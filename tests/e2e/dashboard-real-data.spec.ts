import type { Locator, Page } from "@playwright/test";
import { sql } from "./database";
import { expect, expectIssues, test } from "./fixtures";

// "Comidas de hoy" (specs/dashboard-real-data, US1): the timeline card that replaces the static calorie card.
// Real UI, real routes, real Postgres (the e2e copy); every test sets its meals by SQL and the afterEach puts them back.
// Written before the timeline exists, so every title but the hero-only guard ("Hero selection is unchanged") is red.

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const TODAY = dayKey(new Date());

/* ---------- Data: the e2e copy, changed by SQL and restored after each test ---------- */

const ACTIVE_VERSIONS = "select v.id from plan_versions v join plans p on p.id = v.plan_id where v.is_current and p.status = 'active' and p.deleted_at is null";
const TIMELINE_IDS = "id like 'e2e-tl-%'";
const FIRST_USER = "(select id from users order by seq limit 1)";
const quote = (text: string) => text.replace(/'/g, "''");

function backUp() {
  sql(
    "create table if not exists e2e_tl_logs as select * from daily_logs; create table if not exists e2e_tl_meals as select id, deleted_at from meal_types; create table if not exists e2e_tl_versions as select id, created_at from plan_versions"
  );
}

function restore() {
  if (!sql("select to_regclass('e2e_tl_logs')")) return;
  sql(
    `delete from meal_types where ${TIMELINE_IDS}; update meal_types m set deleted_at = b.deleted_at from e2e_tl_meals b where b.id = m.id; update plan_versions v set created_at = b.created_at from e2e_tl_versions b where b.id = v.id; delete from daily_logs; insert into daily_logs select * from e2e_tl_logs; drop table e2e_tl_logs, e2e_tl_meals, e2e_tl_versions`
  );
}

test.afterEach(() => restore());

type Slot = { name: string; time?: string };

/** The `index`-th meal of a scenario is `e2e-tl-<index>`, in display order index + 1. */
const insertMeal = (slot: Slot, index: number) =>
  sql(
    `insert into meal_types (id, plan_version_id, name, display_order, time_window, created_at) values ('e2e-tl-${index}', (${ACTIVE_VERSIONS} limit 1), '${quote(slot.name)}', ${index + 1}, '${slot.time ?? ""}', now())`
  );

/**
 * The active plan's meals become `slots` (the originals are soft-deleted), `done` of them are checked off today
 * (indexes into `slots`) and the version's created_at is `createdAt` when given. Safe to call again in the same test.
 */
function withMeals(slots: Slot[], { done = [], createdAt }: { done?: number[]; createdAt?: string } = {}) {
  backUp();
  sql(`delete from meal_types where ${TIMELINE_IDS}; update meal_types set deleted_at = null where id in (select id from e2e_tl_meals where deleted_at is null)`);
  sql(`update meal_types set deleted_at = now() where deleted_at is null and plan_version_id in (${ACTIVE_VERSIONS})`);
  slots.forEach(insertMeal);
  const ids = done.map((index) => `e2e-tl-${index}`).join(",");
  sql(
    [
      `delete from daily_logs where date = '${TODAY}'`,
      `insert into daily_logs (id, user_id, date, meals_done, water_glasses, created_at, updated_at) values ('e2e-tl-log', ${FIRST_USER}, '${TODAY}', '{${ids}}', 0, now(), now())`,
      createdAt ? `update plan_versions set created_at = '${createdAt}' where id in (${ACTIVE_VERSIONS})` : "select 1"
    ].join("; ")
  );
}

const FOUR: Slot[] = [
  { name: "Desayuno", time: "07:00" },
  { name: "Colación", time: "10:30" },
  { name: "Comida", time: "14:00" },
  { name: "Cena", time: "20:00" }
];
const mealsDone = () => sql(`select coalesce(array_to_string(meals_done, ','), '') from daily_logs where date = '${TODAY}'`);

/* ---------- Page helpers ---------- */

async function open(page: Page, size?: { width: number; height: number }) {
  if (size) await page.setViewportSize(size);
  await page.goto("/");
  await expect(page.locator(".nt-dash h1")).toHaveText("Dashboard");
  await page.waitForLoadState("networkidle");
}

const list = (page: Page) => page.getByRole("list", { name: "Comidas de hoy", exact: true });
const rows = (page: Page) => list(page).getByRole("button");
const row = (page: Page, name: string | RegExp) => list(page).getByRole("button", typeof name === "string" ? { name, exact: true } : { name });
const hero = (page: Page) => page.locator(".nt-hero-copy h2");
const dots = (page: Page) => page.locator(".nt-pager button");
const markButton = (page: Page) => page.getByRole("button", { name: "Marcar cumplida", exact: true });
const label = (button: Locator) => button.locator(".arc-ab-text");
const region = (page: Page) => page.locator(".nt-hero [role=status]");
const saved = (page: Page) => page.waitForResponse((r) => r.url().includes("/api/daily-logs/") && r.request().method() === "PUT" && r.status() < 400);

/** Every text the hero's status region took, with its time, from now on. Empty texts are kept: `go` says "" when it lands on a pending meal. */
const watchRegion = (page: Page) =>
  page.evaluate(() => {
    const log: { text: string; at: number }[] = [];
    (window as unknown as { __said: typeof log }).__said = log;
    const node = document.querySelector(".nt-hero [role=status]")!;
    new MutationObserver(() => log.push({ text: node.textContent ?? "", at: performance.now() })).observe(node, { childList: true, characterData: true, subtree: true });
  });
const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: { text: string; at: number }[] }).__said);
const saidTexts = async (page: Page) => (await said(page)).map((entry) => entry.text);

async function holdSaves(page: Page, outcome: "pass" | "fail" = "pass") {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/daily-logs/*", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    await gate;
    if (outcome === "fail") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    await route.continue();
  });
  return release;
}

/* ---------- US1: rows, times and states ---------- */

test("Comidas de hoy: rows, times and states", async ({ page }) => {
  const long = "Desayuno con un nombre larguísimo que no cabe en una sola línea";
  expect(long).toHaveLength(63);
  const name60 = long.slice(0, 60);

  // REQ-1, REQ-2: plan order, "HH:MM" as stored, the three states with their word or check.
  withMeals([{ name: "Desayuno", time: "07:00" }, { name: "Comida", time: "14:00" }, { name: "Cena", time: "20:00" }], { done: [0] });
  await open(page);
  await expect(list(page)).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0)).toHaveAccessibleName("07:00, Desayuno, Cumplida");
  await expect(rows(page).nth(1)).toHaveAccessibleName("14:00, Comida, Siguiente");
  await expect(rows(page).nth(2)).toHaveAccessibleName("20:00, Cena, Pendiente");
  const [first, second, third] = [rows(page).nth(0), rows(page).nth(1), rows(page).nth(2)];
  await expect(first.getByText("Cumplida", { exact: true })).toBeVisible();
  await expect(first.locator("svg")).toBeVisible();
  await expect(second.getByText("Siguiente", { exact: true })).toBeVisible();
  await expect(third.getByText("Pendiente", { exact: true })).toBeVisible();
  for (const [index, time] of ["07:00", "14:00", "20:00"].entries()) await expect(rows(page).nth(index).getByText(time, { exact: true })).toBeVisible();

  // REQ-8: the card is "Comidas de hoy" and nothing of the invented calorie card is left.
  const card = page.locator(".nt-today");
  await expect(card.getByRole("heading", { name: "Comidas de hoy", level: 2 })).toBeVisible();
  for (const gone of ["1,850", "+12.8%", "Comidas completadas", "Promedio por comida"]) await expect(card.getByText(gone)).toHaveCount(0);
  await expect(card.getByText("Hoy", { exact: true })).toHaveCount(0);
  await expect(page.locator(".nt-cal, .nt-bars, .nt-hours")).toHaveCount(0);

  // REQ-3: no times at all, then only the second meal with one. Plan order stays either way.
  withMeals([{ name: "Desayuno" }, { name: "Comida" }], { done: [] });
  await open(page);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0)).toHaveAccessibleName("Desayuno, Siguiente");
  await expect(rows(page).nth(1)).toHaveAccessibleName("Comida, Pendiente");
  await expect(list(page)).not.toContainText(/\d{1,2}:\d{2}/);
  withMeals([{ name: "Desayuno" }, { name: "Comida", time: "14:00" }, { name: "Cena" }], { done: [] });
  await open(page);
  await expect(rows(page).nth(0)).toHaveAccessibleName("Desayuno, Siguiente");
  await expect(rows(page).nth(1)).toHaveAccessibleName("14:00, Comida, Pendiente");
  await expect(rows(page).nth(2)).toHaveAccessibleName("Cena, Pendiente");

  // REQ-1: at 360px a 60-character name is cut with an ellipsis; its time and state are whole and nothing scrolls sideways.
  withMeals([{ name: name60, time: "07:00" }, { name: "Cena", time: "20:00" }], { done: [] });
  await open(page, { width: 360, height: 800 });
  const long60 = rows(page).nth(0);
  await expect(long60).toHaveAccessibleName(`07:00, ${name60}, Siguiente`);
  const cut = await long60.getByText(name60, { exact: true }).evaluate((node) => ({ overflow: getComputedStyle(node).textOverflow, clipped: node.scrollWidth > node.clientWidth }));
  expect(cut).toEqual({ overflow: "ellipsis", clipped: true });
  for (const part of [long60.getByText("07:00", { exact: true }), long60.getByText("Siguiente", { exact: true })]) {
    await expect(part).toBeVisible();
    const whole = await part.evaluate((node) => {
      const own = node.getBoundingClientRect();
      const rowBox = node.closest("button")!.getBoundingClientRect();
      return { fits: node.scrollWidth <= node.clientWidth, inside: own.left >= rowBox.left && own.right <= rowBox.right };
    });
    expect(whole).toEqual({ fits: true, inside: true });
  }
  const [pageOverflow, cardOverflow] = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.querySelector(".nt-today")!.scrollWidth - document.querySelector(".nt-today")!.clientWidth]);
  expect(pageOverflow).toBeLessThanOrEqual(0);
  expect(cardOverflow).toBeLessThanOrEqual(1);
});

/* ---------- US1: selection follows the hero ---------- */

test("Comidas de hoy: a row selects the meal in the hero and follows the carousel", async ({ page }) => {
  withMeals(FOUR, { done: [] });
  await open(page);
  await expect(list(page)).toBeVisible();
  const current = list(page).locator("[aria-current=true]");
  const button = markButton(page);

  // REQ-20, REQ-21: one list or tablist is named "Comidas de hoy" (the list); the hero's pager is "Elegir comida".
  const named = { name: "Comidas de hoy", exact: true };
  expect((await page.getByRole("list", named).count()) + (await page.getByRole("tablist", named).count())).toBe(1);
  await expect(page.getByRole("tablist", { name: "Elegir comida" })).toBeVisible();

  // REQ-5: opens on the first pending meal, exactly one row current.
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAccessibleName("07:00, Desayuno, Siguiente");
  await expect(hero(page)).toHaveText("Desayuno");

  // REQ-4: click, Enter and Space show the meal and change no state.
  await row(page, /Comida, Pendiente/).click();
  await expect(hero(page)).toHaveText("Comida");
  await expect(current).toHaveAccessibleName("14:00, Comida, Pendiente");

  // REQ-5: the marker is the current row's inline-start border; a selected Pendiente row keeps its own word.
  const markerWidth = (button: Locator) => button.evaluate((node) => parseFloat(getComputedStyle(node).borderInlineStartWidth));
  expect(await markerWidth(current)).toBeGreaterThan(0);
  await expect(current.getByText("Pendiente", { exact: true })).toBeVisible();
  for (const other of ["07:00, Desayuno, Siguiente", "10:30, Colación, Pendiente", "20:00, Cena, Pendiente"]) expect(await markerWidth(row(page, other))).toBe(0);
  await row(page, /Cena, Pendiente/).focus();
  await page.keyboard.press("Enter");
  await expect(hero(page)).toHaveText("Cena");
  await row(page, /Colación, Pendiente/).focus();
  await page.keyboard.press("Space");
  await expect(hero(page)).toHaveText("Colación");
  await expect(current).toHaveAccessibleName("10:30, Colación, Pendiente");
  await expect(current).toHaveCount(1);
  for (const [index, name] of ["07:00, Desayuno, Siguiente", "10:30, Colación, Pendiente", "14:00, Comida, Pendiente", "20:00, Cena, Pendiente"].entries()) await expect(rows(page).nth(index)).toHaveAccessibleName(name);
  expect(mealsDone()).toBe("");

  // REQ-5: the selected row follows the pager dots and the arrow keys.
  await dots(page).nth(3).click();
  await expect(current).toHaveAccessibleName("20:00, Cena, Pendiente");
  await dots(page).nth(3).focus();
  await page.keyboard.press("ArrowUp");
  await expect(current).toHaveAccessibleName("14:00, Comida, Pendiente");

  // REQ-5: the selected "Siguiente" row shows the word and a heavier name; the others are lighter.
  await dots(page).nth(0).click();
  await expect(current).toHaveAccessibleName("07:00, Desayuno, Siguiente");
  await expect(current.getByText("Siguiente", { exact: true })).toBeVisible();
  const weight = (locator: Locator) => locator.evaluate((node) => Number(getComputedStyle(node).fontWeight));
  const selectedWeight = await weight(current.getByText("Desayuno", { exact: true }));
  expect(selectedWeight).toBeGreaterThanOrEqual(600);
  expect(await weight(row(page, /Comida, Pendiente/).getByText("Comida", { exact: true }))).toBeLessThan(selectedWeight);

  // REQ-20: marking the meal on screen says "Guardando" then "Cumplida", once each; REQ-5: the selection follows the auto-advance at 900 ms.
  await watchRegion(page);
  await page.evaluate(() => {
    const marks: { pressed: number | null; moved: number | null } = { pressed: null, moved: null };
    (window as unknown as { __advance: typeof marks }).__advance = marks;
    const hereButton = document.querySelector(".nt-hero-actions button[aria-pressed]")!;
    const items = document.querySelector("ul[aria-label='Comidas de hoy']")!;
    new MutationObserver(() => {
      if (marks.pressed === null && hereButton.getAttribute("aria-pressed") === "true") marks.pressed = performance.now();
    }).observe(hereButton, { attributes: true, attributeFilter: ["aria-pressed"] });
    new MutationObserver(() => {
      if (marks.pressed !== null && marks.moved === null && items.querySelector("[aria-current=true]")!.getAttribute("aria-label")?.startsWith("10:30")) marks.moved = performance.now();
    }).observe(items, { attributes: true, subtree: true, attributeFilter: ["aria-current"] });
  });
  await Promise.all([saved(page), button.click()]);
  await expect(label(button)).toHaveText("Cumplida");
  await expect(row(page, "07:00, Desayuno, Cumplida")).toBeVisible();
  await expect(row(page, "10:30, Colación, Siguiente")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __advance: { moved: number | null } }).__advance.moved), { timeout: 2000 }).not.toBeNull();
  const { pressed, moved } = await page.evaluate(() => (window as unknown as { __advance: { pressed: number; moved: number } }).__advance);
  expect(moved - pressed).toBeGreaterThanOrEqual(800);
  expect(moved - pressed).toBeLessThanOrEqual(1000);
  await expect(current).toHaveAccessibleName("10:30, Colación, Siguiente");
  // The auto-advance lands on a pending meal, whose `go` clears the region.
  expect(await saidTexts(page)).toEqual(["Guardando", "Cumplida", ""]);

  // REQ-20: activating the done meal's row adds only the hero's own "Cumplida" on reaching it, nothing from the timeline.
  await row(page, "07:00, Desayuno, Cumplida").click();
  await expect(hero(page)).toHaveText("Desayuno");
  await expect.poll(() => saidTexts(page)).toEqual(["Guardando", "Cumplida", "", "Cumplida"]);
  await page.waitForTimeout(300);
  expect(await saidTexts(page)).toEqual(["Guardando", "Cumplida", "", "Cumplida"]);

  // Same row: activating the shown done meal's own row changes nothing and says nothing.
  await row(page, "07:00, Desayuno, Cumplida").click();
  await page.waitForTimeout(300);
  expect(await saidTexts(page)).toEqual(["Guardando", "Cumplida", "", "Cumplida"]);
  await expect(region(page)).toHaveText("Cumplida");
  await expect(current).toHaveAccessibleName("07:00, Desayuno, Cumplida");
  // REQ-5: the cue is independent of state; the selected Cumplida row shows its check and word beside the marker.
  expect(await markerWidth(current)).toBeGreaterThan(0);
  await expect(current.getByText("Cumplida", { exact: true })).toBeVisible();
  await expect(current.locator("svg")).toBeVisible();

  // REQ-23: a click on the shown meal's own row while its auto-advance is pending cancels it.
  await row(page, /Colación, Siguiente/).click();
  await expect(hero(page)).toHaveText("Colación");
  await page.evaluate(() => {
    const hereButton = document.querySelector(".nt-hero-actions button[aria-pressed]")!;
    const own = document.querySelector("ul[aria-label='Comidas de hoy'] [aria-current=true]") as HTMLElement;
    // In the page, in the same task as the "Cumplida" state, so no round trip eats into the 900 ms.
    new MutationObserver((_, observer) => {
      if (hereButton.getAttribute("aria-pressed") !== "true") return;
      observer.disconnect();
      own.click();
    }).observe(hereButton, { attributes: true, attributeFilter: ["aria-pressed"] });
  });
  await Promise.all([saved(page), button.click()]);
  await expect(label(button)).toHaveText("Cumplida");
  await page.waitForTimeout(1500);
  await expect(hero(page)).toHaveText("Colación");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAccessibleName("10:30, Colación, Cumplida");
});

/* ---------- Hero-only guard: passes today and must keep passing through the lift ---------- */

test("Hero selection is unchanged: the active dot re-announces and a stale selection clamps", async ({ page }) => {
  // Gama is done; Alfa (index 0) is the first pending meal, so "keep the index and clamp" differs from "jump to the first pending".
  const three: Slot[] = [{ name: "Alfa", time: "07:00" }, { name: "Beta", time: "14:00" }, { name: "Gama", time: "20:00" }];
  withMeals(three, { done: [2] });
  await open(page);
  await watchRegion(page);
  const selected = page.locator(".nt-pager [aria-selected=true]");

  // Opens on the first pending meal (Alfa). A pending meal's dot says nothing.
  await expect(hero(page)).toHaveText("Alfa");
  await dots(page).nth(1).click();
  await expect(hero(page)).toHaveText("Beta");
  await page.waitForTimeout(300);
  expect(await saidTexts(page)).toEqual([]);

  // REQ-24: a done meal's dot says "Cumplida"; clicking that same active dot clears the region and says it again after about 80 ms.
  await dots(page).nth(2).click();
  await expect(hero(page)).toHaveText("Gama");
  await expect(region(page)).toHaveText("Cumplida");
  await watchRegion(page);
  await dots(page).nth(2).click();
  await expect(region(page)).toHaveText("Cumplida");
  const again = await said(page);
  expect(again.map((entry) => entry.text)).toEqual(["", "Cumplida"]);
  expect(again[1].at - again[0].at).toBeGreaterThanOrEqual(60);
  expect(again[1].at - again[0].at).toBeLessThanOrEqual(400);

  // Stale selection: Beta shown (index 1); Beta goes and Delta is appended, so the same index is Gama (not Alfa, the first pending).
  await dots(page).nth(1).click();
  await expect(hero(page)).toHaveText("Beta");
  sql("update meal_types set deleted_at = now() where id = 'e2e-tl-1'");
  insertMeal({ name: "Delta", time: "21:00" }, 3);
  const saveWeight = async (kg: string) => {
    await page.locator("button.nt-gauge-tile").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Peso de hoy (kg)").fill(kg);
    await Promise.all([page.waitForResponse((r) => r.url().includes("/api/daily-logs/") && r.status() < 400), dialog.getByRole("button", { name: "Guardar" }).click()]);
    await expect(dialog).toBeHidden();
  };
  await saveWeight("71.5");
  await expect(hero(page)).toHaveText("Gama");
  await expect(dots(page)).toHaveCount(3);
  await expect(selected).toHaveCount(1);

  // Delta shown (index 2) and then removed: the selection clamps to the last meal, Gama (not Alfa).
  await dots(page).nth(2).click();
  await expect(hero(page)).toHaveText("Delta");
  sql("update meal_types set deleted_at = now() where id = 'e2e-tl-3'");
  await saveWeight("72.5");
  await expect(hero(page)).toHaveText("Gama");
});

/* ---------- Empty states ---------- */

test("Empty states: no active plan and a plan with no meals", async ({ page }) => {
  // A plan with no meals reads "Tu plan no tiene comidas" and shows no rows.
  withMeals([], { done: [] });
  await open(page);
  const card = page.locator(".nt-today");
  await expect(card).toContainText("Tu plan no tiene comidas");
  await expect(rows(page)).toHaveCount(0);

  // No active plan: "Sin plan activo" and a button (not a link) that opens the upload wizard, no rows, no times.
  const active = sql("select id from plans where status = 'active' and deleted_at is null");
  test.skip(!active, "no active plan to archive");
  const ids = active.split("\n").map((id) => `'${id}'`).join(",");
  sql(`update plans set status = 'archived' where id in (${ids})`);
  try {
    await open(page);
    await expect(card).toContainText("Sin plan activo");
    await expect(card.getByRole("link")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(0);
    await expect(card).not.toContainText(/\d{1,2}:\d{2}/);
    await card.getByRole("button", { name: "Subir plan", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Creación de Plan Nutricional" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar" }).click();
  } finally {
    sql(`update plans set status = 'active' where id in (${ids})`);
  }
});

/* ---------- Failed saves ---------- */

const FAILED_PUT = [/PUT \/api\/daily-logs\/.* → 500/, /Failed to load resource.*500/];
const TOAST = "No se pudo guardar tu registro del día";

test.describe("failed saves", () => {
  test.use({ expectedIssues: expectIssues(...FAILED_PUT) });

  test("Comidas de hoy: rows flip at once and roll back", async ({ page }) => {
    withMeals([{ name: "Desayuno", time: "07:00" }, { name: "Comida", time: "14:00" }, { name: "Cena", time: "20:00" }], { done: [] });
    await open(page);
    await expect(list(page)).toBeVisible();
    const requests: string[] = [];
    page.on("request", (request) => new URL(request.url()).pathname.startsWith("/api/") && requests.push(`${request.method()} ${new URL(request.url()).pathname}`));
    await watchRegion(page);
    const toast = page.locator("section[aria-live]").getByText(TOAST);

    // REQ-6: behind a held request the row already reads Cumplida and Siguiente has moved on.
    const release = await holdSaves(page, "fail");
    await markButton(page).click();
    await expect(row(page, "07:00, Desayuno, Cumplida")).toBeVisible();
    await expect(row(page, "14:00, Comida, Siguiente")).toBeVisible();
    await expect(row(page, "20:00, Cena, Pendiente")).toBeVisible();

    // On the 500 the rows return; the toast shows once inside the live section and the status region stays quiet.
    release();
    await expect(row(page, "07:00, Desayuno, Siguiente")).toBeVisible();
    await expect(row(page, "14:00, Comida, Pendiente")).toBeVisible();
    await expect(toast).toHaveCount(1);
    await page.waitForTimeout(500);
    await expect(toast).toHaveCount(1);
    await expect(region(page)).toHaveText("");
    expect(await saidTexts(page)).toEqual(["Guardando", ""]);
    expect(mealsDone()).toBe("");

    // The check-off sent exactly one request to /api/; activating a row sends none and the list has no check-off control.
    expect(requests).toEqual([expect.stringMatching(/^PUT \/api\/daily-logs\//)]);
    await row(page, /Cena/).click();
    await expect(hero(page)).toHaveText("Cena");
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(1);
    await expect(rows(page)).toHaveCount(3);
    await expect(list(page).locator("[aria-pressed], input, [role=checkbox], [role=switch]")).toHaveCount(0);
  });
});

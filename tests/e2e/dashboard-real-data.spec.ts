import type { Locator, Page } from "@playwright/test";
import { sql } from "./database";
import { expect, expectIssues, test } from "./fixtures";
import { contrast, toRgb } from "./theme-helpers";

// "Comidas de hoy" (specs/dashboard-real-data, US1): the timeline card that replaces the static calorie card.
// Real UI, real routes, real Postgres (the e2e copy); every test sets its meals by SQL and the afterEach puts them back.
// Written before the timeline exists: the US1e titles for overflow, phone and keyboard (T019 to T021) stay red until the
// overflow CSS and MealTimeline behaviour land (T025, T026); the midnight guard (T022) and the earlier US1 titles are green.

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

/* ---------- US1e: overflow, phone, keyboard and midnight (T019 to T021 red until T025/T026; T022 is a green guard) ---------- */

const EIGHT: Slot[] = Array.from({ length: 8 }, (_, index) => ({ name: `Comida ${index + 1}`, time: `${String(7 + index * 2).padStart(2, "0")}:00` }));
const eightRow = (index: number, state: string) => `${EIGHT[index].time}, ${EIGHT[index].name}, ${state}`;
const DESKTOP_SIZES = [{ width: 1440, height: 900 }, { width: 1440, height: 780 }, { width: 1280, height: 768 }, { width: 1920, height: 1080 }, { width: 1920, height: 800 }];
const SHORT_LAPTOP = { width: 1280, height: 768 };
const PHONE = { width: 390, height: 844 };
const ROW_PX = 56;
const MIN_ROW_PX = 44;
const CAP_PX = 336;
const FADE_PX = 16;
/** Soft polls on states the app sets synchronously: a short timeout so one red run does not spend minutes on them. */
const SOFT = { timeout: 1500 };

const card = (page: Page) => page.locator(".nt-today");
const listBox = (page: Page) => list(page).evaluate((node) => node.getBoundingClientRect().toJSON());
const rowHeights = (page: Page) => rows(page).evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
const scrollList = (page: Page, top: number | "end") => list(page).evaluate((node, to) => node.scrollTo({ top: to === "end" ? node.scrollHeight : to, behavior: "instant" }), top);
const listScroll = (page: Page) => list(page).evaluate((node) => ({ top: node.scrollTop, max: node.scrollHeight - node.clientHeight, height: node.clientHeight }));
/** The fade sizes the list currently asks for (spec REQ-7): the plan drives the mask from these two custom properties. */
const fades = (page: Page) =>
  list(page).evaluate((node) => {
    const style = getComputedStyle(node);
    return { top: parseFloat(style.getPropertyValue("--nt-tl-fade-top")), bottom: parseFloat(style.getPropertyValue("--nt-tl-fade-bottom")) };
  });
const activeLabel = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
const pageOverflow = (page: Page) => page.evaluate(() => ({ vertical: document.documentElement.scrollHeight - innerHeight, horizontal: document.documentElement.scrollWidth - innerWidth }));

/** The list's computed edge treatment: its mask, and the 1px divider widths and colour that replace the mask. */
const edgeStyle = (page: Page) =>
  list(page).evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      mask: style.maskImage || style.webkitMaskImage || "none",
      top: parseFloat(style.borderTopWidth) || 0,
      bottom: parseFloat(style.borderBottomWidth) || 0,
      topStyle: style.borderTopStyle,
      bottomStyle: style.borderBottomStyle,
      topColor: style.borderTopColor,
      bottomColor: style.borderBottomColor,
      cardBackground: getComputedStyle(node.closest(".nt-today")!).backgroundColor
    };
  });

/** WCAG contrast of two computed CSS colours; alpha of the foreground is composited on the background. */
async function ratio(page: Page, foreground: string, background: string): Promise<number> {
  const [back, front] = await Promise.all([toRgb(page, background), toRgb(page, foreground)]);
  const mixed = [0, 1, 2].map((i) => front[i] * front[3] + back[i] * (1 - front[3]));
  return contrast([mixed[0], mixed[1], mixed[2], 1], [back[0], back[1], back[2], 1]);
}

/** Colours of one row's parts, as the browser computes them right now. */
const rowColors = (button: Locator) =>
  button.evaluate((node) => {
    const color = (selector: string) => {
      const part = node.querySelector(selector);
      return part ? getComputedStyle(part).color : null;
    };
    const icon = node.querySelector("svg");
    return {
      time: color(".nt-today-time"),
      state: color(".nt-today-state"),
      icon: icon ? getComputedStyle(icon).stroke : null,
      marker: getComputedStyle(node).borderInlineStartColor,
      markerWidth: parseFloat(getComputedStyle(node).borderInlineStartWidth),
      background: getComputedStyle(node).backgroundColor,
      cardBackground: getComputedStyle(node.closest(".nt-today")!).backgroundColor
    };
  });

const ringOf = (button: Locator) =>
  button.evaluate((node) => {
    const style = getComputedStyle(node);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset), color: style.outlineColor, cardBackground: getComputedStyle(node.closest(".nt-today")!).backgroundColor };
  });

/** A system colour as the browser resolves it (for forced colours, where the palette is not ours). */
const systemColor = (page: Page, name: "CanvasText" | "Canvas") =>
  page.evaluate((keyword) => {
    const probe = document.createElement("span");
    probe.style.color = keyword;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, name);

/** Scrollbars and scroll animation settle: the value read twice, 100 ms apart, is the same. */
async function settledScroll(read: () => Promise<number>) {
  let previous = Number.NaN;
  await expect
    .poll(async () => {
      const value = await read();
      const same = value === previous;
      previous = value;
      return same;
    })
    .toBe(true);
  return read();
}

/** In the first animation frame after the next click, what the page and the list had scrolled to. */
const frameAfterNextClick = (page: Page) =>
  page.evaluate(() => {
    const holder = window as unknown as { __frame: { y: number; top: number } | null };
    holder.__frame = null;
    window.addEventListener(
      "click",
      () => requestAnimationFrame(() => (holder.__frame = { y: scrollY, top: document.querySelector("ul[aria-label='Comidas de hoy']")!.scrollTop })),
      { capture: true, once: true }
    );
  });
const readFrame = (page: Page) => page.evaluate(() => (window as unknown as { __frame: { y: number; top: number } | null }).__frame);

test("Comidas de hoy: 8 meals tighten, then scroll with edge fades", async ({ page }) => {
  // REQ-7: 8 meals at 1280×768 cannot fit at 44px, so the list scrolls inside the card with rows of at least 44px.
  withMeals(EIGHT, { done: [] });
  await open(page, SHORT_LAPTOP);
  await expect(rows(page)).toHaveCount(8);
  for (const height of await rowHeights(page)) {
    expect.soft(height, "8 meals: row at least the minimum").toBeGreaterThanOrEqual(MIN_ROW_PX - 0.01);
    expect.soft(height, "8 meals: row at most the default").toBeLessThanOrEqual(ROW_PX + 0.01);
  }
  const scrolling = await list(page).evaluate((node) => ({ overflowY: getComputedStyle(node).overflowY, scrolls: node.scrollHeight > node.clientHeight }));
  expect.soft(["auto", "scroll"], "list overflow-y").toContain(scrolling.overflowY);
  expect.soft(scrolling.scrolls, "8 meals scroll inside the list").toBe(true);
  const eightCard = await card(page).evaluate((node) => node.getBoundingClientRect().toJSON());

  // Every row is reachable by scroll: at the end the last row sits inside the list.
  await scrollList(page, "end");
  const atEnd = await listBox(page);
  const last = await rows(page).nth(7).evaluate((node) => node.getBoundingClientRect().toJSON());
  expect.soft(last.bottom, "last row inside the list at the end").toBeLessThanOrEqual(atEnd.bottom + 1);
  await scrollList(page, 0);

  // Every row is reachable by Tab, and each focused row is whole and clear of the fades (REQ-19).
  await rows(page).nth(0).focus();
  for (let index = 0; index < 8; index++) {
    if (index > 0) await page.keyboard.press("Tab");
    await expect.poll(() => activeLabel(page)).toMatch(new RegExp(`^${EIGHT[index].time}, ${EIGHT[index].name}, `));
    await expect.soft.poll(async () => {
      const [box, within, fade] = await Promise.all([rows(page).nth(index).evaluate((node) => node.getBoundingClientRect().toJSON()), listBox(page), fades(page)]);
      return box.top >= within.top + (fade.top || 0) - 1 && box.bottom <= within.bottom - (fade.bottom || 0) + 1;
    }, { message: `row ${index + 1} clear of the list edges and its fades`, ...SOFT }).toBe(true);
  }

  // Edge fades: a bottom fade until the end, both in between, and a top fade at the end.
  await scrollList(page, 0);
  await expect.soft.poll(() => fades(page), SOFT).toEqual({ top: 0, bottom: FADE_PX });
  const { max } = await listScroll(page);
  await scrollList(page, Math.round(max / 2));
  await expect.soft.poll(() => fades(page), SOFT).toEqual({ top: FADE_PX, bottom: FADE_PX });
  await scrollList(page, "end");
  await expect.soft.poll(() => fades(page), SOFT).toEqual({ top: FADE_PX, bottom: 0 });

  // The fade is a mask and catches no pointer: at a faded edge the pointer lands on a row of the list.
  await scrollList(page, Math.round(max / 2));
  const hit = await list(page).evaluate((node) => {
    const box = node.getBoundingClientRect();
    // The middle of the first and last visible rows, so a gap between rows cannot yield the list itself.
    const visible = [...node.querySelectorAll("button")].map((button) => button.getBoundingClientRect()).filter((rect) => rect.bottom > box.top && rect.top < box.bottom);
    const edges = [visible[0], visible.at(-1)!];
    return edges.map((rect) => document.elementFromPoint(box.left + box.width / 2, Math.min(Math.max(rect.top + rect.height / 2, box.top + 1), box.bottom - 1))?.closest("button")?.getAttribute("aria-label") ?? null);
  });
  for (const found of hit) expect.soft(found, "pointer lands on a row at a faded edge").toMatch(/^\d\d:00, Comida \d, /);
  await expect.soft(list(page)).not.toHaveCSS("pointer-events", "none");
  const normal = await edgeStyle(page);
  expect.soft(normal.mask, "mask while fading").not.toBe("none");
  expect.soft([normal.top, normal.bottom], "no dividers while fading").toEqual([0, 0]);

  // Reduced motion: the fade changes without a transition, and so does the list that carries it (also with normal motion).
  for (const motion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    const durations = await list(page).evaluate((node) => getComputedStyle(node).transitionDuration.split(",").map((value) => parseFloat(value) * (value.trim().endsWith("ms") ? 0.001 : 1)));
    expect.soft(durations.every((seconds) => seconds === 0), `${motion}: list transition durations ${durations}`).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: null });

  // The page never gets a scrollbar at the five desktop sizes with 8 meals.
  for (const size of DESKTOP_SIZES) {
    await open(page, size);
    await expect(rows(page)).toHaveCount(8);
    const overflow = await pageOverflow(page);
    expect.soft(overflow.vertical, `vertical page scroll at ${size.width}×${size.height}`).toBeLessThanOrEqual(0);
    expect.soft(overflow.horizontal, `horizontal page scroll at ${size.width}×${size.height}`).toBeLessThanOrEqual(0);
  }

  // Tighten: 4 meals at 1440×900 do not fit at 56px but do at about 48.6px (plan, Measurements), so rows shrink evenly and the list does not scroll.
  withMeals(FOUR, { done: [] });
  await open(page, { width: 1440, height: 900 });
  await expect(rows(page)).toHaveCount(4);
  const tight = await rowHeights(page);
  for (const height of tight) {
    expect.soft(height, "4 meals at 1440×900: tightened below the default").toBeLessThan(ROW_PX - 0.5);
    expect.soft(height, "4 meals at 1440×900: above the minimum").toBeGreaterThan(MIN_ROW_PX + 0.5);
  }
  expect.soft(Math.max(...tight) - Math.min(...tight), "4 meals: rows shrink evenly").toBeLessThanOrEqual(0.5);
  const fits = await listScroll(page);
  expect.soft(fits.max, "4 meals at 1440×900 do not scroll").toBeLessThanOrEqual(1);

  // 1 meal: the row keeps the default height and the card its size.
  withMeals([{ name: "Desayuno", time: "07:00" }], { done: [] });
  await open(page, SHORT_LAPTOP);
  await expect(rows(page)).toHaveCount(1);
  expect((await rowHeights(page))[0]).toBeCloseTo(ROW_PX, 0);
  const oneCard = await card(page).evaluate((node) => node.getBoundingClientRect().toJSON());
  expect(oneCard.height).toBeCloseTo(eightCard.height, 0);
  expect(oneCard.width).toBeCloseTo(eightCard.width, 0);

  // At 390×844 the list is capped at 6 rows of 56px with 8 meals, and 3 meals take their own 3 rows.
  withMeals(EIGHT, { done: [] });
  await open(page, PHONE);
  await expect(rows(page)).toHaveCount(8);
  const capped = await listScroll(page);
  expect.soft(capped.height, "8 meals at 390: capped").toBeCloseTo(CAP_PX, 0);
  expect.soft(capped.max, "8 meals at 390 scroll").toBeGreaterThan(0);
  withMeals(EIGHT.slice(0, 3), { done: [] });
  await open(page, PHONE);
  expect.soft((await listScroll(page)).height, "3 meals at 390: own rows").toBeCloseTo(3 * ROW_PX, 0);

  // From 938px to 1279px the page scrolls, so the list has its own height: the cap with 8 meals, its own rows with 3, and the list adds no page scroll of its own.
  for (const size of [{ width: 938, height: 900 }, { width: 1100, height: 900 }]) {
    const at = `${size.width}×${size.height}`;
    withMeals(EIGHT, { done: [] });
    await open(page, size);
    await expect(rows(page)).toHaveCount(8);
    const eightList = await listScroll(page);
    const eightPage = await pageOverflow(page);
    expect.soft(eightList.height, `${at}: 8 meals capped`).toBeCloseTo(CAP_PX, 0);
    expect.soft(eightList.max, `${at}: 8 meals scroll in the list`).toBeGreaterThan(0);
    expect.soft(eightPage.horizontal, `${at}: no horizontal page scroll`).toBeLessThanOrEqual(0);
    withMeals(EIGHT.slice(0, 3), { done: [] });
    await open(page, size);
    await expect(rows(page)).toHaveCount(3);
    const threeList = await listScroll(page);
    const threePage = await pageOverflow(page);
    expect.soft(threeList.height, `${at}: 3 meals take their own rows`).toBeCloseTo(3 * ROW_PX, 0);
    // The page may scroll here, but only by what the list's height adds; the extra rows themselves are not page content.
    expect.soft(eightPage.vertical - threePage.vertical, `${at}: page growth from 3 to 8 meals is at most the cap's extra height`).toBeLessThanOrEqual(CAP_PX - 3 * ROW_PX + 1);
  }

  // Reduced transparency (CDP), more contrast and forced colours replace the fade with a 1px divider of 3:1 on the faded edges.
  withMeals(EIGHT, { done: [] });
  await open(page, SHORT_LAPTOP);
  const client = await page.context().newCDPSession(page);
  const modes: { name: string; apply: () => Promise<void>; undo: () => Promise<void>; background: () => Promise<string | null> }[] = [
    {
      name: "reduced transparency",
      apply: () => client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] }).then(() => undefined),
      undo: () => client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "no-preference" }] }).then(() => undefined),
      background: async () => null
    },
    { name: "more contrast", apply: () => page.emulateMedia({ contrast: "more" }), undo: () => page.emulateMedia({ contrast: null }), background: async () => null },
    { name: "forced colours", apply: () => page.emulateMedia({ forcedColors: "active" }), undo: () => page.emulateMedia({ forcedColors: null }), background: () => systemColor(page, "Canvas") }
  ];
  for (const mode of modes) {
    await mode.apply();
    await scrollList(page, 0);
    await expect.soft.poll(async () => (await edgeStyle(page)).mask, { message: `${mode.name}: no mask`, ...SOFT }).toBe("none");
    // At the start only the bottom edge hides rows; at the end only the top edge does.
    await expect.soft.poll(async () => { const edges = await edgeStyle(page); return [edges.top, edges.bottom]; }, { message: `${mode.name} at the start`, ...SOFT }).toEqual([0, 1]);
    const edges = await edgeStyle(page);
    const background = (await mode.background()) ?? edges.cardBackground;
    expect.soft(edges.bottomStyle, `${mode.name}: divider style`).toBe("solid");
    expect.soft(await ratio(page, edges.bottomColor, background), `${mode.name}: divider contrast`).toBeGreaterThanOrEqual(3);
    await scrollList(page, "end");
    await expect.soft.poll(async () => { const now = await edgeStyle(page); return [now.top, now.bottom]; }, { message: `${mode.name} at the end`, ...SOFT }).toEqual([1, 0]);
    const end = await edgeStyle(page);
    expect.soft(end.topStyle, `${mode.name}: top divider style`).toBe("solid");
    expect.soft(await ratio(page, end.topColor, background), `${mode.name}: divider contrast at the top`).toBeGreaterThanOrEqual(3);
    await mode.undo();
  }
});

test("Comidas de hoy: phone row tap brings the hero below the top bar; desktop only scrolls the list", async ({ page }) => {
  withMeals(EIGHT, { done: [] });

  // REQ-9 at 390px: with the page scrolled down to the rows, a row activation brings the hero's top edge to the top bar's bottom edge.
  await open(page, PHONE);
  await expect(rows(page)).toHaveCount(8);
  // The bar is static on a phone and scrolls away; then the hero must come to the very top. A sticky bar would be the target instead.
  const heroGap = () =>
    page.evaluate(() => {
      const bar = document.querySelector(".nt-topbar")!.getBoundingClientRect();
      const top = document.querySelector(".nt-hero")!.getBoundingClientRect().top;
      return top - Math.max(bar.bottom, 0);
    });
  const toRows = () => page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await toRows();
  expect(await heroGap(), "hero is out of view before the tap").toBeLessThan(-100);
  await row(page, eightRow(4, "Pendiente")).click();
  await expect(hero(page)).toHaveText("Comida 5");
  await expect.poll(heroGap, "hero top at or just below the top bar").toBeGreaterThanOrEqual(-1);
  await expect.poll(heroGap).toBeLessThanOrEqual(24);
  expect(await activeLabel(page), "focus stays on the row").toBe(eightRow(4, "Pendiente"));

  // Under reduced motion the page is already at its final scroll in the first animation frame.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, PHONE);
  await toRows();
  await frameAfterNextClick(page);
  await row(page, eightRow(2, "Pendiente")).click();
  await expect(hero(page)).toHaveText("Comida 3");
  const finalY = await settledScroll(() => page.evaluate(() => scrollY));
  expect(finalY, "the page scrolled to the hero").toBeGreaterThan(0);
  expect(await readFrame(page), "first frame after the tap").toMatchObject({ y: finalY });
  expect(await heroGap()).toBeGreaterThanOrEqual(-1);
  expect(await heroGap()).toBeLessThanOrEqual(24);
  expect(await activeLabel(page)).toBe(eightRow(2, "Pendiente"));
  await page.emulateMedia({ reducedMotion: null });

  // REQ-9 at 938px and up: a row activation leaves the page's scroll position alone.
  await open(page, { width: 1100, height: 700 });
  const reach = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(reach, "the page scrolls at 1100×700").toBeGreaterThan(40);
  // Bring the row into view first, so it is the app and not Playwright's click that could move the page.
  await rows(page).nth(3).scrollIntoViewIfNeeded();
  const scrolledTo = await settledScroll(() => page.evaluate(() => scrollY));
  expect(scrolledTo, "the page is scrolled before the tap").toBeGreaterThan(0);
  await row(page, eightRow(3, "Pendiente")).click();
  await expect(hero(page)).toHaveText("Comida 4");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => scrollY)).toBe(scrolledTo);

  // REQ-5: with the page not scrolled, selecting meal 8 moves only the list.
  await open(page, SHORT_LAPTOP);
  const before = await listScroll(page);
  expect(before.max).toBeGreaterThan(0);
  expect(before.top).toBe(0);
  await dots(page).nth(7).click();
  await expect(hero(page)).toHaveText("Comida 8");
  const lastTop = await settledScroll(() => list(page).evaluate((node) => node.scrollTop));
  expect(lastTop, "the list scrolled to meal 8").toBeGreaterThan(0);
  const moved = await rows(page).nth(7).evaluate((node) => {
    const own = node.getBoundingClientRect();
    const frame = node.closest("ul")!.getBoundingClientRect();
    const scrolled: number[] = [];
    for (let up: HTMLElement | null = node.closest("ul")!.parentElement; up; up = up.parentElement) if (up.scrollTop) scrolled.push(up.scrollTop);
    return { visible: own.top >= frame.top - 1 && own.bottom <= frame.bottom + 1, pageY: scrollY, scrolled };
  });
  expect(moved).toEqual({ visible: true, pageY: 0, scrolled: [] });

  // Reduced motion: the list is already where it ends up in the first frame after the selection (no smooth scroll).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, SHORT_LAPTOP);
  await frameAfterNextClick(page);
  await dots(page).nth(7).click();
  await expect(hero(page)).toHaveText("Comida 8");
  const finalTop = await settledScroll(() => list(page).evaluate((node) => node.scrollTop));
  expect(finalTop).toBeGreaterThan(0);
  expect(await readFrame(page), "first frame after the selection").toEqual({ y: 0, top: finalTop });
});

test("Comidas de hoy: keyboard path, focus, hover, contrast, forced colours", async ({ page }) => {
  withMeals(FOUR, { done: [0] });
  await open(page);
  await expect(rows(page)).toHaveCount(4);

  // REQ-19: Tab goes hero controls, then Métricas, then the rows in plan order, then past the counts card (which has no stop here).
  await expect(page.locator(".nt-comp").locator("a, button, input, select, textarea, [tabindex]:not([tabindex='-1'])")).toHaveCount(0);
  await page.locator(".nt-hero button").first().focus();
  const stops: string[] = [];
  const labels: string[] = [];
  for (let step = 0; step < 60; step++) {
    const where = await page.evaluate(() => {
      const node = document.activeElement as HTMLElement;
      const region = node.closest(".nt-hero") ? "hero" : node.closest(".nt-metrics") ? "metrics" : node.closest(".nt-today") ? "today" : node.closest(".nt-comp") ? "comp" : node.closest(".nt-kpi") ? "kpi" : "other";
      return { region, label: region === "today" ? node.getAttribute("aria-label") : null };
    });
    if (where.label) labels.push(where.label);
    if (stops.at(-1) !== where.region) stops.push(where.region);
    if (labels.length === 4 && where.region !== "today") break;
    await page.keyboard.press("Tab");
  }
  expect(stops.filter((region) => region !== "kpi" && region !== "other")).toEqual(["hero", "metrics", "today"]);
  expect(labels).toEqual(["07:00, Desayuno, Cumplida", "10:30, Colación, Siguiente", "14:00, Comida, Pendiente", "20:00, Cena, Pendiente"]);

  // REQ-19: marking meal 3 in the hero keeps focus on row 3 and the list where it is.
  withMeals(EIGHT, { done: [] });
  await open(page, SHORT_LAPTOP);
  await scrollList(page, "end");
  await rows(page).nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(hero(page)).toHaveText("Comida 3");
  // The read deliberately precedes the 900 ms auto-advance after a check-off, so it is the position before any move.
  const rest = await settledScroll(() => list(page).evaluate((node) => node.scrollTop));
  // A script click isolates the invariant (a check-off must not move focus or the list): a real click would focus the hero button.
  await Promise.all([saved(page), markButton(page).evaluate((node: HTMLElement) => node.click())]);
  await expect(label(markButton(page))).toHaveText("Cumplida");
  expect(await activeLabel(page)).toBe(eightRow(2, "Cumplida"));
  expect(await list(page).evaluate((node) => node.scrollTop), "the list did not jump").toBe(rest);

  // REQ-19: the row-6 ring is whole, inside the list and clear of both fades.
  await open(page, SHORT_LAPTOP);
  await rows(page).nth(4).focus();
  await page.keyboard.press("Tab");
  await expect.poll(() => activeLabel(page)).toBe(eightRow(5, "Pendiente"));
  const six = rows(page).nth(5);
  await expect.soft.poll(() => fades(page), SOFT).toEqual({ top: FADE_PX, bottom: FADE_PX });
  const ring = await ringOf(six);
  expect.soft(ring.style, "row-6 ring style").not.toBe("none");
  expect.soft(ring.width, "row-6 ring width").toBeGreaterThanOrEqual(2);
  // Where the ring is actually drawn: the row box grown by the outline offset plus its width. The list clips it and the fades cover its edges.
  const [sixBox, frame] = await Promise.all([six.evaluate((node) => node.getBoundingClientRect().toJSON()), listBox(page)]);
  const reach = ring.style === "none" ? 0 : ring.width + ring.offset;
  expect.soft(sixBox.top - reach, "ring top clear of the top fade").toBeGreaterThanOrEqual(frame.top + FADE_PX - 1);
  expect.soft(sixBox.bottom + reach, "ring bottom clear of the bottom fade").toBeLessThanOrEqual(frame.bottom - FADE_PX + 1);
  expect.soft(sixBox.left - reach, "ring left inside the list").toBeGreaterThanOrEqual(frame.left - 0.5);
  expect.soft(sixBox.right + reach, "ring right inside the list").toBeLessThanOrEqual(frame.right + 0.5);

  // REQ-18: hover shows within 150 ms with normal motion, and instantly with no transform under reduced motion.
  withMeals(FOUR, { done: [0] });
  await open(page);
  const target = row(page, "14:00, Comida, Pendiente");
  const paint = (button: Locator) => button.evaluate((node) => ({ background: getComputedStyle(node).backgroundColor, transform: getComputedStyle(node).transform, durations: getComputedStyle(node).transitionDuration }));
  const hoverBackground = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--nt-yellow-hover)";
    document.querySelector(".nt-today")!.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  });
  for (const motion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await page.mouse.move(0, 0);
    const resting = (await paint(target)).background;
    await target.hover();
    await expect.poll(async () => (await paint(target)).background, { timeout: 400 }).toBe(hoverBackground);
    expect(resting).not.toBe(hoverBackground);
    const after = await paint(target);
    expect(after.transform, `${motion}: no transform`).toBe("none");
    const seconds = after.durations.split(",").map((value) => parseFloat(value) * (value.trim().endsWith("ms") ? 0.001 : 1));
    if (motion === "reduce") expect(seconds.every((value) => value === 0), `reduce: transition durations ${seconds}`).toBe(true);
    else {
      expect(Math.max(...seconds), "normal motion: a transition of at most 150 ms").toBeLessThanOrEqual(0.15);
      expect(Math.max(...seconds), "normal motion: some transition").toBeGreaterThan(0);
    }
  }
  await page.emulateMedia({ reducedMotion: null });

  // REQ-18, NFR: contrast of text, icons, marker and ring in both themes; the ring also on the selected row and while hovered.
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // The app follows the system scheme: wait until it has really switched before reading any colour.
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), { message: `html color-scheme is ${scheme}` }).toBe(scheme);
    await page.mouse.move(0, 0);
    const selected = row(page, "10:30, Colación, Siguiente");
    const colors = await rowColors(selected);
    expect.soft(colors.markerWidth, `${scheme}: marker`).toBeGreaterThan(0);
    expect.soft(await ratio(page, colors.marker, colors.cardBackground), `${scheme}: marker`).toBeGreaterThanOrEqual(3);
    const next = await selected.evaluate((node) => {
      const pill = node.querySelector(".nt-today-pill")!;
      return { color: getComputedStyle(pill).color, background: getComputedStyle(pill).backgroundColor };
    });
    expect.soft(await ratio(page, next.color, next.background), `${scheme}: "Siguiente" pill`).toBeGreaterThanOrEqual(4.5);
    const done = await rowColors(row(page, "07:00, Desayuno, Cumplida"));
    expect.soft(await ratio(page, done.icon!, done.cardBackground), `${scheme}: check icon`).toBeGreaterThanOrEqual(3);
    expect.soft(await ratio(page, done.time!, done.cardBackground), `${scheme}: time`).toBeGreaterThanOrEqual(4.5);
    expect.soft(await ratio(page, done.state!, done.cardBackground), `${scheme}: "Cumplida"`).toBeGreaterThanOrEqual(4.5);
    const pending = await rowColors(target);
    expect.soft(await ratio(page, pending.time!, pending.cardBackground), `${scheme}: pending time`).toBeGreaterThanOrEqual(4.5);
    expect.soft(await ratio(page, pending.state!, pending.cardBackground), `${scheme}: "Pendiente"`).toBeGreaterThanOrEqual(4.5);
    await target.hover();
    await expect.poll(async () => (await paint(target)).background, { timeout: 400 }).toBe(hoverBackground);
    const hovered = await rowColors(target);
    expect.soft(await ratio(page, hovered.time!, hovered.background), `${scheme}: time on hover`).toBeGreaterThanOrEqual(4.5);
    expect.soft(await ratio(page, hovered.state!, hovered.background), `${scheme}: "Pendiente" on hover`).toBeGreaterThanOrEqual(4.5);
    await page.mouse.move(0, 0);

    // The ring on the selected row and on a plain one, by keyboard; hover does not replace it.
    await selected.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(() => activeLabel(page)).toBe("10:30, Colación, Siguiente");
    for (const [button, name] of [[selected, "selected"], [target, "plain"]] as const) {
      if (name === "plain") {
        await page.keyboard.press("Tab");
        await expect.poll(() => activeLabel(page)).toBe("14:00, Comida, Pendiente");
      }
      const focus = await ringOf(button);
      expect.soft(focus.style, `${scheme} ${name}: ring`).not.toBe("none");
      expect.soft(focus.width, `${scheme} ${name}: ring width`).toBeGreaterThanOrEqual(2);
      expect.soft(await ratio(page, focus.color, focus.cardBackground), `${scheme} ${name} row: ring contrast`).toBeGreaterThanOrEqual(3);
      await button.hover();
      expect.soft((await ringOf(button)).style, `${scheme} ${name}: ring while hovered`).not.toBe("none");
      await page.mouse.move(0, 0);
    }
  }
  await page.emulateMedia({ colorScheme: null });

  // Forced colours: rows, check icon, the selected cue and the ring all stay visible, drawn in system colours.
  await page.emulateMedia({ forcedColors: "active" });
  const [canvas, canvasText] = [await systemColor(page, "Canvas"), await systemColor(page, "CanvasText")];
  for (let index = 0; index < 4; index++) await expect(rows(page).nth(index)).toBeVisible();
  const forced = await rowColors(row(page, "10:30, Colación, Siguiente"));
  expect.soft(forced.markerWidth, "forced: marker width").toBeGreaterThan(0);
  expect.soft(forced.marker, "selected marker in CanvasText").toBe(canvasText);
  const forcedDone = await rowColors(row(page, "07:00, Desayuno, Cumplida"));
  expect.soft(await ratio(page, forcedDone.icon!, canvas), "check icon against Canvas").toBeGreaterThanOrEqual(3);
  expect.soft(await ratio(page, forcedDone.state!, canvas), "words against Canvas").toBeGreaterThanOrEqual(4.5);
  const forcedNext = await row(page, "10:30, Colación, Siguiente").locator(".nt-today-pill").evaluate((node) => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
  expect.soft(await ratio(page, forcedNext.color, forcedNext.background === "rgba(0, 0, 0, 0)" ? canvas : forcedNext.background), "the cue word stays readable").toBeGreaterThanOrEqual(4.5);
  await row(page, "10:30, Colación, Siguiente").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const forcedRing = await ringOf(row(page, "10:30, Colación, Siguiente"));
  expect.soft(forcedRing.style, "forced: ring style").not.toBe("none");
  expect.soft(forcedRing.width, "forced: ring width").toBeGreaterThanOrEqual(2);
  expect.soft(await ratio(page, forcedRing.color, canvas), "ring against Canvas").toBeGreaterThanOrEqual(3);
});

test.describe("midnight", () => {
  test.use({ expectedIssues: expectIssues(...FAILED_PUT) });

  test("Midnight: rows reset on focus; an in-flight save settles against its day", async ({ page }) => {
    const DAY = 86_400_000;
    const start = Date.now();
    // `days` after the test began; the page clock is separate from this process's, so it is always set from `start`.
    const midnight = async (days: number) => {
      await page.clock.setSystemTime(new Date(start + days * DAY));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    };

    // The rows follow the new day: every Cumplida becomes Pendiente, the first is Siguiente and the selected row stays.
    withMeals(FOUR, { done: [0, 1] });
    await open(page);
    // The page loaded before the clock is installed, so server and client agree on the date during hydration.
    await page.clock.install({ time: new Date() });
    await row(page, /Cena, Pendiente/).click();
    await expect(hero(page)).toHaveText("Cena");
    await expect(row(page, "07:00, Desayuno, Cumplida")).toBeVisible();
    await expect(row(page, "10:30, Colación, Cumplida")).toBeVisible();
    await expect(row(page, "14:00, Comida, Siguiente")).toBeVisible();
    await midnight(1);
    await expect(row(page, "07:00, Desayuno, Siguiente")).toBeVisible();
    await expect(row(page, "10:30, Colación, Pendiente")).toBeVisible();
    await expect(row(page, "14:00, Comida, Pendiente")).toBeVisible();
    await expect(row(page, "20:00, Cena, Pendiente")).toBeVisible();
    await expect(list(page).getByText("Cumplida")).toHaveCount(0);
    await expect(list(page).locator("[aria-current=true]")).toHaveAccessibleName("20:00, Cena, Pendiente");
    await expect(hero(page)).toHaveText("Cena");
    await midnight(0);
    await expect(row(page, "07:00, Desayuno, Cumplida")).toBeVisible();

    // A check-off held across midnight and then refused: yesterday's meal comes back unchecked, today's rows are not touched.
    withMeals(FOUR, { done: [] });
    await open(page);
    await page.clock.install({ time: new Date() });
    const release = await holdSaves(page, "fail");
    await markButton(page).click();
    await expect(row(page, "07:00, Desayuno, Cumplida")).toBeVisible();
    await midnight(1);
    // The held mark belongs to yesterday: the new day starts with nothing done.
    await expect(row(page, "07:00, Desayuno, Siguiente")).toBeVisible();
    await expect(list(page).getByText("Cumplida")).toHaveCount(0);
    release();
    await expect(page.locator("section[aria-live]").getByText(TOAST)).toHaveCount(1);
    await expect(row(page, "07:00, Desayuno, Siguiente")).toBeVisible();
    for (const [index, name] of ["07:00, Desayuno, Siguiente", "10:30, Colación, Pendiente", "14:00, Comida, Pendiente", "20:00, Cena, Pendiente"].entries()) await expect(rows(page).nth(index)).toHaveAccessibleName(name);
    // Back on yesterday, the rollback is there: the meal is unchecked again.
    await midnight(0);
    await expect(row(page, "07:00, Desayuno, Siguiente")).toBeVisible();
    await expect(list(page).getByText("Cumplida")).toHaveCount(0);
    expect(mealsDone()).toBe("");
  });
});

import type { Locator, Page } from "@playwright/test";
import { sql } from "./database";
import { expect, expectIssues, test } from "./fixtures";

// The redesigned dashboard (specs/alt-dashboard/plan.md), end to end: real UI, real API routes, real Postgres (the e2e copy).
// Follows the plan's QA checklist (§7).

test.describe.configure({ mode: "serial" });

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const TODAY = dayKey(new Date());
const count = (query: string) => Number(sql(query) || 0);
const mealsDone = () => count(`select coalesce(array_length(meals_done, 1), 0) from daily_logs where date = '${TODAY}'`);
const SHOTS = "specs/alt-dashboard/screenshots";

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.locator(".nt-dash h1")).toHaveText("Dashboard");
}

test.beforeEach(async ({ page }) => openHome(page));

test("top bar: order of §5.1, visual-only buttons labelled, profile at the right end", async ({ page }) => {
  const bar = page.locator(".nt-topbar");
  const order = await bar.evaluate((node) => [...node.children].map((child) => child.className.split(" ")[0]));
  expect(order).toEqual(["nt-brand", "nt-search", "nt-chef", "nt-cta", "nt-tools", "nt-profile"]);
  // Chef's selection + "Procesar plan" are centred between the search and the alerts button.
  const box = async (selector: string) => (await bar.locator(selector).boundingBox())!;
  const [search, chef, cta, tools] = [await box(".nt-search"), await box(".nt-chef"), await box(".nt-cta"), await box(".nt-tools")];
  expect(Math.abs(chef.x - (search.x + search.width) - (tools.x - (cta.x + cta.width)))).toBeLessThanOrEqual(2);
  await expect(bar.locator(".nt-brand")).toContainText("NUTRIO");
  await expect(bar.getByPlaceholder("Buscar recetas, planes, ingredientes…")).toBeVisible();
  await expect(bar.locator(".nt-chef")).toContainText("Chef's selection");
  for (const label of ["Alertas", "Notas", "Bandeja de entrada"]) await expect(bar.getByRole("button", { name: label, exact: true })).toBeVisible();
  await expect(bar.locator(".nt-badge")).toHaveText("12");

  await bar.locator(".nt-profile-btn").click();
  const menu = page.getByRole("menu", { name: "Cuenta" });
  await expect(menu.getByRole("menuitem", { name: "Papelera" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Cerrar sesión" })).toBeVisible();
  await expect(menu.locator(".theme-toggle")).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test('"Procesar plan" opens the upload wizard', async ({ page }) => {
  await page.getByRole("button", { name: "Procesar plan" }).click();
  await expect(page.getByRole("heading", { name: "Creación de Plan Nutricional" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
});

test("sidebar: six buttons in the order of §5.2, routes work, HOY is gone", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Principal" });
  const labels = await nav.locator(".nt-icon-btn").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  // The theme switch sits right above Configuración.
  expect(labels.map((label) => (label?.startsWith("Cambiar a tema") ? "Tema" : label))).toEqual(["Inicio", "Planes", "Recetario", "Compras", "Análisis", "Tema", "Configuración"]);
  await expect(nav.locator(".theme-toggle")).toBeVisible();
  // Navigation is centred vertically; the theme switch and Configuración sit at the bottom of the column.
  const [column, main, foot] = await Promise.all([".nt-sidebar", ".nt-side-main", ".nt-side-foot"].map(async (selector) => (await page.locator(selector).boundingBox())!));
  expect(column.y + column.height - (foot.y + foot.height)).toBeLessThanOrEqual(40);
  expect(main.y + main.height).toBeLessThan(foot.y);
  await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("HOY", { exact: true })).toHaveCount(0);

  for (const [label, path] of [["Planes", "/plans"], ["Recetario", "/recipes"], ["Compras", "/groceries"], ["Configuración", "/settings"]] as const) {
    // Enter instead of a click: in dev the Next.js indicator sits over the bottom-left corner, where Configuración is.
    await nav.getByRole("link", { name: label }).press("Enter");
    await page.waitForURL(`**${path}`);
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
  // Análisis is visual only: nothing happens.
  await nav.getByRole("button", { name: "Análisis" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await nav.getByRole("link", { name: "Inicio" }).press("Enter");
  await page.waitForURL((url) => url.pathname === "/");
});

// A zero shows as one dash for the eye and as "0" for assistive tech; any other number is padded to two digits.
const kpiText = (value: number) => (value === 0 ? "0" : String(value).padStart(2, "0"));

test("KPI tiles show real counts with at least two digits", async ({ page }) => {
  const plans = count("select count(*) from plans where deleted_at is null");
  // The Recetario's rule: a recipe has more than one live ingredient row.
  const recipes = count("select count(*) from recipes r where r.deleted_at is null and (select count(*) from ingredient_usages u where u.source_type = 'recipe' and u.source_id = r.id and u.deleted_at is null) > 1");
  const tiles = page.locator(".nt-kpi");
  await expect(tiles.locator(".nt-kpi-label")).toHaveText(["Comidas", "Planes", "Recetas", "Compras"]);
  await expect(tiles.nth(1).locator(".nt-roll")).toHaveText(kpiText(plans));
  await expect(tiles.nth(2).locator(".nt-roll")).toHaveText(kpiText(recipes));
  // The accessible text is the padded number (or 0 behind the dash), not the glyphs of the digit columns.
  for (const text of await tiles.locator(".nt-roll").allTextContents()) expect(text).toMatch(/^(\d{2,}|0)$/);
  // Comidas is how many of today's meals are marked done.
  const doneIds = sql(`select array_to_string(meals_done, ',') from daily_logs where date = '${TODAY}'`).split(",");
  await expect(tiles.nth(0).locator(".nt-roll")).toHaveText(kpiText(slotIds().filter((id) => doneIds.includes(id)).length));
  for (const context of await tiles.locator(".nt-kpi-context").allTextContents()) expect(context.length).toBeGreaterThan(0);
  // Planes says since when the active plan exists, and keeps its full name for hover.
  const planContext = tiles.nth(1).locator(".nt-kpi-context");
  if (plans === 0) await expect(planContext).toHaveText("sin planes");
  else if (!sql("select id from plans where status = 'active' and deleted_at is null")) await expect(planContext).toHaveText("sin plan activo");
  else {
    await expect(planContext).toHaveText(/^desde (\d{1,2} [a-z]{3}|[a-z]{3} \d{4})$/);
    await expect(planContext).toHaveAttribute("title", sql("select name from plans where status = 'active' and deleted_at is null order by seq limit 1"));
  }
});

const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)).then(() => undefined));
const style = (tile: Locator, selector: string | null, property: string) =>
  (selector ? tile.locator(selector) : tile).evaluate((node, name) => getComputedStyle(node).getPropertyValue(name), property);

test("KPI tiles pop in one after another, then rest fully visible", async ({ page }) => {
  const tiles = page.locator(".nt-kpi");
  await expect(tiles).toHaveCount(4);
  const declared = await tiles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const css = getComputedStyle(node);
      return { name: css.animationName, delay: parseFloat(css.animationDelay) * 1000, duration: parseFloat(css.animationDuration) * 1000 };
    })
  );
  for (const tile of declared) {
    expect(tile.name).toBe("nt-kpi-in");
    expect(tile.duration).toBeGreaterThanOrEqual(400);
    expect(tile.duration).toBeLessThanOrEqual(500);
  }
  const delays = declared.map((tile) => tile.delay);
  delays.forEach((delay, index) => index && expect(delay).toBeGreaterThan(delays[index - 1]));
  expect(delays[3] + declared[3].duration).toBeLessThan(700);

  // The digits roll from zero once their own tile has landed, and the text is the real padded value.
  const rolls = await tiles.locator(".nt-roll-strip").evaluateAll((nodes) => nodes.map((node) => ({ name: getComputedStyle(node).animationName, delay: parseFloat(getComputedStyle(node).animationDelay) * 1000, tile: [...document.querySelectorAll(".nt-kpi")].indexOf(node.closest(".nt-kpi")!) })));
  // A tile at zero shows a dash and has no columns, so count the tiles that do; each digit tile has at least two columns.
  // If every tile is at zero there are no columns to check: the digit parts are skipped and the tile checks above and below still run.
  const digitTiles = await tiles.locator(".nt-roll:not(:has(.nt-roll-dash))").count();
  expect(rolls.length).toBeGreaterThanOrEqual(digitTiles * 2);
  expect(new Set(rolls.map((roll) => roll.tile)).size).toBe(digitTiles);
  for (const roll of rolls) {
    expect(roll.name).toBe("nt-roll-in");
    expect(roll.delay).toBeGreaterThanOrEqual(declared[roll.tile].delay + declared[roll.tile].duration);
  }

  await settle(page);
  for (const index of [0, 1, 2, 3]) {
    const tile = tiles.nth(index);
    expect(await style(tile, null, "opacity")).toBe("1");
    expect(await style(tile, null, "translate")).toBe("none");
    expect(await style(tile, null, "scale")).toBe("none");
  }
  const tops = await tiles.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  // At rest every digit column sits on its digit, and the hidden text equals the padded value.
  const resting = await tiles.locator(".nt-roll").evaluateAll((nodes) =>
    nodes.map((node) => ({ text: node.textContent, dashVisible: [...node.querySelectorAll(".nt-roll-dash")].some((dash) => dash.getBoundingClientRect().width > 0 && getComputedStyle(dash).visibility === "visible"), digits: [...node.querySelectorAll(".nt-roll-digit")].map((digit) => ({ wanted: getComputedStyle(digit).getPropertyValue("--nt-roll-d"), top: digit.getBoundingClientRect().top, glyphTop: digit.querySelector(`i[data-glyph="${getComputedStyle(digit).getPropertyValue("--nt-roll-d").trim()}"]`)!.getBoundingClientRect().top })) }))
  );
  for (const roll of resting) {
    if (roll.digits.length === 0) {
      // A tile at zero: "0" for assistive tech, a visible dash, no columns.
      expect(roll.text).toBe("0");
      expect(roll.dashVisible).toBe(true);
      continue;
    }
    expect(roll.text).toMatch(/^\d{2,}$/);
    expect(roll.digits.map((digit) => digit.wanted.trim()).join("")).toBe(roll.text);
    for (const digit of roll.digits) expect(Math.abs(digit.glyphTop - digit.top)).toBeLessThan(1);
  }
  expect(resting.filter((roll) => roll.digits.length > 0)).toHaveLength(digitTiles);
});

// A product decision by the user: the KPI motion plays for everyone, even with reduced motion on the OS. Do not "fix" this.
test("KPI tiles still animate when the OS asks for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  const tile = page.locator(".nt-kpi").first();
  expect(await style(tile, null, "animation-name")).toBe("nt-kpi-in");
  // The first tile may be a dash (Comidas at zero) with no columns, so look for a strip across all tiles.
  const strip = page.locator(".nt-kpi .nt-roll-strip").first();
  // If every tile is at zero there is no digit roll to observe; the tile entrance above is still checked.
  if ((await strip.count()) === 0) return;
  expect(await style(strip, null, "animation-name")).toBe("nt-roll-in");
});

test("KPI tile lifts 3px and wiggles its icon on hover, squashes on press", async ({ page }) => {
  await settle(page);
  const tile = page.locator(".nt-kpi").nth(1);
  const badge = tile.locator(".nt-icon-badge");
  expect(await style(tile, ".nt-icon-badge", "animation-name")).toBe("none");
  const rest = (await tile.boundingBox())!.y;

  await tile.hover();
  await expect.poll(async () => rest - (await tile.boundingBox())!.y).toBeCloseTo(3, 0);
  expect(await style(tile, ".nt-icon-badge", "animation-name")).toBe("nt-kpi-wiggle");
  expect(await style(tile, ".nt-icon-badge", "animation-iteration-count")).toBe("1");
  await expect(badge).toBeVisible();

  await page.mouse.down();
  await expect.poll(() => style(tile, null, "scale")).toBe("0.97");
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await expect.poll(async () => Math.abs((await tile.boundingBox())!.y - rest)).toBeLessThan(0.5);
});

test("carousel: name, rating and Preparación actual change together; rating survives a reload", async ({ page }) => {
  const dots = page.locator(".nt-pager button");
  test.skip((await dots.count()) < 2, "the active plan has fewer than two meals today");
  const title = page.locator(".nt-hero-copy h2");
  const prep = page.locator(".nt-prep");

  await dots.nth(0).click();
  const first = { title: await title.textContent(), rating: await page.locator(".nt-rating").textContent(), href: await prep.getAttribute("href") };
  await dots.nth(1).click();
  await expect(dots.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(prep).not.toHaveAttribute("href", first.href!);
  const second = { rating: await page.locator(".nt-rating").textContent(), href: await prep.getAttribute("href") };

  // Arrow keys move between slides.
  await dots.nth(1).focus();
  await page.keyboard.press("ArrowUp");
  await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(title).toHaveText(first.title!);
  await expect(page.locator(".nt-rating")).toHaveText(first.rating!);

  await openHome(page);
  await page.locator(".nt-pager button").nth(1).click();
  await expect(page.locator(".nt-rating")).toHaveText(second.rating!);
  expect(Number(second.rating)).toBeGreaterThanOrEqual(4.5);
  expect(Number(second.rating)).toBeLessThanOrEqual(5);

  // Preparación actual opens the active recipe.
  await page.locator(".nt-prep").click();
  await page.waitForURL(`**${second.href}`);
});

/** In-page clock for the carousel advance: when the hero button first reads pressed and when the pager selection first moves after that. */
const recordAdvance = (page: Page) =>
  page.evaluate(() => {
    const marks: { pressed: number | null; moved: number | null } = { pressed: null, moved: null };
    (window as unknown as { __advance: typeof marks }).__advance = marks;
    const button = document.querySelector(".nt-hero-actions button[aria-pressed]")!;
    const pager = document.querySelector(".nt-pager")!;
    const start = pager.querySelector("[aria-selected=true]");
    new MutationObserver(() => {
      if (marks.pressed === null && button.getAttribute("aria-pressed") === "true") marks.pressed = performance.now();
    }).observe(button, { attributes: true, attributeFilter: ["aria-pressed"] });
    new MutationObserver(() => {
      const selected = pager.querySelector("[aria-selected=true]");
      if (marks.pressed !== null && marks.moved === null && selected !== start) marks.moved = performance.now();
    }).observe(pager, { attributes: true, attributeFilter: ["aria-selected"], subtree: true });
  });
const advanceMarks = (page: Page) => page.evaluate(() => (window as unknown as { __advance: { pressed: number | null; moved: number | null } }).__advance);

const saved = (page: Page) => page.waitForResponse((r) => r.url().includes("/api/daily-logs/") && r.request().method() === "PUT" && r.status() < 400);
// "Marcar cumplida" is a one-tap action button (specs/dashboard-polish REQ-1). The name is stable in every state (REQ-8);
// the visible, animated label is read from .arc-ab-text.
const markButton = (page: Page) => page.getByRole("button", { name: "Marcar cumplida", exact: true });
const mark = (button: Locator) => button.click();
const label = (button: Locator) => button.locator(".arc-ab-text");
/** Holds every daily-log PUT until `release()`; the held requests then go through unchanged. */
async function holdSaves(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/daily-logs/*", async (route) => {
    if (route.request().method() === "PUT") await gate;
    await route.continue();
  });
  return release;
}
const slotIds = () =>
  sql("select id from meal_types where deleted_at is null and plan_version_id in (select v.id from plan_versions v join plans p on p.id = v.plan_id where v.is_current and p.status = 'active' and p.deleted_at is null) order by display_order").split("\n").filter(Boolean);
const setDone = (ids: string[]) =>
  sql(`insert into daily_logs (id, user_id, date, meals_done, water_glasses, created_at, updated_at) select 'e2e-' || '${TODAY}', id, '${TODAY}', '{}', 0, now(), now() from users order by seq limit 1 on conflict do nothing; update daily_logs set meals_done = '{${ids.join(",")}}' where date = '${TODAY}'`);

test('"Marcar cumplida" saves the meal, moves the adherence and slides to the next pending meal', async ({ page }) => {
  const slots = slotIds();
  test.skip(slots.length < 2, "the active plan has fewer than two meals today");
  const original = sql(`select array_to_string(meals_done, ',') from daily_logs where date = '${TODAY}'`);
  try {
    // Nothing done yet: the hero opens on the first meal.
    setDone([]);
    await openHome(page);
    const dots = page.locator(".nt-pager button");
    const button = markButton(page);
    const title = page.locator(".nt-hero-copy h2");
    await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(label(button)).toHaveText("Marcar cumplida");
    const firstTitle = await title.textContent();
    const adherenceLine = page.locator(".nt-metrics .nt-gauges > *").filter({ has: page.getByRole("meter", { name: "Adherencia", exact: true }) }).getByText(/^\d+ de \d+ comidas?$/);
    await expect(adherenceLine).toBeVisible();
    const before = Number((await adherenceLine.textContent())!.split(" ")[0]);

    // One tap marks. While the save is held the button reads "Guardando" and is not pressed (REQ-3, 8), yet the dial already moved (REQ-9).
    await recordAdvance(page);
    const release = await holdSaves(page);
    await mark(button);
    await expect(label(button)).toHaveText("Guardando");
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button).toBeFocused();
    await expect(adherenceLine).toHaveText(new RegExp(`^${before + 1} de `));
    await Promise.all([saved(page), release()]);
    await expect(label(button)).toHaveText("Cumplida");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(mealsDone()).toBe(1);

    // The carousel waits about 900 ms after "Cumplida" shows (REQ-6), measured in the page between the button first reading
    // pressed and the pager selection moving, so test round trips cannot add to it. Focus stays on the button.
    await expect.poll(async () => (await advanceMarks(page)).moved, { timeout: 2000 }).not.toBeNull();
    const { pressed, moved } = await advanceMarks(page);
    expect(moved! - pressed!).toBeGreaterThanOrEqual(800);
    expect(moved! - pressed!).toBeLessThanOrEqual(1000);
    await expect(dots.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button).toBeFocused();

    // Unmarking keeps the slide.
    await dots.nth(0).click();
    await expect(title).toHaveText(firstTitle!);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await Promise.all([saved(page), mark(button)]);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(1300);
    await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true");
    expect(mealsDone()).toBe(0);

    // From the last meal the search wraps around to the first pending one.
    await dots.last().click();
    await Promise.all([saved(page), mark(button)]);
    await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true");
  } finally {
    setDone(original ? original.split(",") : []);
  }
});

test('"Marcar cumplida" on the last pending meal stays on that slide', async ({ page }) => {
  const slots = slotIds();
  test.skip(slots.length < 2, "the active plan has fewer than two meals today");
  const original = sql(`select array_to_string(meals_done, ',') from daily_logs where date = '${TODAY}'`);
  try {
    // Every meal done except the third (or the last one in shorter plans): the hero opens on it.
    const pending = Math.min(2, slots.length - 1);
    setDone(slots.filter((_, index) => index !== pending));
    await openHome(page);
    const dots = page.locator(".nt-pager button");
    const button = markButton(page);
    await expect(dots.nth(pending)).toHaveAttribute("aria-selected", "true");
    const title = await page.locator(".nt-hero-copy h2").textContent();

    await Promise.all([saved(page), mark(button)]);
    await expect(label(button)).toHaveText("Cumplida");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1200);
    await expect(dots.nth(pending)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".nt-hero-copy h2")).toHaveText(title!);
    expect(mealsDone()).toBe(slots.length);
  } finally {
    setDone(original ? original.split(",") : []);
  }
});

test('"Marcar cumplida" makes the Comidas number go up by one', async ({ page }) => {
  const slots = slotIds();
  test.skip(slots.length < 2, "the active plan has fewer than two meals today");
  const original = sql(`select array_to_string(meals_done, ',') from daily_logs where date = '${TODAY}'`);
  try {
    setDone([]);
    await openHome(page);
    const comidas = page.locator(".nt-kpi").first().locator(".nt-roll");
    // Nothing done: one dash, "0" for screen readers, no digit columns.
    await expect(comidas).toHaveText("0");
    await expect(comidas.locator(".nt-roll-dash")).toHaveCount(1);
    await expect(comidas.locator(".nt-roll-digit")).toHaveCount(0);
    // Record the columns that start rolling from now on: the roll lasts 650ms and the text check below can poll later than that,
    // so reading getAnimations() afterwards would race it. animationstart fires once per column, whenever the check runs.
    await page.evaluate(() => {
      const started: { name: string; delay: string }[] = [];
      (window as unknown as { __rollStarts: typeof started }).__rollStarts = started;
      document.querySelector(".nt-kpi")!.addEventListener("animationstart", (event) => {
        const target = event.target as HTMLElement;
        if (target.matches(".nt-roll-strip")) started.push({ name: (event as AnimationEvent).animationName, delay: getComputedStyle(target).animationDelay });
      });
    });
    await Promise.all([saved(page), mark(markButton(page))]);
    await expect(comidas).toHaveText("01");
    // Both new columns rolled in with nt-roll-in and no first-view delay (a later-mounted column must not wait).
    const started = await page.evaluate(() => (window as unknown as { __rollStarts: { name: string; delay: string }[] }).__rollStarts);
    expect(started).toEqual([{ name: "nt-roll-in", delay: "0s" }, { name: "nt-roll-in", delay: "0s" }]);
    await expect(page.locator(".nt-kpi-context").first()).toHaveText(`de ${slots.length} hoy`);
    // The digits are there and come to rest on 0 and 1 (each glyph level with its cell).
    await expect(comidas.locator(".nt-roll-dash")).toHaveCount(0);
    await settle(page);
    const columns = await comidas.locator(".nt-roll-digit").evaluateAll((nodes) =>
      nodes.map((digit) => {
        const wanted = getComputedStyle(digit).getPropertyValue("--nt-roll-d").trim();
        return { wanted, top: digit.getBoundingClientRect().top, glyphTop: digit.querySelector(`i[data-glyph="${wanted}"]`)!.getBoundingClientRect().top };
      })
    );
    expect(columns.map((column) => column.wanted).join("")).toBe("01");
    for (const column of columns) expect(Math.abs(column.glyphTop - column.top)).toBeLessThan(1);
  } finally {
    setDone(original ? original.split(",") : []);
  }
});

// A failed save never shows success; taps are ignored while saving and for 400 ms after (REQ-4, 5, 7, 24, 25, 27).
const FAILED_PUT = [/PUT \/api\/daily-logs\/.* → 500/, /Failed to load resource.*500/];
const TOAST = "No se pudo guardar tu registro del día";
const failSaves = (page: Page) => page.route("**/api/daily-logs/*", (route) => (route.request().method() === "PUT" ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.continue()));
const puts = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (request) => request.method() === "PUT" && request.url().includes("/api/daily-logs/") && seen.push(request.url()));
  return seen;
};
/** Records what the hero's status region says, and whether the button ever read as pressed. */
const watchHero = (page: Page) =>
  page.evaluate(() => {
    const state = { said: [] as string[], everPressed: false };
    (window as unknown as { __hero: typeof state }).__hero = state;
    const region = document.querySelector(".nt-hero [role=status]")!;
    new MutationObserver(() => region.textContent && state.said.push(region.textContent)).observe(region, { childList: true, characterData: true, subtree: true });
    const button = document.querySelector(".nt-hero-actions button[aria-pressed]")!;
    new MutationObserver(() => button.getAttribute("aria-pressed") === "true" && (state.everPressed = true)).observe(button, { attributes: true });
    // Installed before any tap so waitSinceTap always has a timestamp to measure from.
    const w = window as unknown as { __tapAt?: number };
    button.addEventListener("click", () => (w.__tapAt = performance.now()), true);
  });
/** Resolves once `ms` have passed in the page since the last tap on the hero button (taps are timed in-page, so test latency cannot shorten the wait). */
const waitSinceTap = async (page: Page, ms: number) => {
  await page.waitForFunction((wait) => {
    const tapAt = (window as unknown as { __tapAt?: number }).__tapAt;
    return tapAt !== undefined && performance.now() - tapAt >= wait;
  }, ms);
};
/** Holds a daily-log PUT until released, then answers 500. */
async function failSavesHeld(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/daily-logs/*", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    await gate;
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });
  return release;
}
/**
 * Samples the hero button once per frame: label slot width, check-stroke dash values, and how far letters are lifted or blurred.
 * Value samples work whichever engine drives the motion.
 */
const sampleMotion = (page: Page) =>
  page.evaluate(() => {
    const button = document.querySelector(".nt-hero-actions button[aria-pressed]")!;
    const rec = { widths: new Set<number>(), dashes: new Set<string>(), maxRise: 0, maxBlur: 0, stopped: false };
    const rise = (transform: string) => Math.abs(new DOMMatrix(transform).m42);
    const blur = (filter: string) => Number(/blur\(([\d.]+)px\)/.exec(filter)?.[1] ?? 0);
    const tick = () => {
      rec.widths.add(Math.round(button.querySelector(".arc-ab-slot")!.getBoundingClientRect().width * 10) / 10);
      // Only the check's stroke draw (motion sets pathLength on it); the idle arrow's paths are not animated.
      const path = button.querySelector(".arc-ab-icon path[pathLength]");
      if (path) {
        const style = getComputedStyle(path);
        rec.dashes.add(`${style.strokeDasharray}|${style.strokeDashoffset}`);
      }
      for (const letter of button.querySelectorAll(".arc-ab-letter")) {
        const style = getComputedStyle(letter);
        rec.maxRise = Math.max(rec.maxRise, rise(style.transform));
        rec.maxBlur = Math.max(rec.maxBlur, blur(style.filter));
      }
      if (!rec.stopped) requestAnimationFrame(tick);
    };
    (window as unknown as { __sampler: typeof rec }).__sampler = rec;
    tick();
  });
type MotionSamples = { widths: number[]; dashes: string[]; maxRise: number; maxBlur: number };
const motionSamples = (page: Page) =>
  page.evaluate(() => {
    const rec = (window as unknown as { __sampler: { widths: Set<number>; dashes: Set<string>; stopped: boolean } }).__sampler;
    rec.stopped = true;
    return { ...rec, widths: [...rec.widths], dashes: [...rec.dashes] } as unknown as MotionSamples;
  });
const heroLog = (page: Page) => page.evaluate(() => (window as unknown as { __hero: { said: string[]; everPressed: boolean } }).__hero);

test.describe("failed saves", () => {
  test.use({ expectedIssues: expectIssues(...FAILED_PUT, ...FAILED_PUT) });

  test('"Marcar cumplida": failed save, double tap and reduced motion', async ({ page }) => {
    const slots = slotIds();
    test.skip(slots.length < 2, "the active plan has fewer than two meals today");
    const original = sql(`select array_to_string(meals_done, ',') from daily_logs where date = '${TODAY}'`);
    try {
      setDone([]);
      await openHome(page);
      const button = markButton(page);
      const dots = page.locator(".nt-pager button");
      const toast = page.locator("section[aria-live]").getByText(TOAST);
      const adherence = page.locator(".nt-metrics .nt-gauges > *").filter({ has: page.getByRole("meter", { name: "Adherencia", exact: true }) }).getByText(/^\d+ de \d+ comidas?$/);
      const adherenceBefore = await adherence.textContent();
      await watchHero(page);

      // A failed mark: never "Cumplida", back to "Marcar cumplida", dials rolled back, the toast once, the region silent about the failure.
      await failSaves(page);
      await mark(button);
      await expect(toast).toHaveCount(1);
      await expect(label(button)).toHaveText("Marcar cumplida");
      await expect(button).toHaveAttribute("aria-pressed", "false");
      await expect(adherence).toHaveText(adherenceBefore!);
      await page.waitForTimeout(500);
      await expect(toast).toHaveCount(1);
      expect(await heroLog(page)).toEqual({ said: ["Guardando"], everPressed: false });
      expect(mealsDone()).toBe(0);
      await page.unroute("**/api/daily-logs/*");

      // A double tap on "Marcar cumplida" while the save is held: one request, one mark; the status region says Guardando, then Cumplida.
      const requests = puts(page);
      const release = await holdSaves(page);
      await button.dblclick();
      await expect(label(button)).toHaveText("Guardando");
      await Promise.all([saved(page), release()]);
      await expect(label(button)).toHaveText("Cumplida");
      expect((await heroLog(page)).said).toEqual(["Guardando", "Guardando", "Cumplida"]);
      expect(requests).toHaveLength(1);
      expect(mealsDone()).toBe(1);
      await page.unroute("**/api/daily-logs/*");

      // A failed unmark returns to "Cumplida", pressed again, with the toast; the click reads "not pressed" within a frame and stays so while
      // the failing request is held. Waits first for the earlier toast to go (so this toast is the unmark's) and for the 450 ms lockout.
      await dots.nth(0).click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(toast).toHaveCount(0, { timeout: 10_000 });
      await waitSinceTap(page, 450);
      const releaseFailure = await failSavesHeld(page);
      const pressedAfterFrames = await button.evaluate((node: HTMLElement) => {
        node.click();
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(node.getAttribute("aria-pressed")))));
      });
      expect(pressedAfterFrames).toBe("false");
      await page.waitForTimeout(300);
      await expect(button).toHaveAttribute("aria-pressed", "false");
      releaseFailure();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(label(button)).toHaveText("Cumplida");
      await expect(toast).toHaveCount(1);
      await page.unroute("**/api/daily-logs/*");

      // A double tap on "Cumplida" is one unmark and ends pending, announced as "Comida desmarcada".
      await waitSinceTap(page, 450);
      await page.evaluate(() => ((window as unknown as { __hero: { said: string[] } }).__hero.said.length = 0));
      requests.length = 0;
      await Promise.all([saved(page), button.dblclick()]);
      await expect(label(button)).toHaveText("Marcar cumplida");
      expect(requests).toHaveLength(1);
      expect(mealsDone()).toBe(0);
      expect((await heroLog(page)).said).toEqual(["Comida desmarcada"]);

      // Unmarking before the advance fires cancels it: mark, wait for "Cumplida", unmark after the lockout, and the slide never moves.
      await dots.nth(0).click();
      await Promise.all([saved(page), mark(button)]);
      await expect(label(button)).toHaveText("Cumplida");
      await waitSinceTap(page, 450);
      await Promise.all([saved(page), mark(button)]);
      await expect(label(button)).toHaveText("Marcar cumplida");
      await page.waitForTimeout(1300);
      await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true");
      expect(mealsDone()).toBe(0);

      // Control, normal motion: the sampler sees letters rise and blur, the width spring and the stroke draw, and the focus ring is a box-shadow.
      await button.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(button).toBeFocused();
      const ringNormal = await button.evaluate((node) => ({ outline: getComputedStyle(node).outlineStyle, shadow: getComputedStyle(node).boxShadow, forced: matchMedia("(forced-colors: active)").matches }));
      expect(ringNormal.forced).toBe(false);
      expect(ringNormal.outline).toBe("none");
      expect(ringNormal.shadow).not.toBe("none");
      await sampleMotion(page);
      await Promise.all([saved(page), mark(button)]);
      await expect(label(button)).toHaveText("Cumplida");
      await page.waitForTimeout(500);
      const normal = await motionSamples(page);
      expect(normal.maxRise).toBeGreaterThan(0);
      expect(normal.maxBlur).toBeGreaterThan(0);
      expect(normal.widths.length).toBeGreaterThan(3);
      expect(normal.dashes.length).toBeGreaterThan(2);

      // Reduced motion and forced colours: the labels still change, with no press scale, width spring or stroke draw; the edge and focus ring stay visible.
      setDone([]);
      await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
      await openHome(page);
      await sampleMotion(page);
      const box = (await button.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      expect(await button.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
      await page.mouse.up();
      await expect(label(button)).toHaveText("Cumplida");
      await page.waitForTimeout(700);
      const reduced = await motionSamples(page);
      // Nothing is lifted, blurred, sprung or drawn.
      expect(reduced.maxRise).toBe(0);
      expect(reduced.maxBlur).toBe(0);
      expect(reduced.widths.length).toBeLessThanOrEqual(3);
      expect(reduced.dashes.length).toBeLessThanOrEqual(1);
      const edge = await button.evaluate((node) => ({ style: getComputedStyle(node).borderTopStyle, width: getComputedStyle(node).borderTopWidth }));
      expect(edge).toEqual({ style: "solid", width: "1px" });
      await expect(button.locator(".arc-ab-icon path")).toBeVisible();
      await button.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(button).toBeFocused();
      // Forced colours really apply, and the ring turns from the normal box-shadow into a 2px solid system-colour outline.
      const ringForced = await button.evaluate((node) => ({ forced: matchMedia("(forced-colors: active)").matches, style: getComputedStyle(node).outlineStyle, width: getComputedStyle(node).outlineWidth, shadow: getComputedStyle(node).boxShadow }));
      expect(ringForced).toEqual({ forced: true, style: "solid", width: "2px", shadow: "none" });
    } finally {
      setDone(original ? original.split(",") : []);
    }
  });
});

test("Métricas: title without a range, four tabs, four tiles in order, no order counter", async ({ page }) => {
  const card = page.locator(".nt-metrics");
  await expect(card.getByRole("heading")).toHaveText("Métricas");
  await expect(card.getByRole("tab")).toHaveText(["Semana", "Mes", "Año", "Histórico"]);
  await expect(card).not.toContainText(/Orders|semanal/i);
  const tiles = card.locator(".nt-gauges > *");
  await expect(tiles).toHaveCount(4);
  // Adherencia, Calorías and Proteína are meters named by their tile (REQ-43); Peso keeps its gauge tile until US3.
  const meters = ["Adherencia", "Calorías", "Proteína"];
  for (const [index, name] of meters.entries()) await expect(tiles.nth(index).getByRole("meter", { name, exact: true })).toHaveCount(1);
  await expect(card.getByRole("meter")).toHaveCount(3);
  await expect(tiles.nth(3).locator(".nt-gauge-label")).toHaveText(/^Peso\b/);
  // What each meter reads, by aria-valuetext: with data or "Sin datos", units kept (REQ-43).
  const valueText = /^(Sin datos|\d+%, \d+ de \d+ comidas?)$/;
  const estimate = (unit: string) => new RegExp(`^(Sin datos|≈ [\\d,]+ ${unit}, meta [\\d,]+ ${unit})$`);
  for (const tab of ["Mes", "Año", "Histórico", "Semana"]) {
    await card.getByRole("tab", { name: tab }).click();
    await expect(card.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    const reads = await Promise.all(meters.map((name) => tiles.getByRole("meter", { name, exact: true }).getAttribute("aria-valuetext")));
    expect(reads[0], `Adherencia in ${tab}`).toMatch(valueText);
    expect(reads[1], `Calorías in ${tab}`).toMatch(estimate("kcal"));
    expect(reads[2], `Proteína in ${tab}`).toMatch(estimate("g"));
    for (const value of await tiles.nth(3).locator(".nt-gauge-value").allTextContents()) expect(value).toMatch(/^(—|\d+%)$/);
  }
});

test("Peso gauge opens the weight editor and saves today's weight", async ({ page }) => {
  const previous = sql(`select weight_kg from daily_logs where date = '${TODAY}'`);
  await page.locator("button.nt-gauge-tile").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Peso de hoy (kg)").fill("71.5");
  await Promise.all([page.waitForResponse((r) => r.url().includes("/api/daily-logs/") && r.status() < 400), dialog.getByRole("button", { name: "Guardar" }).click()]);
  await expect(page.locator("button.nt-gauge-tile .nt-gauge-label")).toHaveText("Peso (71.5 kg)");
  expect(Number(sql(`select weight_kg from daily_logs where date = '${TODAY}'`))).toBe(71.5);
  sql(`update daily_logs set weight_kg = ${previous || "null"} where date = '${TODAY}'`);
});

test("yellow and sky cards are static; the old dashboard is gone; the assistant still opens", async ({ page }) => {
  await expect(page.locator(".nt-cal")).toContainText("Resumen calórico");
  await expect(page.locator(".nt-comp")).toContainText("Cumplimiento del plan");
  expect(await page.locator(".nt-cal button, .nt-cal a, .nt-comp button, .nt-comp a").count()).toBe(0);
  await expect(page.locator(".home, .home-grid")).toHaveCount(0);
  await expect(page.getByText(/Dishes sold/i)).toHaveCount(0);

  // The floating assistant covers neither card.
  await expect(page.locator(".nt-comp")).toBeVisible();
  await expect(page.locator(".assistant-fab")).toBeVisible();
  const fab = (await page.locator(".assistant-fab").boundingBox())!;
  const sky = (await page.locator(".nt-comp").boundingBox())!;
  expect(fab.y).toBeGreaterThanOrEqual(sky.y + sky.height);
  await page.locator(".assistant-fab").click();
  await expect(page.locator(".assistant-chat")).toBeVisible();
});

test("every icon-only control has an accessible name", async ({ page }) => {
  const unnamed = await page.locator(".nt-topbar button, .nt-topbar a, .nt-sidebar button, .nt-sidebar a, .nt-dash button, .nt-dash a").evaluateAll((nodes) =>
    nodes.filter((node) => !(node.getAttribute("aria-label") || node.textContent?.trim())).map((node) => node.outerHTML.slice(0, 80))
  );
  expect(unnamed).toEqual([]);
});

test("search sends the question to the assistant", async ({ page }) => {
  const input = page.getByPlaceholder("Buscar recetas, planes, ingredientes…");
  await input.fill("¿Qué me toca comer hoy?");
  await input.press("Enter");
  await expect(page.locator(".assistant-chat")).toBeVisible();
  await expect(page.locator(".assistant-chat")).toContainText("¿Qué me toca comer hoy?");
});

// The whole dashboard fits the screen: no page scrollbar, nothing clipped inside the cards, the assistant over no card.
for (const size of [{ width: 1440, height: 900 }, { width: 1440, height: 780 }, { width: 1280, height: 768 }, { width: 1920, height: 1080 }, { width: 1920, height: 800 }]) {
  test(`fits ${size.width}×${size.height} without scrolling`, async ({ page }) => {
    await page.setViewportSize(size);
    await openHome(page);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight), "vertical page scroll").toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), "horizontal page scroll").toBeLessThanOrEqual(0);
    const clipped = await page.locator(".nt-kpi, .nt-metrics, .nt-gauges > *, .nt-cal, .nt-comp, .nt-prep").evaluateAll((nodes) =>
      nodes.filter((node) => node.scrollHeight > node.clientHeight + 1).map((node) => `${node.className}: ${node.scrollHeight} > ${node.clientHeight}`)
    );
    expect(clipped, "cards whose content is cut").toEqual([]);
    const [fab, sky, prep] = await Promise.all([".assistant-fab", ".nt-comp", ".nt-prep"].map(async (selector) => (await page.locator(selector).boundingBox())!));
    expect(sky.y + sky.height).toBeLessThanOrEqual(fab.y);
    expect(prep.y + prep.height).toBeLessThanOrEqual(size.height);
    // The three dials are the same size (REQ-9); Peso keeps its gauge until US3.
    const dials = await page.locator(".nt-metrics .nt-dial-box").evaluateAll((nodes) => nodes.map((node) => [node.getBoundingClientRect().width, node.getBoundingClientRect().height]));
    expect(dials, "three dial boxes").toHaveLength(3);
    for (const [width, height] of dials) {
      expect(width).toBeCloseTo(dials[0][0], 0);
      expect(height).toBeCloseTo(width, 0);
    }
    if (size.height === 780) await page.screenshot({ path: `${SHOTS}/dashboard-1440x780.png` });
  });
}

for (const size of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1024, height: 900 }, { width: 390, height: 844 }]) {
  test(`screenshot at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openHome(page);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/dashboard-${size.width}x${size.height}.png`, fullPage: size.width < 1280 });
  });
}

test("screenshot in the dark theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openHome(page);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SHOTS}/dashboard-dark-1440x900.png` });
});

test("empty state: a day without a plan shows the message and a link to Planes", async ({ page }) => {
  const active = sql("select id from plans where status = 'active' and deleted_at is null");
  test.skip(!active, "no active plan to archive");
  sql("update plans set status = 'archived' where status = 'active'");
  try {
    await openHome(page);
    await expect(page.locator(".nt-hero-empty")).toHaveText("Hoy no tienes comidas planificadas");
    await expect(page.locator(".nt-hero").getByRole("link", { name: "Ir a Planes" })).toHaveAttribute("href", "/plans");
    await expect(page.locator(".nt-kpi").first().locator(".nt-roll")).toHaveText("0");
    await expect(page.locator(".nt-kpi").first().locator(".nt-roll-dash")).toHaveAttribute("data-glyph", "—");
    await expect(page.locator(".nt-kpi-context").first()).toHaveText("Día libre");
    // No plan means no meals and no targets: every dial reads "—" and "Sin datos" (metric-dials REQ-6, REQ-43); Peso keeps its gauge.
    for (const name of ["Adherencia", "Calorías", "Proteína"]) {
      const dial = page.locator(".nt-metrics").getByRole("meter", { name, exact: true });
      await expect(dial).toHaveAttribute("aria-valuetext", "Sin datos");
      await expect(dial.locator(".nt-dial-readout")).toHaveText("—");
    }
    for (const value of await page.locator(".nt-gauge-value").allTextContents()) expect(value).toMatch(/^(—|\d+%)$/);
    await page.screenshot({ path: `${SHOTS}/dashboard-empty-1440x900.png` });
  } finally {
    sql(`update plans set status = 'active' where id in (${active.split("\n").map((id) => `'${id}'`).join(",")})`);
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`account menu in glass, ${scheme}: header, Papelera and a red sign-out`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openHome(page);
    await page.locator(".nt-profile-btn").click();
    const menu = page.getByRole("menu", { name: "Cuenta" });
    // At 1440 px the pill already shows the name and email, so the menu has no header of its own (it has one below 1280 px).
    await expect(page.locator(".nt-profile-btn strong")).not.toBeEmpty();
    await expect(menu.locator(".nt-menu-head")).toBeHidden();
    await expect(menu.getByRole("menuitem")).toHaveText(["Papelera", "Cerrar sesión"]);
    expect(await menu.evaluate((node) => getComputedStyle(node).backdropFilter)).toContain("blur");
    // Sign-out is the only red entry.
    const hue = (name: string) => menu.getByRole("menuitem", { name }).evaluate((node) => getComputedStyle(node).color);
    expect(await hue("Cerrar sesión")).not.toBe(await hue("Papelera"));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/account-menu-${scheme}.png`, clip: { x: 1040, y: 0, width: 400, height: 280 } });
  });
}

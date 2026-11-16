import type { Locator, Page } from "@playwright/test";
import { sql } from "./database";
import { expect, test } from "./fixtures";

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

const saved = (page: Page) => page.waitForResponse((r) => r.url().includes("/api/daily-logs/") && r.request().method() === "PUT" && r.status() < 400);
// "Marcar cumplida" is held to confirm (800 ms); the extra 100 ms leaves the fill room to finish under load.
const holdToConfirm = async (button: Locator) => {
  const box = (await button.boundingBox())!;
  await button.page().mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await button.page().mouse.down();
  await button.page().waitForTimeout(900);
  await button.page().mouse.up();
};
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
    const button = page.locator(".nt-done");
    const title = page.locator(".nt-hero-copy h2");
    await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true");
    const firstTitle = await title.textContent();

    await Promise.all([saved(page), holdToConfirm(button)]);
    expect(mealsDone()).toBe(1);
    // The carousel moves on to the next pending meal, whose button is not pressed.
    await expect(dots.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".nt-gauge-tile").first().locator(".nt-gauge-label")).toContainText(/Adherencia \(\d+\/\d+\)/);

    // Unmarking keeps the slide.
    await dots.nth(0).click();
    await expect(title).toHaveText(firstTitle!);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await Promise.all([saved(page), button.click()]);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(700);
    await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true");
    expect(mealsDone()).toBe(0);

    // From the last meal the search wraps around to the first pending one.
    await dots.last().click();
    await Promise.all([saved(page), holdToConfirm(button)]);
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
    const button = page.locator(".nt-done");
    await expect(dots.nth(pending)).toHaveAttribute("aria-selected", "true");
    const title = await page.locator(".nt-hero-copy h2").textContent();

    await Promise.all([saved(page), holdToConfirm(button)]);
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
    await Promise.all([saved(page), holdToConfirm(page.locator(".nt-done"))]);
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

test("Métricas: title without a range, four tabs, four gauges in order, no order counter", async ({ page }) => {
  const card = page.locator(".nt-metrics");
  await expect(card.getByRole("heading")).toHaveText("Métricas");
  await expect(card.getByRole("tab")).toHaveText(["Semana", "Mes", "Año", "Histórico"]);
  await expect(card).not.toContainText(/Orders|semanal/i);
  for (const tab of ["Mes", "Año", "Histórico", "Semana"]) {
    await card.getByRole("tab", { name: tab }).click();
    await expect(card.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    const labels = await card.locator(".nt-gauge-label").allTextContents();
    expect(labels.map((label) => label.split(" (")[0])).toEqual(["Adherencia", "Calorías", "Proteína", "Peso"]);
    for (const value of await card.locator(".nt-gauge-value").allTextContents()) expect(value).toMatch(/^(—|\d+%)$/);
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
    const clipped = await page.locator(".nt-kpi, .nt-metrics, .nt-gauge-tile, .nt-cal, .nt-comp, .nt-prep").evaluateAll((nodes) =>
      nodes.filter((node) => node.scrollHeight > node.clientHeight + 1).map((node) => `${node.className}: ${node.scrollHeight} > ${node.clientHeight}`)
    );
    expect(clipped, "cards whose content is cut").toEqual([]);
    const [fab, sky, prep] = await Promise.all([".assistant-fab", ".nt-comp", ".nt-prep"].map(async (selector) => (await page.locator(selector).boundingBox())!));
    expect(sky.y + sky.height).toBeLessThanOrEqual(fab.y);
    expect(prep.y + prep.height).toBeLessThanOrEqual(size.height);
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

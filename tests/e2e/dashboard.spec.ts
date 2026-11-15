import type { Page } from "@playwright/test";
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
  const order = await bar.evaluate((node) => [...node.children].flatMap((group) => [...group.children]).map((child) => child.className.split(" ")[0]));
  expect(order).toEqual(["nt-brand", "nt-search", "nt-chef", "nt-cta", "nt-tools", "nt-profile"]);
  // Chef's selection + "Procesar plan" sit in the middle of the bar.
  const [barBox, middle] = [(await bar.boundingBox())!, (await bar.locator(".nt-top-center").boundingBox())!];
  expect(Math.abs(middle.x + middle.width / 2 - (barBox.x + barBox.width / 2))).toBeLessThanOrEqual(4);
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

test("KPI tiles show real counts with at least two digits", async ({ page }) => {
  const plans = count("select count(*) from plans where deleted_at is null");
  const recipes = count("select count(*) from recipes where deleted_at is null");
  const tiles = page.locator(".nt-kpi");
  await expect(tiles.locator(".nt-kpi-label")).toHaveText(["Comidas de hoy", "Planes disponibles", "Recetas disponibles", "Compras pendientes"]);
  await expect(tiles.nth(1).locator(".nt-figure")).toHaveText(String(plans).padStart(2, "0"));
  await expect(tiles.nth(2).locator(".nt-figure")).toHaveText(String(recipes).padStart(2, "0"));
  for (const text of await tiles.locator(".nt-figure").allTextContents()) expect(text).toMatch(/^\d{2,}$/);
  const slides = await page.locator(".nt-pager button").count();
  await expect(tiles.nth(0).locator(".nt-figure")).toHaveText(String(Math.max(slides, await page.locator(".nt-hero-copy").count())).padStart(2, "0"));
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

test('"Marcar cumplida" saves the meal and moves the Semana adherence', async ({ page }) => {
  test.skip((await page.locator(".nt-done").count()) === 0, "no meals planned today");
  const button = page.locator(".nt-done");
  const before = mealsDone();
  const wasDone = (await button.getAttribute("aria-pressed")) === "true";
  await Promise.all([page.waitForResponse((r) => r.url().includes("/api/daily-logs/") && r.request().method() === "PUT" && r.status() < 400), button.click()]);
  await expect(button).toHaveAttribute("aria-pressed", String(!wasDone));
  expect(mealsDone()).toBe(before + (wasDone ? -1 : 1));
  await expect(page.locator(".nt-gauge-tile").first().locator(".nt-gauge-label")).toContainText(/Adherencia \(\d+\/\d+\)/);
  // Leave the day as it was.
  await Promise.all([page.waitForResponse((r) => r.url().includes("/api/daily-logs/") && r.request().method() === "PUT" && r.status() < 400), button.click()]);
  expect(mealsDone()).toBe(before);
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
    await expect(page.locator(".nt-kpi").first().locator(".nt-figure")).toHaveText("00");
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
    await expect(menu.locator(".nt-menu-head strong")).not.toBeEmpty();
    await expect(menu.getByRole("menuitem")).toHaveText(["Papelera", "Cerrar sesión"]);
    expect(await menu.evaluate((node) => getComputedStyle(node).backdropFilter)).toContain("blur");
    // Sign-out is the only red entry.
    const hue = (name: string) => menu.getByRole("menuitem", { name }).evaluate((node) => getComputedStyle(node).color);
    expect(await hue("Cerrar sesión")).not.toBe(await hue("Papelera"));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/account-menu-${scheme}.png`, clip: { x: 1040, y: 0, width: 400, height: 280 } });
  });
}

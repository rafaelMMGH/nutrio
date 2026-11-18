import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";
import { MIN_TARGET, settledBox, confirmButton, closeButton, mockWizardApi, modal, next, openWizard, previous, step, stepper, toDatos, uploadPdf } from "./upload-wizard-helpers";

// Upload wizard accessibility, layout, reduced motion and 44px targets (spec upload-wizard-stepper, US1). Busy states
// and failures live in upload-wizard-checks.spec.ts. Every write is mocked.

/** The status follows the label as separate blocks, so the browser may put a space before the comma. */
const status = (label: string, text: string) => new RegExp(`^${label}\\s*,\\s*${text}$`);
const liveRegion = (page: Page) => stepper(page).locator('[aria-live="polite"]');

test.describe("REQ-6: the stepper is accessible", () => {
  test("aria-current, screen-reader status and the live region", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await expect(step(page, "Subir")).toHaveAttribute("aria-current", "step");
    await expect(step(page, "Subir")).not.toHaveAccessibleName(/completada|disponible|sin iniciar|con error/);
    for (const label of ["Datos", "Comidas", "Confirmar"]) await expect(step(page, label)).toHaveAccessibleName(status(label, "sin iniciar"));
    await expect(liveRegion(page)).toHaveText("Paso 1 de 4: Subir");

    await uploadPdf(page);
    await next(page).click();
    await expect(liveRegion(page)).toHaveText("Paso 2 de 4: Datos");
    await expect(step(page, "Subir")).toHaveAccessibleName(status("Subir", "completada"));
    await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
    await expect(step(page, "Datos")).not.toHaveAccessibleName(/completada|disponible|sin iniciar|con error/);
    // REQ-6: "con error" takes precedence over the progress status, even on a locked Comidas.
    await expect(step(page, "Comidas")).toHaveAccessibleName(/^Comidas\s*,\s*con error\b/);
    for (const label of ["Subir", "Comidas", "Confirmar"]) await expect(step(page, label)).not.toHaveAttribute("aria-current", /.*/);

    await next(page).click();
    await next(page).click();
    await expect(liveRegion(page)).toHaveText("Paso 4 de 4: Confirmar");
    for (const label of ["Subir", "Datos"]) await expect(step(page, label)).toHaveAccessibleName(status(label, "completada"));
    await expect(step(page, "Comidas")).toHaveAccessibleName(/^Comidas\s*,\s*con error\b/);

    // Jumping back: the current step reads no status and Confirmar is reached but not passed.
    await step(page, "Datos").click();
    await expect(liveRegion(page)).toHaveText("Paso 2 de 4: Datos");
    await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
    await expect(step(page, "Datos")).not.toHaveAccessibleName(/completada|disponible|sin iniciar|con error/);
    await expect(step(page, "Confirmar")).toHaveAccessibleName(status("Confirmar", "disponible"));
    await expect(step(page, "Comidas")).toHaveAccessibleName(/^Comidas\s*,\s*con error\b/);
  });

  test("ArrowDown, ArrowUp, Home, End, Enter and Space move among the selectable steps", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    await next(page).click();
    // Furthest is Datos: Comidas and Confirmar are skipped.
    await step(page, "Subir").focus();
    await page.keyboard.press("ArrowDown");
    await expect(step(page, "Datos")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(step(page, "Datos")).toBeFocused();
    await next(page).click();
    await next(page).click();

    await step(page, "Subir").focus();
    await page.keyboard.press("End");
    await expect(step(page, "Confirmar")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(step(page, "Comidas")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(step(page, "Comidas")).toHaveAttribute("aria-current", "step");
    await expect(liveRegion(page)).toHaveText("Paso 3 de 4: Comidas");
    await page.keyboard.press("Home");
    await expect(step(page, "Subir")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(step(page, "Subir")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" ");
    await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
    await expect(liveRegion(page)).toHaveText("Paso 2 de 4: Datos");
  });

  test("compact: ArrowRight and ArrowLeft move focus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    await next(page).click();
    await step(page, "Subir").focus();
    await page.keyboard.press("ArrowRight");
    await expect(step(page, "Datos")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(step(page, "Subir")).toBeFocused();
  });
});

/** How far the page and the scrolling content spill sideways; both must be 0. */
const horizontalOverflow = (page: Page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    const content = document.querySelector<HTMLElement>(".uw-content")!;
    // A negative difference (the content is narrower than its box) is not overflow, so it counts as 0.
    return { page: Math.max(0, root.scrollWidth - root.clientWidth), content: Math.max(0, content.scrollWidth - content.clientWidth) };
  });

test.describe("REQ-2, REQ-18: layout", () => {
  test("1280px: a 200px rail with the content to its right and one description", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    const rail = (await page.locator(".uw-rail").boundingBox())!;
    const content = (await page.locator(".uw-content").boundingBox())!;
    expect(rail.width).toBe(200);
    expect(content.x).toBeGreaterThanOrEqual(rail.x + rail.width);
    expect(Math.abs(content.y - rail.y)).toBeLessThanOrEqual(1);
    await expect(stepper(page)).not.toHaveClass(/stepper-compact/);
    await expect(stepper(page).locator(".stepper-description")).toHaveCount(1);
    await expect(stepper(page).locator(".stepper-description")).toBeVisible();
  });

  test("390px: compact stepper in the header, caption, full-width content and no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await expect(stepper(page)).toHaveClass(/stepper-compact/);
    await expect(page.locator(".uw-rail")).toHaveCount(0);
    await expect(page.locator(".uw-header").locator(stepper(page))).toBeVisible();
    await expect(page.locator(".stepper-caption")).toHaveText("Subir");
    await uploadPdf(page);
    // The "PDF procesado" result is the one Subir state with content to overflow.
    expect(await horizontalOverflow(page), "Subir result horizontal overflow").toEqual({ page: 0, content: 0 });
    await next(page).click();
    await expect(page.locator(".stepper-caption")).toHaveText("Datos");

    const modalBox = (await page.locator(".upload-wizard-modal").boundingBox())!;
    const content = (await page.locator(".uw-content").boundingBox())!;
    expect(Math.abs(content.width - modalBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(content.x - modalBox.x)).toBeLessThanOrEqual(1);

    // REQ-18: no horizontal scroll on any step, and the header and footer stay on screen.
    for (let index = 1; index <= 3; index++) {
      expect(await horizontalOverflow(page), `step ${index} horizontal overflow`).toEqual({ page: 0, content: 0 });
      for (const selector of [".uw-header", ".uw-footer"]) {
        const box = (await page.locator(selector).boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(800);
      }
      if (index < 3) await next(page).click();
    }
  });

  test("390px, Comidas: the content scrolls on its own while the header and footer stay put", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await toDatos(page);
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Comidas" })).toBeFocused();

    const content = page.locator(".uw-content");
    const sizes = await content.evaluate((node) => ({ scroll: node.scrollHeight, client: node.clientHeight }));
    expect(sizes.scroll, "Comidas is taller than its area, so it has to scroll").toBeGreaterThan(sizes.client);

    // The caption's height spring may still be settling here; wait until two reads 100 ms apart agree. A tolerance
    // would hide a real drift while scrolling, which is what this test guards against.
    const readHeader = async () => JSON.stringify(await page.locator(".uw-header").boundingBox());
    await expect.poll(async () => (await readHeader()) === (await page.waitForTimeout(100).then(readHeader))).toBe(true);
    const header = (await page.locator(".uw-header").boundingBox())!;
    const footer = (await page.locator(".uw-footer").boundingBox())!;
    await content.evaluate((node) => node.scrollTo(0, node.scrollHeight));
    await expect.poll(() => content.evaluate((node) => Math.round(node.scrollHeight - node.clientHeight - node.scrollTop))).toBe(0);
    expect(await page.locator(".uw-header").boundingBox()).toEqual(header);
    expect(await page.locator(".uw-footer").boundingBox()).toEqual(footer);
    const last = (await content.locator(".uw-card").last().boundingBox())!;
    expect(last.y + last.height, "the last meal ends above the footer").toBeLessThanOrEqual(footer.y);
    await expect(next(page)).toBeVisible();
  });

  test("390px, Comidas: a very long unbroken name does not scroll sideways", async ({ page }) => {
    const plan = structuredClone(WIZARD_PLAN);
    const long = "Superlargo".repeat(14);
    plan.structured_data.meals[0].name = long;
    plan.structured_data.meals[0].options[0].recipe.name = long;
    plan.structured_data.meals[0].options[0].recipe.ingredients[0].name = long;
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page, {}, plan);
    await openWizard(page);
    await toDatos(page);
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Comidas" })).toBeFocused();
    await expect(page.locator(".uw-content").getByText(long).first()).toBeVisible();
    expect(await horizontalOverflow(page)).toEqual({ page: 0, content: 0 });
  });
});

/**
 * Clicks Siguiente inside the page, then samples the opacity of the new step's description on every frame, for up to
 * 40 frames or until it reaches 1. The description fades in over 0.2s (a JS animation, so it never shows in
 * getAnimations()): with reduced motion it is at rest from the first frame, without it the samples pass through
 * the values in between.
 */
const opacitySamples = (page: Page, description: string) =>
  page.evaluate(async (text) => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const find = () => Array.from(document.querySelectorAll<HTMLElement>(".stepper-description")).find((node) => node.textContent === text);
    Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Siguiente")!.click();
    for (let waited = 0; !find() && waited < 120; waited++) await frame();
    const node = find();
    if (!node) throw new Error(`description "${text}" never rendered`);
    const samples: number[] = [];
    for (let index = 0; index < 40; index++) {
      await frame();
      samples.push(Number(getComputedStyle(node).opacity));
      if (samples[index] === 1) break;
    }
    return samples;
  }, description);

test.describe("REQ-7: reduced motion", () => {
  test("the new description is at rest within 3 frames, never partway, and the transitions are off", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    const samples = await opacitySamples(page, "Nombre, objetivo y calorías");
    expect(samples.filter((value) => value > 0 && value < 1), `samples ${samples}`).toEqual([]);
    expect(samples.indexOf(1), `samples ${samples}`).toBeGreaterThanOrEqual(0);
    expect(samples.indexOf(1)).toBeLessThan(3);
    await expect(liveRegion(page)).toHaveText("Paso 2 de 4: Datos");
    const durations = await stepper(page).locator(".stepper-disc, .stepper-label").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).transitionDuration));
    expect(new Set(durations)).toEqual(new Set(["0s"]));
  });

  test("control: without reduced motion some sample is partway through the fade", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    const samples = await opacitySamples(page, "Nombre, objetivo y calorías");
    expect(samples.some((value) => value > 0 && value < 1), `samples ${samples}`).toBe(true);
  });
});

test.describe("REQ-19: 44px targets in the compact layout", () => {
  test("stepper hit areas, footer buttons and the X", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    await next(page).click();

    // The hit area is the ::after of each step button, not the button box.
    const areas = await stepper(page).locator(".stepper-head").evaluateAll((heads) =>
      heads.map((head) => {
        const after = getComputedStyle(head, "::after");
        const rect = head.getBoundingClientRect();
        // Just inside the top and bottom edges of the area; neighbours sit to the side, never above or below.
        const at = (y: number) => document.elementFromPoint(rect.left + rect.width / 2, y)?.closest(".stepper-head") === head;
        return { width: parseFloat(after.width), height: parseFloat(after.height), topHits: at(rect.top - 7), bottomHits: at(rect.bottom + 7) };
      })
    );
    expect(areas).toHaveLength(4);
    for (const area of areas) {
      expect(area.width).toBeGreaterThanOrEqual(44);
      expect(area.height).toBeGreaterThanOrEqual(44);
      expect(area.topHits && area.bottomHits, "the extended area is hit").toBe(true);
    }

    for (const button of [closeButton(page), previous(page), next(page)]) {
      const box = await settledBox(button);
      expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET);
    }
    await next(page).click();
    await next(page).click();
    const box = await settledBox(confirmButton(page));
    expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET);
  });
});

test.describe("REQ-16: the wizard is modal", () => {
  test("Q29: Tab never reaches the page behind the wizard, and the page is reachable and refocused after closing", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    // Tab may leave the document for the browser UI or the dev overlay (both outside .app-shell); it must never land in the
    // page behind the wizard, which is everything else in the shell.
    const inside = () => page.evaluate(() => {
      const active = document.activeElement;
      return !active?.closest(".app-shell") || !!active.closest(".upload-wizard-modal");
    });
    const inModal = () => page.evaluate(() => !!document.activeElement?.closest(".upload-wizard-modal"));
    const describe = () => page.evaluate(() => {
      const el = document.activeElement;
      return el ? `${el.tagName}|${el.id}|${el.getAttribute("aria-label") ?? ""}|${(el.textContent ?? "").trim().slice(0, 30)}` : "none";
    });
    await expect(modal(page)).toBeFocused();
    const visited = new Set<string>();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await inside(), `Tab ${i + 1} never reaches the page behind`).toBe(true);
      if (i === 0) expect(await inModal(), "first Tab lands inside the modal").toBe(true);
      if (await inModal()) visited.add(await describe());
    }
    expect(visited.size, `distinct modal elements visited: ${[...visited].join(" ; ")}`).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await inside(), `Shift+Tab ${i + 1} never reaches the page behind`).toBe(true);
    }

    await closeButton(page).click();
    await expect(modal(page)).toHaveCount(0);
    // Focus returns to the control that opened it, and the page behind is no longer inert.
    await expect(page.getByRole("button", { name: /Subir plan nuevo/ }).first()).toBeFocused();
    for (const behind of ["header.nt-topbar", "nav.nt-sidebar", "main.content"]) await expect(page.locator(behind)).not.toHaveAttribute("inert", /.*/);
    await page.getByRole("button", { name: "Abrir asistente" }).focus();
    await expect(page.getByRole("button", { name: "Abrir asistente" })).toBeFocused();
  });
});

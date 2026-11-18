import type { Page } from "@playwright/test";
import { expect, expectIssues, test } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";
import { changePdf, choosePdf, closeButton, confirmButton, gate, mockWizardApi, modal, next, openWizard, previous, resultHeading, step, stepper, submitPdf, toast, toConfirmar, toDatos, uploadPdf } from "./upload-wizard-helpers";

// Upload wizard failures, busy states, accessibility and layout (spec upload-wizard-stepper, US1). Navigation lives in
// upload-wizard.spec.ts. Every write is mocked.

/** The status follows the label as separate blocks, so the browser may put a space before the comma. */
const status = (label: string, text: string) => new RegExp(`^${label}\\s*,\\s*${text}$`);
const liveRegion = (page: Page) => stepper(page).locator('[aria-live="polite"]');

/** A disabled control ignores a forced click; the point is that nothing is sent. */
async function expectLocked(page: Page, labels: string[]) {
  await expect(closeButton(page)).toBeDisabled();
  for (const label of labels) await expect(step(page, label)).toHaveAttribute("aria-disabled", "true");
}

test.describe("REQ-14: one request at a time", () => {
  test("Procesar PDF shows busy, locks the controls and sends no second request", async ({ page }) => {
    const hold = gate();
    const calls = await mockWizardApi(page, { upload: hold.opened });
    await openWizard(page);
    const submit = page.getByRole("button", { name: "Procesar PDF" });
    await choosePdf(page);
    // A double click is two activations in a row; only the first may reach the server.
    await submit.dblclick();
    await expect.poll(() => calls.uploads).toBe(1);
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await expect(submit).toBeDisabled();
    await expect(page.locator('input[name="pdf"]')).toBeDisabled();
    await expectLocked(page, ["Subir", "Datos"]);
    await submit.click({ force: true });
    await closeButton(page).click({ force: true });
    await expect(modal(page)).toBeVisible();
    await expect.poll(() => calls.uploads).toBe(1);
    hold.open();
    await expect(resultHeading(page)).toBeFocused();
    await expect(closeButton(page)).toBeEnabled();
    await expect.poll(() => calls.uploads).toBe(1);
  });

  test("Cambiar PDF shows busy, locks the controls and sends no second DELETE", async ({ page }) => {
    const hold = gate();
    const calls = await mockWizardApi(page, { remove: hold.opened });
    await openWizard(page);
    await toDatos(page);
    await previous(page).click();
    await changePdf(page).dblclick();
    await expect.poll(() => calls.deletes).toBe(1);
    await expect(changePdf(page)).toHaveAttribute("aria-busy", "true");
    await expect(changePdf(page)).toBeDisabled();
    await expect(next(page)).toBeDisabled();
    // Subir is step one, so Anterior is off anyway; it must stay off while the DELETE runs.
    await expect(previous(page)).toBeDisabled();
    await expectLocked(page, ["Datos"]);
    await changePdf(page).click({ force: true });
    await step(page, "Datos").click({ force: true });
    await closeButton(page).click({ force: true });
    await expect(step(page, "Subir")).toHaveAttribute("aria-current", "step");
    await expect(modal(page)).toBeVisible();
    await expect.poll(() => calls.deletes).toBe(1);
    hold.open();
    await expect(page.locator('input[name="pdf"]')).toBeFocused();
    await expect(page.locator('input[name="pdf"]')).toBeEnabled();
    await expect(closeButton(page)).toBeEnabled();
    await expect.poll(() => calls.deletes).toBe(1);
  });

  test("Confirmar plan shows busy, locks the controls and sends no second PATCH", async ({ page }) => {
    const hold = gate();
    const calls = await mockWizardApi(page, { patch: hold.opened });
    await openWizard(page);
    await toConfirmar(page);
    await confirmButton(page).dblclick();
    await expect.poll(() => calls.patches.length).toBe(1);
    await expect(confirmButton(page)).toHaveAttribute("aria-busy", "true");
    await expect(confirmButton(page)).toBeDisabled();
    await expect(previous(page)).toBeDisabled();
    await expectLocked(page, ["Subir", "Datos", "Comidas"]);
    await confirmButton(page).click({ force: true });
    await step(page, "Datos").click({ force: true });
    await closeButton(page).click({ force: true });
    await expect(step(page, "Confirmar")).toHaveAttribute("aria-current", "step");
    await expect.poll(() => calls.patches.length).toBe(1);
    hold.open();
    await expect(modal(page)).toHaveCount(0);
    await expect.poll(() => calls.patches.length).toBe(1);
  });
});

test.describe("REQ-15, REQ-16: PATCH fails", () => {
  test.use({ expectedIssues: expectIssues(/PATCH \/api\/plans\/.* → 500/, /Failed to load resource.*500/) });

  test("toast, the wizard stays on Confirmar with the edits, and focus returns to Confirmar plan", async ({ page }) => {
    const calls = await mockWizardApi(page, { patch: "fail" });
    await openWizard(page);
    await uploadPdf(page);
    await next(page).click();
    await page.getByLabel("Nombre").fill("Nombre editado");
    await next(page).click();
    await next(page).click();
    await confirmButton(page).click();
    await expect(toast(page, "No se pudo confirmar el plan")).toBeVisible();
    await expect(step(page, "Confirmar")).toHaveAttribute("aria-current", "step");
    await expect(confirmButton(page)).toBeEnabled();
    await expect(confirmButton(page)).toBeFocused();
    await expect(closeButton(page)).toBeEnabled();
    expect(calls.patches).toHaveLength(1);
    await step(page, "Datos").click();
    await expect(page.getByLabel("Nombre")).toHaveValue("Nombre editado");
  });
});

test.describe("REQ-4, REQ-16: DELETE fails", () => {
  test.use({ expectedIssues: expectIssues(/DELETE \/api\/plans\/.* → 500/, /Failed to load resource.*500/) });

  test("toast, the result stays and focus returns to Cambiar PDF", async ({ page }) => {
    const calls = await mockWizardApi(page, { remove: "fail" });
    await openWizard(page);
    await uploadPdf(page);
    await changePdf(page).click();
    await expect(toast(page, "No se pudo quitar el PDF")).toBeVisible();
    await expect(resultHeading(page)).toBeVisible();
    await expect(changePdf(page)).toBeEnabled();
    await expect(changePdf(page)).toBeFocused();
    expect(calls.deletes).toBe(1);
  });
});

test.describe("REQ-16: upload fails", () => {
  test.use({ expectedIssues: expectIssues(/POST \/api\/plans\/upload → 500/, /Failed to load resource.*500/) });

  test("toast, the form stays and focus returns to Procesar PDF", async ({ page }) => {
    await mockWizardApi(page, { upload: "fail" });
    await openWizard(page);
    await submitPdf(page);
    await expect(toast(page, "No se pudo procesar el PDF")).toBeVisible();
    await expect(page.getByRole("button", { name: "Procesar PDF" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Procesar PDF" })).toBeEnabled();
    await expect(next(page)).toHaveCount(0);
    await expect(step(page, "Datos")).toHaveAttribute("aria-disabled", "true");
  });
});

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
    await expect(step(page, "Comidas")).toHaveAccessibleName(status("Comidas", "sin iniciar"));
    for (const label of ["Subir", "Comidas", "Confirmar"]) await expect(step(page, label)).not.toHaveAttribute("aria-current", /.*/);

    await next(page).click();
    await next(page).click();
    await expect(liveRegion(page)).toHaveText("Paso 4 de 4: Confirmar");
    for (const label of ["Subir", "Datos", "Comidas"]) await expect(step(page, label)).toHaveAccessibleName(status(label, "completada"));

    // Jumping back: the current step reads no status and Confirmar is reached but not passed.
    await step(page, "Datos").click();
    await expect(liveRegion(page)).toHaveText("Paso 2 de 4: Datos");
    await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
    await expect(step(page, "Datos")).not.toHaveAccessibleName(/completada|disponible|sin iniciar|con error/);
    await expect(step(page, "Confirmar")).toHaveAccessibleName(status("Confirmar", "disponible"));
    await expect(step(page, "Comidas")).toHaveAccessibleName(status("Comidas", "completada"));
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
    return { page: root.scrollWidth - root.clientWidth, content: content.scrollWidth - content.clientWidth };
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
    await next(page).click();
    await expect(page.locator(".stepper-caption")).toHaveText("Datos");

    const modal = (await page.locator(".upload-wizard-modal").boundingBox())!;
    const content = (await page.locator(".uw-content").boundingBox())!;
    expect(Math.abs(content.width - modal.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(content.x - modal.x)).toBeLessThanOrEqual(1);

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

    const header = (await page.locator(".uw-header").boundingBox())!;
    const footer = (await page.locator(".uw-footer").boundingBox())!;
    await content.evaluate((node) => node.scrollTo(0, node.scrollHeight));
    await expect.poll(() => content.evaluate((node) => Math.round(node.scrollHeight - node.clientHeight - node.scrollTop))).toBe(0);
    expect(await page.locator(".uw-header").boundingBox()).toEqual(header);
    expect(await page.locator(".uw-footer").boundingBox()).toEqual(footer);
    const last = (await content.locator(".item").last().boundingBox())!;
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
 * Clicks Siguiente inside the page, waits for the new step's description to be rendered and reads its opacity two
 * frames later, with no polling. The description fades in over 0.2s (a JS animation, so it never shows in
 * getAnimations()): at that moment it is done with reduced motion and still partway without it.
 */
const opacityTwoFramesIn = (page: Page, description: string) =>
  page.evaluate(async (text) => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const find = () => Array.from(document.querySelectorAll<HTMLElement>(".stepper-description")).find((node) => node.textContent === text);
    Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Siguiente")!.click();
    for (let waited = 0; !find() && waited < 120; waited++) await frame();
    const node = find();
    if (!node) throw new Error(`description "${text}" never rendered`);
    await frame();
    await frame();
    return Number(getComputedStyle(node).opacity);
  }, description);

test.describe("REQ-7: reduced motion", () => {
  test("the new description is already at rest right after the step changes, and the transitions are off", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    expect(await opacityTwoFramesIn(page, "Nombre, objetivo y calorías")).toBe(1);
    await expect(liveRegion(page)).toHaveText("Paso 2 de 4: Datos");
    const durations = await stepper(page).locator(".stepper-disc, .stepper-label").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).transitionDuration));
    expect(new Set(durations)).toEqual(new Set(["0s"]));
  });

  test("control: without reduced motion the same measurement catches the description mid-fade", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    expect(await opacityTwoFramesIn(page, "Nombre, objetivo y calorías")).toBeLessThan(1);
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
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await next(page).click();
    await next(page).click();
    const box = (await confirmButton(page).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});

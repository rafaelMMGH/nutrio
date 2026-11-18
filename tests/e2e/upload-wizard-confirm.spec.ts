import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";
import { confirmButton, mockWizardApi, next, openWizard, previous, step, toConfirmar, toDatos, uploadPdf } from "./upload-wizard-helpers";

// Confirmar summary (spec upload-wizard-stepper, US3: REQ-12, REQ-13). Every write is mocked.

const NOTE = "Las recetas con los mismos ingredientes, cantidades y unidades se reutilizan en lugar de duplicarse.";
const summary = (page: Page) => page.locator(".uw-summary");
const row = (page: Page, label: string): Locator => summary(page).locator("> div").filter({ has: page.getByText(label, { exact: true }) });
const recommendations = (page: Page) => page.getByRole("button", { name: "Recomendaciones" });

const withSupplements = {
  ...WIZARD_PLAN,
  structured_data: { ...WIZARD_PLAN.structured_data, supplements: [{ name: "Vitamina D" }, { name: "Omega 3" }] }
};

test.describe("REQ-12: the Confirmar summary", () => {
  test("shows the name, kcal, meals and options of the fixture, and no supplements block", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toConfirmar(page);
    await expect(page.getByRole("heading", { name: "Listo para confirmar" })).toBeVisible();
    await expect(row(page, "Plan").locator("dd")).toHaveText("Plan de prueba");
    await expect(row(page, "Calorías").locator("dd")).toHaveText("1800 kcal al día");
    await expect(row(page, "Comidas").locator("dd")).toHaveText("4 comidas y 6 opciones");
    // The fixture has no supplements: the block is not rendered at all, not even as an empty label.
    await expect(summary(page).locator("dt")).toHaveText(["Plan", "Calorías", "Comidas"]);
    await expect(page.getByText("Suplementos", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Sin suplementos")).toHaveCount(0);
  });

  test("a cleared name shows the hint instead of the detected name, and Confirmar plan is disabled", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    // Reaching Confirmar first raises `furthest` to 3, so the stepper keeps it selectable after jumping back to Datos (REQ-3).
    await toConfirmar(page);
    await step(page, "Datos").click();
    await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
    await page.getByLabel("Nombre").fill("");
    await step(page, "Confirmar").click();
    await expect(step(page, "Confirmar")).toHaveAttribute("aria-current", "step");
    // Datos has the same text, so the locator is scoped to the summary.
    await expect(summary(page).getByText("El nombre es obligatorio")).toBeVisible();
    await expect(summary(page).getByText("Plan de prueba")).toHaveCount(0);
    await expect(confirmButton(page)).toBeDisabled();
  });

  test("the edited name replaces the detected one, and Anterior and Siguiente keep it", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toDatos(page);
    await page.getByLabel("Nombre").fill("Plan de Ana");
    for (let i = 0; i < 2; i++) await next(page).click();
    await expect(step(page, "Confirmar")).toHaveAttribute("aria-current", "step");
    await expect(row(page, "Plan").locator("dd")).toHaveText("Plan de Ana");
    await previous(page).click();
    await next(page).click();
    await expect(row(page, "Plan").locator("dd")).toHaveText("Plan de Ana");
  });

  test("supplements appear when the plan has them", async ({ page }) => {
    await mockWizardApi(page, {}, withSupplements);
    await openWizard(page);
    await toConfirmar(page);
    await expect(summary(page).locator("dt")).toHaveText(["Plan", "Calorías", "Comidas", "Suplementos"]);
    await expect(row(page, "Suplementos").locator("dd")).toHaveText("Vitamina D, Omega 3");
  });

  test("a plan without recommendations has no Recomendaciones block", async ({ page }) => {
    await mockWizardApi(page, {}, { ...WIZARD_PLAN, structured_data: { ...WIZARD_PLAN.structured_data, recommendations: "" } });
    await openWizard(page);
    await toConfirmar(page);
    await expect(confirmButton(page)).toBeVisible();
    await expect(recommendations(page)).toHaveCount(0);
  });

  test("recommendations start collapsed and open and close with Enter and Space", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toConfirmar(page);
    const button = recommendations(page);
    const text = page.getByText("Beber dos litros de agua al día.", { exact: true });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(text).toBeHidden();
    const controls = await button.getAttribute("aria-controls");
    expect(controls).toBeTruthy();

    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(text).toBeVisible();
    await expect(page.locator(`[id="${controls}"]`)).toContainText("Beber dos litros de agua al día.");
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(text).toBeHidden();
    await page.keyboard.press("Space");
    await expect(text).toBeVisible();
  });

  test("the disclosure shows a focus ring", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toConfirmar(page);
    await expect(page.getByRole("heading", { name: "Listo para confirmar" })).toBeFocused();
    await page.keyboard.press("Tab");
    // The first Tab from the heading reaches the disclosure; the ring is its outline.
    await expect(recommendations(page)).toBeFocused();
    await expect(recommendations(page)).toHaveCSS("outline-style", "solid");
    expect(parseFloat(await recommendations(page).evaluate((el) => getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
  });

  test("Confirmar plan still sends the same PATCH", async ({ page }) => {
    const calls = await mockWizardApi(page);
    await openWizard(page);
    await toConfirmar(page);
    await confirmButton(page).click();
    await expect(page.locator(".upload-wizard-modal")).toHaveCount(0);
    expect(calls.patches).toEqual([{ processing_status: "confirmed" }]);
  });
});

test.describe("REQ-13: the reuse note", () => {
  test("is shown word for word, once", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toConfirmar(page);
    await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
    await expect(page.getByText(NOTE)).toHaveCount(1);
  });
});

test.describe("REQ-12, REQ-18: compact layout", () => {
  test("390px: no horizontal overflow and a 44px disclosure, with supplements and open recommendations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page, {}, withSupplements);
    await openWizard(page);
    await uploadPdf(page);
    for (let i = 0; i < 3; i++) await next(page).click();
    await expect(step(page, "Confirmar")).toHaveAttribute("aria-current", "step");
    await recommendations(page).click();
    await expect(recommendations(page)).toHaveAttribute("aria-expanded", "true");
    const box = (await recommendations(page).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const content = document.querySelector<HTMLElement>(".uw-content")!;
      return { page: root.scrollWidth - root.clientWidth, content: content.scrollWidth - content.clientWidth };
    });
    expect(overflow).toEqual({ page: 0, content: 0 });
  });
});

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";
import { confirmButton, mealCard, mockWizardApi, modal, next, openWizard, step, stepper, toConfirmar, toDatos, uploadPdf } from "./upload-wizard-helpers";

// Upload wizard Comidas review and Datos validation (spec upload-wizard-stepper, US2). Every write is mocked; the
// fixture has two options needing review (Desayuno "Huevos con jamón" and Comida "Pollo asado").

const TWO = "2 opciones necesitan revisión";
const errorSteps = (page: Page) => stepper(page).locator('li[data-status="error"]');
const cardHead = (page: Page, meal: string) => page.locator(".uw-content").getByRole("button", { name: new RegExp(`^${meal}\\b`) });

async function toComidas(page: Page) {
  await toDatos(page);
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Comidas" })).toBeFocused();
}

/** A copy of the fixture with its review flags set by meal and option index. */
function planWith(change: (meals: typeof WIZARD_PLAN.structured_data.meals) => void) {
  const plan = structuredClone(WIZARD_PLAN);
  change(plan.structured_data.meals);
  return plan;
}

test.describe("REQ-10, REQ-6: the Comidas error", () => {
  test("1280px: the marker, the caption and 'con error' show while Comidas is locked, on Comidas only", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    await expect(step(page, "Subir")).toHaveAttribute("aria-current", "step");
    await expect(step(page, "Comidas")).toHaveAttribute("aria-disabled", "true");
    await expect(step(page, "Comidas")).toHaveAccessibleName(/^Comidas\s*,\s*con error/);
    await expect(errorSteps(page)).toHaveCount(1);
    await expect(errorSteps(page)).toContainText("Comidas");
    await expect(stepper(page).locator(".stepper-error")).toHaveText([TWO]);
    for (const label of ["Subir", "Datos", "Confirmar"]) await expect(step(page, label)).not.toHaveAccessibleName(/con error/);
  });

  test("390px: the caption on Comidas reads '2 opciones necesitan revisión' and the other steps keep their name", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await toDatos(page);
    await expect(page.locator(".stepper-caption")).toHaveText("Datos");
    // Locked or not, the marker and its status carry the error while Comidas is not current.
    await expect(errorSteps(page)).toHaveCount(1);
    await expect(step(page, "Comidas")).toHaveAccessibleName(/^Comidas\s*,\s*con error/);
    await next(page).click();
    await expect(page.locator(".stepper-caption")).toHaveText(TWO);
    await expect(step(page, "Comidas")).toHaveAttribute("aria-current", "step");
  });

  test("the singular caption for one option", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockWizardApi(page, {}, planWith((meals) => (meals[1].options[0].requires_review = false)));
    await openWizard(page);
    await uploadPdf(page);
    await expect(stepper(page).locator(".stepper-error")).toHaveText(["1 opción necesita revisión"]);
  });

  test("no meals: the caption says so and Comidas shows the empty message", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockWizardApi(page, {}, planWith((meals) => meals.splice(0)));
    await openWizard(page);
    await uploadPdf(page);
    await expect(stepper(page).locator(".stepper-error")).toHaveText(["No se detectaron comidas en el PDF"]);
    await expect(errorSteps(page)).toHaveCount(1);
    await toDatos(page);
    await next(page).click();
    await expect(page.locator(".uw-content").getByText("No se detectaron comidas en el PDF.")).toBeVisible();
    await expect(page.locator(".uw-card")).toHaveCount(0);
  });

  test("nothing to review: no error anywhere", async ({ page }) => {
    await mockWizardApi(page, {}, planWith((meals) => meals.forEach((meal) => meal.options.forEach((option) => (option.requires_review = false)))));
    await openWizard(page);
    await uploadPdf(page);
    await expect(errorSteps(page)).toHaveCount(0);
    await expect(stepper(page).locator(".stepper-error")).toHaveCount(0);
  });

  test("the error never blocks navigation or confirming", async ({ page }) => {
    const calls = await mockWizardApi(page);
    await openWizard(page);
    await toConfirmar(page);
    await expect(errorSteps(page)).toHaveCount(1);
    await step(page, "Comidas").click();
    await expect(step(page, "Comidas")).toHaveAttribute("aria-current", "step");
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect(confirmButton(page)).toBeEnabled();
    await confirmButton(page).click();
    await expect(modal(page)).toHaveCount(0);
    expect(calls.patches).toEqual([{ processing_status: "confirmed" }]);
  });
});

test.describe("REQ-8, REQ-9, REQ-20: meal cards", () => {
  test("review meals start open with 'Requiere revisión'; the others start collapsed", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await toComidas(page);
    await expect(page.locator(".uw-card")).toHaveCount(4);
    for (const meal of ["Desayuno", "Comida"]) {
      await expect(cardHead(page, meal)).toHaveAttribute("aria-expanded", "true");
      await expect(cardHead(page, meal)).toContainText("Requiere revisión");
    }
    for (const meal of ["Colación", "Cena"]) {
      await expect(cardHead(page, meal)).toHaveAttribute("aria-expanded", "false");
      await expect(cardHead(page, meal)).not.toContainText("Requiere revisión");
    }
    await expect(page.locator(".uw-card-review")).toHaveCount(2);
  });

  test("the header shows name, time window and option count; the open body shows options, badge, add-ons and equivalents", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await toComidas(page);
    await expect(cardHead(page, "Desayuno")).toContainText("8:00 a.m.");
    await expect(cardHead(page, "Desayuno")).toContainText("2 opciones");
    await expect(cardHead(page, "Colación")).toContainText("1 opción");
    const body = mealCard(page, "Desayuno");
    await expect(body.getByText("Huevos con jamón")).toBeVisible();
    await expect(body.getByText("confianza 62%")).toBeVisible();
    await expect(body.getByText("40 g Jamón", { exact: true })).toBeVisible();
    await expect(body.getByText("Café")).toBeVisible();
    await expect(body.getByText("Equivalentes: Cereales 2 · Frutas 1")).toBeVisible();
    const closedBody = page.locator(`[id="${await cardHead(page, "Colación").getAttribute("aria-controls")}"]`);
    await expect(closedBody.getByText("1 taza Yogurt", { exact: true })).toBeHidden();
  });

  test("Enter and Space toggle aria-expanded and the controlled body", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await toComidas(page);
    const head = cardHead(page, "Colación");
    const bodyId = await head.getAttribute("aria-controls");
    expect(bodyId).toBeTruthy();
    const body = page.locator(`[id="${bodyId}"]`);
    await head.focus();
    await page.keyboard.press("Enter");
    await expect(head).toHaveAttribute("aria-expanded", "true");
    await expect(body.getByText("1 taza Yogurt", { exact: true })).toBeVisible();
    await page.keyboard.press(" ");
    await expect(head).toHaveAttribute("aria-expanded", "false");
    await expect(body).toBeHidden();
    await page.keyboard.press(" ");
    await expect(head).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Enter");
    await expect(head).toHaveAttribute("aria-expanded", "false");
    // An open review card closes the same way.
    await cardHead(page, "Desayuno").focus();
    await page.keyboard.press("Enter");
    await expect(cardHead(page, "Desayuno")).toHaveAttribute("aria-expanded", "false");
  });

  test("a keyboard-focused header shows a focus ring", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toComidas(page);
    const head = cardHead(page, "Colación");
    await head.focus();
    // A key press first, so the browser treats the focus as keyboard focus (:focus-visible).
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(head).toBeFocused();
    const outline = await head.evaluate((node) => ({ style: getComputedStyle(node).outlineStyle, width: parseFloat(getComputedStyle(node).outlineWidth) }));
    expect(outline).toEqual({ style: "solid", width: 2 });
  });

  test("a meal with no options shows 'Sin opciones detectadas'", async ({ page }) => {
    await mockWizardApi(page, {}, planWith((meals) => (meals[3].options = [])));
    await openWizard(page);
    await toComidas(page);
    await expect(cardHead(page, "Cena")).toContainText("0 opciones");
    await expect(page.locator(".uw-content").getByText("Sin opciones detectadas")).toBeHidden();
    await cardHead(page, "Cena").click();
    await expect(page.locator(".uw-content").getByText("Sin opciones detectadas")).toBeVisible();
  });

  test("390px: every card header is at least 44px tall and the content does not scroll sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await toComidas(page);
    const heads = page.locator(".uw-card-head");
    await expect(heads).toHaveCount(4);
    for (const box of await heads.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()))) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => { const c = document.querySelector<HTMLElement>(".uw-content")!; return c.scrollWidth - c.clientWidth; })).toBe(0);
  });
});

test.describe("REQ-11: Datos name validation", () => {
  test("an empty name shows the message tied to the input and blocks Siguiente", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toDatos(page);
    const name = page.getByLabel("Nombre");
    await expect(page.getByText("El nombre es obligatorio")).toHaveCount(0);
    await expect(name).toHaveAttribute("aria-invalid", "false");
    await name.fill("   ");
    await expect(page.getByText("El nombre es obligatorio")).toBeVisible();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription("El nombre es obligatorio");
    await expect(next(page)).toBeDisabled();
    await name.fill("Plan nuevo");
    await expect(page.getByText("El nombre es obligatorio")).toHaveCount(0);
    await expect(name).toHaveAttribute("aria-invalid", "false");
    await expect(next(page)).toBeEnabled();
  });
});

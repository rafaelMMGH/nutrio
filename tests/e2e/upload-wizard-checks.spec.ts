import type { Page } from "@playwright/test";
import { expect, expectIssues, test } from "./fixtures";
import { changePdf, choosePdf, closeButton, confirmButton, gate, mockWizardApi, modal, next, openWizard, previous, resultHeading, step, submitPdf, toast, toConfirmar, toDatos, uploadPdf } from "./upload-wizard-helpers";

// Upload wizard busy states and failures (spec upload-wizard-stepper, US1). Accessibility, layout, reduced motion and
// 44px targets live in upload-wizard-layout.spec.ts, navigation in upload-wizard.spec.ts. Every write is mocked.

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
    // A double click covers the disabled state: the button is disabled once the first click lands, so the second is ignored.
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

  test("two clicks in the same tick send one upload (the running guard, before the disabled state renders)", async ({ page }) => {
    const hold = gate();
    const calls = await mockWizardApi(page, { upload: hold.opened });
    await openWizard(page);
    await choosePdf(page);
    // Both clicks run before React re-renders, so only the ref guard can stop the second one.
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Procesar PDF")!;
      button.click();
      button.click();
    });
    await expect.poll(() => calls.uploads).toBe(1);
    hold.open();
    await expect(resultHeading(page)).toBeFocused();
    expect(calls.uploads).toBe(1);
  });

  test("Cambiar PDF shows busy, locks the controls and sends no second DELETE", async ({ page }) => {
    const hold = gate();
    const calls = await mockWizardApi(page, { remove: hold.opened });
    await openWizard(page);
    await toDatos(page);
    await previous(page).click();
    // Covers the disabled state, as above.
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
    // Covers the disabled state, as above.
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

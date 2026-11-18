import { expect, test } from "./fixtures";
import { closeButton, confirmButton, dropzone, expectNoToast, mockWizardApi, modal, next, openWizard, previous, resultHeading, rowRemove, step, stepper, toConfirmar, toDatos, uploadPdf } from "./upload-wizard-helpers";

// Upload wizard navigation (spec upload-wizard-stepper, US1). Failures, busy states, layout and accessibility live in
// upload-wizard-checks.spec.ts. Every write is mocked; the shared fixture is the upload response.

test.describe("REQ-1, REQ-5: the four steps and the footer", () => {
  test("four steps in order; no Siguiente before an upload and Anterior is disabled", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await expect(stepper(page).getByRole("listitem")).toHaveCount(4);
    await expect(stepper(page).locator(".stepper-label")).toHaveText(["Subir", "Datos", "Comidas", "Confirmar"]);
    // Only the active step shows its description.
    await expect(stepper(page).locator(".stepper-description")).toHaveText(["Tu PDF del plan"]);
    await expect(next(page)).toHaveCount(0);
    await expect(previous(page)).toBeDisabled();
    // Empty Subir (REQ-21): the dropzone is the only way in, so there is no "Procesar PDF" and no intro.
    await expect(page.getByRole("heading", { name: "Sube tu PDF" })).toBeVisible();
    await expect(dropzone(page)).toContainText("Arrastra tu PDF aquí");
    await expect(dropzone(page)).toContainText("Solo PDF · máximo 20 MB");
    await expect(page.getByRole("button", { name: "Procesar PDF" })).toHaveCount(0);
    // Nothing on the empty step renders a <p> (the dropzone prompt is made of spans).
    await expect(page.locator(".uw-content p")).toHaveCount(0);
    // The description follows the current step.
    await uploadPdf(page);
    // Filtered by text because the outgoing description is still in the DOM while it fades.
    // Comidas has 2 options to review, so its error caption replaces its description while it is current.
    const shown = [
      [".stepper-description", "Nombre, objetivo y calorías"],
      [".stepper-error", "2 opciones necesitan revisión"],
      [".stepper-description", "Revisa y activa el plan"]
    ];
    for (const [selector, text] of shown) {
      await next(page).click();
      await expect(stepper(page).locator(selector).filter({ hasText: text })).toBeVisible();
      if (text === "2 opciones necesitan revisión") {
        // Checked while Comidas is current, where the error must have replaced the description.
        await expect(stepper(page).locator(".stepper-description").filter({ hasText: "Opciones, ingredientes y complementos" })).toHaveCount(0);
      }
    }
  });

  test("an empty name disables Confirmar plan until a name exists", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toConfirmar(page);
    await expect(confirmButton(page)).toBeEnabled();
    await step(page, "Datos").click();
    await page.getByLabel("Nombre").fill("   ");
    await step(page, "Confirmar").click();
    await expect(confirmButton(page)).toBeDisabled();
    await step(page, "Datos").click();
    await page.getByLabel("Nombre").fill("Plan nuevo");
    await step(page, "Confirmar").click();
    await expect(confirmButton(page)).toBeEnabled();
  });
});

test.describe("REQ-3, REQ-4, REQ-16: moving between steps", () => {
  test("after the upload the wizard stays on Subir, with the result again after Anterior", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await uploadPdf(page);
    // Counts of the shared fixture (see tests/shared/wizard-plan-fixture.ts).
    await expect(page.locator(".uw-result-counts")).toHaveText("Detectado: 4 comidas, 6 opciones, 11 ingredientes y 2 complementos.");
    await expect(step(page, "Subir")).toHaveAttribute("aria-current", "step");
    await expect(rowRemove(page)).toHaveAccessibleName("Quitar plan.pdf");
    await expect(previous(page)).toBeDisabled();

    await next(page).click();
    await expect(page.getByRole("heading", { name: "Datos del plan" })).toBeFocused();
    await previous(page).click();
    await expect(resultHeading(page)).toBeFocused();
    await expect(rowRemove(page)).toHaveAccessibleName("Quitar plan.pdf");
    await expect(page.getByText("Listo para confirmar")).toHaveCount(0);
  });

  test("Confirmar is not selectable or focusable from Datos", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toDatos(page);
    await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
    const confirmar = step(page, "Confirmar");
    await expect(confirmar).toHaveAttribute("aria-disabled", "true");
    await expect(confirmar).toHaveAttribute("tabindex", "-1");
    await confirmar.click({ force: true });
    await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
    // The keyboard skips it too: End lands on the furthest reached step.
    await step(page, "Subir").focus();
    await page.keyboard.press("End");
    await expect(step(page, "Datos")).toBeFocused();
  });

  test("a stepper jump keeps focus on the stepper; Siguiente moves it to the heading", async ({ page }) => {
    await mockWizardApi(page);
    await openWizard(page);
    await toConfirmar(page);
    await step(page, "Datos").click();
    await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
    await expect(step(page, "Datos")).toBeFocused();
    await expect(page.getByRole("heading", { name: "Datos del plan" })).not.toBeFocused();
    // Jumping back does not lock the steps already reached, and the keyboard still gets to Confirmar.
    await expect(step(page, "Comidas")).not.toHaveAttribute("aria-disabled", "true");
    await expect(step(page, "Confirmar")).not.toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("End");
    await expect(step(page, "Confirmar")).toBeFocused();
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Comidas" })).toBeFocused();
  });

  test("the processed X sends one DELETE, empties the dropzone, focuses it and locks the steps", async ({ page }) => {
    const calls = await mockWizardApi(page);
    await openWizard(page);
    await toDatos(page);
    await page.getByLabel("Nombre").fill("Nombre editado");
    await previous(page).click();
    await rowRemove(page).click();

    await expect(dropzone(page)).toBeFocused();
    await expect(rowRemove(page)).toHaveCount(0);
    expect(calls.deletes).toBe(1);
    for (const label of ["Datos", "Comidas", "Confirmar"]) await expect(step(page, label)).toHaveAttribute("aria-disabled", "true");
    await expect(next(page)).toHaveCount(0);
    await expect(resultHeading(page)).toHaveCount(0);

    // The unsaved edit went with the PDF.
    await toDatos(page);
    await expect(page.getByLabel("Nombre")).toHaveValue("Plan de prueba");
    // Nothing from the first upload is reached any more.
    await expect(step(page, "Confirmar")).toHaveAccessibleName(/sin iniciar/);
  });
});

test.describe("REQ-5, REQ-15, REQ-17: confirming and closing", () => {
  test("the X closes at once, with unsaved edits, no prompt and no DELETE", async ({ page }) => {
    const calls = await mockWizardApi(page);
    let prompted = false;
    page.on("dialog", (dialog) => {
      prompted = true;
      void dialog.dismiss();
    });
    await openWizard(page);
    await toDatos(page);
    await page.getByLabel("Nombre").fill("Sin guardar");
    await closeButton(page).click();
    await expect(modal(page)).toHaveCount(0);
    expect(prompted).toBe(false);
    expect(calls.deletes).toBe(0);
    expect(calls.patches).toEqual([]);
  });

  test("confirming closes the wizard, shows no toast and sends the trimmed edits", async ({ page }) => {
    const calls = await mockWizardApi(page);
    await openWizard(page);
    await toDatos(page);
    await page.getByLabel("Nombre").fill("  Mi plan  ");
    await page.getByLabel("Objetivo").fill(" Ganar músculo ");
    await next(page).click();
    await next(page).click();
    await confirmButton(page).click();
    await expect(modal(page)).toHaveCount(0);
    await expectNoToast(page);
    expect(calls.patches).toEqual([{ processing_status: "confirmed", name: "Mi plan", objective: "Ganar músculo" }]);
    expect(calls.deletes).toBe(0);
  });
});

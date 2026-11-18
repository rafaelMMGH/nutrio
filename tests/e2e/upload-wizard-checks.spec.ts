import type { Page } from "@playwright/test";
import { expect, expectIssues, test } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";
import { addPdf, closeButton, confirmButton, dropFiles, dropzone, expectNoAlert, expectNoToast, fakeUploadXhr, gate, mockWizardApi, modal, next, openWizard, previous, resultHeading, retry, rowRemove, statusWith, step, toConfirmar, toDatos, uploadPdf } from "./upload-wizard-helpers";

// Upload wizard busy states and failures (spec upload-wizard-stepper, US1 and US4). Accessibility, layout, reduced motion and
// 44px targets live in upload-wizard-layout.spec.ts, navigation in upload-wizard.spec.ts. Every write is mocked, and
// no failure is a toast: each one is inline (REQ-15, REQ-16, REQ-24, REQ-25).

/** A disabled control ignores a forced click; the point is that nothing is sent. */
async function expectLocked(page: Page, labels: string[]) {
  await expect(closeButton(page)).toBeDisabled();
  for (const label of labels) await expect(step(page, label)).toHaveAttribute("aria-disabled", "true");
}

test.describe("REQ-14: one request at a time", () => {
  test("an upload in flight locks the controls, has no X and sends no second request", async ({ page }) => {
    const xhr = await fakeUploadXhr(page);
    await openWizard(page);
    await addPdf(page);
    await xhr.progress(40);
    await xhr.sent();
    await expect(page.locator(".fdz-status", { hasText: "Procesando PDF…" })).toBeVisible();
    await expect(rowRemove(page)).toHaveCount(0);
    await expect(previous(page)).toBeDisabled();
    await expect(next(page)).toHaveCount(0);
    await expectLocked(page, ["Subir", "Datos"]);
    await closeButton(page).click({ force: true });
    await expect(modal(page)).toBeVisible();
    // A second file is rejected while the row exists, so nothing more is sent.
    await dropFiles(page, [{ name: "otro.pdf", mimeType: "application/pdf" }]);
    expect(await xhr.requests()).toBe(1);
    await xhr.respond(200, WIZARD_PLAN);
    await expect(resultHeading(page)).toBeFocused();
    await expect(closeButton(page)).toBeEnabled();
    expect(await xhr.requests()).toBe(1);
  });

  test("the processed X shows busy, locks the controls and sends no second DELETE", async ({ page }) => {
    const hold = gate();
    const calls = await mockWizardApi(page, { remove: hold.opened });
    await openWizard(page);
    await toDatos(page);
    await previous(page).click();
    // Covers the disabled state: the X is disabled once the first click lands, so the second is ignored.
    await rowRemove(page).dblclick();
    await expect.poll(() => calls.deletes).toBe(1);
    await expect(rowRemove(page)).toHaveAttribute("aria-busy", "true");
    await expect(rowRemove(page)).toBeDisabled();
    await expect(rowRemove(page).locator(".fdz-spinner")).toBeVisible();
    await expect(next(page)).toBeDisabled();
    // Subir is step one, so Anterior is off anyway; it must stay off while the DELETE runs.
    await expect(previous(page)).toBeDisabled();
    await expectLocked(page, ["Datos"]);
    await rowRemove(page).click({ force: true });
    await step(page, "Datos").click({ force: true });
    await closeButton(page).click({ force: true });
    await expect(step(page, "Subir")).toHaveAttribute("aria-current", "step");
    await expect(modal(page)).toBeVisible();
    await expect.poll(() => calls.deletes).toBe(1);
    hold.open();
    await expect(dropzone(page)).toBeFocused();
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
    await expect(confirmButton(page).locator(".spin")).toBeVisible();
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
  test.use({ expectedIssues: expectIssues(/PATCH \/api\/plans\/.* → 500/, /Failed to load resource.*500/, /PATCH \/api\/plans\/.* → 500/, /Failed to load resource.*500/) });

  test("an inline status, the wizard stays on Confirmar with the edits, and focus returns to Confirmar plan", async ({ page }) => {
    const calls = await mockWizardApi(page, { patch: "fail" });
    await openWizard(page);
    await uploadPdf(page);
    await next(page).click();
    await page.getByLabel("Nombre").fill("Nombre editado");
    await next(page).click();
    await next(page).click();
    await confirmButton(page).click();
    await expect(statusWith(page, "No se pudo confirmar el plan: Fallo simulado")).toHaveCount(1);
    // The failure sits above the footer, not under the buttons.
    await expect.poll(async () => {
      const alert = await page.locator(".uw-confirm-alert").boundingBox();
      const footer = await page.locator(".uw-footer").boundingBox();
      return alert && footer ? alert.y + alert.height <= footer.y + 0.5 : false;
    }).toBe(true);
    await expectNoAlert(page);
    await expectNoToast(page);
    await expect(step(page, "Confirmar")).toHaveAttribute("aria-current", "step");
    await expect(confirmButton(page)).toBeEnabled();
    await expect(confirmButton(page)).toBeFocused();
    await expect(closeButton(page)).toBeEnabled();
    expect(calls.patches).toHaveLength(1);
    // A second failing attempt shows it again, once (two attempts, so two failed responses are declared above). The
    // current text node is tagged first: a new copy must be inserted for a screen reader to read it again.
    await page.locator(".uw-confirm-alert").evaluate((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.includes("No se pudo confirmar el plan")) node.parentElement?.setAttribute("data-x", "old");
      }
    });
    await expect(page.locator(".uw-confirm-alert [data-x]")).toHaveCount(1);
    await confirmButton(page).click();
    await expect.poll(() => calls.patches.length).toBe(2);
    await expect(statusWith(page, "No se pudo confirmar el plan: Fallo simulado")).toHaveCount(1);
    // The old copy leaving first means the visible one below is the new node.
    await expect(page.locator(".uw-confirm-alert [data-x]")).toHaveCount(0);
    await expect(page.locator(".uw-confirm-alert .alert-line")).toHaveText("No se pudo confirmar el plan: Fallo simulado");
    await expect(confirmButton(page)).toBeFocused();
    // Anterior clears it.
    await previous(page).click();
    await expect(statusWith(page, "No se pudo confirmar el plan")).toHaveCount(0);
    await step(page, "Datos").click();
    await expect(page.getByLabel("Nombre")).toHaveValue("Nombre editado");
  });
});

test.describe("REQ-4, REQ-16: DELETE fails", () => {
  // The failed response is two issues, and the hook also logs the error it caught.
  test.use({ expectedIssues: expectIssues(/DELETE \/api\/plans\/.* → 500/, /Failed to load resource.*500/, /No se pudo eliminar el plan/) });

  test("an inline status below the row, the result stays and focus returns to the X", async ({ page }) => {
    const calls = await mockWizardApi(page, { remove: "fail" });
    await openWizard(page);
    await uploadPdf(page);
    await rowRemove(page).click();
    await expect(statusWith(page, "No se pudo quitar el PDF. Inténtalo de nuevo.")).toHaveCount(1);
    // Below the row, not above or beside it.
    await expect.poll(async () => {
      const row = await page.locator(".fdz-row").boundingBox();
      const status = await statusWith(page, "No se pudo quitar el PDF").boundingBox();
      return row && status ? row.y + row.height <= status.y + 0.5 : false;
    }).toBe(true);
    await expectNoAlert(page);
    await expectNoToast(page);
    await expect(resultHeading(page)).toBeVisible();
    await expect(rowRemove(page)).toBeEnabled();
    await expect(rowRemove(page)).toBeFocused();
    expect(calls.deletes).toBe(1);
  });
});

test.describe("REQ-16, REQ-24: upload fails", () => {
  test.use({ expectedIssues: expectIssues(/POST \/api\/plans\/upload → 500/, /Failed to load resource.*500/) });

  test("the row fails with its reason, focus lands on Reintentar and nothing is an Alert or a toast", async ({ page }) => {
    await mockWizardApi(page, { upload: "fail" });
    await openWizard(page);
    await addPdf(page);
    // The polite .fdz-sr region repeats the text, so the visible copy is scoped to the row.
    await expect(page.locator(".fdz-reason")).toHaveText("No se pudo procesar el PDF: Fallo simulado");
    await expect(retry(page)).toBeFocused();
    await expectNoAlert(page);
    await expectNoToast(page);
    await expect(next(page)).toHaveCount(0);
    await expect(step(page, "Datos")).toHaveAttribute("aria-disabled", "true");
  });
});

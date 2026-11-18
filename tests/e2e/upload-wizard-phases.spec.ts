import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";
import { addPdf, alertWith, closeButton, dropzone, expectNoToast, fakeUploadXhr, gate, mockWizardApi, next, openWizard, previous, resultHeading, retry, rowRemove, step, watchAnnouncements, type Behavior } from "./upload-wizard-helpers";

// Upload wizard phases on Subir (spec upload-wizard-stepper, US4: REQ-14, REQ-16, REQ-23, REQ-25, REQ-26).
// The fake XHR proves the wizard's phase logic, not the real XHR: it never touches the network (so it produces no
// network issue, and a 413 or 500 raised through it is not a response the fixtures see; no test here declares expected
// issues). T030 has the real-XHR checks. Text locators are scoped to the row or a role: the polite `.fdz-sr` region
// repeats every announcement.

const NAME = "plan.pdf";
const row = (page: Page) => page.locator(".fdz-row");
const announcements = (page: Page) => page.locator(".fdz-sr");

/** Fake upload XHR, mocked wizard API (so no DELETE or PATCH reaches the database clone), wizard open, PDF added: phase "uploading". */
async function startUpload(page: Page, remove?: Behavior, size?: number) {
  const xhr = await fakeUploadXhr(page);
  const calls = await mockWizardApi(page, { remove });
  await openWizard(page);
  await addPdf(page, { name: NAME, mimeType: "application/pdf", size });
  await expect(row(page).locator(".fdz-status")).toContainText("Subiendo");
  return { xhr, calls };
}

type Expected = { closeX: "enabled" | "disabled"; siguiente: "hidden" | "enabled" | "disabled"; stepper: "locked" | "subir-only"; rowX: string | null };

/** One row of the REQ-14 table for Subir; Anterior is disabled in every phase, and Reintentar is only in the failed phase. "subir-only" is the stepper of the processed phase: only Subir can be selected. */
async function expectControls(page: Page, { closeX, siguiente, stepper, rowX }: Expected) {
  await expect(closeButton(page)).toBeEnabled({ enabled: closeX === "enabled" });
  await expect(previous(page)).toBeDisabled();
  if (siguiente === "hidden") await expect(next(page)).toHaveCount(0);
  else await expect(next(page)).toBeEnabled({ enabled: siguiente === "enabled" });
  if (stepper === "locked") {
    for (const label of ["Subir", "Datos"]) await expect(step(page, label)).toHaveAttribute("aria-disabled", "true");
  } else {
    await expect(step(page, "Subir")).not.toHaveAttribute("aria-disabled", "true");
    await expect(step(page, "Datos")).toHaveAttribute("aria-disabled", "true");
    await expect(step(page, "Datos")).toHaveAttribute("tabindex", "-1");
  }
  if (rowX === null) await expect(rowRemove(page)).toHaveCount(0);
  else await expect(rowRemove(page)).toHaveAccessibleName(rowX);
  await expect(retry(page)).toHaveCount(0);
}

test("REQ-23: uploading shows N%, a progress bar, the size and a named cancel X", async ({ page }) => {
  const { xhr, calls } = await startUpload(page, undefined, 1_258_291);
  await xhr.progress(40);
  await expect(row(page).locator(".fdz-status")).toHaveText("Subiendo… 40%");
  const bar = row(page).getByRole("progressbar");
  await expect(bar).toHaveAttribute("aria-valuenow", "40");
  await expect(bar).toHaveAttribute("aria-valuemin", "0");
  await expect(bar).toHaveAttribute("aria-valuemax", "100");
  await expect(bar).toHaveAccessibleName(`Subiendo ${NAME}`);
  await expect(row(page).getByRole("button", { name: `Cancelar subida de ${NAME}` })).toBeVisible();
  await expect(row(page).locator(".fdz-size")).toHaveText("1.2 MB");
  expect(calls.uploads).toBe(0);
});

test("REQ-14: the control state of every Subir phase from uploading to deleting", async ({ page }) => {
  const hold = gate();
  const { xhr, calls } = await startUpload(page, hold.opened);
  await xhr.progress(40);
  await expectControls(page, { closeX: "disabled", siguiente: "hidden", stepper: "locked", rowX: `Cancelar subida de ${NAME}` });

  await xhr.sent();
  await expect(row(page).locator(".fdz-status")).toHaveText("Procesando PDF…");
  await expectControls(page, { closeX: "disabled", siguiente: "hidden", stepper: "locked", rowX: null });

  await xhr.respond(200, WIZARD_PLAN);
  await expect(resultHeading(page)).toBeFocused();
  await expectControls(page, { closeX: "enabled", siguiente: "enabled", stepper: "subir-only", rowX: `Quitar ${NAME}` });

  await rowRemove(page).click();
  await expect.poll(() => calls.deletes).toBe(1);
  await expectControls(page, { closeX: "disabled", siguiente: "disabled", stepper: "locked", rowX: `Quitar ${NAME}` });
  await expect(rowRemove(page)).toBeDisabled();
  await expect(rowRemove(page)).toHaveAttribute("aria-busy", "true");

  hold.open();
  await expect(dropzone(page)).toBeFocused();
  await expect(closeButton(page)).toBeEnabled();
  expect(calls.uploads).toBe(0);
});

test.describe("REQ-23: cancel", () => {
  test("aborts, removes the row, focuses the dropzone and creates no draft; a late answer and a second click change nothing", async ({ page }) => {
    const { xhr, calls } = await startUpload(page);
    await xhr.progress(40);
    // Two clicks in one task, before React can unmount the row: the second reaches the same mounted button, and nothing is aborted twice.
    await rowRemove(page).evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(row(page)).toHaveCount(0);
    await expect(dropzone(page)).toBeFocused();
    expect(await xhr.aborted()).toBe(1);
    expect(await xhr.requests()).toBe(1);
    await xhr.sent();
    await xhr.respond(200, WIZARD_PLAN);
    await expect(row(page)).toHaveCount(0);
    await expect(resultHeading(page)).toHaveCount(0);
    await expect(announcements(page)).not.toContainText("PDF procesado");
    await expect(dropzone(page)).toBeFocused();
    expect(await xhr.aborted()).toBe(1);
    expect(await xhr.requests()).toBe(1);
    expect(calls.deletes).toBe(0);
    expect(calls.patches).toHaveLength(0);
    expect(calls.uploads).toBe(0);
    await expectNoToast(page);
  });
});

test.describe("REQ-16: the cancel X at 100%", () => {
  test("with focus on it, the row goes to Procesando, the X disappears and focus moves to the dropzone", async ({ page }) => {
    const { xhr, calls } = await startUpload(page);
    await rowRemove(page).focus();
    await xhr.sent();
    await expect(row(page).locator(".fdz-status")).toHaveText("Procesando PDF…");
    await expect(rowRemove(page)).toHaveCount(0);
    await expect(dropzone(page)).toBeFocused();
    expect(calls.uploads).toBe(0);
  });

  test("with focus elsewhere, focus does not move", async ({ page }) => {
    const { xhr, calls } = await startUpload(page);
    // Focus on something the row's change does not own: it must stay there (the dropzone would pass by accident).
    await step(page, "Subir").focus();
    await xhr.sent();
    await expect(row(page).locator(".fdz-status")).toHaveText("Procesando PDF…");
    await expect(rowRemove(page)).toHaveCount(0);
    await expect(step(page, "Subir")).toBeFocused();
    expect(calls.uploads).toBe(0);
  });
});

test.describe("REQ-16, REQ-25: processing becomes processed", () => {
  test("announces PDF procesado once, focuses the heading and stays on Subir", async ({ page }) => {
    const { xhr, calls } = await startUpload(page);
    const announced = await watchAnnouncements(page);
    await xhr.sent();
    await expect(announcements(page)).toHaveText(`Se agregó ${NAME}`);
    await xhr.respond(200, WIZARD_PLAN);
    await expect(announcements(page)).toHaveText(`PDF procesado: ${NAME}`);
    expect(await announced.count("PDF procesado")).toBe(1);
    expect(calls.uploads).toBe(0);
    await expect(resultHeading(page)).toBeFocused();
    await expect(step(page, "Subir")).toHaveAttribute("aria-current", "step");
    await expectNoToast(page);
  });

  test("sent and the answer in the same tick (a batch) still announce PDF procesado", async ({ page }) => {
    const { calls } = await startUpload(page);
    await page.evaluate((body) => {
      const fake = (window as unknown as { __fakeUpload: { sent(): void; respond(status: number, body: unknown): void } }).__fakeUpload;
      fake.sent();
      fake.respond(200, body);
    }, WIZARD_PLAN);
    await expect(announcements(page)).toHaveText(`PDF procesado: ${NAME}`);
    await expect(resultHeading(page)).toBeFocused();
    expect(calls.uploads).toBe(0);
  });
});

test("REQ-26: a 413 during Subiendo is a rejection that removes the row and focuses the dropzone", async ({ page }) => {
  const { xhr, calls } = await startUpload(page);
  await xhr.progress(40);
  await xhr.respond(413, { error: "cualquier texto" });
  await expect(alertWith(page, "El PDF pesa más de 20 MB")).toBeVisible();
  await expect(row(page)).toHaveCount(0);
  await expect(dropzone(page)).toBeFocused();
  await expect(retry(page)).toHaveCount(0);
  await expectNoToast(page);
  expect(calls.deletes).toBe(0);
  expect(calls.uploads).toBe(0);
});

test.describe("REQ-25: reduced motion", () => {
  test("control: without reduced motion the bar fill tweens and the indeterminate bar animates", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const { xhr, calls } = await startUpload(page);
    // Progress and sampling in one task, so the round trip of a separate call cannot outlast the tween.
    const scales = await page.evaluate(() => {
      const fake = (window as unknown as { __fakeUpload: { progress(n: number): void } }).__fakeUpload;
      fake.progress(40);
      return new Promise<number[]>((resolve) => {
        const fill = document.querySelector(".fdz-bar-fill")!;
        const samples: number[] = [];
        const frame = () => {
          samples.push(new DOMMatrix(getComputedStyle(fill).transform).a);
          if (samples.length >= 8) resolve(samples);
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    });
    expect(scales.some((scale) => scale > 0 && scale < 0.4), `samples ${scales}`).toBe(true);
    expect(new Set(scales).size, `samples ${scales}`).toBeGreaterThan(1);

    await xhr.sent();
    await expect(row(page).locator(".fdz-status")).toHaveText("Procesando PDF…");
    const bar = row(page).locator(".fdz-bar[data-indeterminate] .fdz-bar-fill");
    expect(await bar.evaluate((node) => getComputedStyle(node).animationName)).not.toBe("none");
    expect(calls.uploads).toBe(0);
  });

  test("the progress bar jumps with no tween and the indeterminate bar does not animate", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { xhr, calls } = await startUpload(page);
    await xhr.progress(40);
    await expect(row(page).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    // Two consecutive frames: a tween would still be between 0 and 0.4 in the first one.
    const scales = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const fill = document.querySelector(".fdz-bar-fill")!;
          const scale = () => new DOMMatrix(getComputedStyle(fill).transform).a;
          requestAnimationFrame(() => {
            const first = scale();
            requestAnimationFrame(() => resolve([first, scale()]));
          });
        })
    );
    expect(scales[0]).toBeCloseTo(0.4, 5);
    expect(scales[1]).toBeCloseTo(0.4, 5);

    await xhr.sent();
    await expect(row(page).locator(".fdz-status")).toHaveText("Procesando PDF…");
    const bar = row(page).locator(".fdz-bar[data-indeterminate] .fdz-bar-fill");
    await expect(bar).toHaveCSS("animation-name", "none");
    expect(await bar.evaluate((node) => node.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
    expect(calls.uploads).toBe(0);
  });
});

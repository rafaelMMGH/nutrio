import type { Locator, Page } from "@playwright/test";
import { expect, expectIssues, test } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";
import { seedTheme } from "./theme-helpers";
import { addPdf, closeButton, dropzone, expectNoAlert, expectNoToast, heldUpload, mockWizardApi, modal, openWizard, resultHeading, retry, rowRemove, step, watchAnnouncements } from "./upload-wizard-helpers";

// Upload wizard outcomes with the real XHR (spec upload-wizard-stepper, US4, T030): failures, retry, the row's X, the real
// cancel, long names, 44px targets, focus rings and reduced motion. Outcomes come from page.route, so the browser's own
// XMLHttpRequest runs. Every write is mocked (mockWizardApi), and none of these tests fails a DELETE.

type Outcome = "ok" | "abort" | { status: number; body: string; contentType: string };
const MESSAGE: Outcome = { status: 500, body: JSON.stringify({ error: "Fallo simulado" }), contentType: "application/json" };
const EMPTY_500: Outcome = { status: 500, body: "", contentType: "application/json" };
const HTML_500: Outcome = { status: 500, body: "<html><body>Internal Server Error</body></html>", contentType: "text/html" };

/** Answers each upload POST with the next outcome (the last one repeats) and records what was sent. Registered after mockWizardApi, so it wins for the upload. */
async function routeUploads(page: Page, ...outcomes: Outcome[]) {
  const sent: { fileName: string | undefined }[] = [];
  await page.route(/\/api\/plans\/upload$/, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const outcome = outcomes[Math.min(sent.length, outcomes.length - 1)];
    sent.push({ fileName: route.request().headers()["x-file-name"] });
    if (outcome === "abort") return route.abort("connectionreset");
    if (outcome === "ok") return route.fulfill({ status: 200, json: WIZARD_PLAN });
    return route.fulfill({ status: outcome.status, body: outcome.body, contentType: outcome.contentType });
  });
  return sent;
}

const reason = (page: Page) => page.locator(".fdz-row .fdz-reason");
const row = (page: Page) => page.locator(".fdz-row");
const FAILED_500 = /POST \/api\/plans\/upload → 500/;
const LOG_500 = /Failed to load resource.*500/;
// T016: confirm. A GUESS that Chromium logs an aborted connection as a console error "Failed to load resource: net::ERR_CONNECTION_RESET".
const LOG_RESET = /Failed to load resource.*net::ERR_CONNECTION_RESET/;

async function expectEmptyAndFocused(page: Page) {
  await expect(row(page)).toHaveCount(0);
  await expect(dropzone(page)).toBeFocused();
}

/** Tabs from the wizard's X until `target` has focus, as a keyboard user would. */
async function tabTo(page: Page, target: Locator) {
  await closeButton(page).focus();
  for (let i = 0; i < 20 && !(await target.evaluate((node) => node === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
}

async function expectFocusRing(target: Locator) {
  const ring = await target.evaluate((node) => ({ style: getComputedStyle(node).outlineStyle, width: parseFloat(getComputedStyle(node).outlineWidth) }));
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThanOrEqual(2);
}

test.describe("REQ-24: the upload fails", () => {
  const cases: { title: string; outcome: Outcome; text: string; issues: RegExp[] }[] = [
    { title: "500 with an error message", outcome: MESSAGE, text: "No se pudo procesar el PDF: Fallo simulado", issues: [FAILED_500, LOG_500] },
    { title: "500 with an empty body", outcome: EMPTY_500, text: "No se pudo procesar el PDF: error del servidor (500)", issues: [FAILED_500, LOG_500] },
    { title: "500 with an HTML body", outcome: HTML_500, text: "No se pudo procesar el PDF: error del servidor (500)", issues: [FAILED_500, LOG_500] },
    { title: "a dropped connection", outcome: "abort", text: "No se pudo procesar el PDF: sin conexión con el servidor", issues: [LOG_RESET] }
  ];
  for (const { title, outcome, text, issues } of cases) {
    test.describe(title, () => {
      test.use({ expectedIssues: expectIssues(...issues) });

      test("shows the reason, focuses Reintentar, names the X, is no Alert or toast and is announced once", async ({ page }) => {
        await mockWizardApi(page);
        await routeUploads(page, outcome);
        await openWizard(page);
        const announced = await watchAnnouncements(page);
        await addPdf(page);
        await expect(reason(page)).toHaveText(text);
        await expect(retry(page)).toBeFocused();
        await expect(rowRemove(page)).toHaveAccessibleName("Quitar plan.pdf");
        await expectNoAlert(page);
        await expectNoToast(page);
        await expect.poll(() => announced.count(text)).toBe(1);
        await expect(page.locator(".fdz-sr")).toHaveText(text);
      });
    });
  }
});

test.describe("REQ-24, REQ-16: Reintentar", () => {
  test.describe("then it succeeds", () => {
    test.use({ expectedIssues: expectIssues(FAILED_500, LOG_500) });

    test("sends the same file as a new request, focuses the dropzone while it is sent, then the heading, and ends processed", async ({ page }) => {
      // The page-side recorder sees the File the XHR sends (the route's postData is not reliable for a File body).
      await page.addInitScript(() => {
        const sends: { name: string; size: number }[] = [];
        (window as unknown as { __sends: typeof sends }).__sends = sends;
        const send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
          if (body instanceof File) sends.push({ name: body.name, size: body.size });
          return send.call(this, body);
        };
      });
      const fileNames: (string | undefined)[] = [];
      page.on("request", (request) => {
        if (request.method() === "POST" && request.url().endsWith("/api/plans/upload")) fileNames.push(request.headers()["x-file-name"]);
      });
      await mockWizardApi(page);
      const sent = await routeUploads(page, MESSAGE);
      await openWizard(page);
      await addPdf(page, { name: "dieta.pdf", mimeType: "application/pdf", size: 2048 });
      await expect(retry(page)).toBeFocused();
      // Registered after routeUploads, so it wins for the second attempt.
      const hold = await heldUpload(page);
      await retry(page).click();
      await expect(row(page).getByText(/Subiendo/)).toBeVisible();
      await expect(dropzone(page)).toBeFocused();
      await expect.poll(() => hold.requests()).toBe(1);
      await hold.release(200, WIZARD_PLAN);
      await expect(resultHeading(page)).toBeFocused();
      expect(sent).toHaveLength(1);
      expect(fileNames).toHaveLength(2);
      expect(fileNames[0]).toBeDefined();
      expect(fileNames[1]).toBe(fileNames[0]);
      expect(await page.evaluate(() => (window as unknown as { __sends: unknown[] }).__sends)).toEqual([
        { name: "dieta.pdf", size: 2048 },
        { name: "dieta.pdf", size: 2048 }
      ]);
      await expect(rowRemove(page)).toHaveAccessibleName("Quitar dieta.pdf");
      await expectNoAlert(page);
    });
  });

  test.describe("then it fails again", () => {
    test.use({ expectedIssues: expectIssues(FAILED_500, LOG_500, FAILED_500, LOG_500) });

    test("lands on Reintentar again and announces the second failure again", async ({ page }) => {
      await mockWizardApi(page);
      const sent = await routeUploads(page, MESSAGE);
      await openWizard(page);
      const announced = await watchAnnouncements(page);
      await addPdf(page);
      await expect(retry(page)).toBeFocused();
      await retry(page).click();
      await expect.poll(() => sent.length).toBe(2);
      await expect(reason(page)).toHaveText("No se pudo procesar el PDF: Fallo simulado");
      await expect(retry(page)).toBeFocused();
      await expect.poll(() => announced.count("No se pudo procesar el PDF: Fallo simulado")).toBe(2);
    });
  });
});

test.describe("REQ-4, REQ-16: the row's X restarts", () => {
  test.describe("on a failed row", () => {
    test.use({ expectedIssues: expectIssues(FAILED_500, LOG_500) });

    test("removes the file with no DELETE, empties the dropzone and focuses it", async ({ page }) => {
      const calls = await mockWizardApi(page);
      await routeUploads(page, MESSAGE);
      await openWizard(page);
      await addPdf(page);
      await expect(retry(page)).toBeFocused();
      await rowRemove(page).click();
      await expectEmptyAndFocused(page);
      expect(calls.deletes).toBe(0);
    });
  });

  test("on a processed row sends exactly one DELETE, with no confirmation, empties the dropzone and focuses it", async ({ page }) => {
    const calls = await mockWizardApi(page);
    await openWizard(page);
    await addPdf(page);
    await expect(resultHeading(page)).toBeFocused();
    // A throw inside the handler would not fail the test; record and dismiss instead, then assert nothing was asked.
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss(); });
    await rowRemove(page).click();
    await expectEmptyAndFocused(page);
    expect(calls.deletes).toBe(1);
    expect(dialogs).toEqual([]);
    await expect(modal(page)).toBeVisible();
  });

  test("a restart then a second plan shows the second plan's counts and no stale Comidas error", async ({ page }) => {
    const planB = structuredClone(WIZARD_PLAN);
    // Colación and Cena: no option needs review, so Comidas has nothing to flag.
    planB.structured_data.meals = planB.structured_data.meals.slice(2);
    planB.structured_data.name = "Plan B";
    const calls = await mockWizardApi(page);
    await openWizard(page);
    await addPdf(page);
    await expect(resultHeading(page)).toBeFocused();
    await expect(page.locator(".uw-result-counts")).toContainText("Detectado: 4 comidas, 6 opciones, 11 ingredientes");
    await expect(step(page, "Comidas")).toHaveAccessibleName(/con error/);

    await rowRemove(page).click();
    await expectEmptyAndFocused(page);
    expect(calls.deletes).toBe(1);

    // Registered later, so it wins: the second upload is answered with plan B.
    await page.route(/\/api\/plans\/upload$/, (route) => route.request().method() === "POST" ? route.fulfill({ status: 200, json: planB }) : route.fallback());
    await addPdf(page);
    await expect(resultHeading(page)).toBeFocused();
    await expect(page.locator(".uw-result-counts")).toContainText("Detectado: 2 comidas, 2 opciones, 3 ingredientes");
    await expect(step(page, "Comidas")).not.toHaveAccessibleName(/con error/);
    expect(calls.uploads).toBe(1);
  });
});

test.describe("REQ-17: the wizard's X", () => {
  test.use({ expectedIssues: expectIssues(FAILED_500, LOG_500) });

  test("closes at once on a failed row and sends no DELETE", async ({ page }) => {
    const calls = await mockWizardApi(page);
    await routeUploads(page, MESSAGE);
    await openWizard(page);
    await addPdf(page);
    await expect(retry(page)).toBeFocused();
    await closeButton(page).click();
    await expect(modal(page)).toBeHidden();
    expect(calls.deletes).toBe(0);
  });
});

test.describe("REQ-23: cancelling a real XHR", () => {
  test("aborts the upload: no completion, no draft, the row is gone", async ({ page }) => {
    const calls = await mockWizardApi(page);
    const hold = await heldUpload(page);
    await openWizard(page);
    const announced = await watchAnnouncements(page);
    await addPdf(page);
    // Risk: Chromium may fire upload.onload before the held route resolves, so the row could already read "Procesando PDF…"
    // with no cancel X. This asserts "Subiendo" first; if it fails at T016, the fix is CDP throttling (Network.emulateNetworkConditions)
    // for this test only.
    await expect(row(page).getByText(/Subiendo/)).toBeVisible();
    await expect(rowRemove(page)).toHaveAccessibleName("Cancelar subida de plan.pdf");
    await expect.poll(() => hold.requests()).toBe(1);
    const aborted = page.waitForEvent("requestfailed", (request) => request.url().endsWith("/api/plans/upload"));
    await rowRemove(page).click();
    expect((await aborted).failure()?.errorText).toContain("ERR_ABORTED");
    await expectEmptyAndFocused(page);
    await hold.release(200, WIZARD_PLAN);
    await expect(resultHeading(page)).toHaveCount(0);
    await expect(row(page)).toHaveCount(0);
    expect(await announced.count("PDF procesado")).toBe(0);
    expect(calls.deletes).toBe(0);
  });
  // Declared issues: none. T016: confirm that a route held and then abandoned is not a network issue, and that the client abort
  // is silent in Chromium (no console error); the fixtures would fail the test otherwise.
});

test.describe("REQ-23, REQ-18: a long file name", () => {
  const name = `${"plan-nutricional-".repeat(9)}`.slice(0, 136) + ".pdf";

  /** One line with an ellipsis, and the size, the X and the page itself inside the 390px viewport, whatever the phase. */
  async function expectNameFits(page: Page, removeName: string) {
    const label = row(page).locator(".fdz-name");
    await expect(label).toHaveAttribute("title", name);
    await expect(rowRemove(page)).toHaveAccessibleName(removeName);
    const metrics = await label.evaluate((node) => {
      const style = getComputedStyle(node);
      return { clipped: node.scrollWidth > node.clientWidth, ellipsis: style.textOverflow, wrap: style.whiteSpace, height: node.getBoundingClientRect().height, line: parseFloat(style.lineHeight) };
    });
    expect(metrics).toMatchObject({ clipped: true, ellipsis: "ellipsis", wrap: "nowrap" });
    expect(metrics.height).toBeLessThanOrEqual(metrics.line + 1);
    await expect(row(page).locator(".fdz-size")).toBeVisible();
    for (const target of [row(page).locator(".fdz-size"), rowRemove(page)]) {
      const box = (await target.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await modal(page).evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }

  const file = { name, mimeType: "application/pdf", size: 2048 };

  test("processed: stays on one line with an ellipsis and keeps the size and the X in view at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page);
    await openWizard(page);
    await addPdf(page, file);
    await expect(resultHeading(page)).toBeFocused();
    expect(name).toHaveLength(140);
    await expectNameFits(page, `Quitar ${name}`);
  });

  test("uploading: the same at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockWizardApi(page);
    const hold = await heldUpload(page);
    await openWizard(page);
    await addPdf(page, file);
    await expect(row(page).getByText(/Subiendo/)).toBeVisible();
    await expectNameFits(page, `Cancelar subida de ${name}`);
    await rowRemove(page).click();
    await hold.release(200, WIZARD_PLAN);
  });

  test.describe("failed", () => {
    test.use({ expectedIssues: expectIssues(FAILED_500, LOG_500) });

    test("the same at 390px", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await mockWizardApi(page);
      await routeUploads(page, MESSAGE);
      await openWizard(page);
      await addPdf(page, file);
      await expect(retry(page)).toBeFocused();
      await expectNameFits(page, `Quitar ${name}`);
    });
  });
});

test.describe("REQ-19: targets and focus rings", () => {
  test.use({ expectedIssues: expectIssues(FAILED_500, LOG_500) });

  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: at 390px the trigger, Reintentar and the X are 44px tall, the X 44px wide, and each shows a ring after Tab`, async ({ page }) => {
      await seedTheme(page, theme);
      await page.setViewportSize({ width: 390, height: 800 });
      await mockWizardApi(page);
      await routeUploads(page, MESSAGE);
      await openWizard(page);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(theme);
      await tabTo(page, dropzone(page));
      await expectFocusRing(dropzone(page));
      expect((await dropzone(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await addPdf(page);
      await expect(retry(page)).toBeVisible();
      expect((await retry(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const x = (await rowRemove(page).boundingBox())!;
      expect(x.height).toBeGreaterThanOrEqual(44);
      expect(x.width).toBeGreaterThanOrEqual(44);
      await tabTo(page, retry(page));
      await expectFocusRing(retry(page));
      await page.keyboard.press("Tab");
      await expect(rowRemove(page)).toBeFocused();
      await expectFocusRing(rowRemove(page));
    });
  }
});

test.describe("REQ-25: the row appears", () => {
  /** Starts sampling before the row exists: ten frames of its vertical offset once it is in the DOM. */
  const sampleRowOffsets = (page: Page) =>
    page.evaluate(() => new Promise<number[]>((resolve) => {
      const offsets: number[] = [];
      const frame = () => {
        const node = document.querySelector(".fdz-row");
        if (node) {
          const transform = getComputedStyle(node).transform;
          offsets.push(transform === "none" ? 0 : new DOMMatrix(transform).m42);
        }
        if (offsets.length >= 10) resolve(offsets);
        else requestAnimationFrame(frame);
      };
      frame();
    }));

  test("reduced motion: without movement", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockWizardApi(page);
    const hold = await heldUpload(page);
    await openWizard(page);
    const sampling = sampleRowOffsets(page);
    await addPdf(page);
    expect(await sampling).toEqual(Array(10).fill(0));
    await rowRemove(page).click();
    await hold.release(200, WIZARD_PLAN);
  });

  test("control: without reduced motion some sample has a nonzero y", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await mockWizardApi(page);
    const hold = await heldUpload(page);
    await openWizard(page);
    const sampling = sampleRowOffsets(page);
    await addPdf(page);
    const offsets = await sampling;
    expect(offsets.some((offset) => offset !== 0), `samples ${offsets}`).toBe(true);
    await rowRemove(page).click();
    await hold.release(200, WIZARD_PLAN);
  });
});

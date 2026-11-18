import { readdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, expectIssues, test } from "./fixtures";
import { addPdf, alertWith, retry, closeButton, dropFiles, dropzone, expectNoAlert, expectNoToast, fakeUploadXhr, openWizard, pasteFiles, rowRemove, statusWith, type TestFile } from "./upload-wizard-helpers";

// Dropzone behavior of the Subir step (spec upload-wizard-stepper, US4): adding, rejections, the 413 and reduced motion.
// Nothing reaches the database: the upload is a fake XHR, or a mocked route where the response status matters.

const PDF: TestFile = { name: "plan.pdf", mimeType: "application/pdf" };
const IMAGE: TestFile = { name: "foto.png", mimeType: "image/png" };
const MiB = 1024 * 1024;
const ONE_AT_A_TIME = "Sube un solo PDF a la vez";
const TOO_BIG = "El PDF pesa más de 20 MB";
const rows = (page: Page) => page.locator(".fdz-row");

/** Opens the wizard with the upload faked; the returned handle counts the requests the wizard sent. */
async function open(page: Page) {
  const upload = await fakeUploadXhr(page);
  await openWizard(page);
  return upload;
}

/** Fires a drag event carrying a file at the zone; the component ignores drag events whose dataTransfer lacks "Files". */
const fireDrag = (page: Page, type: "dragenter" | "dragleave") =>
  page.evaluate((eventType) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "plan.pdf", { type: "application/pdf" }));
    document.querySelector(".fdz-zone")!.dispatchEvent(new DragEvent(eventType, { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, type);

/** Fires `dragenter`, as the browser does when the pointer brings a file over the zone. */
const dragEnter = (page: Page) => fireDrag(page, "dragenter");

/** Fires `dragleave` leaving the zone for outside the page (no relatedTarget), as the browser does when the pointer exits. */
const dragLeave = (page: Page) => fireDrag(page, "dragleave");

test.describe("REQ-21: adding a file", () => {
  const ways: [string, (page: Page) => Promise<unknown>][] = [
    ["picker", (page) => addPdf(page, PDF)],
    ["drop", (page) => dropFiles(page, [PDF])],
    ["paste", (page) => pasteFiles(page, [PDF])]
  ];
  for (const [way, add] of ways) {
    test(`${way} starts the upload with no extra click and announces it`, async ({ page }) => {
      const upload = await open(page);
      await add(page);
      await expect.poll(() => upload.requests()).toBe(1);
      await expect(rows(page)).toContainText("plan.pdf");
      await expect(page.locator(".fdz-sr")).toContainText("Se agregó plan.pdf");
    });
  }

  for (const key of ["Enter", "Space"]) {
    test(`the trigger is one button and ${key} opens the file chooser`, async ({ page }) => {
      const upload = await open(page);
      await expect(page.locator(".fdz-zone").getByRole("button")).toHaveCount(1);
      await dropzone(page).focus();
      const chooser = page.waitForEvent("filechooser");
      await page.keyboard.press(key);
      await (await chooser).setFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
      await expect.poll(() => upload.requests()).toBe(1);
      await expect(rows(page)).toContainText("plan.pdf");
    });
  }

  test("drag-over an empty dropzone shows the drop prompt; with a row the normal prompt stays", async ({ page }) => {
    await open(page);
    await dragEnter(page);
    await expect(page.locator(".fdz-zone")).toHaveAttribute("data-dragging", "");
    await expect(page.locator(".fdz-prompt")).toHaveText("Suelta el PDF para subirlo");
    await dropFiles(page, [PDF]);
    await expect(rows(page)).toHaveCount(1);
    await dragEnter(page);
    await expect(page.locator(".fdz-zone")).toHaveAttribute("data-dragging", "");
    await expect(page.locator(".fdz-prompt")).toHaveText("Arrastra tu PDF aquí");
  });

  test("drag-leave resets the dragging state and the normal prompt", async ({ page }) => {
    await open(page);
    await dragEnter(page);
    await expect(page.locator(".fdz-zone")).toHaveAttribute("data-dragging", "");
    await dragLeave(page);
    await expect(page.locator(".fdz-zone")).not.toHaveAttribute("data-dragging");
    await expect(page.locator(".fdz-prompt")).toHaveText("Arrastra tu PDF aquí");
  });

  test("a paste with no files adds nothing", async ({ page }) => {
    const upload = await open(page);
    await pasteFiles(page, []);
    await expect(rows(page)).toHaveCount(0);
    expect(await upload.requests()).toBe(0);
    await expectNoAlert(page);
  });

  test("a size of 1,258,291 bytes is shown as 1.2 MB", async ({ page }) => {
    await open(page);
    await dropFiles(page, [{ ...PDF, size: 1_258_291 }]);
    await expect(page.locator(".fdz-size")).toContainText("1.2 MB");
  });
});

test.describe("REQ-22: rejections", () => {
  // The 20 MiB case is built in the page (a string padded to size, as dropFiles does), which is cheap enough, so the real size check runs.
  const rejections: [string, TestFile[], string][] = [
    ["a non-PDF", [IMAGE], "Solo se aceptan archivos PDF"],
    ["an empty PDF", [{ ...PDF, size: 0 }], "El PDF está vacío"],
    ["a PDF over 20 MB", [{ ...PDF, size: 20 * MiB + 1 }], TOO_BIG],
    ["two files at once", [PDF, { name: "otro.pdf", mimeType: "application/pdf" }], ONE_AT_A_TIME]
  ];
  for (const [title, files, message] of rejections) {
    test(`${title} shows "${message}", uploads nothing and raises no toast`, async ({ page }) => {
      const upload = await open(page);
      await dropFiles(page, files);
      await expect(alertWith(page, message)).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
      expect(await upload.requests()).toBe(0);
      await expectNoToast(page);
      // Rejections are role=alert only; the warning Alert (role=status) is for delete and confirm failures.
      await expect(statusWith(page, message)).toHaveCount(0);
    });
  }

  test("the rejection sits below the dropzone", async ({ page }) => {
    await open(page);
    await dropFiles(page, [IMAGE]);
    const alert = alertWith(page, "Solo se aceptan archivos PDF");
    await expect(alert).toBeVisible();
    await expect.poll(async () => {
      const zone = await page.locator(".fdz-zone").boundingBox();
      const box = await alert.boundingBox();
      return zone && box ? box.y >= zone.y + zone.height - 0.5 : false;
    }).toBe(true);
  });

  test("a different rejection replaces the first one", async ({ page }) => {
    await open(page);
    await dropFiles(page, [IMAGE]);
    await expect(alertWith(page, "Solo se aceptan archivos PDF")).toBeVisible();
    await dropFiles(page, [{ ...PDF, size: 0 }]);
    await expect(alertWith(page, "El PDF está vacío")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(1);
    await expect(alertWith(page, "Solo se aceptan archivos PDF")).toHaveCount(0);
  });

  test("the rejection closes with Reintentar on a failed row", async ({ page }) => {
    // The fake XHR never touches the network, so the 500 raises no issue to declare.
    const upload = await open(page);
    await addPdf(page, PDF);
    await expect.poll(() => upload.requests()).toBe(1);
    await upload.respond(500, { error: "Fallo simulado" });
    await expect(retry(page)).toBeVisible();
    // The failed row still holds its file, so checkFiles rejects on count/row before it looks at the type.
    await dropFiles(page, [IMAGE]);
    await expect(alertWith(page, ONE_AT_A_TIME)).toBeVisible();
    await retry(page).click();
    await expect.poll(() => upload.requests()).toBe(2);
    await expectNoAlert(page);
  });

  test("a second file while a row is present is rejected and the row is unchanged", async ({ page }) => {
    const upload = await open(page);
    await addPdf(page, PDF);
    await expect(rows(page)).toContainText("plan.pdf");
    await dropFiles(page, [{ name: "otro.pdf", mimeType: "application/pdf" }]);
    await expect(alertWith(page, ONE_AT_A_TIME)).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page)).toContainText("plan.pdf");
    expect(await upload.requests()).toBe(1);
    await expectNoToast(page);
  });

  test("PLAN.PDF with no MIME type is accepted", async ({ page }) => {
    const upload = await open(page);
    await dropFiles(page, [{ name: "PLAN.PDF", mimeType: "" }]);
    await expect(rows(page)).toContainText("PLAN.PDF");
    expect(await upload.requests()).toBe(1);
    await expectNoAlert(page);
  });

  test("the rejection closes when the next file is added", async ({ page }) => {
    await open(page);
    await dropFiles(page, [IMAGE]);
    await expect(alertWith(page, "Solo se aceptan archivos PDF")).toBeVisible();
    await addPdf(page, PDF);
    await expect(rows(page)).toHaveCount(1);
    await expectNoAlert(page);
  });

  test("the rejection closes when the row's ✕ is pressed", async ({ page }) => {
    await open(page);
    await addPdf(page, PDF);
    await dropFiles(page, [PDF]);
    await expect(alertWith(page, ONE_AT_A_TIME)).toBeVisible();
    await rowRemove(page).click();
    await expect(rows(page)).toHaveCount(0);
    await expectNoAlert(page);
  });

  test("the rejection is gone when the wizard is closed and reopened", async ({ page }) => {
    await open(page);
    await dropFiles(page, [IMAGE]);
    await expect(alertWith(page, "Solo se aceptan archivos PDF")).toBeVisible();
    await closeButton(page).click();
    await expect(page.locator(".upload-wizard-modal")).toHaveCount(0);
    await page.getByRole("button", { name: /Subir plan nuevo/ }).first().click();
    await expect(page.locator(".upload-wizard-modal")).toBeVisible();
    await expectNoAlert(page);
  });
});

test.describe("Q24: an identical rejection is shown again", () => {
  // The first alert's text node is tagged; reopening replaces it, so the tag must disappear while the alert is visible.
  const tagAlertText = (page: Page) => page.evaluate(() => document.querySelector(".fdz-alert-slot .alert-line")!.setAttribute("data-first", ""));
  const message = "Solo se aceptan archivos PDF";
  const ways: [string, (page: Page) => Promise<unknown>][] = [
    ["picker", (page) => addPdf(page, IMAGE)],
    ["drop", (page) => dropFiles(page, [IMAGE])]
  ];
  for (const [way, add] of ways) {
    test(`${way}: the second identical rejection replaces the first alert`, async ({ page }) => {
      await open(page);
      await add(page);
      await expect(alertWith(page, message)).toBeVisible();
      await tagAlertText(page);
      await add(page);
      await expect(page.locator(".fdz-alert-slot .alert-line[data-first]")).toHaveCount(0);
      await expect(alertWith(page, message)).toBeVisible();
    });
  }
});

test("REQ-14: two drops in the same tick start one upload and reject the second", async ({ page }) => {
  const upload = await open(page);
  await page.evaluate(() => {
    const drop = () => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["%PDF-1.4 e2e"], "plan.pdf", { type: "application/pdf" }));
      document.querySelector(".fdz-zone")!.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    };
    drop();
    drop();
  });
  await expect(alertWith(page, ONE_AT_A_TIME)).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  expect(await upload.requests()).toBe(1);
});

test.describe("REQ-26: a 413 from the server", () => {
  test.use({ expectedIssues: expectIssues(/POST \/api\/plans\/upload → 413/, /Failed to load resource.*413/) });
  const bodies: [string, { json: unknown } | { body: string; contentType: string }][] = [
    ["a JSON error", { json: { error: TOO_BIG } }],
    ["an empty body", { body: "", contentType: "text/plain" }],
    ["an HTML body", { body: "<html><body>413 Request Entity Too Large</body></html>", contentType: "text/html" }]
  ];
  for (const [title, body] of bodies) {
    test(`${title}: danger alert, row removed, focus on the dropzone`, async ({ page }) => {
      await page.route(/\/api\/plans\/upload$/, (route) => route.fulfill({ status: 413, ...body }));
      await openWizard(page);
      await addPdf(page, PDF);
      await expect(alertWith(page, TOO_BIG)).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
      await expect(dropzone(page)).toBeFocused();
      await expectNoToast(page);
    });
  }
});

test("REQ-26: the real server answers 413 to a body over 20 MiB and creates nothing", async ({ page }) => {
  // page.request shares the context's signed-in cookie. A real 20 MiB + 1 body is sent (cheap on localhost) instead of
  // a forged Content-Length: the HTTP client would reject a header that disagrees with the body it sends.
  // The e2e server runs from the project root, so it stores PDFs in the same data/private-pdfs as dev; the test only counts entries (read-only).
  const storedPdfs = () => {
    try {
      return readdirSync(path.join(process.cwd(), "data", "private-pdfs")).length;
    } catch {
      return 0;
    }
  };
  const plansBefore = await (await page.request.get("/api/plans")).json();
  const storedBefore = storedPdfs();
  // The cap path answers 413 without reading the body, so the server may reset the connection mid-send; maxRetries covers that.
  const response = await page.request.post("/api/plans/upload", {
    headers: { "Content-Type": "application/pdf", "X-File-Name": "grande.pdf" },
    data: Buffer.alloc(20 * MiB + 1),
    maxRetries: 3
  });
  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ error: TOO_BIG });
  expect(await (await page.request.get("/api/plans")).json()).toEqual(plansBefore);
  expect(storedPdfs()).toBe(storedBefore);
});

test.describe("REQ-25: reduced motion", () => {
  test("the rejection alert appears without animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    // Samples the alert's opacity every frame; a fade would leave values strictly between 0 and 1.
    await page.evaluate(() => {
      const w = window as unknown as { __opacities: number[]; __sampled: boolean };
      w.__opacities = [];
      const end = performance.now() + 700;
      const sample = () => {
        const box = document.querySelector(".alert-presence");
        if (box) w.__opacities.push(Number(getComputedStyle(box).opacity));
        if (performance.now() < end) requestAnimationFrame(sample);
        else w.__sampled = true;
      };
      requestAnimationFrame(sample);
    });
    await dropFiles(page, [IMAGE]);
    await expect(alertWith(page, "Solo se aceptan archivos PDF")).toBeVisible();
    await page.waitForFunction(() => (window as unknown as { __sampled: boolean }).__sampled);
    const opacities = await page.evaluate(() => (window as unknown as { __opacities: number[] }).__opacities);
    expect(opacities.length).toBeGreaterThan(0);
    expect(opacities.filter((value) => value > 0 && value < 1)).toEqual([]);
    expect(opacities.at(-1)).toBe(1);
  });
});

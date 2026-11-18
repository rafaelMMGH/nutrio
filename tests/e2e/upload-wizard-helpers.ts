import type { Locator, Page, Route } from "@playwright/test";
import { expect } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";

// Shared by every upload-wizard*.spec.ts file (upload-wizard, -checks, -confirm, -dropzone, -layout, -outcomes, -phases, -review). Every write the wizard makes is mocked here, so no
// test creates, archives or confirms a real plan in the shared database clone.

const PLAN_URL = /\/api\/plans\/plan-e2e$/;
const UPLOAD_URL = /\/api\/plans\/upload$/;

/** What a mocked request does: answer at once, answer 500, or wait for a gate to open and then answer. */
export type Behavior = "ok" | "fail" | Promise<void>;

/** A promise the test opens by hand, to hold a mocked request in flight. */
export function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

export type ApiCalls = { uploads: number; deletes: number; patches: unknown[] };

async function answer(route: Route, behavior: Behavior, body: unknown) {
  if (behavior !== "ok" && behavior !== "fail") await behavior;
  if (behavior === "fail") return route.fulfill({ status: 500, json: { error: "Fallo simulado" } });
  return route.fulfill({ status: 200, json: body });
}

/** Mocks the upload (answering `plan`, the shared fixture by default), the draft DELETE and the confirming PATCH, and records what the wizard sent. */
export async function mockWizardApi(page: Page, behaviors: { upload?: Behavior; remove?: Behavior; patch?: Behavior } = {}, plan: unknown = WIZARD_PLAN) {
  const calls: ApiCalls = { uploads: 0, deletes: 0, patches: [] };
  await page.route(UPLOAD_URL, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    calls.uploads++;
    return answer(route, behaviors.upload ?? "ok", plan);
  });
  await page.route(PLAN_URL, (route) => {
    const method = route.request().method();
    if (method === "DELETE") {
      calls.deletes++;
      return answer(route, behaviors.remove ?? "ok", { ok: true });
    }
    if (method === "PATCH") {
      calls.patches.push(route.request().postDataJSON());
      return answer(route, behaviors.patch ?? "ok", { ok: true });
    }
    return route.fallback();
  });
  return calls;
}

/** Opens the wizard from Recetario. */
export async function openWizard(page: Page) {
  await page.goto("/recipes");
  await page.getByRole("button", { name: /Subir plan nuevo/ }).first().click();
  await expect(page.locator(".upload-wizard-modal")).toBeVisible();
}

export const resultHeading = (page: Page) => page.getByRole("heading", { name: "PDF procesado" });
export const closeButton = (page: Page) => page.getByRole("button", { name: "Cerrar", exact: true });
export const modal = (page: Page) => page.locator(".upload-wizard-modal");
export const confirmButton = (page: Page) => page.getByRole("button", { name: "Confirmar plan" });
export const previous = (page: Page) => page.getByRole("button", { name: "Anterior" });

/** The dropzone's button: the target of "focus returns to the dropzone" and of the file chooser. */
export const dropzone = (page: Page) => page.locator(".fdz-trigger");
/** The row's X: "Cancelar subida de <nombre>" while uploading, "Quitar <nombre>" otherwise. */
export const rowRemove = (page: Page) => page.getByRole("button", { name: /^(Cancelar subida de|Quitar) / });
export const retry = (page: Page) => page.getByRole("button", { name: "Reintentar" });

/** A file for the helpers below. Its bytes are a PDF header padded with zeros up to `size` (0 is empty, below the header length is a truncated header; no size is the bare header). */
export type TestFile = { name: string; mimeType: string; size?: number };
const PDF_HEADER = "%PDF-1.4 e2e";
const PLAN_PDF: TestFile = { name: "plan.pdf", mimeType: "application/pdf" };

/** Adds a PDF through the native file chooser, as a user would: click the dropzone and pick. */
export async function addPdf(page: Page, file: TestFile = PLAN_PDF) {
  const chooser = page.waitForEvent("filechooser");
  await dropzone(page).click();
  // `size: 0` is a truly empty file; a size below the header length is a truncated header.
  const header = Buffer.from(PDF_HEADER);
  const buffer = file.size === undefined ? header : Buffer.concat([header, Buffer.alloc(Math.max(0, file.size - header.length))]).subarray(0, file.size);
  await (await chooser).setFiles({ name: file.name, mimeType: file.mimeType, buffer });
}

/** Builds the files inside the page (a `File` cannot cross `evaluate`) and fires `type` with them in a DataTransfer. */
function fireWithFiles(page: Page, selector: string, type: "drop" | "paste", files: TestFile[]) {
  return page.evaluate(
    ({ selector, type, files, header }) => {
      const transfer = new DataTransfer();
      for (const { name, mimeType, size } of files) {
        transfer.items.add(new File([size === undefined ? header : header.slice(0, size).padEnd(size, "\0")], name, { type: mimeType }));
      }
      const target = document.querySelector(selector)!;
      const init = { bubbles: true, cancelable: true };
      target.dispatchEvent(type === "drop" ? new DragEvent("drop", { ...init, dataTransfer: transfer }) : new ClipboardEvent("paste", { ...init, clipboardData: transfer }));
    },
    { selector, type, files, header: PDF_HEADER }
  );
}

/** Drops files on the zone with a synthetic DataTransfer. */
export const dropFiles = (page: Page, files: TestFile[]) => fireWithFiles(page, ".fdz-zone", "drop", files);

/** Pastes files with focus on the dropzone (paste is armed by focus or hover inside it). */
export async function pasteFiles(page: Page, files: TestFile[]) {
  await dropzone(page).focus();
  await fireWithFiles(page, ".fdz-trigger", "paste", files);
}

/**
 * Replaces XMLHttpRequest for `POST /api/plans/upload` only, so a test decides when progress, "sent", the answer and
 * a dropped connection happen. Call it before `openWizard` (it is an init script). It proves the wizard's reaction to
 * XHR events, not `uploadWithProgress` against the real XHR (heldUpload covers that).
 */
export async function fakeUploadXhr(page: Page) {
  // The draft DELETE and the confirming PATCH still go through fetch, so they are mocked here (use mockWizardApi to
  // count them); the abort is a backstop so no request can reach the real upload endpoint.
  await page.route(UPLOAD_URL, (route) => route.abort());
  await page.route(PLAN_URL, (route) => {
    const method = route.request().method();
    if (method !== "DELETE" && method !== "PATCH") return route.fallback();
    return route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.addInitScript(() => {
    const proto = XMLHttpRequest.prototype;
    const real = { open: proto.open, send: proto.send, abort: proto.abort, setRequestHeader: proto.setRequestHeader };
    const fakes = new WeakSet<XMLHttpRequest>();
    const fake = {
      current: null as XMLHttpRequest | null,
      requests: 0,
      aborts: 0,
      progress: (loaded: number) => (fake.current!.upload.onprogress as (event: unknown) => void)({ lengthComputable: true, loaded, total: 100 }),
      sent: () => (fake.current!.upload.onload as () => void)(),
      respond: (status: number, body: unknown) => {
        Object.defineProperty(fake.current!, "status", { value: status, configurable: true });
        Object.defineProperty(fake.current!, "responseText", { value: typeof body === "string" ? body : JSON.stringify(body), configurable: true });
        (fake.current!.onload as () => void)();
      },
      drop: () => (fake.current!.onerror as () => void)()
    };
    (window as unknown as { __fakeUpload: typeof fake }).__fakeUpload = fake;
    proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      if (method === "POST" && new URL(String(url), location.href).pathname === "/api/plans/upload") {
        fakes.add(this);
        fake.current = this;
        return;
      }
      return (real.open as (...args: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof proto.open;
    proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
      if (!fakes.has(this)) real.setRequestHeader.call(this, name, value);
    };
    proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      if (fakes.has(this)) fake.requests++;
      else real.send.call(this, body);
    };
    proto.abort = function (this: XMLHttpRequest) {
      if (fakes.has(this)) fake.aborts++;
      else real.abort.call(this);
    };
  });
  type Fake = { progress(n: number): void; sent(): void; respond(status: number, body: unknown): void; drop(): void; requests: number; aborts: number };
  return {
    /** The body has gone out `percent` percent. */
    progress: (percent: number) => page.evaluate((n) => (window as unknown as { __fakeUpload: Fake }).__fakeUpload.progress(n), percent),
    sent: () => page.evaluate(() => (window as unknown as { __fakeUpload: Fake }).__fakeUpload.sent()),
    /** The server answers with `body` as JSON, or as raw text when it is a string (an HTML 502, say). */
    respond: (status: number, body: unknown) => page.evaluate(([s, b]) => (window as unknown as { __fakeUpload: Fake }).__fakeUpload.respond(s as number, b), [status, body] as const),
    /** The connection drops with no response. */
    drop: () => page.evaluate(() => (window as unknown as { __fakeUpload: Fake }).__fakeUpload.drop()),
    /** How many uploads were sent and how many times the wizard aborted one. */
    requests: () => page.evaluate(() => (window as unknown as { __fakeUpload: Fake }).__fakeUpload.requests),
    aborted: () => page.evaluate(() => (window as unknown as { __fakeUpload: Fake }).__fakeUpload.aborts)
  };
}

/** Counts the nodes added to the polite region whose text contains `text` (or matches the RegExp), so "announced once" is about announcements, not about the text being on screen. Call it before the action. */
export async function watchAnnouncements(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __announced: string[] }).__announced = seen;
    new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach((node) => node.textContent && seen.push(node.textContent));
    }).observe(document.querySelector(".fdz-sr")!, { childList: true, subtree: true });
  });
  return {
    count: (text: string | RegExp) =>
      page.evaluate(
        ({ source, flags, plain }) => {
          const seen = (window as unknown as { __announced: string[] }).__announced;
          if (plain !== undefined) return seen.filter((entry) => entry.includes(plain)).length;
          const pattern = new RegExp(source, flags);
          return seen.filter((entry) => pattern.test(entry)).length;
        },
        typeof text === "string" ? { source: "", flags: "", plain: text } : { source: text.source, flags: text.flags, plain: undefined }
      )
  };
}

/** Holds the real upload request (through `page.route`) until `release`, so a real XHR is in flight. */
export async function heldUpload(page: Page) {
  const pending: Route[] = [];
  await page.route(UPLOAD_URL, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    pending.push(route);
    return undefined;
  });
  return {
    requests: () => pending.length,
    /** Answers every held request. After an abort the fulfil fails; that is the point of the test, so only the "already handled" error is swallowed. */
    release: async (status: number, body: unknown) => {
      await Promise.all(pending.splice(0).map((route) => route.fulfill({ status, json: body }).catch((error: Error) => {
        if (!/already handled/i.test(error.message)) throw error;
      })));
    }
  };
}

/** `role=alert` is the danger Alert (rejections); `role=status` also holds the delete and confirm failures (warning Alert). */
export const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });
export const statusWith = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
/** The Alert wrappers are always mounted, so "no alert" means none with any text, never a bare count of 0. */
export const expectNoAlert = (page: Page) => expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
export const expectNoToast = (page: Page) => expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

/** Adds the PDF and waits for the result, where focus lands (REQ-16). */
export async function uploadPdf(page: Page) {
  await addPdf(page);
  await expect(resultHeading(page)).toBeFocused();
}

export const stepper = (page: Page) => page.getByRole("navigation", { name: "Progreso" });
/** One step of the stepper; its name is the label plus the screen-reader status. */
export const step = (page: Page, label: string): Locator => stepper(page).getByRole("button", { name: new RegExp(`^${label}\\b`) });
export const next = (page: Page) => page.getByRole("button", { name: "Siguiente", exact: true });

/** Uploads and walks with "Siguiente" to Confirmar. */
export async function toConfirmar(page: Page) {
  await uploadPdf(page);
  for (let i = 0; i < 3; i++) await next(page).click();
  await expect(step(page, "Confirmar")).toHaveAttribute("aria-current", "step");
}

/** Uploads and walks with "Siguiente" to Datos. */
export async function toDatos(page: Page) {
  await uploadPdf(page);
  await next(page).click();
  await expect(step(page, "Datos")).toHaveAttribute("aria-current", "step");
}

/** A meal card on Comidas, found by its header button. Unlike `cardHead` it is not rooted at `.uw-content`, so it works as a scope. */
export const mealCard = (page: Page, meal: string): Locator => page.locator(".uw-card").filter({ has: page.getByRole("button", { name: new RegExp(`^${meal}\\b`) }) });

/** 44px touch target with a sub-pixel tolerance: layout can report 43.99997 for a 44px box. */
export const MIN_TARGET = 44 - 0.01;

/** Bounding box once two consecutive reads agree, so a box still animating or reflowing is not measured. */
export async function settledBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  let last = "";
  await expect.poll(async () => {
    const now = JSON.stringify(await locator.boundingBox());
    const settled = now === last && now !== "null";
    last = now;
    return settled;
  }).toBe(true);
  return JSON.parse(last);
}

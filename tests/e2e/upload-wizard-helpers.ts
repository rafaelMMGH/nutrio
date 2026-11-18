import type { Locator, Page, Route } from "@playwright/test";
import { expect } from "./fixtures";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";

// Shared by upload-wizard.spec.ts, upload-wizard-checks.spec.ts, upload-wizard-layout.spec.ts, upload-wizard-review.spec.ts and upload-wizard-confirm.spec.ts. Every write the wizard makes is mocked here, so no
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
  // The toasts sit over the top right, on the X and the footer. They stay visible (and asserted) but never intercept a click.
  await page.addStyleTag({ content: "[data-sonner-toaster], [data-sonner-toast] { pointer-events: none !important; }" });
}

export const resultHeading = (page: Page) => page.getByRole("heading", { name: "PDF procesado" });
export const toast = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });
export const closeButton = (page: Page) => page.getByRole("button", { name: "Cerrar" });
export const modal = (page: Page) => page.locator(".upload-wizard-modal");
export const confirmButton = (page: Page) => page.getByRole("button", { name: "Confirmar plan" });
export const previous = (page: Page) => page.getByRole("button", { name: "Anterior" });
export const changePdf = (page: Page) => page.getByRole("button", { name: "Cambiar PDF" });

/** Chooses a PDF without submitting it. */
export async function choosePdf(page: Page) {
  await page.locator('input[name="pdf"]').setInputFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
}

/** Chooses a PDF and clicks "Procesar PDF" without waiting for the answer. */
export async function submitPdf(page: Page) {
  await choosePdf(page);
  await page.getByRole("button", { name: "Procesar PDF" }).click();
}

/** Uploads and waits for the result, where focus lands (REQ-16). */
export async function uploadPdf(page: Page) {
  await submitPdf(page);
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

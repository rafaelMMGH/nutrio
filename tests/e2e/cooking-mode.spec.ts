import type { Page } from "@playwright/test";
import { sql } from "./database";
import { expect, expectIssues, test } from "./fixtures";

// Modo Cocina (specs/cooking-mode v1.0, US1 to US6). Written for T019 and NOT run while the user's e2e freeze holds
// (spec D10). Real UI, real routes, the e2e copy of Postgres; browser APIs (Wake Lock, speech) are stubbed so every
// path is deterministic. Each test puts back what it changes.

/** The first live recipe used by an option of the active plan's first meal: it has today's "Marcar como hecha". */
const PLAN_RECIPE = `select o.recipe_id from meal_options o join meal_types t on t.id = o.meal_type_id
  join plan_versions v on v.id = t.plan_version_id join plans p on p.id = v.plan_id
  where v.is_current and p.status = 'active' and p.deleted_at is null and t.deleted_at is null and o.deleted_at is null
  order by t.display_order, o.option_number limit 1`;

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

let recipeId = "";
let description = "";

test.beforeEach(() => {
  recipeId = sql(PLAN_RECIPE);
  description = sql(`select description from recipes where id = '${recipeId}'`);
});

test.afterEach(() => {
  sql(`update recipes set description = '${description.replace(/'/g, "''")}' where id = '${recipeId}'`);
  sql(`delete from daily_logs where id like 'e2e-cook-%' or date = '${dayKey(new Date())}'`);
});

function setSteps(text: string) {
  sql(`update recipes set description = '${text.replace(/'/g, "''")}' where id = '${recipeId}'`);
}

async function stubBrowser(page: Page, { wakeLock }: { wakeLock: boolean }) {
  await page.addInitScript((withLock) => {
    Object.defineProperty(Navigator.prototype, "wakeLock", {
      configurable: true,
      get: () => (withLock ? { request: async () => ({ release: async () => undefined, addEventListener() {} }) } : undefined)
    });
    const w = window as unknown as Record<string, unknown>;
    const instances: { onresult?: (event: unknown) => void; onend?: () => void }[] = [];
    class FakeRecognition {
      onresult?: (event: unknown) => void;
      onend?: () => void;
      constructor() {
        instances.push(this);
      }
      start() {}
      stop() {}
      abort() {
        this.onend?.();
      }
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    w.__say = (text: string) => instances.at(-1)?.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
    const spoken: string[] = [];
    w.__spoken = spoken;
    window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      spoken.push(utterance.text);
      setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 20);
    };
  }, wakeLock);
}

const screenOf = (page: Page) => page.locator(".ck").getAttribute("data-screen");

test("REQ-1/2/6/8/10: open from the recipe page, mark ingredients, step through, leave with Escape", async ({ page }) => {
  setSteps("Batir los huevos. Cocinar a fuego bajo.");
  await stubBrowser(page, { wakeLock: true });
  await page.goto(`/recipes/${recipeId}`);
  await page.getByRole("link", { name: "Modo Cocina" }).click();
  await expect(page).toHaveURL(new RegExp(`/recipes/${recipeId}/cook$`));
  await expect(page.locator(".nt-topbar, .nt-sidebar")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Antes de empezar" })).toBeVisible();
  const rows = page.locator(".ck-ingredient");
  const total = await rows.count();
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".ck-count").first()).toHaveText(new RegExp(`1 de ${total} listo`));
  for (let index = 1; index < total; index += 1) await rows.nth(index).click();
  await expect(page.locator(".ck-count").first()).toContainText("¡Todo listo!");
  await page.getByRole("button", { name: /Empezar/ }).click();
  await expect(page.getByText("Paso 1 de 2")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Paso 2 de 2")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  expect(await screenOf(page)).toBe("before");
  await expect(page.getByText("Tu pantalla podría apagarse")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/recipes/${recipeId}$`));
});

test("REQ-3: without Wake Lock the note says the screen may turn off", async ({ page }) => {
  await stubBrowser(page, { wakeLock: false });
  await page.goto(`/recipes/${recipeId}/cook`);
  await expect(page.getByText("Tu pantalla podría apagarse mientras cocinas.")).toBeVisible();
});

test("REQ-12/14: the ingredients sheet opens over a step and Escape closes only the sheet", async ({ page }) => {
  setSteps("Batir los huevos.");
  await stubBrowser(page, { wakeLock: true });
  await page.goto(`/recipes/${recipeId}/cook`);
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Ver ingredientes" }).click();
  await expect(page.getByRole("dialog", { name: "Ingredientes" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await screenOf(page)).toBe("step-0");
});

test("REQ-13: a recipe without steps offers Escribir los pasos, which opens the edit dialog", async ({ page }) => {
  setSteps("");
  await stubBrowser(page, { wakeLock: true });
  await page.goto(`/recipes/${recipeId}/cook`);
  await page.getByRole("button", { name: /Empezar/ }).click();
  await expect(page.getByRole("heading", { name: "Tu plan no incluye pasos para esta receta." })).toBeVisible();
  await page.getByRole("link", { name: "Escribir los pasos" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/recipes/${recipeId}$`));
});

test("REQ-15/16/17: finishing marks today's meal, Deshacer puts it back", async ({ page }) => {
  setSteps("Servir.");
  await stubBrowser(page, { wakeLock: true });
  await page.goto(`/recipes/${recipeId}/cook`);
  while ((await screenOf(page)) !== "done") await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { name: "¡Listo!" })).toBeVisible();
  await page.getByRole("button", { name: /Marcar como hecha/ }).click();
  await expect(page.getByText("Ya marcaste esta comida hoy.")).toBeVisible();
  await expect.poll(() => sql(`select count(*) from daily_logs where date = '${dayKey(new Date())}' and array_length(meals_done, 1) > 0`)).toBe("1");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("button", { name: /Marcar como hecha/ })).toBeVisible();
});

test.describe("a failed save", () => {
  test.use({ expectedIssues: expectIssues(/PUT \/api\/daily-logs\/.* → 500/, /status of 500/) });
  test("REQ-16: shows the error toast and keeps the button", async ({ page }) => {
    setSteps("Servir.");
    await stubBrowser(page, { wakeLock: true });
    await page.route("**/api/daily-logs/**", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.goto(`/recipes/${recipeId}/cook`);
    while ((await screenOf(page)) !== "done") await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: /Marcar como hecha/ }).click();
    await expect(page.getByText("No se pudo guardar tu registro del día")).toBeVisible();
    await expect(page.getByRole("button", { name: /Marcar como hecha/ })).toBeVisible();
  });
});

test("REQ-18/19/20: a step with a time offers a timer that survives a reload with Empezar de nuevo", async ({ page }) => {
  setSteps("Lavar el mango. Refrigerar de 10 a 15 minutos. Servir frío.");
  await stubBrowser(page, { wakeLock: true });
  await page.goto(`/recipes/${recipeId}/cook`);
  await page.getByRole("button", { name: /Empezar/ }).click();
  await expect(page.locator(".ck-timer-start")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Temporizador 15 min" }).click();
  await expect(page.locator(".ck-clock")).toHaveText(/^14:5\d$/);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".ck-chip")).toContainText("Paso 2");
  await page.reload();
  expect(await screenOf(page)).toBe("step-2");
  await expect(page.getByText("Retomamos donde te quedaste.")).toBeVisible();
  await expect(page.locator(".ck-chip")).toContainText("Paso 2");
  await page.getByRole("button", { name: "Empezar de nuevo" }).click();
  expect(await screenOf(page)).toBe("before");
  await expect(page.locator(".ck-chip")).toHaveCount(0);
});

test("REQ-21/22/23/25: voice commands move, go back and repeat; each new step is read aloud", async ({ page }) => {
  setSteps("Batir los huevos. Cocinar a fuego bajo.");
  await stubBrowser(page, { wakeLock: true });
  await page.goto(`/recipes/${recipeId}/cook`);
  await page.getByRole("button", { name: "Control por voz" }).click();
  await expect(page.getByText(/Escuchando/)).toBeVisible();
  const say = (text: string) => page.evaluate((value) => (window as unknown as { __say: (text: string) => void }).__say(value), text);
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.slice());
  await expect.poll(spoken).toContainEqual(expect.stringMatching(/^Antes de empezar\. Ten a la mano:/));
  await say("ok, siguiente");
  await expect.poll(() => screenOf(page)).toBe("step-0");
  await expect.poll(spoken).toContain("Paso 1 de 2. Batir los huevos.");
  await say("siguiente");
  await expect.poll(() => screenOf(page)).toBe("step-1");
  await say("atrás");
  await expect.poll(() => screenOf(page)).toBe("step-0");
  const before = (await spoken()).length;
  await say("repite");
  await expect.poll(async () => (await spoken()).length).toBe(before + 1);
  await say("le pongo sal");
  expect(await screenOf(page)).toBe("step-0");
});

test("REQ-4/5: the dashboard hero links to Modo Cocina, and an unknown recipe is a 404", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nt-hero").getByRole("link", { name: "Modo Cocina" })).toHaveAttribute("href", /\/recipes\/.+\/cook$/);
  const response = await page.request.get("/recipes/no-such-recipe/cook");
  expect(response.status()).toBe(404);
});

for (const [width, height] of [[390, 844], [1440, 900], [1920, 1080]] as const) {
  test(`NFR: no page scrollbar at ${width}×${height}`, async ({ page }) => {
    setSteps("Batir los huevos. Cocinar a fuego bajo hasta que cuajen, moviendo con suavidad y sin dejar que se doren por debajo.");
    await stubBrowser(page, { wakeLock: true });
    await page.setViewportSize({ width, height });
    await page.goto(`/recipes/${recipeId}/cook`);
    for (const _ of [0, 1, 2, 3]) {
      const overflow = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
      await page.keyboard.press("ArrowRight");
    }
  });
}

import type { Page } from "@playwright/test";
import { NO_MATCH_LEAD } from "../shared/assistant-copy";
import { expectIssues } from "./fixtures";
import {
  assistantUi,
  cartAnswer,
  createChatUser,
  deleteChatUser,
  expect,
  mockChat,
  openAssistant,
  seedCart,
  seedPlan,
  seedRecipes,
  test
} from "./assistant-helpers";

// UI tests of the next step after a question. Spec assistant-chat-polish, US2: REQ-5 (buttons under the latest answer),
// REQ-7 ("Pensando…") and REQ-8 (error, Reintentar, the 15 s timeout); REQ-23 (the HTTP 500 copy). There are no scopes
// (assistant-data-scope REQ-4): the request is the message alone and the server sends every button.

const RECIPES_CHIP = "¿Qué recetas hay en mi plan?";
const CART_CHIP = "¿Qué tengo en mi carrito?";
const BUY_CHIP = "¿Qué ingredientes necesito comprar?";
const API = /\/api\/rag\/chat$/;

let ids: Record<string, string> = {};

test.beforeAll(() => {
  createChatUser("next-step");
  ids = seedRecipes([{ name: "Pollo asado", ingredients: [{ name: "Pechuga de pollo", quantity: 200, category: "Proteínas" }, { name: "Arroz", quantity: 100 }] }]);
  seedPlan({ times: "all" });
  seedCart(3);
});
test.afterAll(() => deleteChatUser());

/** Types `message` in the panel input and sends it. */
async function typeQuestion(page: Page, message: string) {
  const ui = assistantUi(page);
  await ui.input.fill(message);
  await ui.send.click();
}

test.describe("REQ-5: chips under the latest answer", () => {
  test("only the latest answer has chips, outside the live region, and activating one moves them", async ({ chat }) => {
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, CART_CHIP);
    await expect(ui.assistantTurns).toHaveCount(1);
    await expect(ui.chips).toHaveText([RECIPES_CHIP, "Mi cena de hoy"]);
    await expect(ui.live.locator(".assistant-chips")).toHaveCount(0);
    await expect(ui.assistantTurns.nth(0).locator(".assistant-chips button")).toHaveCount(2);

    await ui.chips.first().click();
    await expect(ui.assistantTurns).toHaveCount(2);
    await expect(ui.userTurns).toHaveText([CART_CHIP, RECIPES_CHIP]);
    await expect(ui.assistantTurns.nth(0).locator(".assistant-chips")).toHaveCount(0);
    await expect(ui.assistantTurns.nth(1).locator(".assistant-chips button")).toHaveText(["Mi carrito", "Mi cena de hoy"]);
    await expect(ui.chips).toHaveCount(2);
  });

  test("every chip is disabled while a request is pending and activating one sends nothing", async ({ chat }) => {
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, CART_CHIP);
    await expect(ui.chips).toHaveCount(2);

    const mock = await mockChat(chat, cartAnswer(), { hold: true });
    await typeQuestion(chat, "una pregunta más");
    await expect(ui.pending).toHaveCount(1);
    await expect(ui.chips).toHaveCount(2);
    await expect(ui.chips.first()).toBeDisabled();
    await expect(ui.chips.last()).toBeDisabled();
    await ui.chips.first().click({ force: true });
    expect(mock.requests).toHaveLength(1);

    mock.release();
    await expect(ui.pending).toHaveCount(0);
    await expect(ui.chips.first()).toBeEnabled();
    expect(mock.requests).toHaveLength(1);
  });

  test("a follow-up that repeats the question is left out (server repeat rule)", async ({ chat }) => {
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, "¿Qué suplementos tomo?");
    await expect(ui.assistantTurns).toHaveCount(1);
    await expect(ui.chips).toHaveText(["¿Cuál es mi meta?", RECIPES_CHIP]);
  });

  test("buttons survive an in-app navigation and ask their message alone", async ({ chat }) => {
    await chat.goto(`/recipes/${ids["Pollo asado"]}`);
    const ui = await openAssistant(chat);
    await typeQuestion(chat, CART_CHIP);
    await expect(ui.chips).toHaveText([RECIPES_CHIP, "Mi cena de hoy"]);

    // An in-app link keeps the shell, and with it the thread, mounted.
    await chat.getByRole("link", { name: "Inicio", exact: true }).click();
    await expect(chat).toHaveURL(/\/$/);
    await expect(ui.chips).toHaveCount(2);

    const request = chat.waitForRequest(API);
    await ui.chips.first().click();
    expect((await request).postDataJSON()).toEqual({ message: RECIPES_CHIP });
    await expect(ui.assistantTurns).toHaveCount(2);
    await expect(ui.assistantTurns.nth(1).getByRole("heading", { level: 4 })).toHaveText(["Recetas"]);
  });
});

test.describe("REQ-29: the no-match reply", () => {
  test("shows the lead and the 4 starters, and is not an error", async ({ chat }) => {
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, "¿Cuál es la capital de Francia?");
    await expect(ui.assistantTurns).toHaveCount(1);
    await expect(ui.assistantTurns.getByRole("paragraph")).toHaveText([NO_MATCH_LEAD]);
    await expect(ui.chips).toHaveText(["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"]);
    await expect(ui.panel).not.toContainText("No pude responder");
    await expect(ui.panel).not.toContainText("Algo salió mal");
  });
});

const THINKING = "Pensando…";
// HTTP 500 has its own copy (REQ-23); every other failure keeps the generic one (REQ-8).
const SERVER_ERROR_COPY = "Algo salió mal al responder. Intenta de nuevo.";
const REQUEST_ERROR_COPY = "No pude responder en este momento.";
const FAILED_500 = [/POST \/api\/rag\/chat → 500/, /Failed to load resource.*500/];
const FAILED_503 = [/POST \/api\/rag\/chat → 503/, /Failed to load resource.*503/];
const retryButton = (page: Page) => page.getByRole("button", { name: "Reintentar" });

test.describe("REQ-7: Pensando…", () => {
  test("shows in the answer position while the request is pending, outside the live region, and is gone afterwards", async ({ chat }) => {
    const mock = await mockChat(chat, cartAnswer(2), { hold: true });
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, CART_CHIP);
    await expect(ui.pending).toHaveCount(1);
    await expect(ui.pending).toContainText(THINKING);
    await expect(ui.userTurns).toHaveText([CART_CHIP]);
    await expect(ui.live.filter({ hasText: THINKING })).toHaveCount(0);

    mock.release();
    await expect(ui.assistantTurns).toHaveCount(1);
    await expect(ui.pending).toHaveCount(0);
    await expect(ui.panel).not.toContainText(THINKING);
  });
});

test.describe("REQ-8: error, Reintentar and the 15 s timeout", () => {
  test.describe("a 500 answer", () => {
    test.use({ expectedIssues: expectIssues(...FAILED_500) });

    test("keeps the question, shows the error with Reintentar and no chips; Reintentar swaps it for Pensando… and then the answer", async ({ chat }) => {
      await mockChat(chat, cartAnswer(), { status: 500 });
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await typeQuestion(chat, CART_CHIP);
      await expect(ui.assistantTurns).toHaveCount(1);
      await expect(ui.assistantTurns.first()).toContainText(SERVER_ERROR_COPY);
      await expect(ui.live).toHaveText([SERVER_ERROR_COPY]);
      await expect(ui.userTurns).toHaveText([CART_CHIP]);
      await expect(ui.labels).toHaveCount(0);
      await expect(ui.chips).toHaveCount(0);
      await expect(retryButton(chat)).toBeVisible();
      await expect(ui.live.getByRole("button")).toHaveCount(0);

      const healthy = await mockChat(chat, cartAnswer(), { hold: true });
      await retryButton(chat).click();
      await expect(ui.pending).toHaveCount(1);
      await expect(ui.pending).toContainText(THINKING);
      await expect(ui.assistantTurns).toHaveCount(0);
      await expect(ui.panel).not.toContainText(SERVER_ERROR_COPY);
      await expect(retryButton(chat)).toHaveCount(0);
      await expect(ui.userTurns).toHaveText([CART_CHIP]);

      healthy.release();
      await expect(ui.assistantTurns).toHaveCount(1);
      await expect(ui.assistantTurns.getByRole("heading", { level: 4 })).toHaveText(["Ingredientes"]);
      await expect(ui.chips).toHaveText([RECIPES_CHIP, "Mi cena de hoy"]);
      await expect(ui.panel).not.toContainText(SERVER_ERROR_COPY);
      await expect(retryButton(chat)).toHaveCount(0);
      await expect(ui.userTurns).toHaveText([CART_CHIP]);
      expect(healthy.requests).toEqual([{ message: CART_CHIP }]);
    });
  });

  test.describe("an older 503 error followed by a later answer", () => {
    test.use({ expectedIssues: expectIssues(...FAILED_503) });

    test("only the latest turn offers Reintentar", async ({ chat }) => {
      await mockChat(chat, cartAnswer(), { status: 503 });
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await typeQuestion(chat, CART_CHIP);
      await expect(retryButton(chat)).toBeVisible();

      await mockChat(chat, cartAnswer(1));
      await typeQuestion(chat, "una pregunta nueva");
      await expect(ui.assistantTurns).toHaveCount(2);
      await expect(ui.assistantTurns.nth(0)).toContainText(REQUEST_ERROR_COPY);
      await expect(ui.assistantTurns.nth(1)).toContainText("Esto es lo que tienes en tu carrito.");
      await expect(retryButton(chat)).toHaveCount(0);
    });
  });

  test.describe("a retry that fails again", () => {
    test.use({ expectedIssues: expectIssues(...FAILED_500, ...FAILED_500) });

    test("shows the error again, with the question once", async ({ chat }) => {
      const mock = await mockChat(chat, cartAnswer(), { status: 500 });
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await typeQuestion(chat, CART_CHIP);
      await expect(retryButton(chat)).toBeVisible();
      await retryButton(chat).click();
      await expect.poll(() => mock.requests.length).toBe(2);
      await expect(ui.pending).toHaveCount(0);
      await expect(ui.assistantTurns).toHaveCount(1);
      await expect(ui.live).toHaveText([SERVER_ERROR_COPY]);
      await expect(retryButton(chat)).toBeVisible();
      await expect(ui.userTurns).toHaveText([CART_CHIP]);
      await expect(ui.chips).toHaveCount(0);
    });
  });

  test.describe("a network failure", () => {
    test.use({ expectedIssues: expectIssues(/Failed to load resource.*ERR_FAILED/) });

    test("is treated like a non-2xx answer", async ({ chat }) => {
      await mockChat(chat, cartAnswer(), { abort: true });
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await typeQuestion(chat, CART_CHIP);
      await expect(ui.live).toHaveText([REQUEST_ERROR_COPY]);
      await expect(retryButton(chat)).toBeVisible();
      await expect(ui.userTurns).toHaveText([CART_CHIP]);
      await expect(ui.chips).toHaveCount(0);
    });
  });

  test.describe("a request pending over 15 s", () => {
    // The clock is installed before the page loads so the app's own timer is the faked one.
    test("shows the error, and a late answer is discarded", async ({ chat }) => {
      await chat.clock.install();
      const mock = await mockChat(chat, cartAnswer(), { hold: true });
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await typeQuestion(chat, CART_CHIP);
      await expect(ui.pending).toHaveCount(1);

      await chat.clock.fastForward(14_000);
      await expect(ui.pending).toHaveCount(1);
      await chat.clock.fastForward(1_500);
      await expect(ui.pending).toHaveCount(0);
      await expect(ui.live).toHaveText([REQUEST_ERROR_COPY]);
      await expect(retryButton(chat)).toBeVisible();
      await expect(ui.userTurns).toHaveText([CART_CHIP]);

      const late = chat.waitForResponse(API);
      mock.release();
      await late;
      // A new question, answered by a healthy mock, proves the late response was handled before the assertions below.
      await mockChat(chat, cartAnswer(1));
      await typeQuestion(chat, "una pregunta nueva");
      await expect(ui.assistantTurns).toHaveCount(2);
      await expect(ui.assistantTurns.nth(0)).toContainText(REQUEST_ERROR_COPY);
      await expect(ui.assistantTurns.nth(1)).toContainText("Esto es lo que tienes en tu carrito.");
      await expect(ui.userTurns).toHaveText([CART_CHIP, "una pregunta nueva"]);
      await expect(ui.panel.getByText("Esto es lo que tienes en tu carrito.")).toHaveCount(1);
    });

    test("a late answer that arrives during a retry leaves the retry pending", async ({ chat }) => {
      await chat.clock.install();
      await mockChat(chat, cartAnswer(2));
      await chat.goto("/");
      const ui = await openAssistant(chat);
      // An earlier answer, so the chips under it show while the later turn is pending.
      await typeQuestion(chat, BUY_CHIP);
      await expect(ui.assistantTurns).toHaveCount(1);
      // 5 items, against 2 in the earlier answer: "Ingrediente 05" can only come from the late or the retried answer.
      const first = await mockChat(chat, cartAnswer(5), { hold: true });
      await typeQuestion(chat, CART_CHIP);
      await expect(ui.pending).toHaveCount(1);
      await chat.clock.fastForward(15_500);
      await expect(retryButton(chat)).toBeVisible();

      const second = await mockChat(chat, cartAnswer(5), { hold: true });
      await retryButton(chat).click();
      await expect(ui.pending).toHaveCount(1);
      await expect.poll(() => second.requests.length).toBe(1);

      const late = chat.waitForResponse(API);
      first.release();
      await late;
      await chat.evaluate(() => undefined);
      await expect(ui.pending).toHaveCount(1);
      await expect(ui.pending).toContainText(THINKING);
      await expect(ui.assistantTurns).toHaveCount(1);
      await expect(ui.panel).not.toContainText("Ingrediente 05");
      // A pending retry hides every chip, the earlier answer's too (REQ-5, REQ-8).
      await expect(ui.chips).toHaveCount(0);

      second.release();
      await expect(ui.assistantTurns).toHaveCount(2);
      await expect(ui.panel.getByText("Ingrediente 05")).toHaveCount(1);
      await expect(ui.pending).toHaveCount(0);
    });

    test("Reintentar afterwards asks again and answers once", async ({ chat }) => {
      await chat.clock.install();
      await mockChat(chat, cartAnswer(), { hold: true });
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await typeQuestion(chat, CART_CHIP);
      await expect(ui.pending).toHaveCount(1);
      await chat.clock.fastForward(15_500);
      await expect(retryButton(chat)).toBeVisible();

      const healthy = await mockChat(chat, cartAnswer());
      await retryButton(chat).click();
      await expect(ui.assistantTurns).toHaveCount(1);
      await expect(ui.chips).toHaveCount(2);
      await expect(ui.userTurns).toHaveText([CART_CHIP]);
      expect(healthy.requests).toHaveLength(1);
    });
  });
});

test.describe("REQ-5 with REQ-8: an error as the latest turn hides every chip", () => {
  test.use({ expectedIssues: expectIssues(...FAILED_500) });

  test("chips of the earlier answer are gone too", async ({ chat }) => {
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, CART_CHIP);
    await expect(ui.chips).toHaveCount(2);

    await mockChat(chat, cartAnswer(), { status: 500 });
    await typeQuestion(chat, "una pregunta más");
    await expect(ui.live.last()).toHaveText(SERVER_ERROR_COPY);
    await expect(chat.locator(".assistant-chips")).toHaveCount(0);
  });
});

test.describe("REQ-16: the loader under reduced motion", () => {
  const animationOf = (page: Page) => page.locator(".assistant-loader").evaluate((node) => getComputedStyle(node).animationName);

  test("blinks normally and is static text under prefers-reduced-motion", async ({ chat }) => {
    await mockChat(chat, cartAnswer(), { hold: true });
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, CART_CHIP);
    await expect(ui.pending).toContainText(THINKING);
    expect(await animationOf(chat)).not.toBe("none");

    await chat.emulateMedia({ reducedMotion: "reduce" });
    expect(await animationOf(chat)).toBe("none");
  });
});

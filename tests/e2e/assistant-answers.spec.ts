import type { Locator, Page } from "@playwright/test";
import { expectIssues } from "./fixtures";
import { auditNow, visit } from "./theme-audit";
import { contrast, effectiveBackground, toRgb } from "./theme-helpers";
import { NO_MATCH_ANSWER, NO_MATCH_LEAD, assistantUi, buildAnswer, cartAnswer, createChatUser, deleteChatUser, expect, mockChat, openAssistant, seedPlan, test } from "./assistant-helpers";

// UI tests of what an answer turn shows. Spec assistant-chat-polish: the structured content of a turn (REQ-2, REQ-3,
// REQ-18 UI) and the error copy (REQ-8, REQ-23). There are no scopes (assistant-data-scope REQ-4), so nothing here
// asserts a scope label or a scope in the request.

const SERVER_ERROR_COPY = "Algo salió mal al responder. Intenta de nuevo.";
const REQUEST_ERROR_COPY = "No pude responder en este momento.";

test.beforeAll(() => {
  createChatUser("answers");
  seedPlan({ times: "all" });
});
test.afterAll(() => deleteChatUser());

/** Types `message` in the panel input and sends it. */
async function typeQuestion(page: Page, message: string) {
  const ui = assistantUi(page);
  await ui.input.fill(message);
  await ui.send.click();
}

test.describe("a failed request", () => {
  test.use({ expectedIssues: expectIssues(/POST \/api\/rag\/chat → (500|503)/, /Failed to load resource.*(500|503)/) });

  test("a 500 gives an error turn with the server-error copy and no label (REQ-23)", async ({ chat }) => {
    await mockChat(chat, NO_MATCH_ANSWER, { status: 500 });
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, "¿Qué tengo en mi carrito?");

    await expect(ui.assistantTurns).toHaveCount(1);
    await expect(ui.assistantTurns.locator(".assistant-turn-live")).toHaveText(SERVER_ERROR_COPY);
    await expect(ui.labels).toHaveCount(0);
    await expect(ui.userTurns).toHaveText("¿Qué tengo en mi carrito?");
  });

  test("a 503 keeps the generic copy (REQ-8: any non-2xx other than 500)", async ({ chat }) => {
    await mockChat(chat, NO_MATCH_ANSWER, { status: 503 });
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, "¿Qué tengo en mi carrito?");

    await expect(ui.assistantTurns).toHaveCount(1);
    await expect(ui.assistantTurns.locator(".assistant-turn-live")).toHaveText(REQUEST_ERROR_COPY);
    await expect(ui.assistantTurns).not.toContainText(SERVER_ERROR_COPY);
    await expect(ui.labels).toHaveCount(0);
  });
});

test.describe("REQ-2, REQ-3, REQ-18: an answer shows exactly its structure", () => {
  /** Asks one question against a mocked answer and returns the finished turn. */
  async function answerTurn(chat: Page, answer: Parameters<typeof mockChat>[1]) {
    await mockChat(chat, answer);
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, "¿Qué tengo en mi carrito?");
    await expect(ui.assistantTurns).toHaveCount(1);
    return ui.assistantTurns.first();
  }

  test("a cart answer has one h3 below the panel h2, one li per item and highlighted quantities", async ({ chat }) => {
    const turn = await answerTurn(chat, cartAnswer(3));
    await expect(assistantUi(chat).panel.getByRole("heading", { level: 2 })).toHaveCount(1);
    await expect(turn.getByRole("heading", { level: 4 })).toHaveText(["Ingredientes"]);
    await expect(turn.getByRole("paragraph").first()).toHaveText("Esto es lo que tienes en tu carrito.");
    await expect(turn.getByRole("listitem")).toHaveText(["Ingrediente 01 · 1 g", "Ingrediente 02 · 2 g", "Ingrediente 03 · 3 g"]);
    const strong = turn.locator("strong");
    await expect(strong).toHaveText(["1 g", "2 g", "3 g"]);
    for (const weight of await strong.evaluateAll((nodes) => nodes.map((node) => Number(getComputedStyle(node).fontWeight)))) expect(weight).toBeGreaterThanOrEqual(600);
  });

  test("the items are a bulleted list, so the bullets show and the list keeps its semantics", async ({ chat }) => {
    const turn = await answerTurn(chat, cartAnswer(2));
    const list = turn.getByRole("list");
    await expect(list).toHaveCount(1);
    await expect(list).toHaveCSS("list-style-type", "disc");
    expect(await list.evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft))).toBeGreaterThan(0);
  });

  test("text only in `answer` is not shown as a heading, item or highlight", async ({ chat }) => {
    const answer = { ...cartAnswer(2), answer: "SOLO EN ANSWER" };
    const turn = await answerTurn(chat, answer);
    await expect(turn.getByRole("heading", { level: 4 })).toHaveText(["Ingredientes"]);
    await expect(turn.getByRole("listitem")).toHaveCount(2);
    await expect(turn).not.toContainText("SOLO EN ANSWER");
  });

  test("an answer with sources ends with a muted line listing every source", async ({ chat }) => {
    const answer = buildAnswer({ lead: [{ text: "Sobre algo:" }], sources: ["Recetario", "Carrito actual", "Receta: Pollo asado"] });
    const turn = await answerTurn(chat, answer);
    const sources = turn.getByText(/^Basado en:/);
    await expect(sources).toHaveText("Basado en: Recetario, Carrito actual, Receta: Pollo asado");
    // "Muted" must be visible in the styles, not only in the name: against the turn's background the line has less contrast than the lead.
    const lead = turn.locator(".assistant-turn-lead");
    const ratioOf = async (locator: Locator) => contrast(await toRgb(chat, await locator.evaluate((node) => getComputedStyle(node).color)), await effectiveBackground(locator));
    expect(await ratioOf(sources)).toBeLessThan(await ratioOf(lead));
  });

  test("no 'Basado en' line without sources or on the no-match reply, which shows the 4 starters", async ({ chat }) => {
    const empty = await answerTurn(chat, buildAnswer({ lead: [{ text: "Tu carrito está vacío." }] }));
    await expect(empty).not.toContainText("Basado en");
    await expect(empty.getByRole("heading")).toHaveCount(0);
    await expect(empty.getByRole("listitem")).toHaveCount(0);

    const noMatch = await answerTurn(chat, NO_MATCH_ANSWER);
    await expect(noMatch).not.toContainText("Basado en");
    await expect(noMatch.getByRole("paragraph")).toHaveText([NO_MATCH_LEAD]);
    await expect(noMatch.getByRole("button")).toHaveText(["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"]);
  });

  test("meal times show one item per meal with highlighted times (real API)", async ({ chat }) => {
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, "¿A qué hora es mi comida?");
    const turn = ui.assistantTurns.first();
    await expect(turn.getByRole("heading", { level: 4 })).toHaveText(["Comidas"]);
    await expect(turn.getByRole("listitem")).toHaveText(["Desayuno · Entre 7 a 8 am", "Colación · Entre 10 a 11 am", "Comida · Entre 2 a 3 pm", "Cena · Entre 8 a 9 pm"]);
    await expect(turn.locator("strong")).toHaveText(["Entre 7 a 8 am", "Entre 10 a 11 am", "Entre 2 a 3 pm", "Entre 8 a 9 pm"]);
    await expect(turn).toContainText("Basado en: Plan activo:");
  });
});

test.describe("REQ-17: the live region", () => {
  test("a pending turn already has a visible polite region, and it holds the answer once released", async ({ chat }) => {
    const mock = await mockChat(chat, cartAnswer(2), { hold: true });
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, "¿Qué tengo en mi carrito?");
    await expect(ui.pending).toHaveCount(1);
    const region = ui.pending.locator('[aria-live="polite"]');
    await expect(region).toBeAttached();
    expect(await region.evaluate((node) => getComputedStyle(node).display)).not.toBe("none");
    await expect(region).toHaveText("");

    mock.release();
    await expect(ui.pending).toHaveCount(0);
    await expect(ui.assistantTurns.locator('[aria-live="polite"]')).toContainText("Esto es lo que tienes en tu carrito.");
  });
});

test.describe("REQ-14: an answered turn meets contrast in the light theme", () => {
  test("lead, section, highlight, sources and buttons", async ({ chat }) => {
    test.setTimeout(120_000);
    await mockChat(chat, { ...cartAnswer(3), sources: ["Carrito actual"] });
    await visit(chat, "/", "light");
    const ui = await openAssistant(chat);
    await typeQuestion(chat, "¿Qué tengo en mi carrito?");
    await expect(ui.assistantTurns).toHaveCount(1);
    await expect(ui.chips).toHaveCount(2);
    await expect(ui.assistantTurns.locator(".assistant-turn-sources")).toBeVisible();
    // The whole panel: T031 tuned the header subtitle, the placeholder and the field border to pass in light too.
    const { violations } = await auditNow(chat, { scope: ".assistant-chat", tab: false, hover: false });
    expect(violations).toEqual([]);
  });
});

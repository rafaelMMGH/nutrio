import type { BrowserContext, Page } from "@playwright/test";
import type { ChatAnswer } from "../../src/lib/assistant";
import { ask, assistantUi, createChatUser, deleteChatUser, expect, openAssistant, resendSweep, seedCart, seedPlan, seedRecipes, test } from "./assistant-helpers";

// REQ-4 (API), REQ-5 and the trace guard of REQ-13: the request is { message }; scope and recipe_id from an old client
// change nothing, `resolved` exists only on request, and every starter resolves to a definite answer. The UI half of
// REQ-4 (no scope controls, same answer on two pages, header at 360 px) is at the end of the file.

let recipeIds: Record<string, string>;

test.beforeAll(() => createChatUser("noscope"));
test.afterAll(() => deleteChatUser());
test.beforeEach(() => {
  recipeIds = seedRecipes([
    { name: "Quesadillas", ingredients: [{ name: "Tortilla", quantity: 2, unit: "pza" }, { name: "Queso", quantity: 80 }] },
    { name: "Pollo asado", description: "Sazonar el pollo.\nAsar 20 minutos.", ingredients: [{ name: "Pechuga de pollo", quantity: 200 }] }
  ]);
  seedPlan({ times: "all", fixture: true });
  seedCart(3);
});

/** Posts the raw body, so the legacy fields really travel (ask() sends only the message). */
async function post(chatContext: BrowserContext, data: Record<string, unknown>) {
  const response = await chatContext.request.post("/api/rag/chat", { data });
  expect(response.status(), JSON.stringify(data)).toBe(200);
  return (await response.json()) as ChatAnswer;
}

const MESSAGES = ["¿Qué hay en mi carrito?", "¿Qué recetas hay en mi plan?", "¿A qué hora es mi comida?", "¿Cuál es mi objetivo?", "¿Cómo se prepara?", "¿Cuál es la capital de Francia?"];

test("REQ-4 scope and recipe_id change nothing: the same answer, kind, blocks and buttons", async ({ chatContext }) => {
  const recipeId = Object.values(recipeIds)[0];
  for (const message of MESSAGES) {
    const plain = await post(chatContext, { message });
    expect(plain.context_used, message).toBe("Todo el sistema");
    for (const legacy of [{ scope: "Carrito" }, { scope: "Plan activo" }, { scope: "Receta", recipe_id: recipeId }, { scope: "Recetario", recipe_id: "no-such-recipe" }]) {
      expect(await post(chatContext, { message, ...legacy }), `${message} ${JSON.stringify(legacy)}`).toEqual(plain);
    }
  }
});

test("REQ-4 a recipe id with scope Receta does not turn the cart question into a recipe answer", async ({ chatContext }) => {
  const body = await post(chatContext, { message: "¿Qué hay en mi carrito?", scope: "Receta", recipe_id: Object.values(recipeIds)[1] });
  expect(body.kind).toBe("answer");
  expect(body.answer).toContain("Esto es lo que tienes en tu carrito.");
  expect(body.answer).toContain("Ingrediente 01 · 1 g");
});

test("REQ-13 resolved is absent without the trace header and present, with the same answer, with it", async ({ chatContext }) => {
  const plain = await ask(chatContext.request, "¿Qué hay en mi carrito?");
  expect(plain.status).toBe(200);
  expect("resolved" in plain.body).toBe(false);
  const traced = await ask(chatContext.request, "¿Qué hay en mi carrito?", { trace: true });
  expect(traced.body.resolved?.map((intent) => intent.topic)).toEqual(["cart"]);
  expect(traced.body.answer).toBe(plain.body.answer);
  expect(traced.body.answer).toContain("Esto es lo que tienes en tu carrito.");
});

test("REQ-5 every starter button, sent as a first message, gives the same definite answer both times", async ({ chatContext }) => {
  const { status, body } = await ask(chatContext.request, "hola");
  expect(status).toBe(200);
  expect(body.kind).toBe("greeting");
  const messages = await resendSweep(chatContext.request, [body]);
  expect(messages).toEqual(["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"]);
});

// ---------------------------------------------------------------------------------------------------------------------
// REQ-4 UI

/** The JSON bodies the page posts to the chat endpoint, in order. The real server answers (the seeded cart and plan). */
function recordChatBodies(page: Page) {
  const bodies: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/rag/chat")) bodies.push(request.postDataJSON());
  });
  return bodies;
}

const STARTERS = ["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"];
const PAGES = [{ name: "the dashboard", path: () => "/" }, { name: "a recipe page", path: () => `/recipes/${Object.values(recipeIds)[0]}` }, { name: "the groceries page", path: () => "/groceries" }, { name: "the plans page", path: () => "/plans" }];

for (const page of PAGES) {
  test(`REQ-4 ${page.name} has no scope control and shows the 4 starters`, async ({ chat }) => {
    await chat.goto(page.path());
    const ui = await openAssistant(chat);
    await expect(ui.chips).toHaveText(STARTERS);
    for (const gone of [chat.getByText("Alcance"), chat.getByRole("button", { name: /Preguntar en Todo/ }), chat.getByRole("group", { name: "Alcance" }), chat.getByRole("button", { name: /Alcance|Buscar en/ })]) {
      await expect(gone).toHaveCount(0);
    }
  });
}

test("REQ-4 on a recipe page the cart question gets the cart answer, sent as { message } only", async ({ chat }) => {
  const bodies = recordChatBodies(chat);
  await chat.goto(`/recipes/${Object.values(recipeIds)[0]}`);
  const ui = await openAssistant(chat);
  await ui.input.fill("¿Qué hay en mi carrito?");
  await ui.send.click();
  await expect(ui.assistantTurns).toHaveCount(1);
  expect(bodies).toEqual([{ message: "¿Qué hay en mi carrito?" }]);
  await expect(ui.live).toContainText("Esto es lo que tienes en tu carrito.");
  await expect(ui.labels).toHaveCount(0);
});

test("REQ-4 the search bar opens the panel and sends only { message }", async ({ chat }) => {
  const bodies = recordChatBodies(chat);
  await chat.goto("/");
  const ui = assistantUi(chat);
  const bar = chat.getByRole("textbox", { name: "Preguntar al asistente" });
  await expect(bar).toHaveAttribute("placeholder", "Pregunta por tu plan, tu avance o tus compras");
  await bar.fill("¿Cuál es mi peso?");
  await bar.press("Enter");
  await expect(ui.panel).toBeVisible();
  await expect(ui.assistantTurns).toHaveCount(1);
  expect(bodies).toEqual([{ message: "¿Cuál es mi peso?" }]);
});

test("REQ-4 the subtitle is a label only: the same question gives the same visible answer and buttons on two pages", async ({ chat }) => {
  const visible = async (path: string) => {
    await chat.goto(path);
    const ui = await openAssistant(chat);
    await expect(ui.panel.locator("header p")).toBeAttached();
    await ui.input.fill("¿Cuál es mi horario?");
    await ui.send.click();
    await expect(ui.assistantTurns).toHaveCount(1);
    return { subtitle: await ui.panel.locator("header p").textContent(), text: await ui.live.last().innerText(), buttons: await ui.chips.allInnerTexts() };
  };
  const recipe = await visible(`/recipes/${Object.values(recipeIds)[0]}`);
  const groceries = await visible("/groceries");
  expect(recipe.subtitle).not.toBe(groceries.subtitle);
  expect(recipe.text).toBe(groceries.text);
  expect(recipe.buttons).toEqual(groceries.buttons);
});

test.describe("360 px header", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("REQ-4 row 1 holds the title, Nueva conversación and the close button, each at least 44x44, without overlap", async ({ chat }) => {
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ui.input.fill("Mi carrito");
    await ui.send.click();
    await expect(ui.assistantTurns).toHaveCount(1);
    const head = ui.panel.locator("header");
    const boxes = [];
    for (const target of [head.getByRole("heading", { name: "Asistente" }), head.getByRole("button", { name: "Nueva conversación" }), head.getByRole("button", { name: "Cerrar asistente" })]) {
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box!);
    }
    for (const box of boxes.slice(1)) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const headBox = (await head.boundingBox())!;
    for (const [index, box] of boxes.entries()) {
      expect(box.x).toBeGreaterThanOrEqual(headBox.x);
      expect(box.x + box.width).toBeLessThanOrEqual(headBox.x + headBox.width);
      for (const other of boxes.slice(index + 1)) {
        const apart = box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y;
        expect(apart).toBe(true);
      }
    }
    // Row 1 only: all three sit on one line.
    expect(Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y))).toBeLessThan(44);
  });
});

import type { BrowserContext } from "@playwright/test";
import type { ChatAnswer } from "../../src/lib/assistant";
import { ask, createChatUser, deleteChatUser, expect, resendSweep, seedCart, seedPlan, seedRecipes, test } from "./assistant-helpers";

// REQ-4 (API), REQ-5 and the trace guard of REQ-13: the request is { message }; scope and recipe_id from an old client
// change nothing, `resolved` exists only on request, and every starter resolves to a definite answer. The UI half of
// REQ-4 (no scope controls, same answer on two pages) joins this file in T012.

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

import { ask, createChatUser, deleteChatUser, expect, seedCart, seedPlan, seedRecipes, test } from "./assistant-helpers";

// REQ-1 and REQ-2 through the real API: one Given with its answer text, a typo that still resolves and a word that must not.
// The full tables run as unit tests (tests/unit/chat-answer.test.ts); `resolved` is only a diagnostic next to the text.

test.beforeAll(() => createChatUser("match"));
test.afterAll(() => deleteChatUser());
test.beforeEach(() => {
  seedRecipes([{ name: "Quesadillas", ingredients: [{ name: "Tortilla", quantity: 2, unit: "pza" }] }]);
  seedPlan({ times: "all", fixture: true });
  seedCart(3);
});

test("REQ-1 a plural reaches its topic: '¿Qué horarios tengo?' lists the meal times", async ({ chatContext }) => {
  const { status, body } = await ask(chatContext.request, "¿Qué horarios tengo?", { trace: true });
  expect(status).toBe(200);
  expect(body.resolved?.map((intent) => intent.topic)).toEqual(["mealTimes"]);
  expect(body.blocks[0].lead.map((span) => span.text).join("")).toMatch(/horarios/);
});

test("REQ-2 'carito' is a typo of carrito and shows the cart", async ({ chatContext }) => {
  const { body } = await ask(chatContext.request, "carito", { trace: true });
  expect(body.resolved?.map((intent) => intent.topic)).toEqual(["cart"]);
  expect(body.answer).toContain("Esto es lo que tienes en tu carrito.");
});

test("REQ-2 'una planta' is not 'plan': the no-match reply with the four starters", async ({ chatContext }) => {
  const { body } = await ask(chatContext.request, "una planta", { trace: true });
  expect(body.kind).toBe("no_match");
  expect(body.resolved).toEqual([]);
  expect(body.buttons.map((button) => button.label)).toEqual(["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"]);
});

test("REQ-6 'plan' beside 'recetas' is the possessor: only the Recipes answer, from the recipe book", async ({ chatContext }) => {
  const { body } = await ask(chatContext.request, "¿Qué recetas hay en mi plan?", { trace: true });
  expect(body.resolved?.map((intent) => intent.topic)).toEqual(["recipes"]);
  expect(body.sources).toEqual(["Recetario"]);
  expect(body.answer).toContain("Quesadillas");
});

test("REQ-6 'ingredientes' with a cart cue is the cart alone", async ({ chatContext }) => {
  const { body } = await ask(chatContext.request, "¿Qué ingredientes necesito comprar?", { trace: true });
  expect(body.resolved?.map((intent) => intent.topic)).toEqual(["cart"]);
  expect(body.answer).toContain("Esto es lo que tienes en tu carrito.");
});

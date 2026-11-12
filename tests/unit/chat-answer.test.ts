import assert from "node:assert/strict";
import { test } from "node:test";
import type { Block, ChatAnswer } from "@/lib/assistant";
import { ragAnswer, recipeList } from "@/lib/domain/chat";
import { isGeneric } from "@/lib/domain/chat-dish";
import { memDb, sweep } from "./memdb";

// The answer path of the chat over in-memory data (plan D10): the same ragAnswer the route calls, with today passed in.
// Builders that do not exist yet (weight, slots, ...) are covered by the batches that add them.

const TODAY = "2026-10-28";
const KINDS = ["answer", "options", "detail", "clarify", "did_you_mean", "greeting", "no_match", "empty"];
const STARTERS = ["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"];
const PLACEHOLDER = /Pronto podré responder sobre/;

const plain = (rich: { text: string }[]) => rich.map((span) => span.text).join("");
const messagesOf = (buttons: ChatAnswer["buttons"]) => buttons.flatMap((button) => (button.type === "question" ? [button.message] : []));

/** The plain `answer` the contract describes for blocks without option buttons: title, lead, then each section's title and items. */
const textOf = (blocks: Block[]) =>
  blocks.flatMap((block) => [...(block.title ? [block.title] : []), plain(block.lead), ...block.sections.flatMap((section) => [section.title, ...section.items.map(plain)])]).join("\n");

const QUESTIONS = ["¿Qué hay en mi carrito?", "¿Qué recetas hay en mi plan?", "¿Cuál es mi horario?", "¿Cuál es mi plan?", "hola", "gracias", "¿Cuál es la capital de Francia?", "¿Qué hago ahora?"];

test("every reply has an allowed kind, blocks, buttons, the general context and an answer equal to its blocks", () => {
  const { db, user } = memDb({ cart: 3 });
  for (const message of QUESTIONS) {
    const reply = ragAnswer(db, user, message, TODAY);
    assert.ok(KINDS.includes(reply.kind), `${message}: ${reply.kind}`);
    assert.equal(reply.context_used, "Todo el sistema", message);
    assert.ok(reply.blocks.length >= 1 && reply.blocks.length <= 2, message);
    assert.ok(Array.isArray(reply.buttons), message);
    assert.equal(reply.answer, textOf(reply.blocks), message);
    assert.doesNotMatch(reply.answer, PLACEHOLDER, message);
  }
});

test("the cart answer shows the cart text and the Cart follow-ups as question buttons", () => {
  const { db, user } = memDb({ cart: 3 });
  const reply = ragAnswer(db, user, "¿Qué hay en mi carrito?", TODAY);
  assert.equal(reply.kind, "answer");
  assert.match(reply.answer, /Esto es lo que tienes en tu carrito\.\nIngredientes\nIngrediente 01 · 1 g/);
  assert.deepEqual(reply.sources, ["Carrito actual"]);
  assert.deepEqual(reply.buttons, [
    { type: "question", label: "¿Qué recetas hay en mi plan?", message: "¿Qué recetas hay en mi plan?" },
    { type: "question", label: "Mi cena de hoy", message: "Mi cena de hoy" }
  ]);
});

test("a greeting answers with a greeting kind and the four starters; greetings and thanks differ", () => {
  const { db, user } = memDb();
  const hello = ragAnswer(db, user, "¡Hola!", TODAY);
  assert.equal(hello.kind, "greeting");
  assert.deepEqual(messagesOf(hello.buttons), STARTERS);
  assert.ok(["¡Hola! ¿En qué te ayudo?", "¡Hola! ¿Qué quieres saber?", "¡Hola! Pregúntame por tu plan, tu avance o tu carrito."].includes(hello.answer), hello.answer);
  const thanks = ragAnswer(db, user, "gracias", TODAY);
  assert.equal(thanks.kind, "greeting");
  assert.ok(["¡Con gusto!", "¡De nada!", "Para eso estoy."].includes(thanks.answer), thanks.answer);
});

test("a question with no topic is no_match with the lead, the four starters and no sources", () => {
  const { db, user } = memDb();
  for (const message of ["¿Cuál es la capital de Francia?", "¿Qué hago ahora?"]) {
    const reply = ragAnswer(db, user, message, TODAY);
    assert.equal(reply.kind, "no_match", message);
    assert.equal(reply.answer, "No entendí tu pregunta. Puedo ayudarte con:", message);
    assert.deepEqual(messagesOf(reply.buttons), STARTERS, message);
    assert.deepEqual(reply.sources, [], message);
  }
});

test("the old fallback texts never appear", () => {
  const { db, user } = memDb();
  for (const message of QUESTIONS) {
    const { answer } = ragAnswer(db, user, message, TODAY);
    assert.doesNotMatch(answer, /No encontré eso en tu información|Puedo ayudarte con tu plan de comidas/, message);
  }
});

test("resolved appears only with the trace option, and the visible answer is the same", () => {
  const { db, user } = memDb({ cart: 2 });
  const plainReply = ragAnswer(db, user, "¿Qué hay en mi carrito?", TODAY);
  const traced = ragAnswer(db, user, "¿Qué hay en mi carrito?", TODAY, { trace: true });
  assert.equal("resolved" in plainReply, false);
  assert.deepEqual(traced.resolved?.map((intent) => intent.topic), ["cart"]);
  assert.equal(traced.answer, plainReply.answer);
  assert.match(traced.answer, /Esto es lo que tienes en tu carrito\./);
  assert.deepEqual(ragAnswer(db, user, "hola", TODAY, { trace: true }).resolved?.map((intent) => intent.topic), ["greeting"]);
  assert.deepEqual(ragAnswer(db, user, "¿Cuál es la capital de Francia?", TODAY, { trace: true }).resolved, []);
});

test("REQ-5 the repeat rule drops a follow-up that repeats the message, however it is typed", () => {
  const { db, user } = memDb();
  // Recipes are one topic here ("plan" is the possessor), so its follow-ups are the ones offered, without the question just asked.
  const wanted = ["Mi carrito", "Mi cena de hoy"];
  assert.deepEqual(messagesOf(ragAnswer(db, user, "¿Qué recetas hay en mi plan?", TODAY).buttons), wanted);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "¡¿QUÉ recetas hay en MI plan?!", TODAY).buttons), wanted);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "Mi carrito", TODAY).buttons), ["¿Qué recetas hay en mi plan?", "Mi cena de hoy"]);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "¿Qué suplementos tomo?", TODAY).buttons), ["¿Cuál es mi meta?", "¿Qué recetas hay en mi plan?"]);
});

// Buttons that cannot be swept yet: no builder (goals, weight, weekly, metrics).
const PENDING = ["¿Cuál es mi meta?", "Mi peso", "Mi avance de la semana", "¿Cuánto ejercicio llevo?", "¿Cuánta agua llevo?", "¿Cuántas comidas llevo?"];

test("REQ-5 every starter and follow-up with a builder resolves to its Button-column topic and gives the same answer", () => {
  const { db, user } = memDb({ cart: 3 });
  const answers = ["hola", "Mi carrito", "¿Cuál es mi horario?", "¿Cuál es mi plan?"].map((message) => ragAnswer(db, user, message, TODAY));
  assert.deepEqual(sweep(db, user, answers, TODAY, { skip: PENDING }).sort(), ["Mi carrito", "Mi cena de hoy", "¿Qué suplementos tomo?", "¿Qué recetas hay en mi plan?"].sort());
});

test("REQ-5 every '¿Qué lleva <receta>?' of a non-generic fixture recipe resolves to that recipe and gives the same detail", () => {
  const { db, user } = memDb();
  const recipes = db.recipes.filter((recipe) => !isGeneric(recipe.name));
  assert.equal(recipes.length, 6);
  const buttons = recipes.map((recipe) => ({ type: "question" as const, label: recipe.name, message: `¿Qué lleva ${recipe.name}?` }));
  const offered: ChatAnswer = { ...ragAnswer(db, user, "¿Qué recetas hay en mi plan?", TODAY), buttons };
  assert.deepEqual(sweep(db, user, [offered], TODAY), buttons.map((button) => button.message));
  for (const recipe of recipes) assert.deepEqual(ragAnswer(db, user, `¿Qué lleva ${recipe.name}?`, TODAY, { trace: true }).resolved?.[0].recipeIds, [recipe.id], recipe.name);
});

test("the sweep fails on an empty set and on a placeholder", () => {
  const { db, user } = memDb();
  const bare: ChatAnswer = { ...ragAnswer(db, user, "¿Cuál es la capital de Francia?", TODAY), buttons: [] };
  assert.throws(() => sweep(db, user, [{ ...bare, blocks: [] }], TODAY), /no question buttons/);
  const placeholder: ChatAnswer = { ...bare, answer: "Pronto podré responder sobre Peso.", blocks: [{ title: null, lead: [{ text: "Pronto podré responder sobre Peso." }], sections: [], buttons: [] }] };
  assert.throws(() => sweep(db, user, [placeholder], TODAY), /placeholder answer/);
});

const topicsOf = (db: ReturnType<typeof memDb>["db"], user: ReturnType<typeof memDb>["user"], message: string) =>
  ragAnswer(db, user, message, TODAY, { trace: true }).resolved?.map((intent) => intent.topic);

// REQ-1 Givens and the synonym groups of the Topics table, one topic each; the combinations are in chat-intent.test.ts.
const GIVENS: [string, string, RegExp?][] = [
  ["¿CUÁNTO PESÉ?", "weight"],
  ["báscula", "weight"],
  ["bascula", "weight"],
  ["¿Cuánto entrené?", "exercise"],
  ["gym", "exercise"],
  ["¿Ya tomé agua?", "water"],
  ["kilos", "weight"],
  ["gimnasio", "exercise"],
  ["hidratación", "water"],
  ["vasos", "water"],
  ["¿Cuál es mi meta?", "goals"],
  ["mi avance", "weekly"],
  ["resumen", "weekly"],
  ["¿Cuántas comidas llevo?", "mealsDone"],
  ["¿Cómo me llamo?", "identity"],
  ["¿Cómo se llama mi plan?", "identity"],
  ["¿Qué hay en el carrito, por favor?", "cart", /carrito/],
  ["¿Dónde compro?", "cart", /carrito/],
  ["¿Cómo preparo el pollo?", "recipes", /Estas recetas coinciden/],
  ["¿Qué ingrediente me falta?", "recipes", /Estas son tus recetas/],
  ["¿CUÁL ES MI HORARIO?", "mealTimes", /horarios/],
  ["¿Qué horarios tengo?", "mealTimes", /horarios/],
  ["¿Cuándo?", "mealTimes", /horarios/],
  ["Dame las recomendaciones", "plan", /Tu objetivo/],
  ["¿Qué suplementos tomo?", "plan", /Tu objetivo/],
  ["Mis planes", "plan", /Tu objetivo/],
  ["desayuno", "slotOptions"],
  ["mi colacion", "slotOptions"],
  ["¿Qué colaciones tengo?", "slotOptions"]
];

for (const [message, topic, lead] of GIVENS) {
  test(`REQ-1 "${message}" resolves to ${topic}`, () => {
    const { db, user } = memDb({ cart: 2 });
    assert.deepEqual(topicsOf(db, user, message), [topic]);
    if (lead) assert.match(ragAnswer(db, user, message, TODAY).answer, lead);
  });
}

test("REQ-1 two topics are answered in order of first appearance, titled", () => {
  const { db, user } = memDb({ cart: 2 });
  const reply = ragAnswer(db, user, "peso y carrito", TODAY, { trace: true });
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["weight", "cart"]);
  assert.deepEqual(reply.blocks.map((block) => block.title), ["Peso", "Carrito"]);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "carrito, peso y agua", TODAY).buttons).slice(-1), ["¿Cuánta agua llevo?"]);
  // A time word beside another topic is ignored (REQ-6): the cart alone.
  assert.deepEqual(topicsOf(db, user, "carrito y horario"), ["cart"]);
});

test("REQ-3 the sources of the second answered block are listed too", () => {
  const { db, user } = memDb({ cart: 2 });
  const reply = ragAnswer(db, user, "mi objetivo y carrito", TODAY, { trace: true });
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["goals", "cart"]);
  // Includes, not equals: the goals block may bring its own sources once its builder lands.
  assert.ok(reply.sources.includes("Carrito actual"), reply.sources.join());
});

test("REQ-3 a source shared by two blocks is listed once", () => {
  const { db, user } = memDb();
  const reply = ragAnswer(db, user, "¿A qué hora es el desayuno y la cena?", TODAY);
  assert.equal(reply.sources.length, new Set(reply.sources).size, reply.sources.join());
});

// REQ-2 table through the answer path: a typo resolves to its topic, a ✗ row to nothing.
const TYPOS: [string, string][] = [["carito", "cart"], ["carrtio", "cart"], ["recta", "recipes"], ["desayno", "slotOptions"], ["ejersisio", "exercise"], ["horarios", "mealTimes"]];
const NOT_TOPICS = ["ahora", "ahorita", "pero", "carritito", "garrito", "vasto", "pasar", "lleva", "objeto", "cuanto", "una planta", "¿Qué cosas tengo?", "¿Qué hago ahora?"];

for (const [message, topic] of TYPOS) {
  test(`REQ-2 "${message}" is a typo of ${topic}`, () => {
    const { db, user } = memDb();
    assert.deepEqual(topicsOf(db, user, message), [topic]);
  });
}

for (const message of NOT_TOPICS) {
  test(`REQ-2 "${message}" matches no topic: the no-match reply with the starters`, () => {
    const { db, user } = memDb();
    const reply = ragAnswer(db, user, message, TODAY, { trace: true });
    assert.deepEqual(reply.resolved, []);
    assert.equal(reply.kind, "no_match");
    assert.deepEqual(messagesOf(reply.buttons), STARTERS);
  });
}

test("REQ-24 a topic button already among the second block's follow-ups is offered once", () => {
  const { db, user } = memDb();
  const reply = ragAnswer(db, user, "agua, ejercicio y peso", TODAY);
  assert.deepEqual(messagesOf(reply.buttons), ["¿Cuánta agua llevo?", "Mi peso"]);
});

test("REQ-24 a question with three topics gets two titled blocks; the third becomes its button", () => {
  const { db, user } = memDb();
  const reply = ragAnswer(db, user, "agua, ejercicio y peso", TODAY, { trace: true });
  assert.equal(reply.blocks.length, 2);
  assert.deepEqual(reply.blocks.map((block) => block.title), ["Agua", "Ejercicio"]);
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["water", "exercise"]);
});

test("REQ-24 topics are answered in question order, also when a phrase comes after a word", () => {
  const { db, user } = memDb();
  const reply = ragAnswer(db, user, "agua y cómo me llamo", TODAY, { trace: true });
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["water", "identity"]);
  assert.equal(reply.blocks[0].title, "Agua");
});

// Recipe-list filter words frozen from chat-polish v1.9 (spec Terms): a recipe named after one of them must not be
// picked by it. "Pollo asado" always matches through "pollo"; "Sopa <word>" must stay out of the list.
const STOP_WORDS = ["que", "hay", "en", "mi", "mis", "de", "del", "el", "la", "los", "las", "con", "para", "por", "tengo", "cual", "cuales", "como", "cuanto", "es", "un", "una"];
const ALSO_DROPPED = ["hora", "horas", "horario", "horarios", "cuando", "desayuno", "desayunos", "comida", "comidas", "cena", "cenas", "colacion", "colaciones", "carrito", "carritos", "plan", "planes", "objetivo", "objetivos"];
// One real word per prefix (compr, receta, ingrediente, prepar, suplement, recomend), and two forms of the first.
const PREFIXED = ["comprar", "compras", "recetario", "ingredientes", "preparado", "suplementos", "recomendado"];

// The filter is the recipe list's own: the resolver lets some of these words (slots, cart, goals) take the question
// away from Recipes, so the rows call the Recipes builder directly. Its wiring is the "descomprar" row below.
function recipeBlock(word: string, question: string) {
  const { db, user } = memDb({ fixture: false });
  const template = { user_id: user.id, description: "", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null };
  db.recipes = ["Pollo asado", `Sopa ${word}`].map((name, index) => ({ ...template, id: `r${index}`, name, canonical_hash: `r${index}` }));
  const built = recipeList(db, user.id, question);
  return { lead: plain(built.lead), items: (built.sections ?? []).flatMap((section) => section.items.map(plain)) };
}

for (const word of [...STOP_WORDS, ...ALSO_DROPPED, ...PREFIXED, "ya"]) {
  test(`REQ-1 the recipe list ignores the frozen filter word "${word}"`, () => {
    assert.deepEqual(recipeBlock(word, `recetas pollo ${word}`), { lead: "Estas recetas coinciden con tu pregunta.", items: ["Pollo asado"] });
  });
}

// "descomprar" only contains "compr": a dropped prefix is a prefix (startsWith), so it narrows.
for (const word of ["peso", "sal", "descomprar"]) {
  test(`REQ-1 the recipe list still narrows by the word "${word}"`, () => {
    assert.deepEqual(recipeBlock(word, `recetas ${word}`), { lead: "Estas recetas coinciden con tu pregunta.", items: [`Sopa ${word}`] });
  });
}

test("REQ-1 the answer to a recipes question is the Recipes block alone, narrowed by a word with a dropped prefix inside it", () => {
  const { db, user } = memDb({ fixture: false });
  const template = { user_id: user.id, description: "", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null };
  db.recipes = ["Pollo asado", "Sopa descomprar"].map((name, index) => ({ ...template, id: `r${index}`, name, canonical_hash: `r${index}` }));
  const reply = ragAnswer(db, user, "recetas descomprar", TODAY, { trace: true });
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["recipes"]);
  assert.equal(reply.blocks.length, 1);
  assert.deepEqual(reply.blocks[0].sections.flatMap((section) => section.items.map(plain)), ["Sopa descomprar"]);
});

test("REQ-6 the resolver picks the topics: the possessor plan, ingredients with a cart cue, a time word beside a cart cue", () => {
  const { db, user } = memDb({ cart: 2 });
  const recipes = ragAnswer(db, user, "¿Qué recetas hay en mi plan?", TODAY, { trace: true });
  assert.deepEqual(recipes.resolved?.map((intent) => intent.topic), ["recipes"]);
  assert.deepEqual(recipes.blocks.map((block) => block.title), [null]);
  assert.deepEqual(recipes.sources, ["Recetario"]);
  for (const message of ["¿Qué ingredientes necesito comprar?", "¿Cuándo compro?"]) {
    const cart = ragAnswer(db, user, message, TODAY, { trace: true });
    assert.deepEqual(cart.resolved?.map((intent) => intent.topic), ["cart"], message);
    assert.match(cart.answer, /carrito/, message);
  }
});

test("REQ-24 the answered topics come from the resolver: a third topic with no button leaves no stray button", () => {
  const { db, user } = memDb();
  const reply = ragAnswer(db, user, "agua, ejercicio y cómo me llamo", TODAY, { trace: true });
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["water", "exercise"]);
  // Only the second block's follow-ups: the identity topic has no button to offer.
  assert.deepEqual(messagesOf(reply.buttons), ["¿Cuánta agua llevo?", "Mi peso"]);
});

// REQ-6 step 4 through ragAnswer (T079): the dish phrase is matched against the user's own, non-deleted, non-generic recipes.
const dishIntent = (db: ReturnType<typeof memDb>["db"], user: ReturnType<typeof memDb>["user"], message: string) => ragAnswer(db, user, message, TODAY, { trace: true }).resolved?.[0];

test("REQ-6 step 4: each non-generic fixture recipe is found by '¿Qué lleva <receta>?'", () => {
  const { db, user } = memDb({ extras: true });
  const named = db.recipes.filter((recipe) => !/ opcion \d+$/.test(recipe.name));
  assert.equal(named.length, 9);
  for (const recipe of named) assert.deepEqual(dishIntent(db, user, `¿Qué lleva ${recipe.name}?`), { topic: "dish", outcome: "found", recipeIds: [recipe.id], phrase: recipe.name }, recipe.name);
});

test("REQ-6 step 4: a soft-deleted recipe and another user's recipe are never found", () => {
  const { db, user } = memDb();
  const [pollo] = db.recipes.filter((recipe) => recipe.name === "Pollo asado");
  pollo.deleted_at = "2026-02-01T00:00:00.000Z";
  assert.equal(dishIntent(db, user, "¿Qué lleva el pollo asado?")?.outcome, "didYouMean");
  assert.deepEqual(dishIntent(db, user, "¿Qué lleva el pollo asado?")?.recipeIds, [db.recipes.find((recipe) => recipe.name === "Ensalada de pollo")!.id]);
  const tacos = db.recipes.find((recipe) => recipe.name === "Tacos de frijol")!;
  tacos.user_id = "someone-else";
  assert.deepEqual(dishIntent(db, user, "¿Qué lleva tacos de frijol?"), { topic: "dish", outcome: "notFound", phrase: "tacos de frijol" });
});

test("REQ-6 steps 2 and 4: a generic option name is never a dish; '<slot> opcion <n>' is option selection (REQ-10)", () => {
  const { db, user } = memDb();
  assert.deepEqual(dishIntent(db, user, "¿Qué lleva desayuno opcion 1?"), { topic: "slotOptions", slot: "desayuno", option: 1 });
});

// REQ-13, REQ-14: ragAnswer parses dates against the `today` it is given, so a pinned today moves the period bounds.
test("the trace carries the period computed from the given today", () => {
  const { db, user } = memDb();
  const periodOf = (today: string) => ragAnswer(db, user, "¿Cuánta agua tomé ayer?", today, { trace: true }).resolved?.[0]?.period;
  assert.deepEqual(periodOf("2026-10-28"), { kind: "yesterday", from: "2026-10-27", to: "2026-10-27" });
  assert.deepEqual(periodOf("2026-03-13"), { kind: "yesterday", from: "2026-03-12", to: "2026-03-12" });
});

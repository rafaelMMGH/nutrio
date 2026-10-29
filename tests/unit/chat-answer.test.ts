import assert from "node:assert/strict";
import { test } from "node:test";
import type { Block, ChatAnswer } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
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
  // Two topics (until the resolver): the second block's follow-ups, here Plan's, without the question just asked.
  const wanted = ["¿Cuál es mi meta?", "¿Qué suplementos tomo?"];
  assert.deepEqual(messagesOf(ragAnswer(db, user, "¿Qué recetas hay en mi plan?", TODAY).buttons), wanted);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "¡¿QUÉ recetas hay en MI plan?!", TODAY).buttons), wanted);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "¿Qué suplementos tomo?", TODAY).buttons), ["¿Cuál es mi meta?", "¿Qué recetas hay en mi plan?"]);
});

// Buttons that cannot be swept yet: no builder (goals, weight, weekly, metrics, slot options: "Mi cena de hoy" returns
// with T021 and T032) or more than one matched topic until the resolver (T022/T023: possessor "plan", "llevo").
const PENDING = ["¿Cuál es mi meta?", "Mi peso", "Mi avance de la semana", "Mi cena de hoy", "¿Qué recetas hay en mi plan?", "¿Cuánto ejercicio llevo?", "¿Cuánta agua llevo?", "¿Cuántas comidas llevo?"];

test("REQ-5 every starter and follow-up with a builder resolves to its Button-column topic and gives the same answer", () => {
  const { db, user } = memDb({ cart: 3 });
  const answers = ["hola", "Mi carrito", "¿Cuál es mi horario?", "¿Cuál es mi plan?"].map((message) => ragAnswer(db, user, message, TODAY));
  assert.deepEqual(sweep(db, user, answers, TODAY, { skip: PENDING }).sort(), ["Mi carrito", "¿Qué suplementos tomo?"].sort());
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

// REQ-1 Givens and the synonym groups of the Topics table. Until the resolver (T023) the topic list is the matched
// topics in order of first appearance, so only questions with one topic are listed; combinations belong to T021.
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
  const reply = ragAnswer(db, user, "carrito y horario", TODAY, { trace: true });
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["cart", "mealTimes"]);
  assert.deepEqual(reply.blocks.map((block) => block.title), ["Carrito", "Horarios"]);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "carrito, horario y plan", TODAY).buttons).slice(-1), ["¿Cuál es mi plan?"]);
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

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

const QUESTIONS = ["¿Qué hay en mi carrito?", "¿Qué recetas hay en mi plan?", "¿A qué hora es mi comida?", "¿Cuál es mi objetivo?", "hola", "gracias", "¿Cuál es la capital de Francia?", "¿Qué hago ahora?"];

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
  const asked = ragAnswer(db, user, "Mi cena de hoy", TODAY);
  assert.deepEqual(messagesOf(asked.buttons), ["Mi carrito"]);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "¡MI CENA de hoy!", TODAY).buttons), ["Mi carrito"]);
  assert.deepEqual(messagesOf(ragAnswer(db, user, "¿Qué recetas hay en mi plan?", TODAY).buttons), ["Mi carrito", "Mi cena de hoy"]);
});

// Follow-ups whose builders do not exist yet resolve to no_match; each batch that adds a builder shrinks this list.
const PENDING = ["¿Cuál es mi meta?", "Mi peso", "Mi avance de la semana"];

test("REQ-5 every starter and follow-up with a builder gives the same definite answer as a first message", () => {
  const { db, user } = memDb({ cart: 3 });
  const answers = ["hola", ...QUESTIONS.slice(0, 4)].map((message) => ragAnswer(db, user, message, TODAY));
  const swept = sweep(db, user, answers, TODAY, { skip: PENDING });
  assert.deepEqual(swept.sort(), ["Mi carrito", "Mi cena de hoy", "¿Qué recetas hay en mi plan?", "¿Qué suplementos tomo?"].sort());
});

test("the sweep fails on an empty set and on a placeholder", () => {
  const { db, user } = memDb();
  const bare: ChatAnswer = { ...ragAnswer(db, user, "¿Cuál es la capital de Francia?", TODAY), buttons: [] };
  assert.throws(() => sweep(db, user, [{ ...bare, blocks: [] }], TODAY), /no question buttons/);
  const placeholder: ChatAnswer = { ...bare, answer: "Pronto podré responder sobre Peso.", blocks: [{ title: null, lead: [{ text: "Pronto podré responder sobre Peso." }], sections: [], buttons: [] }] };
  assert.throws(() => sweep(db, user, [placeholder], TODAY), /placeholder answer/);
});

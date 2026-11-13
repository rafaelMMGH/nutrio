import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTERS, type ChatAnswer } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { isGeneric, rankDish } from "@/lib/domain/chat-dish";
import { pickVariant } from "@/lib/domain/chat-meals";
import { GREETINGS, NO_MATCH_LEADS, THANKS } from "../shared/assistant-copy";
import { memDb, sweep } from "./memdb";

// Chat-like edge cases (spec assistant-data-scope US4): greeting and thanks (REQ-23), the REQ-28 variants and the
// plain no-match reply and the dish answers, did-you-mean and not found (REQ-26, REQ-29).

const TODAY = "2026-10-28";
const ask = (message: string) => {
  const { db, user } = memDb();
  return ragAnswer(db, user, message, TODAY, { trace: true });
};
const starters = (reply: ChatAnswer) => reply.buttons.flatMap((button) => (button.type === "question" ? [button.message] : []));

// Raw texts, each reaching one variant through the question hash (REQ-28). The fuzzy rows are the 1c2 review (M4).
const HELLOS = ["hola", "¡Hola!", "buenos días", "Buenas tardes", "buenas noches", "qué tal", "buenso dias", "buenas tarde", "buenos dia", "hola, buenos días"];
const THANKS_ROWS = ["gracias", "grasias", "gracia", "gracias hola", "gracais", "gracas", "gracis"];

for (const message of HELLOS) {
  test(`REQ-23 "${message}" is a greeting: a lead and the four starters`, () => {
    const reply = ask(message);
    assert.equal(reply.kind, "greeting");
    assert.ok(GREETINGS.includes(reply.answer), reply.answer);
    assert.deepEqual(starters(reply), [...STARTERS]);
    assert.deepEqual(reply.resolved, [{ topic: "greeting" }]);
    assert.deepEqual(reply.sources, []);
  });
}

for (const message of THANKS_ROWS) {
  test(`REQ-23 "${message}" is thanks: a thanks lead and the four starters`, () => {
    const reply = ask(message);
    assert.equal(reply.kind, "greeting");
    assert.ok(THANKS.includes(reply.answer), reply.answer);
    assert.deepEqual(starters(reply), [...STARTERS]);
  });
}

test('REQ-23 "hoal" (4 letters, exact only) stays no_match, and a greeting before a question is ignored', () => {
  assert.equal(ask("hoal").kind, "no_match");
  const reply = ask("Hola, ¿cuánto peso?");
  assert.notEqual(reply.kind, "greeting");
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["weight"]);
});

test("REQ-23 thanks before a real question is ignored: the question is answered", () => {
  const reply = ask("gracias, ¿qué cenaré hoy?");
  assert.ok(!["greeting", "thanks"].includes(reply.kind), reply.kind);
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["slotOptions"]);
});

// Names one swap or edit away from "gracias" are not thanks.
for (const message of ["garcia", "Grecia"]) {
  test(`REQ-23 "${message}" is not thanks`, () => assert.equal(ask(message).kind, "no_match"));
}

test("REQ-28 each greeting variant is reached by a raw question, the same one twice and with other punctuation", () => {
  assert.deepEqual(["qué tal", "hola", "buenos días"].map((message) => ask(message).answer), GREETINGS);
  assert.equal(ask("¡HOLA!").answer, ask("hola").answer);
});

test("REQ-28 each thanks variant is reached by a raw question", () => {
  assert.deepEqual(["gracia", "gracias", "gracias hola"].map((message) => ask(message).answer), THANKS);
});

test("REQ-29 a question with no topic gets the no-match lead variant of its hash, the four starters and nothing of the user's data", () => {
  const { db, user } = memDb();
  const recipes = db.recipes.filter((recipe) => !isGeneric(recipe.name));
  const data = ["Mejorar mi energía", "Desayuno", "Colación", "Comida", "Cena"];
  // 4a2's step 8 runs rankDish first: these questions must stay no-match there.
  for (const [message, lead] of [["¿Cuál es la capital de Francia?", NO_MATCH_LEADS[0]], ["¿Qué hago ahora?", NO_MATCH_LEADS[0]], ["hoal", NO_MATCH_LEADS[1]]]) {
    assert.deepEqual(rankDish(message, recipes), [], message);
    const reply = ragAnswer(db, user, message, TODAY, { trace: true });
    assert.equal(reply.kind, "no_match", message);
    assert.equal(reply.answer, lead, message);
    assert.deepEqual(starters(reply), [...STARTERS], message);
    assert.deepEqual(reply.sources, [], message);
    for (const name of data) assert.ok(!reply.answer.includes(name), `${message}: ${name}`);
    assert.equal(ragAnswer(db, user, message, TODAY).answer, lead, `${message} twice`);
  }
});

test("REQ-28 a slot's time has two variants with the same highlighted time; the same question twice gives the same one", () => {
  const [horario, es] = [ask("¿A qué hora es la cena?"), ask("¿Cuándo es mi cena?")];
  assert.equal(horario.answer, "Tu horario de cena: Entre 8 a 9 pm.");
  assert.equal(es.answer, "Tu cena es: Entre 8 a 9 pm.");
  for (const reply of [horario, es]) assert.deepEqual(reply.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text), ["Entre 8 a 9 pm"]);
  assert.equal(ask("¿A qué hora es mi colación?").answer, "Tu colación es: Entre 10 a 11 am.");
  assert.equal(ask("¿A qué hora es la cena?").answer, horario.answer);
});

test("REQ-28 the picker spreads the four starters over the variants and ignores case and punctuation", () => {
  for (const variants of [[0, 1], [0, 1, 2]]) {
    assert.ok(new Set(STARTERS.map((message) => pickVariant(variants, message))).size > 1, `${variants.length} variants`);
    assert.equal(pickVariant(variants, "¡Hola!"), pickVariant(variants, "hola"));
  }
});

test("REQ-5 the starters of a greeting and of a no-match reply resolve to their own topics", () => {
  const { db, user } = memDb();
  const answers = ["hola", "¿Cuál es la capital de Francia?"].map((message) => ragAnswer(db, user, message, TODAY));
  assert.deepEqual(sweep(db, user, answers, TODAY).sort(), [...STARTERS].sort());
});

// Dish answers on the base fixture (REQ-26, REQ-29). The detail leads are REQ-28 variants, so "not a detail" is asserted by kind.
const NOT_FOUND = (phrase: string) => `No encontré '${phrase}' en tu plan ni en tus recetas.`;
const NEARBY = (phrase: string) => `No encontré exactamente '${phrase}'. ¿Quisiste decir…?`;
const SUGGEST = "¿Quisiste decir…?";
const offered = (reply: ChatAnswer) => reply.buttons.map((button) => (button.type === "question" ? [button.label, button.message] : [button.label]));
const sends = (...names: string[]) => names.map((name) => [name, `¿Qué lleva ${name}?`]);

function assertNotFound(message: string, phrase: string) {
  const reply = ask(message);
  assert.equal(reply.kind, "answer", message);
  assert.equal(reply.answer, NOT_FOUND(phrase), message);
  assert.deepEqual(starters(reply), ["Mi carrito", "Mi cena de hoy"], message);
  assert.deepEqual(reply.resolved, [{ topic: "dish", outcome: "notFound", phrase }], message);
  assert.deepEqual(reply.sources, [], message);
}

test("REQ-26 a dish no recipe resembles is not found: the lead quotes the phrase and the Recipes follow-ups show, no recipe is offered", () => {
  assertNotFound("¿Qué lleva la pizza?", "pizza");
  assertNotFound("¿Qué lleva la opcion 1?", "opcion 1");
  assertNotFound("¿Qué lleva ab?", "ab");
});

test("REQ-26 a phrase that only partly matches is a did-you-mean: the lead quotes it, the candidates are buttons in rank order, nothing opens", () => {
  const cases: [string, string, string[]][] = [
    ["¿Qué lleva el pollo?", "pollo", ["Pollo asado", "Ensalada de pollo"]],
    ["¿Qué lleva la pizza con atún?", "pizza con atún", ["Sándwich de atún"]],
    ["¿Qué lleva la Pizza Con Atún?", "Pizza Con Atún", ["Sándwich de atún"]],
    ["¿Qué lleva la ensalada de res?", "ensalada de res", ["Ensalada de pollo"]]
  ];
  for (const [message, phrase, names] of cases) {
    const reply = ask(message);
    assert.equal(reply.kind, "did_you_mean", message);
    assert.equal(reply.answer, NEARBY(phrase), message);
    assert.ok(!phrase.startsWith("la ") && !phrase.includes("lleva"), message);
    assert.deepEqual(offered(reply), sends(...names), message);
    assert.deepEqual(reply.blocks[0].sections, [], message);
    assert.deepEqual(reply.resolved?.map((intent) => intent.outcome), ["didYouMean"], message);
    assert.deepEqual(reply.sources, [], message);
  }
});

test('REQ-26 "¿Qué lleva el agua?" is the water answer, not a dish reply', () => {
  const reply = ask("¿Qué lleva el agua?");
  assert.deepEqual(reply.resolved?.map((intent) => intent.topic), ["water"]);
  assert.ok(!reply.answer.includes("No encontré"), reply.answer);
  assert.ok(!["did_you_mean", "no_match"].includes(reply.kind), reply.kind);
});

test("REQ-29 a question with no dish cue is ranked as a phrase: did-you-mean with the candidates in order, never a detail", () => {
  const cases: [string, string[]][] = [
    ["una ensalada rica", ["Ensalada de pollo"]],
    ["pollo atún ensalada", ["Ensalada de pollo", "Pollo asado", "Sándwich de atún"]],
    ["estoy buscando algo rico con atún", ["Sándwich de atún"]],
    ["Pollo asado", ["Pollo asado", "Ensalada de pollo"]]
  ];
  for (const [message, names] of cases) {
    const reply = ask(message);
    assert.equal(reply.kind, "did_you_mean", message);
    assert.equal(reply.answer, SUGGEST, message);
    assert.deepEqual(offered(reply), sends(...names), message);
    assert.deepEqual(reply.sources, [], message);
  }
});

test("REQ-5 the did-you-mean buttons of both replies open that recipe's detail, and the not-found follow-ups resolve", () => {
  const { db, user } = memDb();
  const answers = ["¿Qué lleva el pollo?", "pollo atún ensalada", "¿Qué lleva la pizza?"].map((message) => ragAnswer(db, user, message, TODAY));
  const swept = sweep(db, user, answers, TODAY);
  assert.ok(swept.includes("¿Qué lleva Sándwich de atún?") && swept.includes("¿Qué lleva Pollo asado?") && swept.includes("Mi carrito"), swept.join(" | "));
});

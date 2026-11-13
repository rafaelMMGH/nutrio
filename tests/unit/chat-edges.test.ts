import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTERS, type ChatAnswer } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { isGeneric, rankDish } from "@/lib/domain/chat-dish";
import { pickVariant } from "@/lib/domain/chat-meals";
import { GREETINGS, NO_MATCH_LEADS, THANKS } from "../shared/assistant-copy";
import { memDb, sweep } from "./memdb";

// Chat-like edge cases (spec assistant-data-scope US4): greeting and thanks (REQ-23), the REQ-28 variants and the
// plain no-match reply (REQ-29). The dish answers (did-you-mean, not found) are tested in the next batch.

const TODAY = "2026-10-28";
const ask = (message: string) => {
  const { db, user } = memDb();
  return ragAnswer(db, user, message, TODAY, { trace: true });
};
const starters = (reply: ChatAnswer) => reply.buttons.flatMap((button) => (button.type === "question" ? [button.message] : []));

// Raw texts, each reaching one variant through the question hash (REQ-28). The fuzzy rows are the 1c2 review (M4).
const HELLOS = ["hola", "¡Hola!", "buenos días", "Buenas tardes", "buenas noches", "qué tal", "buenso dias", "buenas tarde", "buenos dia", "hola, buenos días"];
const THANKS_ROWS = ["gracias", "grasias", "gracia", "gracias hola"];

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

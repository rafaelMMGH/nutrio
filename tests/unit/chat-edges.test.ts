import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTERS, type ChatAnswer } from "@/lib/assistant";
import type { AppDb } from "@/lib/types";
import { ragAnswer } from "@/lib/domain/chat";
import { isGeneric, rankDish } from "@/lib/domain/chat-dish";
import { pickVariant } from "@/lib/domain/chat-meals";
import { GREETINGS, NO_MATCH_LEADS, THANKS } from "../shared/assistant-copy";
import { memDb, sweep, type MemDbOptions } from "./memdb";

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
  assertNotFound("¿Qué lleva la Pizza?", "Pizza");
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

test("REQ-5 the did-you-mean buttons of both replies and the not-found follow-ups are swept and resolve", () => {
  const { db, user } = memDb();
  const answers = ["¿Qué lleva el pollo?", "pollo atún ensalada", "¿Qué lleva la pizza?"].map((message) => ragAnswer(db, user, message, TODAY));
  const swept = sweep(db, user, answers, TODAY);
  assert.ok(swept.includes("¿Qué lleva Sándwich de atún?") && swept.includes("¿Qué lleva Pollo asado?") && swept.includes("Mi carrito"), swept.join(" | "));
});

// REQ-24 two-block answers (T050 part 1): titles, one block with option buttons, follow-ups then overflow, a later
// clarification omitted. "Pollo asado" is the fixture's recipe with more than 2 preparation steps.
const messages = (reply: ChatAnswer) => reply.buttons.map((button) => (button.type === "question" ? button.message : button.label));
const titles = (reply: ChatAnswer) => reply.blocks.map((block) => block.title);
const OPTIONS = (ref: string) => [`${ref}, opción 1`, `${ref}, opción 2`, `${ref}, opción 3`, `${ref}, más opciones (página 2)`];
const askIn = (message: string, options?: MemDbOptions, tweak: (db: AppDb) => void = () => {}) => {
  const { db, user } = memDb(options);
  tweak(db);
  return ragAnswer(db, user, message, TODAY, { trace: true });
};

test("REQ-24 D7 a two-block answer's plain text is both blocks in order, each with its title, lead and sections", () => {
  const reply = ask("agua, ejercicio y peso");
  assert.equal(
    reply.answer,
    [
      "Agua",
      "Hoy llevas 0 vasos de agua (0 litros) de tu meta de 8 vasos. Esta semana (lun 26 – hoy): 0 litros.",
      "Ejercicio",
      "Esta semana (lun 26 – hoy) llevas 0 de 4 días de ejercicio. Te faltan 4 días."
    ].join("\n")
  );
  assert.deepEqual(titles(reply), ["Agua", "Ejercicio"]);
});

test("REQ-24 follow-ups of the second block come first, then the overflow topic buttons, each offered once", () => {
  const reply = ask("agua, ejercicio, peso y carrito");
  assert.deepEqual(messages(reply), ["¿Cuánta agua llevo?", "Mi peso", "Mi carrito"]);
});

test("REQ-24 two slot topics that would both list options: the first lists them, the second is offered as its button", () => {
  const reply = ask("¿Qué puedo desayunar y cenar?");
  assert.equal(reply.blocks.length, 1);
  assert.equal(reply.blocks[0].title, null);
  assert.equal(reply.answer, "Estas son tus opciones de desayuno:");
  assert.deepEqual(messages(reply), [...OPTIONS("Desayuno"), "¿Cuál es mi cena?"]);
  assert.deepEqual(reply.buttons.slice(0, 3).map((button) => button.type === "question" && button.layout), ["option", "option", "option"]);
  assert.deepEqual(messages(ask("¿Qué puedo desayunar, cenar y comer?")).slice(-2), ["¿Cuál es mi cena?", "¿Cuál es mi comida?"]);
});

test("REQ-24 slot options as the second block keep their option buttons, in place of its follow-ups", () => {
  const reply = ask("cuánta agua llevo y qué puedo cenar");
  assert.equal(reply.blocks.length, 2);
  assert.deepEqual(titles(reply), ["Agua", "Cena"]);
  assert.deepEqual(messages(reply), OPTIONS("Cena"));
});

test("REQ-24 slot options as the first block keep their buttons, then the second block's follow-ups", () => {
  const reply = ask("¿Qué puedo desayunar y cuánta agua llevo?");
  assert.deepEqual(titles(reply), ["Desayuno", "Agua"]);
  assert.deepEqual(messages(reply), [...OPTIONS("Desayuno"), "¿Cuánto ejercicio llevo?", "¿Cuántas comidas llevo?"]);
});

test("REQ-24 REQ-27 a slot the plan lacks, with a second topic: its slot buttons stay, then the second block's follow-ups", () => {
  const plan = { meals: ["Desayuno", "Comida"] };
  const first = askIn("¿Qué puedo cenar y cuánta agua llevo?", plan);
  assert.deepEqual(titles(first), ["Cena", "Agua"]);
  assert.equal(first.blocks[0].lead.map((span) => span.text).join(""), "Tu plan no tiene cena.");
  assert.deepEqual(messages(first), ["¿Cuál es mi desayuno?", "¿Cuál es mi comida?", "¿Cuánto ejercicio llevo?", "¿Cuántas comidas llevo?"]);
  assert.deepEqual(messages(askIn("cuánta agua llevo y qué puedo cenar", plan)), ["¿Cuál es mi desayuno?", "¿Cuál es mi comida?"]);
});

test("REQ-24 a button is offered once: an offer that repeats one of the slot buttons of a not-in-plan block is dropped", () => {
  const plan = { meals: ["Desayuno", "Colación", "Comida"] };
  for (const question of ["¿Qué puedo cenar y desayunar?", "¿Qué puedo cenar y qué hay de comida?", "¿Qué puedo cenar, desayunar y comer?"]) {
    const found = messages(askIn(question, plan));
    assert.deepEqual(found, [...new Set(found)], question);
  }
  assert.deepEqual(messages(askIn("¿Qué puedo cenar y desayunar?", plan)), ["¿Cuál es mi desayuno?", "¿Cuál es mi colación?", "¿Cuál es mi comida?"]);
});

// Two colaciones: "colación" asks which one.
const TWO_COLACIONES = { meals: ["Desayuno", "Colación", "Comida", "Colación", "Cena"] };

test("REQ-24 a clarification stands alone: a later topic is not answered and its buttons do not mix in", () => {
  const reply = askIn("colación y agua", TWO_COLACIONES);
  assert.equal(reply.kind, "clarify");
  assert.equal(reply.blocks.length, 1);
  assert.equal(reply.answer, "Tienes 2 colaciones. ¿Cuál?");
  assert.deepEqual(messages(reply), ["¿Cuál es mi primera colación?", "¿Cuál es mi segunda colación?"]);
  // The overflow topic of a clarification is not offered either.
  assert.deepEqual(messages(askIn("colación, agua y peso", TWO_COLACIONES)), messages(reply));
});

test("REQ-24 an offered slot button names the concrete slot; a slot that would ask again is not offered", () => {
  assert.deepEqual(messages(askIn("¿Qué puedo desayunar y la segunda colación?", TWO_COLACIONES)).slice(-1), ["¿Cuál es mi segunda colación?"]);
  assert.deepEqual(messages(askIn("¿Qué puedo desayunar, comer y colación?", TWO_COLACIONES)).slice(-1), ["¿Cuál es mi comida?"]);
});

test("REQ-24 a later topic that needs a clarification is omitted: the first answer keeps its follow-ups", () => {
  const reply = askIn("agua y colación", TWO_COLACIONES);
  assert.equal(reply.kind, "answer");
  assert.deepEqual(titles(reply), [null]);
  assert.equal(reply.blocks[0].lead.map((span) => span.text).join("").startsWith("Hoy "), true);
  assert.deepEqual(messages(reply), ["¿Cuánto ejercicio llevo?", "¿Cuántas comidas llevo?"]);
});

test("REQ-24 the times question of three slots offers the third slot's time, not its options", () => {
  assert.deepEqual(messages(ask("¿A qué hora es mi desayuno, mi cena y mi comida?")).slice(-1), ["¿A qué hora es mi comida?"]);
});

test("REQ-24 the sources of a block left out do not reach the answer", () => {
  // The omitted clarification would cite the plan; the water block cites nothing.
  assert.deepEqual(askIn("agua y colación", TWO_COLACIONES).sources, []);
});

test("REQ-24 a single-option slot answered as a detail keeps its slot-ref title beside another block", () => {
  const oneDesayuno = (db: AppDb) => {
    for (const recipe of db.recipes) recipe.description = "Uno. Dos. Tres.";
    let kept = false;
    db.mealOptions = db.mealOptions.filter((option) => option.meal_type_id !== "chat-e2e-memdb-plan-v1-meal-0" || (!kept && (kept = true)));
  };
  const reply = askIn("¿Qué puedo desayunar y mi peso?", undefined, oneDesayuno);
  assert.equal(reply.kind, "detail");
  assert.deepEqual(titles(reply), ["Desayuno", "Peso"]);
  assert.deepEqual(askIn("mi peso y qué puedo desayunar", undefined, oneDesayuno).blocks.map((block) => block.title), ["Peso", "Desayuno"]);
});

test("REQ-24 'Subir mi plan' shows once in a no-plan answer of two blocks, in the first", () => {
  const reply = askIn("mi meta y mi avance de la semana", undefined, (db) => {
    db.plans = [];
  });
  assert.deepEqual(titles(reply), ["Metas", "Avance"]);
  assert.deepEqual(reply.blocks.map((block) => block.buttons), [[{ type: "link", label: "Subir mi plan", href: "/plans" }], []]);
  assert.deepEqual(messages(reply), ["Mi peso", "¿Cuál es mi meta?"]);
});

test("REQ-9 an option's detail offers its slot's time as a follow-up, beside the block's 'Ver receta completa'", () => {
  const detail = (message: string, options?: MemDbOptions) =>
    askIn(message, options, (db) => {
      for (const recipe of db.recipes) recipe.description = "Uno. Dos. Tres.";
    });
  const cena = detail("Cena, opción 2");
  assert.equal(cena.kind, "detail");
  assert.deepEqual(cena.buttons, [{ type: "question", label: "¿A qué hora es mi cena?", message: "¿A qué hora es mi cena?" }]);
  assert.deepEqual(cena.blocks[0].buttons, [{ type: "link", label: "Ver receta completa", href: `/recipes/${memDb().db.recipes.find((recipe) => recipe.name === "Cena opcion 2")!.id}` }]);
  assert.deepEqual(messages(detail("Segunda colación, opción 1", TWO_COLACIONES)), ["¿A qué hora es mi segunda colación?"]);
  assert.deepEqual(messages(ask("¿Qué lleva el pollo asado?")), ["Mi carrito", "Mi cena de hoy"]);
});

test("REQ-5 the time follow-up of an option's detail resolves to that slot's time", () => {
  const { db, user } = memDb();
  const swept = sweep(db, user, [ragAnswer(db, user, "Cena, opción 2", TODAY)], TODAY);
  assert.deepEqual(swept, ["¿A qué hora es mi cena?"]);
});

// REQ-25: a dish cue with no dish and nothing else resolved asks which dish.
test("REQ-25 a dish cue with an empty phrase asks '¿De qué platillo?' with the first three recipes as buttons", () => {
  const reply = ask("¿Qué lleva?");
  assert.equal(reply.kind, "clarify");
  assert.equal(reply.answer, "¿De qué platillo?");
  assert.deepEqual(offered(reply), sends("Pollo asado", "Ensalada de pollo", "Sándwich de atún"));
  assert.deepEqual(reply.sources, []);
  assert.deepEqual(reply.resolved, [{ topic: "dish", outcome: "clarify", phrase: "" }]);
});

test("REQ-25 the recipe buttons are the user's live, non-generic recipes only", () => {
  const reply = askIn("¿Qué lleva?", undefined, (db) => {
    db.recipes.find((recipe) => recipe.name === "Pollo asado")!.deleted_at = "2026-02-01T00:00:00.000Z";
    db.recipes.find((recipe) => recipe.name === "Ensalada de pollo")!.user_id = "someone-else";
  });
  assert.deepEqual(offered(reply), sends("Sándwich de atún", "Atole de avena", "Chilaquiles verdes"));
});

test("REQ-25 with no non-generic recipe the buttons are the plan's slots, or the starters when it has none", () => {
  const slots = askIn("¿Qué lleva?", undefined, (db) => {
    db.recipes = db.recipes.filter((recipe) => isGeneric(recipe.name));
  });
  assert.equal(slots.kind, "clarify");
  assert.deepEqual(messages(slots), ["¿Cuál es mi desayuno?", "¿Cuál es mi colación?", "¿Cuál es mi comida?", "¿Cuál es mi cena?"]);
  const none = askIn("¿Qué lleva?", { fixture: false }, (db) => {
    db.plans = [];
  });
  assert.equal(none.kind, "clarify");
  assert.equal(none.answer, "¿De qué platillo?");
  assert.deepEqual(messages(none), [...STARTERS]);
});

// 4b1 survivors (T050 part 2): the title of a slot block that has no options, the accent of an absent slot's title, the
// trace listing intents the answer dropped.

test("REQ-24 REQ-27 a slot with no options keeps its slot-ref title beside another block", () => {
  // Slot position 3 is the cena of the default plan and the second colación of TWO_COLACIONES.
  const noOptions = (db: AppDb) => {
    db.mealOptions = db.mealOptions.filter((option) => !option.meal_type_id.endsWith("-meal-3"));
  };
  const reply = askIn("¿Qué puedo cenar y mi peso?", undefined, noOptions);
  assert.deepEqual(titles(reply), ["Cena", "Peso"]);
  assert.equal(reply.blocks[0].lead.map((span) => span.text).join(""), "Tu plan no tiene opciones para tu cena.");
  assert.deepEqual(titles(askIn("mi peso y la segunda colación", TWO_COLACIONES, noOptions)), ["Peso", "Segunda colación"]);
});

test("REQ-24 REQ-27 the title of an absent slot is its word capitalised, with the accent of colación", () => {
  assert.deepEqual(titles(askIn("¿Qué puedo tomar de colación y mi peso?", { meals: ["Desayuno", "Comida", "Cena"] })), ["Colación", "Peso"]);
  assert.deepEqual(titles(askIn("mi peso y qué puedo cenar", { meals: ["Desayuno", "Comida"] })), ["Peso", "Cena"]);
});

test("REQ-24 the trace lists every intent the resolver found, also the ones the answer dropped", () => {
  const dropped = askIn("colación y agua", TWO_COLACIONES);
  assert.equal(dropped.blocks.length, 1);
  assert.deepEqual(dropped.resolved?.map((intent) => intent.topic), ["slotOptions", "water"]);
  const both = ask("¿Qué puedo desayunar y cenar?");
  assert.equal(both.blocks.length, 1);
  assert.deepEqual(both.resolved?.map((intent) => [intent.topic, intent.slot]), [["slotOptions", "desayuno"], ["slotOptions", "cena"]]);
});

// REQ-25: ambiguous progress asks which metric (T052).
test('REQ-25 "¿Cuánto llevo?" asks which metric, with Agua, Ejercicio and Comidas as buttons that resolve', () => {
  for (const message of ["¿Cuánto llevo?", "¿Cómo voy?"]) {
    const reply = ask(message);
    assert.equal(reply.kind, "clarify", message);
    assert.equal(reply.answer, "¿Te refieres a agua, ejercicio o comidas?", message);
    assert.deepEqual(reply.buttons, [
      { type: "question", label: "Agua", message: "¿Cuánta agua llevo?" },
      { type: "question", label: "Ejercicio", message: "¿Cuánto ejercicio llevo?" },
      { type: "question", label: "Comidas", message: "¿Cuántas comidas llevo?" }
    ], message);
    assert.deepEqual(reply.sources, [], message);
    assert.deepEqual(reply.resolved, [{ topic: "ambiguous" }], message);
  }
  const { db, user } = memDb();
  assert.deepEqual(sweep(db, user, [ragAnswer(db, user, "¿Cuánto llevo?", TODAY)], TODAY), ["¿Cuánta agua llevo?", "¿Cuánto ejercicio llevo?", "¿Cuántas comidas llevo?"]);
});

test("REQ-5 REQ-24 every clarify and overflow button resolves to a definite answer", () => {
  const { db, user } = memDb({ meals: TWO_COLACIONES.meals });
  const answers = ["¿Cuánto llevo?", "colación", "¿A qué hora es mi almuerzo?", "¿Qué lleva?", "agua, ejercicio, peso y carrito"].map((message) => ragAnswer(db, user, message, TODAY));
  assert.deepEqual(answers.map((reply) => reply.kind), ["clarify", "clarify", "clarify", "clarify", "answer"]);
  const swept = sweep(db, user, answers, TODAY);
  for (const message of ["¿Cuánta agua llevo?", "¿Cuál es mi primera colación?", "¿A qué hora es mi comida?", "¿Qué lleva Pollo asado?", "Mi peso", "Mi carrito"]) assert.ok(swept.includes(message), message);
});

// REQ-27: no active plan, for plan, slot and meals-done questions (T052). A plan with no slots is no plan (user ruling 2026-11-13).
const NO_PLAN = "Aún no tienes un plan activo.";
const NO_PLAN_LINK = { type: "link", label: "Subir mi plan", href: "/plans" };
const NO_PLAN_QUESTIONS = ["¿A qué hora es la cena?", "¿Cuál es mi horario?", "¿Qué puedo cenar?", "cena, opción 2", "¿Cuál es mi plan?", "¿Qué suplementos tomo?", "¿Cuántas comidas llevo?", "¿Cuántas comidas llevo hoy?"];
const WITHOUT_PLAN: [string, MemDbOptions | undefined, (db: AppDb) => void][] = [
  ["no active plan", undefined, (db) => { db.plans = []; }],
  ["an active plan with no slots", { meals: [], fixture: false }, () => {}]
];

for (const [name, options, tweak] of WITHOUT_PLAN) {
  test(`REQ-27 ${name}: slot, times, plan and meals-done questions say so, with 'Subir mi plan' and no sections or sources`, () => {
    for (const message of NO_PLAN_QUESTIONS) {
      const reply = askIn(message, options, tweak);
      assert.equal(reply.kind, "answer", message);
      assert.equal(reply.answer, NO_PLAN, message);
      assert.deepEqual(reply.blocks[0].sections, [], message);
      assert.deepEqual(reply.blocks[0].buttons, [NO_PLAN_LINK], message);
      assert.deepEqual(reply.sources, [], message);
    }
  });
}

test("REQ-27 a no-plan answer about a slot offers the other question about that slot; one about all the times keeps the topic's follow-ups", () => {
  const noPlan = (db: AppDb) => { db.plans = []; };
  assert.deepEqual(messages(askIn("¿Qué puedo cenar?", undefined, noPlan)), ["¿A qué hora es mi cena?"]);
  assert.deepEqual(messages(askIn("¿Qué puedo tomar de colación?", undefined, noPlan)), ["¿A qué hora es mi colación?"]);
  assert.deepEqual(messages(askIn("¿A qué hora es mi cena?", undefined, noPlan)), ["¿Cuál es mi cena?"]);
  assert.deepEqual(messages(askIn("¿Cuál es mi horario?", undefined, noPlan)), ["Mi cena de hoy", "Mi carrito"]);
  assert.deepEqual(messages(askIn("¿Cuántas comidas llevo?", undefined, noPlan)), ["¿Cuánta agua llevo?", "Mi cena de hoy"]);
});

test("REQ-24 REQ-27 no-plan slot blocks beside another block are titled, and 'Subir mi plan' shows once", () => {
  const noPlan = (db: AppDb) => { db.plans = []; };
  assert.deepEqual(titles(askIn("¿qué puedo desayunar y mi peso?", undefined, noPlan)), ["Desayuno", "Peso"]);
  assert.deepEqual(titles(askIn("mi peso y qué puedo tomar de colación", undefined, noPlan)), ["Peso", "Colación"]);
  const both = askIn("¿qué puedo desayunar y qué puedo cenar?", undefined, noPlan);
  assert.deepEqual(titles(both), ["Desayuno", "Cena"]);
  assert.deepEqual(both.blocks.flatMap((block) => block.buttons), [NO_PLAN_LINK]);
  const meals = askIn("¿Cuántas comidas llevo y mi peso?", undefined, noPlan);
  assert.deepEqual(titles(meals), ["Comidas", "Peso"]);
  assert.equal(meals.blocks[0].lead.map((span) => span.text).join(""), NO_PLAN);
});

test("REQ-27 a slot with no options says so and offers its time; the Given of a plan without cena offers one button per slot", () => {
  const noOptions = askIn("¿Qué puedo cenar?", undefined, (db) => {
    db.mealOptions = db.mealOptions.filter((option) => !option.meal_type_id.endsWith("-meal-3"));
  });
  assert.equal(noOptions.answer, "Tu plan no tiene opciones para tu cena.");
  assert.deepEqual(messages(noOptions), ["¿A qué hora es mi cena?"]);
  const absent = askIn("¿Qué puedo cenar?", { meals: ["Desayuno", "Comida"] });
  assert.equal(absent.answer, "Tu plan no tiene cena.");
  assert.deepEqual(messages(absent), ["¿Cuál es mi desayuno?", "¿Cuál es mi comida?"]);
});

test("REQ-27 an empty recipe book says so: no sections and no sources", () => {
  const reply = askIn("¿Qué recetas tengo?", undefined, (db) => { db.recipes = []; });
  assert.equal(reply.answer, "Aún no tienes recetas.");
  assert.deepEqual(reply.blocks[0].sections, []);
  assert.deepEqual(reply.sources, []);
});

test("REQ-8 a slot's time offers that slot's options, with or without a time and with duplicated slots; all the times keep the topic's follow-ups", () => {
  assert.deepEqual(messages(ask("¿A qué hora es la cena?")), ["¿Cuál es mi cena?"]);
  assert.deepEqual(messages(askIn("¿Cuándo desayuno?", { times: "none" })), ["¿Cuál es mi desayuno?"]);
  assert.deepEqual(messages(askIn("¿A qué hora es mi segunda colación?", TWO_COLACIONES)), ["¿Cuál es mi segunda colación?"]);
  assert.deepEqual(messages(ask("¿Cuál es mi horario?")), ["Mi cena de hoy", "Mi carrito"]);
});

test("REQ-5 the options and times follow-ups of the slot answers resolve", () => {
  const { db, user } = memDb();
  const answers = ["¿A qué hora es la cena?", "¿Qué puedo cenar?"].map((message) => ragAnswer(db, user, message, TODAY));
  const noOptions = askIn("¿Qué puedo cenar?", undefined, (copy) => {
    copy.mealOptions = copy.mealOptions.filter((option) => !option.meal_type_id.endsWith("-meal-3"));
  });
  assert.ok(sweep(db, user, [answers[0]], TODAY).includes("¿Cuál es mi cena?"));
  assert.ok(messages(noOptions).includes("¿A qué hora es mi cena?"));
  assert.ok(sweep(db, user, [noOptions], TODAY).includes("¿A qué hora es mi cena?"));
});

test("REQ-27 REQ-5 a duplicated slot with no options offers its time by ref, and the offer resolves to that slot", () => {
  const { db, user } = memDb(TWO_COLACIONES);
  db.mealOptions = db.mealOptions.filter((option) => !option.meal_type_id.endsWith("-meal-3"));
  const reply = ragAnswer(db, user, "¿Qué puedo tomar de segunda colación?", TODAY);
  assert.equal(reply.answer, "Tu plan no tiene opciones para tu segunda colación.");
  assert.deepEqual(messages(reply), ["¿A qué hora es mi segunda colación?"]);
  const followUp = ragAnswer(db, user, "¿A qué hora es mi segunda colación?", TODAY);
  assert.equal(followUp.kind, "answer");
  assert.match(followUp.answer, /segunda colación/i);
  assert.ok(sweep(db, user, [reply], TODAY).includes("¿A qué hora es mi segunda colación?"));
});

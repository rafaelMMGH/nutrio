import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTERS } from "@/lib/assistant";
import { isGeneric } from "@/lib/domain/chat-dish";
import { resolve } from "@/lib/domain/chat-intent";
import { TOPICS } from "@/lib/domain/chat-topics";
import type { Recipe } from "@/lib/types";
import { BUTTON_TOPICS } from "../shared/assistant-buttons";
import { memDb } from "./memdb";

// Spec assistant-data-scope REQ-6 (resolution order), REQ-1 and REQ-5, asserted on `resolve()` alone: the answer-level
// rows (text, buttons, overflow copy) belong to the ragAnswer tests. An intent reads "topic" or "topic:slot|metric|of".
const label = (intent: { topic: string; slot?: string; metric?: string; of?: string }) => [intent.topic, intent.slot ?? intent.metric ?? intent.of].filter(Boolean).join(":");
const found = (message: string) => resolve(message).intents.map(label);

const ROWS: [string, string[]][] = [
  // REQ-1 Givens
  ["¿Qué ingredientes lleva el desayuno?", ["slotOptions:desayuno"]],
  ["¿Cuándo compro?", ["cart"]],
  ["¿A qué hora compro el súper?", ["cart"]],
  ["¿Qué ingredientes necesito comprar?", ["cart"]],
  ["¿Cuál es mi meta de peso?", ["goals:weight"]],
  ["¿Qué recetas hay en mi plan?", ["recipes"]],
  ["¿Cómo se llama mi plan?", ["identity:plan"]],
  ["nombre de mi plan", ["identity:plan"]],
  ["¿Cómo me llamo?", ["identity:name"]],
  ["¿Cuál es mi nombre?", ["identity:name"]],
  ["¿Qué lleva la cena?", ["slotOptions:cena"]],
  ["¿Cuánto llevo?", ["ambiguous"]],
  ["¿Cuántas comidas llevo?", ["mealsDone"]],
  // REQ-6 step 1 and step 8 (the caller owns steps 7 and 8: nothing found)
  ["Hola", ["greeting"]],
  ["Gracias", ["greeting"]],
  ["Hola, ¿qué hay en mi carrito?", ["cart"]],
  ["¿Qué hago ahora?", []],
  ["¿Qué cosas tengo?", []],
  // meals done: "comidas" and "llevo" apart beat the slot reading and the ambiguous reading (1c2 review M5)
  ["¿Cuántas comidas ya llevo?", ["mealsDone"]],
  ["¿Cuántas comidas llevo hoy?", ["mealsDone"]],
  ["¿Cuántas comidas me llevo?", ["mealsDone"]],
  ["¿Cuántas comidas hice hoy?", ["mealsDone"]],
  ["¿Qué lleva la comida?", ["slotOptions:comida"]],
  // time word + slot, time word alone, time word beside another topic
  ["¿A qué hora es mi cena?", ["mealTimes:cena"]],
  ["¿Cuándo desayuno?", ["mealTimes:desayuno"]],
  ["¿Cuál es mi horario?", ["mealTimes"]],
  ["Mis comidas", ["mealTimes"]],
  // typos of the plural "comidas" are all meal times too (T080); the singular stays the slot
  ["Mis comdias", ["mealTimes"]],
  ["Mis comidsa", ["mealTimes"]],
  ["Mis comidass", ["mealTimes"]],
  ["Mi comida", ["slotOptions:comida"]],
  ["¿A qué hora es mi comida?", ["mealTimes:comida"]],
  ["horario y peso", ["weight"]],
  // slots
  ["Mi cena de hoy", ["slotOptions:cena"]],
  ["¿Qué puedo cenar?", ["slotOptions:cena"]],
  ["ingredientes de la cena", ["slotOptions:cena"]],
  ["recetas para el desayuno", ["slotOptions:desayuno"]],
  ["desayuno y cena", ["slotOptions:desayuno", "slotOptions:cena"]],
  // dish cue
  ["¿Qué lleva el pollo asado?", ["dish"]],
  ["¿Cómo se prepara?", ["dish"]],
  // goals, metrics, weekly progress
  ["¿Cuál es mi meta?", ["goals"]],
  ["meta de agua y de ejercicio", ["goals:water", "goals:exercise"]],
  ["¿Cuál es el objetivo del plan?", ["plan"]],
  ["meta del plan", ["plan"]],
  ["Mi avance de la semana", ["weekly"]],
  ["mi avance de peso", ["weight"]],
  ["¿Cuánto ejercicio llevo?", ["exercise"]],
  ["¿Cuánta agua llevo?", ["water"]],
  ["¿Cómo voy?", ["ambiguous"]],
  // possessor and Plan only when alone
  ["¿Cuál es mi plan?", ["plan"]],
  ["suplementos", ["plan"]],
  ["peso en mi plan", ["weight"]],
  ["mi cena del plan", ["slotOptions:cena"]],
  ["mi carrito del plan", ["cart"]],
  // topics in order of first appearance
  ["carrito y agua", ["cart", "water"]],
  ["agua y carrito", ["water", "cart"]],
  // typos (REQ-2)
  ["¿Qué hay en mi carito?", ["cart"]],
  ["ejersisio", ["exercise"]],
  // weak readings, pinned as CURRENT behavior (pending spec decision, 1d1 Open question Q-c): all meal times, then
  // the ambiguous "llevo", then Plan
  ["cuándo voy", ["mealTimes"]],
  ["horario y plan", ["mealTimes"]],
  ["cómo voy con mi plan", ["ambiguous"]],
  // meals done: the pair of words in either order, with a slot or a topic around it
  ["llevo la comida", ["mealsDone"]],
  ["qué comida llevo", ["mealsDone"]],
  ["agua y cuántas comidas llevo", ["water", "mealsDone"]],
  ["cuántas comidas llevo y agua", ["mealsDone", "water"]],
  ["resumen de comidas llevo", ["mealsDone"]],
  ["comidas, agua y llevo", ["mealsDone", "water"]],
  ["llevo agua y comidas", ["mealsDone", "water"]],
  // identity phrases are positioned intents; the same intent twice is one
  ["cómo se llama mi plan y mi nombre", ["identity:plan", "identity:name"]],
  ["mi nombre y cómo se llama mi plan", ["identity:name", "identity:plan"]],
  ["cena y mi cena", ["slotOptions:cena"]]
];

for (const [message, expected] of ROWS) {
  test(`resolve "${message}" -> ${expected.join(", ") || "nothing"}`, () => {
    assert.deepEqual(found(message), expected);
  });
}

test("every Topics button, follow-up and starter resolves to exactly its topic (REQ-5)", () => {
  const messages = new Set([...STARTERS, ...Object.values(TOPICS).flatMap((topic) => [...(topic.button ? [topic.button] : []), ...topic.followUps])]);
  assert.ok(messages.size >= 12);
  for (const message of messages) {
    const expected = BUTTON_TOPICS[message];
    assert.ok(expected, `${message} has an expected topic`);
    assert.deepEqual(resolve(message).intents.map((intent) => intent.topic), [expected.topic], message);
  }
});

test("at most 2 topics are answered; the rest are overflow, in question order (REQ-24)", () => {
  const { intents, overflow } = resolve("agua, ejercicio y peso");
  assert.deepEqual(intents.map(label), ["water", "exercise"]);
  assert.deepEqual(overflow.map(label), ["weight"]);
  assert.deepEqual(resolve("Mi carrito").overflow, []);
});

test("the same topic named twice is one intent", () => {
  assert.deepEqual(found("peso, mi peso y báscula"), ["weight"]);
});

// REQ-6 steps 4 and 7 (T079): with the user's recipes, a dish phrase ends the answer with the matcher's outcome; a phrase
// that is not a dish name falls through to the slot and topic readings. Recipes come filtered like `ragAnswer` does.
const RECIPES = memDb().db.recipes.filter((recipe) => !isGeneric(recipe.name));
const idOf = (name: string) => RECIPES.find((recipe) => recipe.name === name)!.id;
const adHoc = (...names: string[]): Recipe[] => names.map((name, index) => ({ id: `r${index}`, user_id: "u", name, description: "", canonical_hash: `h${index}`, created_at: "", updated_at: "", deleted_at: null }));
const withRecipes = (message: string, recipes: readonly Recipe[] = RECIPES) => resolve(message, recipes).intents;

test("REQ-6 step 4: a dish phrase that matches ends the answer with the recipe id and the phrase as typed", () => {
  assert.deepEqual(withRecipes("¿Qué lleva el pollo asao?"), [{ topic: "dish", outcome: "found", recipeIds: [idOf("Pollo asado")], phrase: "pollo asao" }]);
  assert.deepEqual(withRecipes("¿Cómo se prepara el Sándwich de atún?"), [{ topic: "dish", outcome: "found", recipeIds: [idOf("Sándwich de atún")], phrase: "Sándwich de atún" }]);
});

test("REQ-6 step 4: several candidates are a did-you-mean in matcher order; no candidate is not-found", () => {
  assert.deepEqual(withRecipes("¿Qué lleva el pollo?"), [{ topic: "dish", outcome: "didYouMean", recipeIds: [idOf("Pollo asado"), idOf("Ensalada de pollo")], phrase: "pollo" }]);
  assert.deepEqual(withRecipes("¿Qué lleva la pizza?"), [{ topic: "dish", outcome: "notFound", phrase: "pizza" }]);
  assert.deepEqual(withRecipes("¿Qué lleva ab?"), [{ topic: "dish", outcome: "notFound", phrase: "ab" }]);
});

test("REQ-6 step 4: a phrase that is not a dish name falls through to the slot or topic reading", () => {
  assert.deepEqual(withRecipes("¿Qué lleva la cena?").map(label), ["slotOptions:cena"]);
  assert.deepEqual(withRecipes("¿Qué lleva el agua?").map(label), ["water"]);
  // A slot ref is not a dish name (REQ-11); its ordinal is the T030 rows below.
  assert.deepEqual(withRecipes("¿Qué lleva la segunda colación?"), [{ topic: "slotOptions", slot: "colacion", ordinal: 2 }]);
});

test("REQ-6 step 7: a dish cue with an empty phrase and nothing else resolved is the clarify intent", () => {
  assert.deepEqual(withRecipes("¿Qué lleva?"), [{ topic: "dish", outcome: "clarify", phrase: "" }]);
});

test("REQ-3 rule 1: an exact recipe name made of a slot word beats the slot reading", () => {
  const recipes = adHoc("Cena de pollo");
  assert.deepEqual(withRecipes("¿Qué lleva la cena de pollo?", recipes), [{ topic: "dish", outcome: "found", recipeIds: ["r0"], phrase: "cena de pollo" }]);
  assert.deepEqual(withRecipes("¿Qué lleva la cena?", recipes).map(label), ["slotOptions:cena"]);
});

test("resolve(question) without recipes keeps the plain dish intent", () => {
  assert.deepEqual(resolve("¿Qué lleva el pollo asado?").intents, [{ topic: "dish" }]);
});

// Open question 1c2 item 4, pinned as CURRENT behavior until the user answers: "receta de" is a dish cue, so "pollo" is a dish phrase.
test("CURRENT: 'recetas de pollo' is a dish phrase with candidates, not a recipe-list filter", () => {
  assert.deepEqual(withRecipes("recetas de pollo"), [{ topic: "dish", outcome: "didYouMean", recipeIds: [idOf("Pollo asado"), idOf("Ensalada de pollo")], phrase: "pollo" }]);
});

// REQ-11 (T030): a typed ordinal or "<slot> <n>" names which of the duplicated slots; the resolver cannot see the plan,
// so it reports the position and the answer builders decide (a non-duplicated "<slot> <n>" is option n, T033).
const ORDINALS: [string, string, number][] = [
  ["¿A qué hora es mi segunda colación?", "mealTimes", 2],
  ["segunda colacion", "slotOptions", 2],
  ["Primera colación", "slotOptions", 1],
  ["la colación tercera", "slotOptions", 3],
  ["mi primer desayuno", "slotOptions", 1],
  ["Segundo snack", "slotOptions", 2],
  ["décimo desayuno", "slotOptions", 10],
  ["Séptima colación", "slotOptions", 7],
  ["colación 2", "slotOptions", 2],
  ["Colación 11", "slotOptions", 11],
  ["¿Cuándo es mi colación 3?", "mealTimes", 3]
];
for (const [message, topic, ordinal] of ORDINALS) {
  test(`REQ-11 resolve "${message}" -> ${topic} with ordinal ${ordinal}`, () => {
    const [intent, ...rest] = resolve(message).intents;
    assert.equal(intent.topic, topic);
    assert.equal(intent.ordinal, ordinal);
    assert.equal(rest.length, 0);
  });
}

test("REQ-11 a slot word without an ordinal carries none, and each slot word takes its own", () => {
  assert.deepEqual(resolve("mi colación").intents, [{ topic: "slotOptions", slot: "colacion" }]);
  assert.deepEqual(resolve("primera colación y cena").intents, [{ topic: "slotOptions", slot: "colacion", ordinal: 1 }, { topic: "slotOptions", slot: "cena" }]);
});

test("REQ-11 a word that names an Object property beside a slot word is no ordinal", () => {
  for (const word of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.deepEqual(resolve(`mi ${word} colación`).intents, [{ topic: "slotOptions", slot: "colacion" }], word);
  }
});

// REQ-10, REQ-9, REQ-11 (T033): resolver step 2, option selection and paging, ahead of the dish cue and the slot reading.
const OPTION_ROWS: [string, object][] = [
  ["cena opción 2", { slot: "cena", option: 2 }],
  ["cena opcion 2", { slot: "cena", option: 2 }],
  ["Cena, opción 2", { slot: "cena", option: 2 }],
  ["la 2 de la cena", { slot: "cena", option: 2 }],
  ["opción 2 de la cena", { slot: "cena", option: 2 }],
  ["la comida opcion 1", { slot: "comida", option: 1 }],
  ["¿Qué lleva desayuno opcion 1?", { slot: "desayuno", option: 1 }],
  ["Segunda colación, opción 2", { slot: "colacion", ordinal: 2, option: 2 }],
  ["Colación 11, opción 3", { slot: "colacion", ordinal: 11, numbered: true, option: 3 }],
  // 2c2 L1: a decimal elsewhere in the message (a clock time) is not the option's decimal.
  ["a las 2.30 cena opción 2", { slot: "cena", option: 2 }],
  ["la 2 de la cena a las 8,30", { slot: "cena", option: 2 }]
];
for (const [message, expected] of OPTION_ROWS) {
  test(`REQ-10 resolve "${message}" -> option selection`, () => {
    assert.deepEqual(resolve(message).intents, [{ topic: "slotOptions", ...expected }]);
    assert.deepEqual(resolve(message, memDb().db.recipes.filter((recipe) => !isGeneric(recipe.name))).intents, [{ topic: "slotOptions", ...expected }]);
  });
}

const PAGE_ROWS: [string, object][] = [
  ["Cena, más opciones (página 2)", { slot: "cena", page: 2 }],
  ["cena más opciones", { slot: "cena", page: 2 }],
  ["cena mas opciones pagina 1", { slot: "cena", page: 1 }],
  ["Cena, más opciones (página 3.5)", { slot: "cena", page: 2 }],
  ["Cena, más opciones (página 2x)", { slot: "cena", page: 2 }],
  ["Segunda colación, más opciones (página 1)", { slot: "colacion", ordinal: 2, page: 1 }]
];
for (const [message, expected] of PAGE_ROWS) {
  test(`REQ-9 resolve "${message}" -> paging`, () => {
    assert.deepEqual(resolve(message).intents, [{ topic: "slotOptions", ...expected }]);
  });
}

test("REQ-11 '<slot> <n>' is flagged as a bare number, for the plan to read as option n on a single slot; 'colación 2 am' is no ordinal", () => {
  assert.deepEqual(resolve("cena 2").intents, [{ topic: "slotOptions", slot: "cena", ordinal: 2, numbered: true }]);
  assert.deepEqual(resolve("colación 2 am").intents, [{ topic: "slotOptions", slot: "colacion" }]);
  assert.deepEqual(resolve("segunda colación").intents, [{ topic: "slotOptions", slot: "colacion", ordinal: 2 }]);
});

// REQ-14 (T041): the resolver attaches the period the date parser found to the metric intents, with today passed in.
const TODAY = "2026-10-28";
const periods = (message: string, today: string | null = TODAY) => resolve(message, undefined, today ?? undefined).intents.map((intent) => [intent.topic, intent.period?.kind, intent.period?.from, intent.period?.to]);

test("REQ-14 the period is attached to water, exercise, weight and meals-done intents", () => {
  assert.deepEqual(periods("¿Cuánta agua tomé ayer?"), [["water", "yesterday", "2026-10-27", "2026-10-27"]]);
  assert.deepEqual(periods("¿Cuántos días hice ejercicio esta semana?"), [["exercise", "thisWeek", "2026-10-26", TODAY]]);
  assert.deepEqual(periods("¿Cuál es mi peso el lunes?"), [["weight", "weekday", "2026-10-26", "2026-10-26"]]);
  assert.deepEqual(periods("¿Cuántas comidas llevo hoy?"), [["mealsDone", "today", TODAY, TODAY]]);
  assert.deepEqual(periods("agua y ejercicio ayer"), [["water", "yesterday", "2026-10-27", "2026-10-27"], ["exercise", "yesterday", "2026-10-27", "2026-10-27"]]);
});

test("REQ-14 no period without a recognized phrase, without today, or on topics that are not metrics", () => {
  assert.deepEqual(periods("¿Cuánta agua llevo?"), [["water", undefined, undefined, undefined]]);
  assert.deepEqual(periods("¿Cuánta agua tomé hace dos semanas?"), [["water", undefined, undefined, undefined]]);
  assert.deepEqual(periods("¿Cuánta agua tomé ayer?", null), [["water", undefined, undefined, undefined]]);
  assert.deepEqual(periods("¿Cuál es mi meta de peso ayer?"), [["goals", undefined, undefined, undefined]]);
  assert.deepEqual(periods("¿Qué lleva la cena ayer?"), [["slotOptions", undefined, undefined, undefined]]);
  assert.deepEqual(periods("Mi avance de la semana"), [["weekly", undefined, undefined, undefined]]);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTERS } from "@/lib/assistant";
import { resolve } from "@/lib/domain/chat-intent";
import { TOPICS } from "@/lib/domain/chat-topics";
import { BUTTON_TOPICS } from "../shared/assistant-buttons";

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

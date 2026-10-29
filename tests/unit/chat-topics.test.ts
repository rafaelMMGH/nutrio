import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeText } from "@/lib/assistant";
import { matchTopics, TOPICS, VOCABULARY } from "@/lib/domain/chat-topics";

// The matcher does not normalize vocabulary entries and its never-fuzzy list is accent-free, so entries are stored
// normalized and in the singular (it folds plurals itself). Numbers are not parsed here (US3).

test("every vocabulary entry is normalized, in the singular, and belongs to a topic with a title table row", () => {
  assert.ok(VOCABULARY.length > 0);
  for (const { topic, words, phrases } of VOCABULARY) {
    assert.ok(topic in TOPICS, topic);
    for (const entry of [...words, ...phrases]) {
      assert.equal(entry.replace(/\*$/, ""), normalizeText(entry.replace(/\*$/, "")), `${topic}: ${entry}`);
      for (const part of entry.replace(/\*$/, "").split(" ")) assert.ok(!part.endsWith("s"), `${topic}: "${entry}" has a plural-looking word "${part}"`);
    }
  }
});

// The Topics table of the spec (Button, Title, Follow-ups), written out independently of the code. A null is a cell
// that is "–" or holds a <slot>/<receta>/"Nombre / Plan" placeholder: those get their text with their builders.
const SPEC_TOPICS: Record<string, { title: string | null; button: string | null; followUps: string[] }> = {
  mealTimes: { title: "Horarios", button: "¿Cuál es mi horario?", followUps: ["Mi cena de hoy", "Mi carrito"] },
  slotOptions: { title: null, button: null, followUps: [] },
  dish: { title: null, button: null, followUps: ["Mi carrito", "Mi cena de hoy"] },
  weight: { title: "Peso", button: "Mi peso", followUps: ["¿Cuál es mi meta?", "¿Cuánto ejercicio llevo?"] },
  exercise: { title: "Ejercicio", button: "¿Cuánto ejercicio llevo?", followUps: ["¿Cuánta agua llevo?", "Mi peso"] },
  water: { title: "Agua", button: "¿Cuánta agua llevo?", followUps: ["¿Cuánto ejercicio llevo?", "¿Cuántas comidas llevo?"] },
  mealsDone: { title: "Comidas", button: "¿Cuántas comidas llevo?", followUps: ["¿Cuánta agua llevo?", "Mi cena de hoy"] },
  goals: { title: "Metas", button: "¿Cuál es mi meta?", followUps: ["Mi avance de la semana", "Mi peso"] },
  weekly: { title: "Avance", button: "Mi avance de la semana", followUps: ["Mi peso", "¿Cuál es mi meta?"] },
  ambiguous: { title: null, button: null, followUps: [] },
  cart: { title: "Carrito", button: "Mi carrito", followUps: ["¿Qué recetas hay en mi plan?", "Mi cena de hoy"] },
  recipes: { title: "Recetas", button: "¿Qué recetas hay en mi plan?", followUps: ["Mi carrito", "Mi cena de hoy"] },
  plan: { title: "Plan", button: "¿Cuál es mi plan?", followUps: ["¿Cuál es mi meta?", "¿Qué suplementos tomo?", "¿Qué recetas hay en mi plan?"] },
  identity: { title: null, button: null, followUps: ["¿Cuál es mi plan?", "Mi avance de la semana"] }
};

test("REQ-24 the TOPICS table holds the Title, Button and Follow-ups of the spec Topics table for all 14 topics", () => {
  assert.equal(Object.keys(SPEC_TOPICS).length, 14);
  assert.deepEqual(TOPICS, SPEC_TOPICS);
});

// One row per vocabulary entry: [topic, entry as typed, plural, typo]. A null is a variant the REQ-2 rules rule out
// (entries up to 4 letters allow no typo; a plural of a verb or a stem means nothing). Every variant resolves to the
// row's topic alone.
type Row = [topic: string, exact: string, plural: string | null, typo: string | null];
const ROWS: Row[] = [
  ["mealTimes", "hora", "horas", null],
  ["mealTimes", "horario", "horarios", "horaro"],
  ["mealTimes", "cuándo", null, "cuadno"],
  ["slotOptions", "desayuno", "desayunos", "desayno"],
  ["slotOptions", "comida", "comidas", "comda"],
  ["slotOptions", "cena", "cenas", null],
  ["slotOptions", "colación", "colaciones", "colacin"],
  ["slotOptions", "almuerzo", "almuerzos", "almuerso"],
  ["slotOptions", "merienda", "meriendas", "merinda"],
  ["slotOptions", "snack", "snacks", "snak"],
  ["slotOptions", "desayunar", null, "desayuar"],
  ["slotOptions", "comer", null, "comre"],
  ["slotOptions", "cenar", null, "cenra"],
  ["dish", "qué lleva", "qué llevas", "que leva"],
  ["dish", "cómo se prepara", null, "como se prepra"],
  ["dish", "cómo se hace", null, null],
  ["dish", "ingrediente de", "ingredientes de", "ingredinte de"],
  ["dish", "receta de", "recetas de", "recta de"],
  ["weight", "peso", "pesos", null],
  ["weight", "pesar", "pesares", "pesra"],
  ["weight", "pesé", null, null],
  ["weight", "pesaje", "pesajes", "pesje"],
  ["weight", "báscula", "básculas", "bacula"],
  ["weight", "kilo", "kilos", null],
  ["exercise", "ejercicio", "ejercicios", "ejersisio"],
  ["exercise", "entrenar", null, "entrenra"],
  ["exercise", "entrené", null, "entrne"],
  ["exercise", "entrenamiento", "entrenamientos", "entrenamineto"],
  ["exercise", "actividad", "actividades", "actvidad"],
  ["exercise", "gym", "gyms", null],
  ["exercise", "gimnasio", "gimnasios", "gimansio"],
  ["water", "agua", "aguas", null],
  ["water", "hidratación", "hidrataciones", "hidratacin"],
  ["water", "hidratar", null, "hidrtar"],
  ["water", "vaso", "vasos", null],
  ["mealsDone", "comida llevo", "comidas llevo", "comda llevo"],
  ["mealsDone", "comida hice", "comidas hice", "comda hice"],
  ["mealsDone", "comida cumplido", "comidas cumplido", "comida cumplid"],
  ["mealsDone", "comida cumplí", "comidas cumplí", "comda cumpli"],
  ["goals", "meta", "metas", null],
  ["goals", "objetivo", "objetivos", "objtivo"],
  ["weekly", "avance", "avances", "avnace"],
  ["weekly", "progreso", "progresos", "progerso"],
  ["weekly", "resumen", "resumenes", "resumne"],
  ["ambiguous", "llevo", null, "levo"],
  ["ambiguous", "voy", null, null],
  ["ambiguous", "cuánto llevo", "cuántos llevo", "cuanto levo"],
  ["cart", "carrito", "carritos", "carrtio"],
  ["cart", "compras", "compra", null],
  ["cart", "súper", "supers", "supre"],
  ["recipes", "receta", "recetas", "recta"],
  ["recipes", "ingrediente", "ingredientes", "ingredinte"],
  ["recipes", "preparo", "prepara", null],
  ["plan", "plan", "planes", null],
  ["plan", "suplemento", "suplementos", "suplemneto"],
  ["plan", "recomendación", "recomendaciones", "recomendacin"],
  ["plan", "objetivo del plan", "objetivos del plan", "objtivo del plan"],
  ["identity", "cómo me llamo", "cómo me llamos", "como me lamo"],
  ["identity", "mi nombre", "mi nombres", "mi nobre"],
  ["identity", "cómo se llama mi plan", null, "como se lama mi plan"],
  ["identity", "nombre de mi plan", null, "nobre de mi plan"]
];

for (const [topic, exact, plural, typo] of ROWS) {
  for (const [kind, text] of [["exact", exact], ["plural", plural], ["typo", typo]] as const) {
    if (text === null) continue;
    test(`REQ-1/REQ-2 ${topic}: ${kind} "${text}"`, () => {
      assert.deepEqual(matchTopics(text), [topic]);
      assert.deepEqual(matchTopics(`¿${text.toUpperCase()}?`), [topic]);
    });
  }
}

test("REQ-1 the table has a row for every vocabulary entry", () => {
  const covered = (topic: string, entry: string) =>
    ROWS.some(([rowTopic, exact]) => rowTopic === topic && (entry.endsWith("*") ? normalizeText(exact).startsWith(entry.slice(0, -1)) : normalizeText(exact) === entry));
  for (const { topic, words, phrases } of VOCABULARY) for (const entry of [...words, ...phrases]) assert.ok(covered(topic, entry), `${topic}: ${entry}`);
});

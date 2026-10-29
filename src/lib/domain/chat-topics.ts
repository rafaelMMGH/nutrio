import { words } from "@/lib/assistant";

// Topic matcher of the assistant (spec assistant-chat-polish, REQ-19). A question has at most one winning topic, found
// from its words against the vocabulary below only. The vocabulary is exhaustive: do not add words the spec's Topics
// table does not list. It is rewritten for the Topics table in T020; until then only the first four topics can match.

export type TopicId = "mealTimes" | "cart" | "recipes" | "plan" | "weight" | "exercise" | "water" | "mealsDone" | "goals" | "weekly";
type Tier = 1 | 2 | 3;

type Vocabulary = { tier: Tier; topic: TopicId; exact: string[]; stems: string[] };

const MEAL_NOUNS = ["desayuno", "desayunos", "comida", "comidas", "cena", "cenas", "colacion", "colaciones"];

// Normalized (lowercase, no accents). A word matches if it equals an `exact` entry or starts with a stem.
const VOCABULARY: Vocabulary[] = [
  { tier: 1, topic: "mealTimes", exact: ["hora", "horas", "horario", "horarios"], stems: [] },
  { tier: 3, topic: "mealTimes", exact: MEAL_NOUNS, stems: [] },
  { tier: 2, topic: "cart", exact: ["carrito", "carritos"], stems: ["compr"] },
  { tier: 2, topic: "recipes", exact: [], stems: ["receta", "ingrediente", "prepar"] },
  { tier: 2, topic: "plan", exact: ["plan", "planes", "objetivo", "objetivos"], stems: ["suplement", "recomend"] }
];

// "cuándo" is a weak Tier 1 word (REQ-19): it counts only next to a meal noun or when nothing else is a topic word.
const WHEN = "cuando";

// Ties inside a tier go to the first topic of this list.
const TIE_ORDER: TopicId[] = ["cart", "recipes", "plan", "mealTimes"];

/** Title (block title and placeholder name) and follow-up messages of each topic, from the spec's Topics table. */
export const TOPICS: Record<TopicId, { title: string; followUps: string[] }> = {
  mealTimes: { title: "Horarios", followUps: ["Mi cena de hoy", "Mi carrito"] },
  cart: { title: "Carrito", followUps: ["¿Qué recetas hay en mi plan?", "Mi cena de hoy"] },
  recipes: { title: "Recetas", followUps: ["Mi carrito", "Mi cena de hoy"] },
  plan: { title: "Plan", followUps: ["¿Cuál es mi meta?", "¿Qué suplementos tomo?", "¿Qué recetas hay en mi plan?"] },
  weight: { title: "Peso", followUps: ["¿Cuál es mi meta?", "¿Cuánto ejercicio llevo?"] },
  exercise: { title: "Ejercicio", followUps: ["¿Cuánta agua llevo?", "Mi peso"] },
  water: { title: "Agua", followUps: ["¿Cuánto ejercicio llevo?", "¿Cuántas comidas llevo?"] },
  mealsDone: { title: "Comidas", followUps: ["¿Cuánta agua llevo?", "Mi cena de hoy"] },
  goals: { title: "Metas", followUps: ["Mi avance de la semana", "Mi peso"] },
  weekly: { title: "Avance", followUps: ["Mi peso", "¿Cuál es mi meta?"] }
};

/** Empty state, greeting and no-match buttons. */
export const STARTERS = ["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"];

const GREETING_WORDS = /(^| )(hola|buenos dias|buenas tardes|buenas noches|que tal|gracias)(?= |$)/g;

/** "hello" or "thanks" when the message is made only of greeting or thanks words, else null (a greeting before a question is ignored by the matcher). */
export function greetingOf(question: string): "hello" | "thanks" | null {
  const text = words(question).join(" ");
  if (!text || text.replace(GREETING_WORDS, "").trim()) return null;
  return text.includes("gracias") ? "thanks" : "hello";
}

/** Tiers of the topics a (normalized) word belongs to. */
function classify(word: string): { tier: Tier; topic: TopicId }[] {
  return VOCABULARY.filter((entry) => entry.exact.includes(word) || entry.stems.some((stem) => word.startsWith(stem))).map(({ tier, topic }) => ({ tier, topic }));
}

/** True when a normalized word is in the vocabulary (including "cuando"): the recipe-list filter drops such words. */
export function isTopicWord(word: string): boolean {
  return word === WHEN || classify(word).length > 0;
}

/** The winning topic of a question, or null when no word is a topic word. Tier 1 beats 2 beats 3; ties follow `TIE_ORDER`. */
export function matchTopic(question: string): TopicId | null {
  const tokens = words(question);
  const hits = tokens.flatMap(classify);
  const hasMealNoun = tokens.some((word) => MEAL_NOUNS.includes(word));
  if (tokens.includes(WHEN) && (hasMealNoun || hits.length === 0)) hits.push({ tier: 1, topic: "mealTimes" });
  for (const tier of [1, 2, 3] as const) {
    const topics = hits.filter((hit) => hit.tier === tier).map((hit) => hit.topic);
    const winner = TIE_ORDER.find((topic) => topics.includes(topic));
    if (winner) return winner;
  }
  return null;
}

import { words } from "@/lib/assistant";
import { matchPhrases, matchWord } from "@/lib/domain/chat-match";

// Vocabulary and topic table of the assistant (spec assistant-data-scope, Topics table, REQ-1, REQ-2). Words are
// matched by chat-match.ts (typos, plurals, stems); this file only says which words and phrases belong to which topic.

export type TopicId =
  | "mealTimes" | "slotOptions" | "dish" | "weight" | "exercise" | "water" | "mealsDone" | "goals" | "weekly" | "ambiguous"
  | "cart" | "recipes" | "plan" | "identity";

/**
 * Synonym groups. Entries are normalized (`normalizeText`) and in the singular: the matcher folds plurals and does not
 * normalize them, and its never-fuzzy list is accent-free. A trailing `*` is an exact-prefix stem. `phrases` are
 * multi-word entries that consume their words. Slot times ("hora" + slot) and the possessor rule are the resolver's (T022).
 */
export const VOCABULARY: { topic: TopicId; words: string[]; phrases: string[] }[] = [
  { topic: "mealTimes", words: ["hora", "horario", "cuando"], phrases: [] },
  { topic: "slotOptions", words: ["desayuno", "comida", "cena", "colacion", "almuerzo", "merienda", "snack", "desayunar", "comer", "cenar"], phrases: [] },
  { topic: "dish", words: [], phrases: ["que lleva", "como se prepara", "como se hace", "ingrediente de", "receta de"] },
  { topic: "weight", words: ["peso", "pesar", "pese", "pesaje", "bascula", "kilo"], phrases: [] },
  { topic: "exercise", words: ["ejercicio", "entrenar", "entrene", "entrenamiento", "actividad", "gym", "gimnasio"], phrases: [] },
  { topic: "water", words: ["agua", "hidratacion", "hidratar", "vaso"], phrases: [] },
  { topic: "mealsDone", words: [], phrases: ["comida llevo", "comida hice", "comida cumplido", "comida cumpli"] },
  { topic: "goals", words: ["meta", "objetivo"], phrases: [] },
  { topic: "weekly", words: ["avance", "progreso", "resumen"], phrases: [] },
  { topic: "ambiguous", words: ["llevo", "voy"], phrases: ["cuanto llevo"] },
  { topic: "cart", words: ["carrito", "compr*", "super"], phrases: [] },
  { topic: "recipes", words: ["receta", "ingrediente", "prepar*"], phrases: [] },
  { topic: "plan", words: ["plan", "suplemento", "recomendacion"], phrases: ["objetivo del plan"] },
  { topic: "identity", words: [], phrases: ["como me llamo", "mi nombre", "como se llama mi plan", "nombre de mi plan"] }
];

/**
 * Title (block title in 2-block answers), Button (the message that offers the topic) and Follow-ups of the Topics table.
 * `null` where the table has a <slot> or <receta> placeholder: those topics get theirs with their builders (T026, T028).
 */
export const TOPICS: Record<TopicId, { title: string | null; button: string | null; followUps: string[] }> = {
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

const PHRASES = new Map(VOCABULARY.flatMap(({ topic, phrases }) => phrases.map((phrase) => [phrase, topic] as const)));
const ENTRY_TOPICS = new Map<string, TopicId[]>();
for (const { topic, words: entries } of VOCABULARY) for (const entry of entries) ENTRY_TOPICS.set(entry, [...(ENTRY_TOPICS.get(entry) ?? []), topic]);
// Words of phrases are entries too, so an exact "lleva" never fuzzy-matches the entry "llevo" (REQ-2), but they trigger nothing alone.
const WORD_ENTRIES = [...new Set([...ENTRY_TOPICS.keys(), ...[...PHRASES.keys()].flatMap((phrase) => phrase.split(" "))])];

// Entries are singular, as the matcher expects (REQ-2): "gracias" and "buenos dias" match through their plural forms.
const GREETING_WORDS = ["hola"];
const THANKS_WORD = "gracia";
const GREETING_PHRASES = ["bueno dia", "buena tarde", "buena noche", "que tal"];

/** "hello" or "thanks" when the message is made only of greeting or thanks words, else null (a greeting before a question is ignored by the matcher). */
export function greetingOf(question: string): "hello" | "thanks" | null {
  const tokens = words(question);
  const consumed = new Set(matchPhrases(tokens, GREETING_PHRASES).flatMap(({ from, to }) => Array.from({ length: to - from }, (_, offset) => from + offset)));
  const rest = tokens.filter((_, at) => !consumed.has(at));
  const entries = [...GREETING_WORDS, THANKS_WORD];
  if (!tokens.length || !rest.every((token) => matchWord(token, entries).length)) return null;
  return rest.some((token) => matchWord(token, [THANKS_WORD]).length) ? "thanks" : "hello";
}

/** A vocabulary entry found in a question: the topic, the entry (a phrase or a word) and the index of its first word. */
export type TopicHit = { topic: TopicId; entry: string; at: number };

// "comidas … llevo": the noun and the verbs of the meals-done phrases, which may be apart in a question (1c2 review M5).
const MEALS_DONE_PHRASES = VOCABULARY.filter(({ topic }) => topic === "mealsDone").flatMap(({ phrases }) => phrases.map((phrase) => phrase.split(" ")));
const MEALS_DONE_NOUNS = [...new Set(MEALS_DONE_PHRASES.map(([noun]) => noun))];
const MEALS_DONE_VERBS = [...new Set(MEALS_DONE_PHRASES.map(([, verb]) => verb))];

/**
 * Every vocabulary entry a question's words match. Phrases come first and consume their words; then meals done is
 * looked for over the words left, apart or not; then each remaining word against the word entries. No REQ-6 rules.
 */
export function topicHits(tokens: readonly string[]): TopicHit[] {
  const hits: TopicHit[] = [];
  const consumed = new Set<number>();
  for (const { phrase, from, to } of matchPhrases(tokens, [...PHRASES.keys()])) {
    hits.push({ topic: PHRASES.get(phrase)!, entry: phrase, at: from });
    for (let index = from; index < to; index++) consumed.add(index);
  }
  // A word that exactly equals an entry of another phrase ("lleva") never reaches "llevo" (matchWord), so "qué lleva la comida" is not meals done.
  const unconsumed = (entries: string[]) => tokens.flatMap((token, at) => (!consumed.has(at) && matchWord(token, WORD_ENTRIES).some((entry) => entries.includes(entry)) ? [at] : []));
  const [noun, verb] = [unconsumed(MEALS_DONE_NOUNS)[0], unconsumed(MEALS_DONE_VERBS)[0]];
  if (noun !== undefined && verb !== undefined) {
    hits.push({ topic: "mealsDone", entry: MEALS_DONE_PHRASES[0].join(" "), at: Math.min(noun, verb) });
    consumed.add(noun).add(verb);
  }
  tokens.forEach((token, at) => {
    if (consumed.has(at)) return;
    for (const entry of matchWord(token, WORD_ENTRIES)) for (const topic of ENTRY_TOPICS.get(entry) ?? []) hits.push({ topic, entry, at });
  });
  return hits.sort((a, b) => a.at - b.at);
}

/** The topics a question matches, in order of first appearance, without the REQ-6 rules (the answer uses `resolve`; this is the vocabulary tests' view). */
export const matchTopics = (question: string): TopicId[] => [...new Set(topicHits(words(question)).map((hit) => hit.topic))];

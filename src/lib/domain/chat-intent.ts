import { type Intent, words } from "@/lib/assistant";
import { parsePeriod } from "@/lib/domain/chat-dates";
import { matchDish } from "@/lib/domain/chat-dish";
import { isPlural, matchWord } from "@/lib/domain/chat-match";
import { greetingOf, topicHits, type TopicHit, type TopicId } from "@/lib/domain/chat-topics";
import type { Recipe } from "@/lib/types";

// Intent resolution of the assistant (spec assistant-data-scope REQ-6). Pure: the message is the only input. The
// vocabulary says which words belong to which topic (chat-topics.ts); this file applies the combination rules.

/** What `resolve` found: the intents to answer (at most 2) and the further ones, offered as buttons (REQ-24). */
export type Resolution = { intents: Intent[]; overflow: Intent[] };

const MAX_INTENTS = 2;
/** A verb form of a slot word is that slot. */
const SLOT_OF_VERB: Record<string, string> = { desayunar: "desayuno", comer: "comida", cenar: "cena" };
const METRICS = ["weight", "exercise", "water"] as const;
/** Topics that answer a question about a number: weekly progress and the ambiguous "llevo" give way to them. */
const METRIC_TOPICS: TopicId[] = [...METRICS, "mealsDone"];

/** Ordinal words of a slot ref (Terms), normalized: both genders, "primero" and "tercero" included. */
const ORDINAL_WORDS = new Map<string, number>(
  [["primera", "primer", "primero"], ["segunda", "segundo"], ["tercera", "tercer", "tercero"], ["cuarta", "cuarto"], ["quinta", "quinto"], ["sexta", "sexto"], ["septima", "septimo"], ["octava", "octavo"], ["novena", "noveno"], ["decima", "decimo"]]
    .flatMap((forms, index) => forms.map((form): [string, number] => [form, index + 1]))
);

/** Tokens after a bare number that make it a clock time ("colación 2 am"), not a position. */
const MERIDIEMS = new Set(["am", "pm"]);

/** The position a slot word carries: an ordinal word before or after it ("segunda colación"), or a number after it ("colación 2"). */
function ordinalAt(tokens: string[], at: number): { ordinal?: number; numbered?: boolean } {
  const word = ORDINAL_WORDS.get(tokens[at - 1]) ?? ORDINAL_WORDS.get(tokens[at + 1]);
  if (word) return { ordinal: word };
  const number = /^\d{1,3}$/.test(tokens[at + 1] ?? "") && !MERIDIEMS.has(tokens[at + 2]) ? Number(tokens[at + 1]) : 0;
  return number ? { ordinal: number, numbered: true } : {};
}

const integer = (token: string | undefined) => (token !== undefined && /^\d+$/.test(token) ? Number(token) : undefined);
// The page number is read from the typed message: the word split would turn "3.5" into the page 3.
const PAGE_NUMBER = /p[aá]gina\s+(\d+)(?![\p{L}\d]|[.,]\d)/iu;

/**
 * REQ-9, REQ-10: what a message does with the options of the slot at `at`. "<slot>, más opciones" is a page (the typed
 * number, or 2); "opción <n>" and "<n> de la <slot>" pick option n. Nothing of the sort gives undefined.
 */
function selectionAt(question: string, tokens: string[], at: number): { page: number } | { option: number } | undefined {
  const isOption = (token: string | undefined) => token !== undefined && matchWord(token, ["opcion"]).length > 0;
  if (tokens.some((token, index) => token === "mas" && isOption(tokens[index + 1]))) return { page: Number(PAGE_NUMBER.exec(question)?.[1] ?? 2) };
  // "de" then articles then the slot word: "la 2 de la cena".
  const reachesSlot = (from: number) => {
    if (tokens[from] !== "de") return false;
    let next = from + 1;
    while (ARTICLES.includes(tokens[next])) next++;
    return next === at;
  };
  // The typed words line up with the tokens (both split on letters and digits); the decimal is read after the option's own word.
  const typed = [...question.matchAll(/[\p{L}\p{N}]+/gu)];
  for (let index = 0; index < tokens.length; index++) {
    let option = integer(tokens[index]);
    if (option === undefined || !((isOption(tokens[index - 1]) && tokens[index + 1] !== "de") || reachesSlot(index + 1))) continue;
    // The word split turns "2.5" into 2 and 5: read the decimal from the typed message so the builder can reject it.
    const word = typed.length === tokens.length ? typed[index] : undefined;
    const decimal = word && /^[.,](\d+)/.exec(question.slice(word.index + word[0].length))?.[1];
    if (decimal) option = Number(`${option}.${decimal}`);
    return { option };
  }
  return undefined;
}

const ARTICLES = ["el", "la", "los", "las", "un", "una"];

const only = (...intents: Intent[]): Resolution => ({ intents, overflow: [] });

/** The words after the dish cue minus the leading article, normalized (`text`, for the matcher) and as typed (REQ-26). */
function dishPhrase(question: string, tokens: string[], hit: TopicHit): { text: string; typed: string } {
  const from = hit.at + hit.entry.split(" ").length;
  const typedWords = question.match(/[\p{L}\p{N}]+/gu);
  // Both lists split on the same characters; if they ever disagree, fall back to the normalized words.
  const source = typedWords?.length === tokens.length ? typedWords : tokens;
  const skip = ARTICLES.includes(tokens[from]) ? 1 : 0;
  return { text: tokens.slice(from + skip).join(" "), typed: source.slice(from + skip).join(" ") };
}

/**
 * REQ-6 in order. Step 1 greeting, step 2 (option selection and paging) and step 3 identity are here. Step 4 (a dish named by its recipe, REQ-3) runs when the caller passes the
 * user's recipes: a dish phrase ends the answer; a phrase that is not a dish name falls through to the topics, and
 * a dish cue still unresolved at the end is step 7. Without recipes the dish cue is a plain "dish" intent. When nothing
 * is found the caller continues with step 8 (did-you-mean over the question, no-match). With `today`, the period the
 * message names (REQ-14) is attached to the metric intents.
 * Phrases (identity, dish cues, meals done, multi-word synonyms) consume their words before any single word counts.
 */
export function resolve(question: string, recipes?: readonly Recipe[], today?: string): Resolution {
  if (greetingOf(question)) return only({ topic: "greeting" });
  const tokens = words(question);
  const hits = topicHits(tokens);

  const first = (match: (hit: TopicHit) => boolean) => hits.find(match)?.at;
  const topicAt = (topic: TopicId) => first((hit) => hit.topic === topic);
  // "comidas" in the plural, typos included, is the whole day's meals, not the slot "comida" (Topics: all meal times).
  const allMeals = (hit: TopicHit) => hit.topic === "slotOptions" && hit.entry === "comida" && isPlural(tokens[hit.at], hit.entry);
  const slotHits = hits.filter((hit) => hit.topic === "slotOptions" && !allMeals(hit));
  const timeAt = first((hit) => hit.topic === "mealTimes" || allMeals(hit));
  const timed = hits.some((hit) => hit.topic === "mealTimes");

  // Step 2: option selection and paging of a slot ends the answer, ahead of the dish cue and the slot reading.
  if (!timed) {
    for (const hit of slotHits) {
      const selection = selectionAt(question, tokens, hit.at);
      if (selection) return only({ topic: "slotOptions", slot: SLOT_OF_VERB[hit.entry] ?? hit.entry, ...ordinalAt(tokens, hit.at), ...selection });
    }
  }

  // Step 4: a dish cue plus a dish name ends the answer with the matcher's outcome.
  const dishHit = recipes && hits.find((hit) => hit.topic === "dish");
  const dish = dishHit ? dishPhrase(question, tokens, dishHit) : undefined;
  if (recipes && dish) {
    const match = matchDish(dish.text, recipes);
    if (match.kind === "found") return only({ topic: "dish", outcome: "found", recipeIds: [match.recipe.id], phrase: dish.typed });
    if (match.kind === "didYouMean") return only({ topic: "dish", outcome: "didYouMean", recipeIds: match.candidates.map((recipe) => recipe.id), phrase: dish.typed });
    if (match.dishName) return only({ topic: "dish", outcome: "notFound", phrase: dish.typed });
  }

  const named = today ? parsePeriod(question, today) : undefined;
  const dated = (intent: Intent): Intent => (typeof named === "object" ? { ...intent, period: named } : intent);
  const items: { at: number; intent: Intent }[] = [];
  const add = (at: number | undefined, intent: Intent) => at !== undefined && items.push({ at, intent });

  for (const hit of hits.filter(({ topic }) => topic === "identity")) add(hit.at, { topic: "identity", of: hit.entry.includes("plan") ? "plan" : "name" });
  // Time word + slot = slot times; a slot alone (or with a dish cue, which the slot reading wins) = its options.
  for (const hit of slotHits) add(hit.at, { topic: timed ? "mealTimes" : "slotOptions", slot: SLOT_OF_VERB[hit.entry] ?? hit.entry, ...ordinalAt(tokens, hit.at) });
  if (!slotHits.length && !recipes) add(topicAt("dish"), { topic: "dish" });

  // Goal word + metric = that goal only; a goal word beside "plan" and no metric is the Plan topic (below).
  const goalAt = topicAt("goals");
  for (const metric of METRICS) add(topicAt(metric), goalAt === undefined ? dated({ topic: metric }) : { topic: "goals", metric });
  add(topicAt("mealsDone"), dated({ topic: "mealsDone" }));
  if (goalAt !== undefined && !METRICS.some((metric) => topicAt(metric) !== undefined) && topicAt("plan") === undefined) add(goalAt, { topic: "goals" });
  if (!METRIC_TOPICS.some((topic) => topicAt(topic) !== undefined)) add(topicAt("weekly"), { topic: "weekly" });
  add(topicAt("cart"), { topic: "cart" });
  // Recipes give way to a slot, a dish cue or the cart ("ingredientes" + cart = cart only).
  if (!slotHits.length && topicAt("dish") === undefined && topicAt("cart") === undefined) add(topicAt("recipes"), { topic: "recipes" });

  if (!items.length) {
    // Only the weak readings are left, in order: all meal times (a time word with another topic is ignored, so it
    // counts only here), the ambiguous "llevo" (REQ-25, step 6), then the Plan topic, which applies only when alone.
    if (timeAt !== undefined) return only({ topic: "mealTimes" });
    if (topicAt("ambiguous") !== undefined) return only({ topic: "ambiguous" });
    if (topicAt("plan") !== undefined) return only({ topic: "plan" });
    // Step 7: the dish cue is left unresolved, so an empty phrase asks which dish and any other phrase is not found.
    if (dish) return only(dish.typed ? { topic: "dish", outcome: "notFound", phrase: dish.typed } : { topic: "dish", outcome: "clarify", phrase: "" });
    return only();
  }

  const seen = new Set<string>();
  const ordered = items
    .sort((a, b) => a.at - b.at)
    .map(({ intent }) => intent)
    .filter((intent) => !seen.has(JSON.stringify(intent)) && seen.add(JSON.stringify(intent)));
  return { intents: ordered.slice(0, MAX_INTENTS), overflow: ordered.slice(MAX_INTENTS) };
}

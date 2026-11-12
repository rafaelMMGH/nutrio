import { type Intent, words } from "@/lib/assistant";
import { matchDish } from "@/lib/domain/chat-dish";
import { isPlural } from "@/lib/domain/chat-match";
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
const ORDINAL_WORDS: Record<string, number> = Object.fromEntries(
  [["primera", "primer", "primero"], ["segunda", "segundo"], ["tercera", "tercer", "tercero"], ["cuarta", "cuarto"], ["quinta", "quinto"], ["sexta", "sexto"], ["septima", "septimo"], ["octava", "octavo"], ["novena", "noveno"], ["decima", "decimo"]]
    .flatMap((forms, index) => forms.map((form) => [form, index + 1]))
);

/** The position a slot word carries: an ordinal word before or after it ("segunda colación"), or a number after it ("colación 2"). */
function ordinalAt(tokens: string[], at: number): { ordinal?: number } {
  const ordinal = ORDINAL_WORDS[tokens[at - 1]] ?? ORDINAL_WORDS[tokens[at + 1]] ?? (/^\d{1,3}$/.test(tokens[at + 1] ?? "") ? Number(tokens[at + 1]) : undefined);
  return ordinal ? { ordinal } : {};
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
 * REQ-6 in order. Step 1 greeting and step 3 identity are here; step 2 (option selection and paging, US2) comes before
 * the topics and is left to that task. Step 4 (a dish named by its recipe, REQ-3) runs when the caller passes the
 * user's recipes: a dish phrase ends the answer; a phrase that is not a dish name falls through to the topics, and
 * a dish cue still unresolved at the end is step 7. Without recipes the dish cue is a plain "dish" intent. When nothing
 * is found the caller continues with step 8 (did-you-mean over the question, no-match).
 * Phrases (identity, dish cues, meals done, multi-word synonyms) consume their words before any single word counts.
 */
export function resolve(question: string, recipes?: readonly Recipe[]): Resolution {
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

  // Step 4: a dish cue plus a dish name ends the answer with the matcher's outcome.
  const dishHit = recipes && hits.find((hit) => hit.topic === "dish");
  const dish = dishHit ? dishPhrase(question, tokens, dishHit) : undefined;
  if (recipes && dish) {
    const match = matchDish(dish.text, recipes);
    if (match.kind === "found") return only({ topic: "dish", outcome: "found", recipeIds: [match.recipe.id], phrase: dish.typed });
    if (match.kind === "didYouMean") return only({ topic: "dish", outcome: "didYouMean", recipeIds: match.candidates.map((recipe) => recipe.id), phrase: dish.typed });
    if (match.dishName) return only({ topic: "dish", outcome: "notFound", phrase: dish.typed });
  }

  const items: { at: number; intent: Intent }[] = [];
  const add = (at: number | undefined, intent: Intent) => at !== undefined && items.push({ at, intent });

  for (const hit of hits.filter(({ topic }) => topic === "identity")) add(hit.at, { topic: "identity", of: hit.entry.includes("plan") ? "plan" : "name" });
  // Time word + slot = slot times; a slot alone (or with a dish cue, which the slot reading wins) = its options.
  for (const hit of slotHits) add(hit.at, { topic: timed ? "mealTimes" : "slotOptions", slot: SLOT_OF_VERB[hit.entry] ?? hit.entry, ...ordinalAt(tokens, hit.at) });
  if (!slotHits.length && !recipes) add(topicAt("dish"), { topic: "dish" });

  // Goal word + metric = that goal only; a goal word beside "plan" and no metric is the Plan topic (below).
  const goalAt = topicAt("goals");
  for (const metric of METRICS) add(topicAt(metric), goalAt === undefined ? { topic: metric } : { topic: "goals", metric });
  add(topicAt("mealsDone"), { topic: "mealsDone" });
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

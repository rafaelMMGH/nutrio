import { type Intent, words } from "@/lib/assistant";
import { greetingOf, topicHits, type TopicHit, type TopicId } from "@/lib/domain/chat-topics";

// Intent resolution of the assistant (spec assistant-data-scope REQ-6). Pure: the message is the only input. The
// vocabulary says which words belong to which topic (chat-topics.ts); this file applies the combination rules.

/** What `resolve` found: the intents to answer (at most 2) and the further ones, offered as buttons (REQ-24). */
export type Resolution = { intents: Intent[]; overflow: Intent[] };

const MAX_INTENTS = 2;
const TIME_WORDS = ["hora", "horario", "cuando"];
/** A verb form of a slot word is that slot. */
const SLOT_OF_VERB: Record<string, string> = { desayunar: "desayuno", comer: "comida", cenar: "cena" };
const METRICS = ["weight", "exercise", "water"] as const;
/** Topics that answer a question about a number: weekly progress and the ambiguous "llevo" give way to them. */
const METRIC_TOPICS: TopicId[] = [...METRICS, "mealsDone"];

const only = (...intents: Intent[]): Resolution => ({ intents, overflow: [] });

/**
 * REQ-6 in order. Step 1 greeting and step 3 identity are here; step 2 (option selection and paging, US2) comes before
 * the topics and step 4 (a dish named by its recipe, T027) refines the "dish" and slot intents below, so both are
 * left to those tasks. When nothing is found the caller continues with step 7 (did-you-mean) and step 8 (no-match).
 * Phrases (identity, dish cues, meals done, multi-word synonyms) consume their words before any single word counts.
 */
export function resolve(question: string): Resolution {
  if (greetingOf(question)) return only({ topic: "greeting" });
  const tokens = words(question);
  const hits = topicHits(tokens);

  const first = (match: (hit: TopicHit) => boolean) => hits.find(match)?.at;
  const topicAt = (topic: TopicId) => first((hit) => hit.topic === topic);
  // "comidas" in the plural is the whole day's meals, not the slot "comida" (Topics: all meal times).
  const allMeals = (hit: TopicHit) => hit.topic === "slotOptions" && tokens[hit.at] === "comidas";
  const slotHits = hits.filter((hit) => hit.topic === "slotOptions" && !allMeals(hit));
  const timeAt = first((hit) => hit.topic === "mealTimes" || allMeals(hit));
  const timed = hits.some((hit) => hit.topic === "mealTimes");

  const items: { at: number; intent: Intent }[] = [];
  const add = (at: number | undefined, intent: Intent) => at !== undefined && items.push({ at, intent });

  for (const hit of hits.filter(({ topic }) => topic === "identity")) add(hit.at, { topic: "identity", of: hit.entry.includes("plan") ? "plan" : "name" });
  // Time word + slot = slot times; a slot alone (or with a dish cue, which the slot reading wins) = its options.
  for (const hit of slotHits) add(hit.at, { topic: timed ? "mealTimes" : "slotOptions", slot: SLOT_OF_VERB[hit.entry] ?? hit.entry });
  if (!slotHits.length) add(topicAt("dish"), { topic: "dish" });

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
    if (topicAt("plan") !== undefined || goalAt !== undefined) return only({ topic: "plan" });
    return only();
  }

  const seen = new Set<string>();
  const ordered = items
    .sort((a, b) => a.at - b.at)
    .map(({ intent }) => intent)
    .filter((intent) => !seen.has(JSON.stringify(intent)) && seen.add(JSON.stringify(intent)));
  return { intents: ordered.slice(0, MAX_INTENTS), overflow: ordered.slice(MAX_INTENTS) };
}

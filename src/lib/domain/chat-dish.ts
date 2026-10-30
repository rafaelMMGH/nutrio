import { words } from "@/lib/assistant";
import { DATE_CUES } from "@/lib/domain/chat-dates";
import { isExact, matchWord } from "@/lib/domain/chat-match";
import { VOCABULARY } from "@/lib/domain/chat-topics";

// Dish matcher of the assistant (spec assistant-data-scope REQ-3, REQ-26, REQ-29; plan D11). In-house, on the REQ-2 word
// matcher: a phrase is ranked against recipe names by recall, then precision, then array order. Pure: the caller passes
// the recipes (REQ-3 asks for owned ones), in insertion (seq) order; this file never reorders them.

/** REQ-3 stop words (spec Terms): the frozen recipe-filter stop words plus al, y, a. A separate list: the filter's stays untouched. */
const STOP_WORDS = new Set(["que", "hay", "en", "mi", "mis", "de", "del", "el", "la", "los", "las", "con", "para", "por", "tengo", "cual", "cuales", "como", "cuanto", "es", "un", "una", "al", "y", "a"]);

const SLOT_WORDS = VOCABULARY.filter(({ topic }) => topic === "slotOptions").flatMap(({ words: entries }) => entries);
const TRIGGER_WORDS = VOCABULARY.flatMap(({ words: entries }) => entries);
// Ordinal words of a slot ref in both genders, normalized (spec Terms).
const ORDINAL_WORDS = [
  "primer", "primera", "primero", "segunda", "segundo", "tercer", "tercera", "tercero", "cuarta", "cuarto", "quinta", "quinto",
  "sexta", "sexto", "septima", "septimo", "octava", "octavo", "novena", "noveno", "decima", "decimo"
];
const DAY_PART_WORDS = ["manana", "tarde", "noche"];
const NON_DISH_WORDS = [...TRIGGER_WORDS, ...ORDINAL_WORDS, ...DATE_CUES, ...DAY_PART_WORDS];
const MIN_PHRASE_LENGTH = 3;
const MAX_OFFERED = 3;

type Named = { name: string; deleted_at?: string | null };

export type DishMatch<R extends Named> =
  | { kind: "found"; recipe: R }
  | { kind: "didYouMean"; candidates: R[] }
  /** `dishName` false: the phrase is not a dish name, so REQ-6 step 4 falls through to the remaining steps. */
  | { kind: "none"; dishName: boolean };

/** A generic option name: a slot word, "opcion" and a number ("Desayuno opcion 1"); never a dish. */
export function isGeneric(name: string): boolean {
  const [slot, option, number, ...rest] = words(name);
  return !rest.length && SLOT_WORDS.includes(slot) && option === "opcion" && /^\d+$/.test(number ?? "");
}

const contentWords = (text: string) => words(text).filter((word) => !STOP_WORDS.has(word));

/** Not a dish name (REQ-3): empty or under 3 characters, or only topic, slot, ordinal, date-cue or day-part words (plus a number beside a slot word). */
function isNotDishName(content: string[]): boolean {
  if (content.join(" ").length < MIN_PHRASE_LENGTH) return true;
  const hasSlot = content.some((word) => matchWord(word, SLOT_WORDS).length > 0);
  return content.every((word) => matchWord(word, NON_DISH_WORDS).length > 0 || (hasSlot && /^\d+$/.test(word)));
}

/** Name words matched by a phrase word: an exact word wins and excludes the fuzzy ones of the same name; else either direction of REQ-2. */
function matchedWords(word: string, nameWords: string[]): number[] {
  const indexes = nameWords.flatMap((name, index) => (isExact(word, name) || isExact(name, word) ? [index] : []));
  if (indexes.length) return indexes;
  return nameWords.flatMap((name, index) => (matchWord(word, [name]).length || matchWord(name, [word]).length ? [index] : []));
}

type Ranked<R> = { recipe: R; recall: number; precision: number };

function rank<R extends Named>(content: string[], recipes: readonly R[]): Ranked<R>[] {
  const ranked: Ranked<R>[] = [];
  for (const recipe of recipes) {
    const nameWords = contentWords(recipe.name);
    if (recipe.deleted_at || isGeneric(recipe.name) || !nameWords.length) continue;
    const perWord = content.map((word) => matchedWords(word, nameWords));
    const hit = perWord.filter((indexes) => indexes.length).length;
    if (!hit) continue;
    ranked.push({ recipe, recall: hit / content.length, precision: new Set(perWord.flat()).size / nameWords.length });
  }
  // Array.sort is stable: tied candidates stay in the order the recipes were passed.
  return ranked.sort((a, b) => b.recall - a.recall || b.precision - a.precision);
}

/**
 * REQ-3 outcome for a dish phrase. Rule 1: the name equals the phrase (normalized, stop words removed on both sides),
 * even for a name made only of topic words. Not a dish name: none with `dishName` false. Rule 2: the first candidate has
 * recall 1 and no second candidate, or the second is strictly worse on (recall, precision): found. Rule 3: otherwise
 * did-you-mean (up to 3, best first). Rule 4: no candidate: none with `dishName` true.
 */
export function matchDish<R extends Named>(phrase: string, recipes: readonly R[]): DishMatch<R> {
  const content = contentWords(phrase);
  const text = content.join(" ");
  const exact = text && recipes.find((recipe) => !recipe.deleted_at && !isGeneric(recipe.name) && contentWords(recipe.name).join(" ") === text);
  if (exact) return { kind: "found", recipe: exact };
  if (isNotDishName(content)) return { kind: "none", dishName: false };
  const ranked = rank(content, recipes);
  const [first, second] = ranked;
  if (!first) return { kind: "none", dishName: true };
  const ahead = !second || second.recall < first.recall || (second.recall === first.recall && second.precision < first.precision);
  if (first.recall === 1 && ahead) return { kind: "found", recipe: first.recipe };
  return { kind: "didYouMean", candidates: ranked.slice(0, MAX_OFFERED).map(({ recipe }) => recipe) };
}

/** REQ-29: the candidates for a whole question, best first, up to 3; never a found (rules 1 and 2 do not apply). */
export function rankDish<R extends Named>(question: string, recipes: readonly R[]): R[] {
  const content = contentWords(question);
  return isNotDishName(content) ? [] : rank(content, recipes).slice(0, MAX_OFFERED).map(({ recipe }) => recipe);
}

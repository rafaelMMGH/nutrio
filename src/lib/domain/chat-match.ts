// Word and phrase matcher of the assistant (spec assistant-data-scope REQ-1, REQ-2). Pure and in-house: no dependency.
// Inputs are normalized words (`normalizeText`, `words`); vocabulary entries are normalized too.

/** Words that only ever match exactly: a typo of one is a different word ("cuanto" is not "cuando"). */
const NEVER_FUZZY = new Set(["ahora", "ahorita", "pasar", "paso", "pero", "objeto", "cuanto", "cuanta", "cuantos", "cuantas"]);

/** Typos allowed by the length of the vocabulary entry: up to 4 letters none, 5 to 7 one, 8 or more two. */
const allowance = (entry: string) => (entry.length <= 4 ? 0 : entry.length <= 7 ? 1 : 2);

/** Singular and plural spellings of an entry (s, es, z to ces). */
function forms(entry: string): string[] {
  const plural = entry.endsWith("z") ? `${entry.slice(0, -1)}ces` : `${entry}es`;
  return [entry, `${entry}s`, plural];
}

/** Optimal string alignment distance: insertion, deletion, substitution or a swap of two adjacent letters is one edit. */
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

const isExact = (word: string, entry: string) => (entry.endsWith("*") ? word.startsWith(entry.slice(0, -1)) : forms(entry).includes(word));

/**
 * The entries a word matches. A "stem*" entry matches an exact prefix; any other entry matches its singular or plural
 * form, or, within the entry's allowance and with the same first letter, a typo of it. A word that exactly matches any
 * entry, or that is never-fuzzy, matches exact entries only, so "lleva" never reaches "llevo" when both are entries.
 */
export function matchWord(word: string, entries: readonly string[]): string[] {
  const exact = entries.filter((entry) => isExact(word, entry));
  if (exact.length || NEVER_FUZZY.has(word)) return exact;
  return entries.filter(
    (entry) => !entry.endsWith("*") && !NEVER_FUZZY.has(entry) && entry[0] === word[0] && forms(entry).some((form) => distance(word, form) <= allowance(entry))
  );
}

/**
 * Multi-word entries found in a text's words: consecutive words, each compared with its own length's allowance. A word
 * is compared with the words every phrase has at that position, so an exact word never fuzzy-matches a rival phrase's
 * ("me llevo" is not "me lleva"). The longest phrase wins and consumes its words (`from` inclusive, `to` exclusive),
 * which later phrases cannot reuse.
 */
export function matchPhrases(tokens: readonly string[], phrases: readonly string[]): { phrase: string; from: number; to: number }[] {
  const consumed = new Set<number>();
  const found: { phrase: string; from: number; to: number }[] = [];
  const split = phrases.map((phrase) => ({ phrase, parts: phrase.split(" ") }));
  const rivals = (k: number) => [...new Set(split.flatMap(({ parts }) => parts.slice(k, k + 1)))];
  for (const { phrase, parts } of [...split].sort((a, b) => b.parts.length - a.parts.length)) {
    for (let from = 0; from + parts.length <= tokens.length; from++) {
      const span = parts.map((_, k) => from + k);
      if (span.some((index) => consumed.has(index)) || !parts.every((part, k) => matchWord(tokens[from + k], rivals(k)).includes(part))) continue;
      span.forEach((index) => consumed.add(index));
      found.push({ phrase, from, to: from + parts.length });
    }
  }
  return found.sort((a, b) => a.from - b.from);
}

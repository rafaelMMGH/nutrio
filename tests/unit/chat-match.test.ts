import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeText, words } from "@/lib/assistant";
import { matchPhrases, matchWord } from "@/lib/domain/chat-match";

// Spec assistant-data-scope REQ-2 matcher table, run on the matcher alone. `entries` is the vocabulary; the row asks whether the word matches the first one.
const TABLE: { word: string; entries: string[]; matches: boolean; why: string }[] = [
  { word: "carito", entries: ["carrito"], matches: true, why: "one deletion" },
  { word: "carrtio", entries: ["carrito"], matches: true, why: "a swap is one edit" },
  { word: "recta", entries: ["receta"], matches: true, why: "one deletion" },
  { word: "desayno", entries: ["desayuno"], matches: true, why: "one deletion" },
  { word: "ejersisio", entries: ["ejercicio"], matches: true, why: "two edits, 9 letters" },
  { word: "horarios", entries: ["horario"], matches: true, why: "plural" },
  { word: "luces", entries: ["luz"], matches: true, why: "z becomes ces" },
  { word: "preparación", entries: ["prepar*"], matches: true, why: "stem prefix" },
  { word: "ahora", entries: ["hora"], matches: false, why: "never-fuzzy" },
  { word: "ahorita", entries: ["hora"], matches: false, why: "never-fuzzy" },
  { word: "pero", entries: ["peso"], matches: false, why: "never-fuzzy" },
  { word: "carritito", entries: ["carrito"], matches: false, why: "two edits, 7 letters" },
  { word: "pasar", entries: ["pesar"], matches: false, why: "never-fuzzy" },
  { word: "paso", entries: ["peso"], matches: false, why: "never-fuzzy" },
  { word: "lleva", entries: ["llevo", "lleva"], matches: false, why: "exact vocabulary word never matches the other entry" },
  { word: "garrito", entries: ["carrito"], matches: false, why: "first letter" },
  { word: "vasto", entries: ["vaso"], matches: false, why: "4 letters are exact only" },
  { word: "objeto", entries: ["objetivo"], matches: false, why: "never-fuzzy" },
  { word: "cuanto", entries: ["cuando"], matches: false, why: "never-fuzzy" },
  { word: "cuántas", entries: ["cuantos"], matches: false, why: "never-fuzzy" },
  { word: "planta", entries: ["plan"], matches: false, why: "a prefix is not a stem match" },
  { word: "prepararse", entries: ["prepar"], matches: false, why: "no star, no prefix" }
];

for (const { word, entries, matches, why } of TABLE) {
  test(`matchWord ${word} ${matches ? "matches" : "does not match"} ${entries.join("/")} (${why})`, () => {
    assert.equal(matchWord(normalizeText(word), entries).includes(entries[0]), matches);
  });
}

test("matchWord returns the entry that matched, and only the exact one when a word equals an entry", () => {
  assert.deepEqual(matchWord("carito", ["carrito", "cena"]), ["carrito"]);
  assert.deepEqual(matchWord("llevo", ["lleva", "llevo"]), ["llevo"]);
  assert.deepEqual(matchWord("preparar", ["prepar*"]), ["prepar*"]);
});

test("a multi-word entry compares each word with its own allowance and consumes the longest phrase", () => {
  const tokens = words("Hola, buenos dias");
  assert.deepEqual(matchPhrases(tokens, ["buenos dias", "dias"]), [{ phrase: "buenos dias", from: 1, to: 3 }]);
  assert.deepEqual(matchPhrases(words("bunos días"), ["buenos dias"]), [{ phrase: "buenos dias", from: 0, to: 2 }]);
  assert.deepEqual(matchPhrases(words("buenas tardes"), ["buenos dias"]), []);
  assert.deepEqual(matchPhrases(words("buenos"), ["buenos dias"]), []);
});

test("an exact word never fuzzy-matches another phrase's word at the same position, whichever order they are listed", () => {
  assert.deepEqual(matchPhrases(["me", "llevo"], ["me lleva", "me llevo"]), [{ phrase: "me llevo", from: 0, to: 2 }]);
  assert.deepEqual(matchPhrases(["me", "lleva"], ["me llevo", "me lleva"]), [{ phrase: "me lleva", from: 0, to: 2 }]);
  assert.deepEqual(matchPhrases(["me", "lleva"], ["me llevo"]), [{ phrase: "me llevo", from: 0, to: 2 }], "alone, lleva is a typo of llevo");
  assert.deepEqual(matchPhrases(["como", "pero"], ["como peso"]), [], "a never-fuzzy word stays exact inside a phrase");
});

test("the same phrase is found twice when the text repeats it", () => {
  assert.deepEqual(matchPhrases(words("hola hola"), ["hola"]), [
    { phrase: "hola", from: 0, to: 1 },
    { phrase: "hola", from: 1, to: 2 }
  ]);
});

test("normalizeText: lowercase, no accents, ñ as n, every other character a space", () => {
  assert.equal(normalizeText("  ¿Qué Hay, Mamá?  "), "que hay mama");
  assert.equal(normalizeText("Cuántas piñas"), "cuantas pinas");
  assert.equal(normalizeText("avena-con/fruta (2)"), "avena con fruta 2");
  assert.equal(normalizeText("¡¿ ?!"), "");
  assert.equal(normalizeText("COLACIÓN"), "colacion");
});

test("normalizeText leaves plurals alone (the matcher folds them)", () => {
  assert.equal(normalizeText("Luces"), "luces");
  assert.deepEqual(words("¿Cuántos días?"), ["cuantos", "dias"]);
});

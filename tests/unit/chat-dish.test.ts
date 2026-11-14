import assert from "node:assert/strict";
import { test } from "node:test";
import { isGeneric, matchDish, rankDish } from "@/lib/domain/chat-dish";
import type { Recipe } from "@/lib/types";
import { memDb } from "./memdb";

// Spec assistant-data-scope REQ-3 table (v1.7), REQ-29 table and the not-a-dish-name rule, on the matcher alone. Expected
// values come from the spec tables, not from the matcher. Recipes are filtered like `ragAnswer` will (T079): owned,
// not deleted, non-generic, in seq (array) order.

const pool = (extras: boolean) => memDb({ extras }).db.recipes.filter((recipe) => !recipe.deleted_at && !isGeneric(recipe.name));
const BASE = pool(false);
const EXTRAS = pool(true);
const adHoc = (...names: string[]): Recipe[] => names.map((name, index) => ({ id: `r${index}`, user_id: "u", name, description: "", canonical_hash: `h${index}`, created_at: "", updated_at: "", deleted_at: null }));

type Shape = ["found", string] | ["didYouMean", ...string[]] | ["none", boolean];
const shape = (phrase: string, recipes: Recipe[]): Shape => {
  const result = matchDish(phrase, recipes);
  if (result.kind === "found") return ["found", result.recipe.name];
  if (result.kind === "didYouMean") return ["didYouMean", ...result.candidates.map((recipe) => recipe.name)];
  return ["none", result.dishName];
};

const BASE_ROWS: [string, Shape][] = [
  ["el pollo asao", ["found", "Pollo asado"]],
  ["el pollo asdao", ["found", "Pollo asado"]],
  ["el sandwich de atun", ["found", "Sándwich de atún"]],
  ["el pollo", ["didYouMean", "Pollo asado", "Ensalada de pollo"]],
  ["la pizza", ["none", true]],
  ["pizza con atún", ["didYouMean", "Sándwich de atún"]],
  ["la opcion 1", ["none", true]]
];
const EXTRAS_ROWS: [string, Shape][] = [
  ["el pollo asado", ["found", "Pollo asado"]],
  ["pollo asado con verduras", ["found", "Pollo asado con verduras"]],
  ["asado pollo", ["found", "Pollo asado"]],
  ["el pollo", ["didYouMean", "Pollo asado", "Ensalada de pollo", "Pollo asado con verduras"]],
  ["la lima", ["found", "Sopa de lima"]],
  ["agua de lima", ["didYouMean", "Sopa de lima"]],
  ["el orno", ["none", true]]
];
const NOT_A_DISH = ["agua", "peso", "plan", "mañana", "segunda colación", "colación 2", "ab", "primer desayuno", "ayer", "hoy", "tarde", "noche", ""];

test("REQ-3 table, base rows on the base fixture", () => {
  for (const [phrase, expected] of BASE_ROWS) assert.deepEqual(shape(phrase, BASE), expected, phrase);
});

test("REQ-3 table, rows with the extra recipes on the extras fixture", () => {
  for (const [phrase, expected] of EXTRAS_ROWS) assert.deepEqual(shape(phrase, EXTRAS), expected, phrase);
});

test("REQ-3 table: every base row but \"el pollo\" gives the same result on the extras fixture", () => {
  for (const [phrase, expected] of BASE_ROWS.filter(([phrase]) => phrase !== "el pollo")) assert.deepEqual(shape(phrase, EXTRAS), expected, phrase);
});

test("not a dish name: no candidate and dishName false, one row per category, on both fixtures", () => {
  for (const recipes of [BASE, EXTRAS]) for (const phrase of NOT_A_DISH) assert.deepEqual(shape(phrase, recipes), ["none", false], JSON.stringify(phrase));
});

test("not a dish name: only all-topic words; extra words keep the phrase a dish name", () => {
  assert.deepEqual(shape("agua de lima", EXTRAS), ["didYouMean", "Sopa de lima"]);
  assert.deepEqual(shape("hoy desayuno", BASE), ["none", false]);
  assert.deepEqual(shape("colaciones", BASE), ["none", false]);
  assert.deepEqual(shape("decima colacion", BASE), ["none", false]);
  assert.deepEqual(shape("el", BASE), ["none", false]);
  assert.deepEqual(shape("pizza ayer", BASE), ["none", true]);
});

test("under 3 characters is not a dish name, 3 characters is", () => {
  assert.deepEqual(shape("te", adHoc("Té verde")), ["none", false]);
  assert.deepEqual(shape("pan", adHoc("Pan tostado")), ["found", "Pan tostado"]);
});

test("rule 1: an exact name beats the not-a-dish-name rule", () => {
  const recipes = adHoc("Desayuno de hoy");
  assert.deepEqual(shape("desayuno de hoy", recipes), ["found", "Desayuno de hoy"]);
  assert.deepEqual(shape("desayuno", recipes), ["none", false]);
});

test("every fixture recipe is found by its own name, with or without accents", () => {
  for (const recipe of EXTRAS) assert.deepEqual(shape(recipe.name, EXTRAS), ["found", recipe.name], recipe.name);
  assert.deepEqual(shape("SANDWICH DE ATUN", EXTRAS), ["found", "Sándwich de atún"]);
});

test("generic names and distractors are never candidates", () => {
  const all = memDb({ extras: true }).db.recipes;
  assert.deepEqual(shape("desayuno opcion 1", all), ["none", true]);
  const distractors = ["Atole de avena", "Chilaquiles verdes", "Tacos de frijol"];
  for (const [phrase] of [...BASE_ROWS, ...EXTRAS_ROWS]) {
    const result = matchDish(phrase, EXTRAS);
    const offered = result.kind === "found" ? [result.recipe] : result.kind === "didYouMean" ? result.candidates : [];
    for (const recipe of offered) assert.ok(!distractors.includes(recipe.name) && !isGeneric(recipe.name), `${phrase}: ${recipe.name}`);
  }
});

test("isGeneric: slot word, \"opcion\" and digits only", () => {
  for (const name of ["Desayuno opcion 1", "Colación opción 12", "comida opcion 7"]) assert.equal(isGeneric(name), true, name);
  for (const name of ["Pollo asado", "Cena opcion", "Cena opcion 2 con pollo", "Opcion 1"]) assert.equal(isGeneric(name), false, name);
});

test("a soft-deleted recipe is never a candidate, not even an exact one", () => {
  const recipes = pool(false).map((recipe) => (recipe.name === "Pollo asado" ? { ...recipe, deleted_at: "2026-10-01T00:00:00.000Z" } : recipe));
  assert.deepEqual(shape("el pollo asao", recipes), ["didYouMean", "Ensalada de pollo"]);
  assert.deepEqual(shape("pollo asado", recipes), ["didYouMean", "Ensalada de pollo"]);
});

test("word match is symmetric: the typo allowance may come from the phrase word or from the name word", () => {
  assert.deepEqual(shape("pollo asao", adHoc("Pollo asado")), ["found", "Pollo asado"]);
  assert.deepEqual(shape("pollo asado", adHoc("Pollo asao")), ["found", "Pollo asao"]);
  // 2 edits: allowed only by the 8-letter word, which is the name word in one row and the phrase word in the other.
  assert.deepEqual(shape("ensald", adHoc("Ensalada")), ["found", "Ensalada"]);
  assert.deepEqual(shape("ensalada", adHoc("Ensald")), ["found", "Ensald"]);
});

test("a phrase word counts once in recall, however many name words it matches", () => {
  // "pollo" fuzzy-matches both "polla" and "polle": recall 1, precision 2/4, behind "Asado pollo" (recall 1, precision 1).
  assert.deepEqual(shape("pollo asado", adHoc("Polla polle asada asado", "Asado pollo")), ["found", "Asado pollo"]);
});

test("the first letter must match, in either direction", () => {
  assert.deepEqual(shape("esado", adHoc("Pollo asado")), ["none", true]);
  assert.deepEqual(shape("hornillo", adHoc("Pan de ornillo")), ["none", true]);
  assert.deepEqual(shape("ornillo", adHoc("Pan de hornillo")), ["none", true]);
});

test("exact-wins is per name: an exact word never fuzzy-matches another word of that name", () => {
  // "pollo" equals a word of "Pollo polla" and so does not also match "polla": precision 1/2, a tie with "Pollo asado".
  assert.deepEqual(shape("pollo", adHoc("Pollo asado", "Pollo polla")), ["didYouMean", "Pollo asado", "Pollo polla"]);
});

test("exact-wins never blocks fuzzy matches against other recipes' names", () => {
  assert.deepEqual(shape("pollo", adHoc("Pollo asado", "Polla verde")), ["didYouMean", "Pollo asado", "Polla verde"]);
});

test("REQ-3 stop words al, y and a are removed from the phrase", () => {
  for (const stop of ["al", "y", "a"]) assert.deepEqual(shape(`pan ${stop} queso`, adHoc("Pan queso", "Pan queso extra")), ["found", "Pan queso"], stop);
});

test("REQ-3 stop words al, y and a are removed from the recipe names", () => {
  for (const stop of ["al", "y", "a"]) assert.deepEqual(shape("pan queso", adHoc(`Pan ${stop} queso`, "Pan queso extra")), ["found", `Pan ${stop} queso`], stop);
});

test("the usual stop words (el, de, con, la, ...) are removed from the phrase and from names", () => {
  assert.deepEqual(shape("el pan con queso de la casa", adHoc("Pan queso casa", "Pan queso casa extra")), ["found", "Pan queso casa"]);
});

test("tied candidates follow the recipes array order, at most 3 are offered", () => {
  const names = ["Taco uno", "Taco dos", "Taco tres", "Taco cuatro"];
  assert.deepEqual(shape("taco", adHoc(...names)), ["didYouMean", "Taco uno", "Taco dos", "Taco tres"]);
  assert.deepEqual(shape("taco", adHoc(...[...names].reverse())), ["didYouMean", "Taco cuatro", "Taco tres", "Taco dos"]);
});

test("a tie on recall and precision never opens a dish, whatever the order", () => {
  assert.deepEqual(shape("pollo", adHoc("Pollo rojo", "Pollo azul")), ["didYouMean", "Pollo rojo", "Pollo azul"]);
});

test("ranking: recall first, then precision, then array order", () => {
  // "pollo asado frito": Pollo asado frito (recall 3/3), Pollo asado (2/3, precision 1), the long one (2/3, precision 1/2), Pollo (1/3).
  const recipes = adHoc("Pollo", "Pollo asado verde y rojo", "Pollo asado", "Pollo asado frito");
  assert.deepEqual(shape("pollo asado frito", recipes), ["found", "Pollo asado frito"]);
  assert.deepEqual(rankDish("pollo asado frito", recipes).map((recipe) => recipe.name), ["Pollo asado frito", "Pollo asado", "Pollo asado verde y rojo"]);
});

test("a candidate with a missing word is offered, never opened, even alone", () => {
  assert.deepEqual(shape("pollo frito", adHoc("Pollo asado")), ["didYouMean", "Pollo asado"]);
});

test("recall 1 with a second candidate strictly worse on recall opens the first", () => {
  // "pollo atun": Pollo con atun has both words; Pollo asado only one (recall 1/2, lower).
  assert.deepEqual(shape("pollo atun", adHoc("Pollo asado", "Pollo con atun extra", "Ensalada verde")), ["found", "Pollo con atun extra"]);
});

test("recall 1 with a second candidate of equal recall and lower precision opens the first", () => {
  assert.deepEqual(shape("pollo", adHoc("Pollo asado con verduras", "Pollo asado")), ["found", "Pollo asado"]);
});

test("REQ-29: rankDish over the whole question, candidates only, never a found", () => {
  const ranked = (question: string) => rankDish(question, BASE).map((recipe) => recipe.name);
  assert.deepEqual(ranked("una ensalada rica"), ["Ensalada de pollo"]);
  assert.deepEqual(ranked("pollo atún ensalada"), ["Ensalada de pollo", "Pollo asado", "Sándwich de atún"]);
  assert.deepEqual(ranked("estoy buscando algo rico con atún"), ["Sándwich de atún"]);
  assert.deepEqual(ranked("¿Cuál es la capital de Francia?"), []);
});

test("rankDish keeps the not-a-dish-name rule and ranks an exact name like any other candidate", () => {
  assert.deepEqual(rankDish("agua", BASE), []);
  assert.deepEqual(rankDish("agua", adHoc("Agua fresca")), []);
  assert.deepEqual(rankDish("", BASE), []);
  assert.deepEqual(rankDish("sandwich de atun", BASE).map((recipe) => recipe.name), ["Sándwich de atún"]);
  assert.equal(rankDish("taco", adHoc("Taco uno", "Taco dos", "Taco tres", "Taco cuatro")).length, 3);
});

// Terms "generic name": a slot word or the plan's own slot name, then "opcion" and a number (BUG-B8).
test("isGeneric: a custom slot name of the plan counts as a slot word", () => {
  assert.equal(isGeneric("Postre opcion 1"), false, "unknown without the plan's slot names");
  assert.equal(isGeneric("Postre opción 1", ["Postre"]), true);
  assert.equal(isGeneric("postre opcion 12", ["Postre", "Cena"]), true);
  assert.equal(isGeneric("Colación pre-entreno opcion 2", ["Colación pre-entreno"]), true, "a multi-word slot name");
  assert.equal(isGeneric("Postre de fresa", ["Postre"]), false);
  assert.equal(isGeneric("Postre opcion", ["Postre"]), false);
  assert.equal(isGeneric("Postre opcion 2 con fresa", ["Postre"]), false);
  assert.equal(isGeneric("Opcion 1", ["Postre"]), false);
});

test("a generic name of a custom slot is never a candidate once the plan's slot names are known", () => {
  const recipes = adHoc("Postre opcion 1", "Pollo asado");
  assert.deepEqual(shape("postre opcion 1", recipes), ["found", "Postre opcion 1"], "without the slot names it is still a plain recipe name");
  const result = matchDish("postre opcion 1", recipes, ["Postre"]);
  assert.deepEqual(result, { kind: "none", dishName: true });
  assert.deepEqual(rankDish("postre opcion 1", recipes, ["Postre"]), []);
});

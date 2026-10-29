import assert from "node:assert/strict";
import { test } from "node:test";
import { RECORD_KEYS } from "../shared/assistant-fixture";
import { memDb } from "./memdb";

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

test("default fixture: 19 generic recipes, 3 table recipes and 4 distractors", () => {
  const { db } = memDb();
  const recipes = names(db.recipes);
  assert.equal(recipes.length, 26);
  assert.equal(recipes.filter((name) => /^(Desayuno|Colacion|Comida|Cena) opcion \d+$/.test(name)).length, 19);
  for (const name of ["Pollo asado", "Ensalada de pollo", "Sándwich de atún"]) assert.ok(recipes.includes(name), name);
  for (const name of ["Sopa de lima", "Atole de avena", "Chilaquiles verdes", "Tacos de frijol"]) assert.ok(recipes.includes(name), name);
  assert.equal(db.ingredientUsages.filter((usage) => usage.source_type === "recipe").length, 52);
});

test("slots, option numbers and the recipes outside the plan", () => {
  const { db } = memDb();
  const version = db.planVersions[0];
  assert.equal(db.planVersions.length, 1);
  assert.equal(version.is_current, true);
  assert.deepEqual(db.mealTypes.map((meal) => [meal.name, meal.display_order, meal.time_window]), [
    ["Desayuno", 0, "Entre 7 a 8 am"],
    ["Colación", 1, "Entre 10 a 11 am"],
    ["Comida", 2, "Entre 2 a 3 pm"],
    ["Cena", 3, "Entre 8 a 9 pm"]
  ]);
  const idOf = (name: string) => db.recipes.find((recipe) => recipe.name === name)!.id;
  const optionOf = (name: string) => db.mealOptions.find((option) => option.recipe_id === idOf(name));
  assert.equal(db.mealOptions.length, 24);
  assert.equal(db.planVersionRecipes.length, 24);
  assert.deepEqual([optionOf("Pollo asado")!.meal_type_id, optionOf("Pollo asado")!.option_number], [db.mealTypes[2].id, 6]);
  assert.equal(optionOf("Ensalada de pollo")!.option_number, 7);
  assert.deepEqual([optionOf("Sándwich de atún")!.meal_type_id, optionOf("Sándwich de atún")!.option_number], [db.mealTypes[3].id, 5]);
  assert.deepEqual([optionOf("Atole de avena")!.meal_type_id, optionOf("Atole de avena")!.option_number], [db.mealTypes[0].id, 6]);
  assert.equal(optionOf("Chilaquiles verdes"), undefined);
  assert.equal(optionOf("Tacos de frijol"), undefined);
  assert.deepEqual(db.planVersionRecipes.map((row) => row.option_number), db.mealOptions.map((row) => row.option_number));
});

test("add-ons: one on the first slot, a quantity-only one on the last, each with an add_on usage", () => {
  const { db } = memDb();
  assert.deepEqual(db.sharedAddOns.map((addOn) => [addOn.name, addOn.meal_type_id]), [
    ["Agua natural", db.mealTypes[0].id],
    ["Fruta de temporada", db.mealTypes[3].id]
  ]);
  const usages = db.ingredientUsages.filter((usage) => usage.source_type === "add_on");
  assert.deepEqual(usages.map((usage) => [usage.quantity, usage.unit]), [[1, "vaso"], [2, ""]]);
});

test("options: meals, times, fixture, supplements, objective, name, goals, logs and cart", () => {
  const { db, user } = memDb({
    meals: ["Desayuno", "Cena"],
    times: "some",
    fixture: false,
    supplements: false,
    objective: "Bajar de peso",
    name: "Ana",
    goals: { weight: 60, days: 3 },
    logs: [{ date: "2026-10-28", meals_done: ["Desayuno"], water_glasses: 3 }],
    cart: 2
  });
  assert.deepEqual(db.mealTypes.map((meal) => meal.time_window), ["Entre 7 a 8 am", ""]);
  assert.equal(db.recipes.length, 0);
  assert.equal(db.sharedAddOns.length, 0);
  assert.deepEqual(db.planVersions[0].structured_data.supplements, []);
  assert.equal(db.plans[0].objective, "Bajar de peso");
  assert.deepEqual([user.name, user.weight_goal_kg, user.activity_goal_days], ["Ana", 60, 3]);
  assert.equal(db.users.length, 1);
  assert.deepEqual(db.dailyLogs.map((log) => [log.date, log.meals_done, log.water_glasses, log.weight_kg, log.exercised]), [["2026-10-28", ["Desayuno"], 3, null, false]]);
  assert.deepEqual(db.cartItems.map((item) => [item.manual_name, item.manual_quantity]), [["Ingrediente 01", 1], ["Ingrediente 02", 2]]);
});

test("every collection's record keys equal the keys the SQL seed's rows produce through toRecord", () => {
  const { db } = memDb({ logs: [{ date: "2026-10-28" }], cart: 1 });
  for (const [collection, keys] of Object.entries(RECORD_KEYS)) {
    const records = (db as unknown as Record<string, Record<string, unknown>[]>)[collection];
    assert.ok(records.length > 0, `${collection} is empty`);
    for (const record of records) assert.deepEqual(Object.keys(record).sort(), [...keys].sort(), collection);
  }
});

test("times: none leaves every slot without a time window", () => {
  const { db } = memDb({ times: "none" });
  assert.deepEqual(db.mealTypes.map((meal) => meal.time_window), ["", "", "", ""]);
});

test("ids follow the scheme the SQL seed uses", () => {
  const { db, user } = memDb();
  const versionId = db.planVersions[0].id;
  const recipe = db.recipes.find((row) => row.name === "Pollo asado")!;
  assert.equal(recipe.id, `${user.id}-rec-pollo-asado`);
  assert.equal(db.mealOptions.find((row) => row.recipe_id === recipe.id)!.id, `${recipe.id}-opt`);
  assert.equal(db.planVersionRecipes.find((row) => row.recipe_id === recipe.id)!.id, `${recipe.id}-pvr`);
  assert.deepEqual(db.mealTypes.map((meal) => meal.id), [0, 1, 2, 3].map((index) => `${versionId}-meal-${index}`));
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chefSelection, dashboardSummary } from "@/lib/domain/queries";
import { dishRecipes, listRecipes } from "@/lib/domain/plans";
import { isDish } from "@/lib/recipes";
import { emptyDb } from "@/lib/storage/db";
import type { AppDb } from "@/lib/types";

describe("isDish", () => {
  it("needs more than one ingredient", () => {
    assert.equal(isDish(0), false);
    assert.equal(isDish(1), false);
    assert.equal(isDish(2), true);
  });
});

// Recipes "r1".."rN" with the given number of live ingredient rows; extra options add deleted rows and rows of other sources.
function dbWith(recipes: { id: string; ingredients: number; deleted?: boolean; user?: string; deletedUsages?: number }[]): AppDb {
  const db = emptyDb();
  for (const [index, recipe] of recipes.entries()) {
    db.recipes.push({ id: recipe.id, user_id: recipe.user ?? "u1", name: `Receta ${recipe.id}`, created_at: `2026-11-0${index + 1}T00:00:00Z`, deleted_at: recipe.deleted ? "2026-11-10T00:00:00Z" : null } as never);
    const rows = Array.from({ length: recipe.ingredients + (recipe.deletedUsages ?? 0) }, (_, row) => ({
      id: `${recipe.id}-${row}`,
      source_type: "recipe",
      source_id: recipe.id,
      deleted_at: row < recipe.ingredients ? null : "2026-11-10T00:00:00Z"
    }));
    db.ingredientUsages.push(...(rows as never[]));
  }
  return db;
}

describe("dishRecipes", () => {
  it("keeps recipes with two or more live ingredients, in order", () => {
    const db = dbWith([{ id: "a", ingredients: 0 }, { id: "b", ingredients: 1 }, { id: "c", ingredients: 2 }, { id: "d", ingredients: 5 }]);
    assert.deepEqual(dishRecipes(db, "u1").map((recipe) => recipe.id), ["c", "d"]);
  });
  it("does not count deleted ingredient rows, deleted recipes or other users' recipes", () => {
    const db = dbWith([{ id: "a", ingredients: 1, deletedUsages: 3 }, { id: "b", ingredients: 3, deleted: true }, { id: "c", ingredients: 3, user: "u2" }, { id: "d", ingredients: 2 }]);
    assert.deepEqual(dishRecipes(db, "u1").map((recipe) => recipe.id), ["d"]);
  });
  it("ignores usages that belong to another kind of source", () => {
    const db = dbWith([{ id: "a", ingredients: 1 }]);
    db.ingredientUsages.push({ id: "x", source_type: "cart", source_id: "a", deleted_at: null } as never);
    assert.deepEqual(dishRecipes(db, "u1"), []);
  });
  it("returns the same ids in the same order as listRecipes filtered with isDish", () => {
    const db = dbWith([
      { id: "a", ingredients: 2, deletedUsages: 2 },
      { id: "b", ingredients: 1, deletedUsages: 4 },
      { id: "c", ingredients: 3, deleted: true },
      { id: "d", ingredients: 5, user: "u2" },
      { id: "e", ingredients: 1 },
      { id: "f", ingredients: 4 }
    ]);
    // A usage of another source type must not count, and duplicated ingredient rows each count once.
    db.ingredientUsages.push({ id: "x", source_type: "cart", source_id: "e", deleted_at: null } as never);
    db.ingredientUsages.push({ id: "f-dup-1", source_type: "recipe", source_id: "f", ingredient_id: "i1", deleted_at: null } as never);
    db.ingredientUsages.push({ id: "f-dup-2", source_type: "recipe", source_id: "f", ingredient_id: "i1", deleted_at: null } as never);
    const expected = listRecipes(db, "u1").filter((recipe) => isDish(recipe.ingredients.length)).map((recipe) => recipe.id);
    assert.deepEqual(expected, ["a", "f"]);
    assert.deepEqual(dishRecipes(db, "u1").map((recipe) => recipe.id), expected);
  });
});

describe("recipes in the top bar and the dashboard", () => {
  const db = dbWith([{ id: "a", ingredients: 2 }, { id: "b", ingredients: 3 }, { id: "c", ingredients: 1 }, { id: "d", ingredients: 2 }, { id: "e", ingredients: 4 }, { id: "f", ingredients: 0 }]);
  it("chef selection shows the three newest qualifying recipes and counts the rest from qualifying ones", () => {
    const chef = chefSelection(db, "u1");
    assert.deepEqual(chef.latest.map((recipe) => recipe.id), ["e", "d", "b"]);
    assert.equal(chef.rest, 1);
  });
  it("chef selection with fewer than three qualifying recipes shows them all and counts none as rest", () => {
    const few = dbWith([{ id: "a", ingredients: 1 }, { id: "b", ingredients: 2 }, { id: "c", ingredients: 0 }]);
    const chef = chefSelection(few, "u1");
    assert.deepEqual(chef.latest.map((recipe) => recipe.id), ["b"]);
    assert.equal(chef.rest, 0);
  });
  it("dashboard recipe count matches the same rule", () => {
    assert.equal(dashboardSummary(db, "u1").recipesCount, 4);
  });
});

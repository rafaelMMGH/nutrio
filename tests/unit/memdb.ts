import type { AppDb, AppUser, IngredientUsage, Plan } from "@/lib/types";
import { emptyDb } from "@/lib/storage/db";
import { addOnSpecs, DEFAULT_MEALS, PLAN_NAME, planFixture, slug, TIME_WINDOWS, type SeedLog, type SeedRecipe } from "../shared/assistant-fixture";

// An in-memory AppDb with the same ids and fields as the e2e SQL seed (tests/e2e/assistant-helpers.ts: createChatUser,
// seedRecipes, seedPlan, seedCart, seedLogs, setGoals, setName), so unit tests run the domain code over what e2e seeds.
// Value formats the database owns (timestamps, dates as Date objects) are only proven by e2e (plan Risks).

export type MemDbOptions = {
  meals?: string[];
  /** `all`: every meal has a time window; `some`: only the first and third; `none`: no meal has one. Default `all`. */
  times?: "all" | "some" | "none";
  /** The recipe fixture of `planFixture`, wired into the plan. Default true (the e2e `seedPlan` defaults to false). */
  fixture?: boolean;
  supplements?: boolean;
  objective?: string;
  recommendations?: string;
  logs?: SeedLog[];
  goals?: { weight?: number | null; days?: number };
  name?: string;
  /** Number of manual items "Ingrediente 01"… in the active cart. */
  cart?: number;
};

const STAMP = "2026-01-01T00:00:00.000Z";
const USER_ID = "chat-e2e-memdb";

export function memDb({
  meals = DEFAULT_MEALS,
  times = "all",
  fixture = true,
  supplements = true,
  objective = "Mejorar mi energía",
  recommendations = "Tomar agua durante el día",
  logs = [],
  goals = {},
  name = "Asistente memdb",
  cart = 0
}: MemDbOptions = {}): { db: AppDb; user: AppUser } {
  const db = emptyDb();
  const user: AppUser = {
    id: USER_ID,
    email: "asistente-e2e-memdb@local",
    name,
    weight_goal_kg: goals.weight ?? null,
    activity_goal_days: goals.days ?? 4,
    created_at: STAMP,
    updated_at: STAMP,
    deleted_at: null
  };
  db.users = [user];

  const cartId = `${USER_ID}-cart`;
  db.carts = [{ id: cartId, user_id: USER_ID, status: "active", created_at: STAMP, updated_at: STAMP, deleted_at: null }];
  for (let position = 1; position <= cart; position++) {
    db.cartItems.push({
      id: `${cartId}-item-${position}`,
      cart_id: cartId,
      source_type: "manual",
      source_id: null,
      quantity_multiplier: 1,
      period_days: 1,
      training_days: 0,
      selected_alternatives: {},
      include_add_ons: false,
      include_supplements: false,
      manual_name: `Ingrediente ${String(position).padStart(2, "0")}`,
      manual_quantity: position,
      manual_unit: "g",
      manual_ingredient_id: null,
      created_at: STAMP,
      updated_at: STAMP,
      deleted_at: null
    });
  }

  const usage = (id: string, ingredientId: string, sourceType: string, sourceId: string, quantity: number, unit: string): IngredientUsage => ({
    id,
    ingredient_id: ingredientId,
    source_type: sourceType,
    source_id: sourceId,
    quantity,
    unit,
    practical_quantity: null,
    practical_unit: null,
    notes: "",
    is_optional: false,
    alternative_group_id: null,
    confidence_score: 1,
    requires_review: false,
    created_at: STAMP,
    deleted_at: null
  });

  const placed = fixture ? planFixture(meals) : [];
  const recipeIds: Record<string, string> = {};
  for (const { recipe } of placed) {
    const recipeId = `${USER_ID}-rec-${slug(recipe.name)}`;
    recipeIds[recipe.name] = recipeId;
    db.recipes.push({ id: recipeId, user_id: USER_ID, name: recipe.name, description: recipe.description ?? "", canonical_hash: slug(recipe.name), created_at: STAMP, updated_at: STAMP, deleted_at: null });
    recipe.ingredients.forEach((ingredient: SeedRecipe["ingredients"][number], index) => {
      const ingredientId = `${USER_ID}-ing-${slug(ingredient.name)}`;
      const unit = ingredient.unit ?? "g";
      const category = ingredient.category ?? "Otros";
      // The seed upserts the ingredient: the first insert fixes the unit, a later one only updates the category.
      const existing = db.ingredients.find((row) => row.id === ingredientId);
      if (existing) existing.category = category;
      else db.ingredients.push({ id: ingredientId, user_id: USER_ID, canonical_name: ingredient.name, category, primary_unit: unit, created_at: STAMP, updated_at: STAMP, deleted_at: null });
      db.ingredientUsages.push(usage(`${recipeId}-use-${index}`, ingredientId, "recipe", recipeId, ingredient.quantity ?? 100, unit));
    });
  }

  const planId = `${USER_ID}-plan`;
  const versionId = `${planId}-v1`;
  const windows = meals.map((_, index) => (times === "all" || (times === "some" && index % 2 === 0) ? TIME_WINDOWS[index % TIME_WINDOWS.length] : ""));
  // The seed writes processing_status 'ready', which the Plan type does not list; no domain code reads it.
  db.plans.push({ id: planId, user_id: USER_ID, name: PLAN_NAME, objective, status: "active", processing_status: "ready" as Plan["processing_status"], created_at: STAMP, updated_at: STAMP, deleted_at: null });
  db.planVersions.push({
    id: versionId,
    plan_id: planId,
    version_number: 1,
    structured_data: {
      name: PLAN_NAME,
      objective,
      diagnosis: "",
      recommendations,
      supplements: supplements ? [{ name: "Vitamina D", quantity: 1, unit: "cápsula" }] : [],
      nutrition_summary: {},
      meals: meals.map((mealName, index) => ({ name: mealName, time_window: windows[index], options: [] }))
    },
    change_summary: "",
    is_current: true,
    created_at: STAMP,
    updated_at: STAMP,
    deleted_at: null
  });
  meals.forEach((mealName, index) => {
    db.mealTypes.push({ id: `${versionId}-meal-${index}`, plan_version_id: versionId, name: mealName, display_order: index, time_window: windows[index], created_at: STAMP, deleted_at: null });
  });
  for (const { recipe, slot, option } of placed) {
    if (slot === null) continue;
    const mealId = `${versionId}-meal-${slot}`;
    const recipeId = recipeIds[recipe.name];
    db.mealOptions.push({ id: `${recipeId}-opt`, plan_version_id: versionId, meal_type_id: mealId, recipe_id: recipeId, option_number: option, is_unique_option: false, created_at: STAMP, deleted_at: null });
    db.planVersionRecipes.push({ id: `${recipeId}-pvr`, plan_version_id: versionId, recipe_id: recipeId, meal_type_id: mealId, option_number: option, created_at: STAMP, deleted_at: null });
  }
  if (fixture) {
    for (const { name: addOnName, slot, quantity, unit } of addOnSpecs(meals)) {
      const addOnId = `${versionId}-addon-${slug(addOnName)}`;
      const ingredientId = `${USER_ID}-ing-${slug(addOnName)}`;
      db.sharedAddOns.push({
        id: addOnId,
        plan_version_id: versionId,
        meal_type_id: `${versionId}-meal-${slot}`,
        name: addOnName,
        applies_to_all_options: true,
        required: false,
        notes: "",
        canonical_hash: slug(addOnName),
        created_at: STAMP,
        deleted_at: null
      });
      // `on conflict do nothing`: an ingredient that already exists keeps its category and unit.
      if (!db.ingredients.some((row) => row.id === ingredientId)) {
        db.ingredients.push({ id: ingredientId, user_id: USER_ID, canonical_name: addOnName, category: "Otros", primary_unit: unit, created_at: STAMP, updated_at: STAMP, deleted_at: null });
      }
      db.ingredientUsages.push(usage(`${addOnId}-use`, ingredientId, "add_on", addOnId, quantity, unit));
    }
  }

  for (const { date, meals_done = [], water_glasses = 0, weight_kg = null, exercised = false } of logs) {
    db.dailyLogs.push({ id: `${USER_ID}-log-${date}`, user_id: USER_ID, date, meals_done, water_glasses, weight_kg, exercised, created_at: STAMP, updated_at: STAMP });
  }
  return { db, user };
}

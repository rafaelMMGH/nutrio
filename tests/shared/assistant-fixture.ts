// The deterministic assistant fixture (REQ-3 table). Pure data, no Playwright or SQL import: tests/e2e/assistant-helpers.ts
// turns it into rows (seedPlan) and tests/unit/memdb.ts into an in-memory AppDb, so the two cannot drift (plan D10).

export type SeedRecipe = {
  name: string;
  /** Preparation text; empty by default. */
  description?: string;
  /** `category: "Proteínas"` makes the recipe have a protein (the recipe page then offers "¿Cuánto <proteína> lleva?"). */
  ingredients: { name: string; quantity?: number; unit?: string; category?: string }[];
};

export const slug = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type SeedLog = { date: string; meals_done?: string[]; water_glasses?: number; weight_kg?: number | null; exercised?: boolean };

export const PLAN_NAME = "Plan e2e del asistente";
export const DEFAULT_MEALS = ["Desayuno", "Colación", "Comida", "Cena"];
export const TIME_WINDOWS = ["Entre 7 a 8 am", "Entre 10 a 11 am", "Entre 2 a 3 pm", "Entre 8 a 9 pm"];

const unaccent = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export type Placed = { recipe: SeedRecipe; /** Index into `meals`, or null for a recipe outside the plan. */ slot: number | null; option: number };

/**
 * The deterministic recipe fixture of the REQ-3 table, in insertion order: 19 generic names ("Desayuno opcion 1",
 * round-robin over the slots, numbered per name so duplicate slots never collide), "Pollo asado", "Ensalada de pollo"
 * and "Sándwich de atún", then the distractors "Atole de avena" (planned), "Chilaquiles verdes" and "Tacos de frijol"
 * (recipe book only). The distractors share no word and no near spelling with any phrase of the REQ-3 or REQ-29 tables.
 * `extras: true` appends "Pollo asado con verduras", "Sopa de lima" and "Pan de horno" outside the plan (the "With the
 * extra recipes" rows), so slots and option numbers are identical in both fixtures. Ingredients cover quantity + unit,
 * quantity only (unit "") and neither (0, ""); descriptions are filled, empty or an "Extraído de" import note.
 */
export function planFixture(meals: string[], { extras = false }: { extras?: boolean } = {}): Placed[] {
  const placed: Placed[] = [];
  const perSlot = meals.map(() => 0);
  const perName = new Map<string, number>();
  const variants: SeedRecipe["ingredients"][] = [
    [{ name: "Huevo", quantity: 2, unit: "pieza", category: "Proteínas" }, { name: "Aguacate", quantity: 1, unit: "" }],
    [{ name: "Avena", quantity: 40, unit: "g" }, { name: "Canela", quantity: 0, unit: "" }],
    [{ name: "Frijoles", quantity: 1, unit: "taza" }, { name: "Sal", quantity: 0, unit: "" }]
  ];
  const descriptions = ["", "Mezcla todo. Sirve caliente.", "Extraído de plan.pdf"];
  const add = (name: string, slot: number | null, index: number, description = descriptions[index % 3]) => {
    const option = slot === null ? 0 : ++perSlot[slot];
    placed.push({ recipe: { name, description, ingredients: variants[index % 3] }, slot, option });
  };
  const slotOf = (word: string) => {
    const found = meals.findIndex((meal) => unaccent(meal).toLowerCase() === word);
    return found === -1 ? meals.length - 1 : found;
  };
  // With no meals at all (meals: []) every recipe stays outside the plan.
  const planned = (word: string) => (meals.length ? slotOf(word) : null);
  for (let index = 0; meals.length && index < 19; index++) {
    const base = `${unaccent(meals[index % meals.length])} opcion`;
    const number = (perName.get(base) ?? 0) + 1;
    perName.set(base, number);
    add(`${base} ${number}`, index % meals.length, index);
  }
  const steps = "Sazona el pollo. Hornea 30 minutos. Sirve con limón.";
  add("Pollo asado", planned("comida"), 0, steps);
  add("Ensalada de pollo", planned("comida"), 1, steps);
  add("Sándwich de atún", planned("cena"), 2, steps);
  add("Atole de avena", planned("desayuno"), 1);
  add("Chilaquiles verdes", null, 2);
  add("Tacos de frijol", null, 0);
  if (extras) {
    add("Pollo asado con verduras", null, 0, steps);
    add("Sopa de lima", null, 1);
    add("Pan de horno", null, 2);
  }
  return placed;
}

/**
 * A complement on the first slot ("Agua natural · 1 vaso") and a quantity-only one on the last; each gets an `add_on` usage.
 * The add-on `name` differs from its `ingredient`, so a test can tell which one an answer shows. None without meals.
 */
export function addOnSpecs(meals: string[]) {
  if (!meals.length) return [];
  return [
    { name: "Complemento del desayuno", ingredient: "Agua natural", slot: 0, quantity: 1, unit: "vaso" },
    { name: "Complemento de la cena", ingredient: "Fruta de temporada", slot: meals.length - 1, quantity: 2, unit: "" }
  ];
}

/**
 * The record keys each seeded collection has after `toRecord` (src/lib/storage/store.ts): the model's columns without
 * `seq`, `extra` replaced by its keys (none are seeded), and `name_snapshot`/`category_snapshot` omitted while null.
 * Kept here, beside the seed, so tests/unit/memdb.test.ts can check `memDb()` against it without importing Prisma. Update
 * it with prisma/schema.prisma or a seeded column; the e2e run is what proves the seed really produces these keys.
 */
export const RECORD_KEYS = {
  users: ["id", "email", "name", "weight_goal_kg", "activity_goal_days", "created_at", "updated_at", "deleted_at"],
  plans: ["id", "user_id", "name", "objective", "status", "processing_status", "created_at", "updated_at", "deleted_at"],
  planVersions: ["id", "plan_id", "version_number", "structured_data", "change_summary", "is_current", "created_at", "updated_at", "deleted_at"],
  mealTypes: ["id", "plan_version_id", "name", "display_order", "time_window", "created_at", "deleted_at"],
  recipes: ["id", "user_id", "name", "description", "canonical_hash", "created_at", "updated_at", "deleted_at"],
  ingredients: ["id", "user_id", "canonical_name", "category", "primary_unit", "created_at", "updated_at", "deleted_at"],
  ingredientUsages: [
    "id", "ingredient_id", "source_type", "source_id", "quantity", "unit", "practical_quantity", "practical_unit", "notes", "is_optional",
    "alternative_group_id", "confidence_score", "requires_review", "created_at", "deleted_at"
  ],
  mealOptions: ["id", "plan_version_id", "meal_type_id", "recipe_id", "option_number", "is_unique_option", "created_at", "deleted_at"],
  planVersionRecipes: ["id", "plan_version_id", "recipe_id", "meal_type_id", "option_number", "created_at", "deleted_at"],
  sharedAddOns: ["id", "plan_version_id", "meal_type_id", "name", "applies_to_all_options", "required", "notes", "canonical_hash", "created_at", "deleted_at"],
  carts: ["id", "user_id", "status", "created_at", "updated_at", "deleted_at"],
  cartItems: [
    "id", "cart_id", "source_type", "source_id", "quantity_multiplier", "period_days", "training_days", "selected_alternatives", "include_add_ons",
    "include_supplements", "manual_name", "manual_quantity", "manual_unit", "manual_ingredient_id", "created_at", "updated_at", "deleted_at"
  ],
  dailyLogs: ["id", "user_id", "date", "meals_done", "water_glasses", "weight_kg", "exercised", "created_at", "updated_at"]
} as const;

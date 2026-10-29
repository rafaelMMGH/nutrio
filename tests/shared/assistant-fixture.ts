// The deterministic assistant fixture (REQ-3 table). Pure data, no Playwright or SQL import: tests/e2e/assistant-helpers.ts
// turns it into rows (seedPlan) and tests/unit/memdb.ts into an in-memory AppDb, so the two cannot drift (plan D10).

export type SeedRecipe = {
  name: string;
  /** Preparation text; empty by default. */
  description?: string;
  /** `category: "Proteínas"` makes the recipe have a protein (the recipe page then offers "¿Cuánto <proteína> lleva?"). */
  ingredients: { name: string; quantity?: number; unit?: string; category?: string }[];
};

export const PLAN_NAME = "Plan e2e del asistente";
export const DEFAULT_MEALS = ["Desayuno", "Colación", "Comida", "Cena"];
export const TIME_WINDOWS = ["Entre 7 a 8 am", "Entre 10 a 11 am", "Entre 2 a 3 pm", "Entre 8 a 9 pm"];

const unaccent = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export type Placed = { recipe: SeedRecipe; /** Index into `meals`, or null for a recipe outside the plan. */ slot: number | null; option: number };

/**
 * The deterministic recipe fixture of the REQ-3 table: 19 generic names ("Desayuno opcion 1", round-robin over the
 * slots, numbered per name so duplicate slots never collide), "Pollo asado", "Ensalada de pollo" and "Sándwich de atún",
 * and distractors that must never be a candidate for any REQ-3 phrase: "Sopa de lima", "Atole de avena", "Chilaquiles
 * verdes" and "Tacos de frijol". They share no word and no near spelling with "pollo asado", "sandwich de atun" or
 * "pizza"; the first two are planned, the last two only in the recipe book. Ingredients cover quantity + unit, quantity
 * only (unit "") and neither (0, ""); descriptions are filled, empty or an "Extraído de" import note.
 */
export function planFixture(meals: string[]): Placed[] {
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
  add("Sopa de lima", planned("comida"), 0);
  add("Atole de avena", planned("desayuno"), 1);
  add("Chilaquiles verdes", null, 2);
  add("Tacos de frijol", null, 0);
  return placed;
}

/** A complement on the first slot ("Agua natural · 1 vaso") and a quantity-only one on the last; each gets an `add_on` usage. None without meals. */
export function addOnSpecs(meals: string[]) {
  if (!meals.length) return [];
  return [
    { name: "Agua natural", slot: 0, quantity: 1, unit: "vaso" },
    { name: "Fruta de temporada", slot: meals.length - 1, quantity: 2, unit: "" }
  ];
}

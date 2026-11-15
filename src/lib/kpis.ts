// Numbers and short context lines for the dashboard's KPI tiles. Pure, so the server and the client render the same text.

// Done ids that belong to today's meals; ids left over from a replaced plan do not count.
export function countDoneToday(mealIds: string[], doneIds: string[]) {
  const today = new Set(mealIds);
  return new Set(doneIds.filter((id) => today.has(id))).size;
}

// How many ISO dates fall within the last `days` days up to `now`.
export function countSince(dates: string[], now: Date, days: number) {
  const from = now.getTime() - days * 86_400_000;
  return dates.filter((date) => Number(new Date(date)) >= from).length;
}

export type GroceriesSource = { source: "list" | "cart" | "none"; total: number };

export function kpiContexts({ planned, planName, newRecipes, groceries }: { planned: number; planName: string | null; newRecipes: number; groceries: GroceriesSource }) {
  return {
    meals: planned > 0 ? `de ${planned} hoy` : "sin plan hoy",
    plan: planName ?? "sin plan activo",
    recipes: newRecipes > 0 ? `+${newRecipes} esta semana` : "sin nuevas",
    groceries: groceries.source === "list" ? `de ${groceries.total} en lista` : groceries.source === "cart" ? "en el carrito" : "sin lista"
  };
}

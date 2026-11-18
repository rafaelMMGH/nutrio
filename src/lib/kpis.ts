import { serverToday } from "@/lib/domain/chat-dates";

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

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// The Planes tile's line: since when the active plan exists. Days are the Mexico City ones (the app's fixed "today", see serverToday), never the viewer's.
export function planContext({ createdAt, plans }: { createdAt: string | null; plans: number }, now: Date) {
  if (!createdAt) return plans > 0 ? "sin plan activo" : "sin planes";
  const [year, month, day] = serverToday(new Date(createdAt)).split("-").map(Number);
  const thisYear = Number(serverToday(now).slice(0, 4));
  return year === thisYear ? `desde ${day} ${SHORT_MONTHS[month - 1]}` : `desde ${SHORT_MONTHS[month - 1]} ${year}`;
}

type ContextInput = { planned: number; plan: string; newRecipes: number; recipes: number; pending: number; groceries: GroceriesSource };

export function kpiContexts({ planned, plan, newRecipes, recipes, pending, groceries }: ContextInput) {
  return {
    meals: planned > 0 ? `de ${planned} hoy` : "Día libre",
    plan,
    recipes: recipes === 0 ? "sin recetas" : newRecipes > 0 ? `+${newRecipes} esta semana` : "Ninguna esta semana",
    groceries: pending === 0 ? "sin pendientes" : groceries.source === "list" ? `de ${groceries.total} en lista` : "en el carrito"
  };
}

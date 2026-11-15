import type { Metadata } from "next";
import { Dashboard } from "@/components/nutrio/Dashboard";
import { consolidateCart } from "@/lib/domain/cart";
import { dashboardSummary, listPlans, listShoppingLists, loadFor } from "@/lib/domain/queries";
import { getPageSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Inicio · NUTRIO" };

export default async function HomePage() {
  const { user } = await getPageSession();
  const db = await loadFor(user, "dashboard", "cart", "shoppingLists", "plans");
  const summary = dashboardSummary(db, user.id);
  // Pending groceries: unchecked items of the newest shopping list; without a list, what is in the cart.
  const latestList = listShoppingLists(db, user.id).at(-1);
  const pendingGroceries = latestList ? latestList.items.filter((item) => item.status === "Pendiente").length : consolidateCart(db, user.id).ingredients.length;
  return (
    <Dashboard
      meals={summary.schedule?.meals ?? []}
      dailyLogs={summary.dailyLogs}
      kcalGoal={summary.schedule?.kcal_goal ?? null}
      proteinPct={summary.schedule?.protein_pct ?? null}
      weightGoal={user.weight_goal_kg ?? null}
      counts={{ plans: listPlans(db, user.id).length, recipes: summary.recipesCount, pendingGroceries }}
    />
  );
}

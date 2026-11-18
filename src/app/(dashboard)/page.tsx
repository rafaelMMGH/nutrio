import type { Metadata } from "next";
import { Dashboard } from "@/components/nutrio/Dashboard";
import { consolidateCart } from "@/lib/domain/cart";
import { dishRecipes } from "@/lib/domain/plans";
import { countSince, planContext } from "@/lib/kpis";
import { dashboardSummary, listPlans, listShoppingLists, loadFor } from "@/lib/domain/queries";
import { getPageSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Inicio · NUTRIO" };

export default async function HomePage() {
  const { user } = await getPageSession();
  const db = await loadFor(user, "dashboard", "cart", "shoppingLists", "plans");
  const now = new Date();
  const summary = dashboardSummary(db, user.id);
  // Pending groceries: unchecked items of the newest shopping list; without a list, what is in the cart.
  const latestList = listShoppingLists(db, user.id).at(-1);
  const cartItems = latestList ? 0 : consolidateCart(db, user.id).ingredients.length;
  const pendingGroceries = latestList ? latestList.items.filter((item) => item.status === "Pendiente").length : cartItems;
  const groceries = latestList ? { source: "list" as const, total: latestList.items.length } : { source: cartItems > 0 ? ("cart" as const) : ("none" as const), total: cartItems };
  const newRecipes = countSince(dishRecipes(db, user.id).map((item) => item.created_at), now, 7);
  const plans = listPlans(db, user.id).length;
  return (
    <Dashboard
      meals={summary.schedule?.meals ?? []}
      dailyLogs={summary.dailyLogs}
      kcalGoal={summary.schedule?.kcal_goal ?? null}
      proteinPct={summary.schedule?.protein_pct ?? null}
      weightGoal={user.weight_goal_kg ?? null}
      counts={{ plans, recipes: summary.recipesCount, pendingGroceries }}
      kpiContext={{ plan: planContext({ createdAt: summary.activePlan?.created_at ?? null, plans }, now), planName: summary.activePlan?.name ?? null, newRecipes, groceries }}
    />
  );
}

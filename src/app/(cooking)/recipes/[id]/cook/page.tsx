import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CookingMode } from "@/components/cooking/CookingMode";
import { activeSchedule, findRecipe } from "@/lib/domain/plans";
import { loadFor } from "@/lib/domain/queries";
import { recipeSteps } from "@/lib/recipe-steps";
import { getPageSession } from "@/lib/server/session";

type Props = { params: Promise<{ id: string }> };

async function load(params: Props["params"]) {
  const { id } = await params;
  const { user } = await getPageSession();
  const db = await loadFor(user, "recipes", "dashboard");
  return { db, user, recipe: findRecipe(db, user.id, id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { recipe } = await load(params);
  return { title: `Modo Cocina · ${recipe?.name ?? "Receta"} · NUTRIO` };
}

export default async function CookPage({ params }: Props) {
  const { db, user, recipe } = await load(params);
  if (!recipe) notFound();
  // Today's meals with every option's recipe, so the end screen can offer "Marcar como hecha" (REQ-16).
  const meals = (activeSchedule(db, user.id)?.meals ?? []).map((meal) => ({
    id: meal.id,
    name: meal.name,
    recipeIds: db.mealOptions.filter((option) => option.meal_type_id === meal.id && !option.deleted_at).map((option) => option.recipe_id)
  }));
  // "Today" is the browser's date (as on the dashboard), so the client picks it from the recent days.
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const logs = db.dailyLogs.filter((log) => log.user_id === user.id && log.date >= since).map((log) => ({ date: log.date, meals_done: log.meals_done ?? [] }));
  const ingredients = (recipe.ingredients ?? []).map((item) => ({ name: item.name, quantity: Number(item.quantity) || 0, unit: item.unit ?? "", category: item.category ?? "" }));
  return (
    <CookingMode
      recipe={{ id: recipe.id, name: recipe.name, ingredients, steps: recipeSteps(recipe.description), appearances: recipe.appearances }}
      meals={meals}
      logs={logs}
    />
  );
}

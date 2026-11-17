// Pure rules of Modo Cocina (specs/cooking-mode), apart from React so they can be unit tested.

/** A screen of Modo Cocina: "before" (Antes de empezar), "step-<n>" (0-based), "no-steps" or "done". */
export type ScreenKey = string;

/** Screens in order: ingredients first when there are any (REQ-6, REQ-9), one per step or "no-steps" (REQ-10, REQ-13), then the end (REQ-15). */
export function screensFor(ingredients: number, steps: number): ScreenKey[] {
  const screens: ScreenKey[] = ingredients > 0 ? ["before"] : [];
  if (steps > 0) for (let index = 0; index < steps; index += 1) screens.push(`step-${index}`);
  else screens.push("no-steps");
  screens.push("done");
  return screens;
}

export function nextIndex(screens: ScreenKey[], index: number) {
  return Math.min(index + 1, screens.length - 1);
}

export function backIndex(index: number) {
  return Math.max(index - 1, 0);
}

/** 0-based step index of a "step-<n>" screen, else null. */
export function stepOf(screen: ScreenKey) {
  const match = /^step-(\d+)$/.exec(screen);
  return match ? Number(match[1]) : null;
}

/** "3 de 6 listos", or "¡Todo listo!" once everything is marked (REQ-6, REQ-8). */
export function readyLabel(checked: number, total: number) {
  if (total > 0 && checked >= total) return "¡Todo listo!";
  return `${checked} de ${total} ${checked === 1 ? "listo" : "listos"}`;
}

export type TodayMeal = { id: string; name: string; recipeIds: string[] };
export type MealMark = { state: "none" } | { state: "pending" | "done"; meal: { id: string; name: string } };

/** Which of today's meals the end screen offers to mark (REQ-16, REQ-17): the first not done that uses the recipe. */
export function mealToMark(meals: TodayMeal[], recipeId: string, doneIds: string[]): MealMark {
  const matching = meals.filter((meal) => meal.recipeIds.includes(recipeId));
  if (!matching.length) return { state: "none" };
  const pending = matching.find((meal) => !doneIds.includes(meal.id));
  const meal = pending ?? matching[0];
  return { state: pending ? "pending" : "done", meal: { id: meal.id, name: meal.name } };
}

export const RESUME_MS = 12 * 60 * 60 * 1000;

export type SavedTimer = { step: number; totalMs: number; endsAt: number | null; leftMs: number | null };
export type SavedProgress = { screen: ScreenKey; checked: number[]; timers: SavedTimer[]; ingredients: number; steps: number; savedAt: number };

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function validTimer(value: unknown, steps: number): value is SavedTimer {
  if (!value || typeof value !== "object") return false;
  const timer = value as Record<string, unknown>;
  const step = timer.step;
  return isNumber(step) && Number.isInteger(step) && step >= 0 && step < steps && isNumber(timer.totalMs) && timer.totalMs > 0
    && (timer.endsAt === null || isNumber(timer.endsAt)) && (timer.leftMs === null || isNumber(timer.leftMs))
    && (timer.endsAt !== null || timer.leftMs !== null);
}

/** Saved progress if it is still valid for this recipe (REQ-20): under 12 hours old, same counts, a screen that exists. */
export function resumeFrom(raw: unknown, now: number, ingredients: number, steps: number): SavedProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const saved = raw as Record<string, unknown>;
  if (!isNumber(saved.savedAt) || now - saved.savedAt > RESUME_MS || saved.savedAt > now) return null;
  if (saved.ingredients !== ingredients || saved.steps !== steps) return null;
  if (typeof saved.screen !== "string" || !screensFor(ingredients, steps).includes(saved.screen)) return null;
  if (!Array.isArray(saved.checked) || !Array.isArray(saved.timers)) return null;
  const checked = saved.checked.filter((item): item is number => isNumber(item) && Number.isInteger(item) && item >= 0 && item < ingredients);
  const timers = saved.timers.filter((item) => validTimer(item, steps)) as SavedTimer[];
  return { screen: saved.screen, checked, timers, ingredients, steps, savedAt: saved.savedAt };
}

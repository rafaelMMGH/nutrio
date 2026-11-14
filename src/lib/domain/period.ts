// Kept free of imports: the client planner uses it, and cart.ts pulls Node-only modules into the bundle.

/**
 * Shares a period of `days` among `recipes` rotating recipes: every recipe gets floor(days / recipes) days and the
 * first (days % recipes) get one more, so the shares add up to the period. Each share is at least 1 day, because a
 * 0-day cart item would silently count as one day.
 */
export function splitDays(days: number, recipes: number): number[] {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`days must be an integer >= 1, got ${days}`);
  if (!Number.isInteger(recipes) || recipes < 1) throw new RangeError(`recipes must be an integer >= 1, got ${recipes}`);
  if (recipes > days) throw new RangeError(`cannot split ${days} days among ${recipes} recipes`);
  const base = Math.floor(days / recipes);
  const extra = days % recipes;
  return Array.from({ length: recipes }, (_, index) => base + (index < extra ? 1 : 0));
}

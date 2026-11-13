/** Pure timing for the typewriter (REQ-33): a long lead must finish within the budget, a short one types at a natural pace. */
export const TYPE_BUDGET_MS = 900;
const MS_PER_CHARACTER = 18;

/** Total typing time for `length` characters: natural pace, capped so a long lead completes within the budget. */
export function typingDuration(length: number): number {
  return Math.min(TYPE_BUDGET_MS, Math.max(0, length) * MS_PER_CHARACTER);
}

/** How many characters are visible `elapsed` ms after the start; reaches `length` exactly at the duration. */
export function visibleCharacters(length: number, elapsed: number): number {
  const duration = typingDuration(length);
  if (length <= 0 || elapsed >= duration) return Math.max(0, length);
  return Math.min(length, Math.max(0, Math.floor((length * elapsed) / duration)));
}

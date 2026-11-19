/**
 * Which letters of `next` are new compared with `prev` (true = rises, false = stays still).
 * The common beginning and ending of the two labels stay; everything between them changes,
 * so "Cumplida" to "Marcar cumplida" keeps "umplida" in place (REQ-7).
 */
export function changedLetters(prev: string, next: string): boolean[] {
  const limit = Math.min(prev.length, next.length);
  let head = 0;
  while (head < limit && prev[head] === next[head]) head++;
  let tail = 0;
  while (tail < limit - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail++;
  return Array.from(next, (_, i) => i >= head && i < next.length - tail);
}

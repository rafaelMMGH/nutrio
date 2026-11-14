import type { Rich } from "@/lib/assistant";

/** Pure timing for the typewriter (REQ-33): a long lead must finish within the budget, a short one types at a natural pace. */
export const TYPE_BUDGET_MS = 800;
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

// The typewriter reveals whole user-perceived characters, never UTF-16 units: slicing by unit can leave a lone surrogate
// ("🥑" cut in half) or split a ZWJ sequence ("👨‍👩‍👧") into its parts. Length, duration and clipping all use this unit.
const segmenter = new Intl.Segmenter("es", { granularity: "grapheme" });

export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/** Length of a rich text in graphemes (each span counted on its own; a cluster is never split across spans in practice). */
export function richLength(rich: Rich): number {
  return rich.reduce((total, span) => total + graphemes(span.text).length, 0);
}

/** The first `count` graphemes of `rich`, keeping each span's highlight; spans cut to nothing are dropped. */
export function clipRich(rich: Rich, count: number): Rich {
  const clipped: Rich = [];
  let left = Math.max(0, count);
  for (const span of rich) {
    if (left <= 0) break;
    const parts = graphemes(span.text);
    const text = parts.length <= left ? span.text : parts.slice(0, left).join("");
    left -= Math.min(parts.length, left);
    clipped.push(span.highlight ? { text, highlight: true } : { text });
  }
  return clipped;
}

// Legibility rules of the metric dials (specs/metric-dials plan "Sizes and fit"; constants from "Chosen (T006)",
// option (c)). Pure, so the unit tests import it without React. D is the dial's box size in px, n the number of
// characters of a readout.

/** Smallest in-knob readout, px (T006). */
export const F_MIN = 10;
/** Width of one character in em: Urbanist 500, tabular figures, −0.02em letter-spacing (T005). */
export const DIAL_C = 0.42;
/** Smallest dial that shows the numbers at both ends of the ring. */
export const END_LABEL_MIN_D = 112;
/** End labels are 11px. */
const END_LABEL_PX = 11;
/** The knob is 64% of D and the readout may use 80% of its width. */
const KNOB = 0.64;
const KNOB_BUDGET = 0.8;
/** Never set a readout above the dial smaller than this, px. */
const ABOVE_MIN = 14;

/** Font size a readout of n characters gets inside the knob of a dial of size D. */
export function inKnobFont(d: number, n: number) {
  return Math.min(0.22 * d, (KNOB_BUDGET * KNOB * d) / (DIAL_C * n));
}

/** Decided per row (D21b): inside only when every dial's longest readout reaches F_MIN; otherwise all sit above. */
export function readoutPlacement(d: number, longestReadouts: number[]): "inside" | "above" {
  return longestReadouts.every((n) => inKnobFont(d, n) >= F_MIN) ? "inside" : "above";
}

/** Numbers at both ends of the ring, when the dial is large enough and the longest end label fits beside the knob. */
export function showEndLabels(d: number, longestEndLabel: number) {
  return d >= END_LABEL_MIN_D && DIAL_C * END_LABEL_PX * longestEndLabel + 6 <= 1.08 * (d / 2 - 6);
}

/** Font size of a readout above the dial: fills the tile's content width, at most fMax, never below 14px. */
export function aboveFont(contentWidth: number, n: number, fMax: number) {
  return Math.max(ABOVE_MIN, Math.min(fMax, contentWidth / (DIAL_C * n)));
}

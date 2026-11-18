import assert from "node:assert/strict";
import { test } from "node:test";
import { DIAL_C, END_LABEL_MIN_D, F_MIN, aboveFont, inKnobFont, readoutPlacement, showEndLabels } from "@/components/nutrio/dial-logic";

// Constants from plan.md "Chosen (T006)": option (c), F_min 10px, c = 0.42 em per character.
test("constants recorded at T006", () => {
  assert.equal(F_MIN, 10);
  assert.equal(DIAL_C, 0.42);
  assert.equal(END_LABEL_MIN_D, 112);
});

test("in-knob font is the smaller of 0.22·D and the width budget 0.8·0.64·D ÷ (c·n)", () => {
  assert.ok(Math.abs(inKnobFont(76, 4) - 16.72) < 1e-9); // "100%": bound by 0.22·D
  assert.ok(Math.abs(inKnobFont(76, 7) - (0.8 * 0.64 * 76) / (0.42 * 7)) < 1e-9); // "≈ 1,850": bound by width
  assert.ok(Math.abs(inKnobFont(61, 7) - 10.62) < 0.01); // 1280×768 Calorías, measured 10.6
});

test("placement is decided per row: one dial under F_min puts all four above (D21b)", () => {
  const row = (d: number, ns: number[]) => readoutPlacement(d, ns);
  // 1280×768 (D 61): "100%", "≈ 1,850", "≈ 112", "150.0" all at least 10px → inside.
  assert.equal(row(61, [4, 7, 5, 5]), "inside");
  // A five-digit kcal target ("≈ 12,345", n 8) at D 61 needs 9.3px → the whole row goes above.
  assert.equal(row(61, [4, 8, 5, 5]), "above");
  // Each side of the threshold for n 7: F_in = 10 at D = 10·0.42·7 ÷ 0.512 = 57.42…
  assert.equal(row(57.4, [7]), "above");
  assert.equal(row(57.5, [7]), "inside");
  // And for the 0.22·D term with n 4: F_in = 10 at D = 45.45…
  assert.equal(row(45.4, [4]), "above");
  assert.equal(row(45.5, [4]), "inside");
});

test("end labels need D ≥ 112 and room for the longest end label", () => {
  // "100" (n 3): 0.42·11·3 + 6 = 19.86 ≤ 1.08·(D/2 − 6) from D ≈ 48.8, so D decides.
  assert.equal(showEndLabels(111.9, 3), false);
  assert.equal(showEndLabels(112, 3), true);
  // "1,850" (n 5): 29.1 ≤ 1.08·(112/2 − 6) = 54 → shown at 112.
  assert.equal(showEndLabels(112, 5), true);
  // Width side: n 11 needs 0.42·11·11 + 6 = 56.82 ≤ 1.08·(D/2 − 6) → D ≥ 117.2…
  assert.equal(showEndLabels(117, 11), false);
  assert.equal(showEndLabels(117.3, 11), true);
});

test("a readout above the dial fits the tile width, capped at F_max and never below 14px", () => {
  // "≈ 12,345 kcal" (n 13) in the 360px tile's 112px content: 112 ÷ (0.42·13) = 20.5px.
  assert.ok(Math.abs(aboveFont(112, 13, 26) - 112 / (0.42 * 13)) < 1e-9);
  assert.ok(aboveFont(112, 13, 26) >= 14);
  assert.equal(aboveFont(400, 4, 32), 32);
  assert.equal(aboveFont(60, 13, 26), 14);
});

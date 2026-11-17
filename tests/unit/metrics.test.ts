import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardMetrics, periodStart, prepMinutes, recipeRating } from "../../src/lib/metrics";

const slots = ["a", "b", "c", "d"];
const base = { slotIds: slots, today: "2026-11-14", kcalGoal: 2000, proteinPct: 20, weightGoal: 70 };
// 2026-11-14 is a Saturday: the week starts Monday 2026-11-09.
const logs = [
  { date: "2026-10-01", meals_done: ["a"], weight_kg: 80 },
  { date: "2026-11-02", meals_done: ["a", "b", "c", "d"] },
  { date: "2026-11-10", meals_done: ["a", "b"], weight_kg: 76 },
  { date: "2026-11-14", meals_done: ["a", "b", "c", "zzz"], weight_kg: 75 }
];

test("period starts", () => {
  assert.equal(periodStart("week", "2026-11-14", logs), "2026-11-09");
  assert.equal(periodStart("month", "2026-11-14", logs), "2026-11-01");
  assert.equal(periodStart("year", "2026-11-14", logs), "2026-01-01");
  assert.equal(periodStart("all", "2026-11-14", logs), "2026-10-01");
  assert.equal(periodStart("all", "2026-11-14", []), null);
});

test("week: adherence counts only plan slots, over the days elapsed", () => {
  const m = dashboardMetrics({ ...base, logs, period: "week" });
  assert.deepEqual(m.adherence, { ratio: 5 / 24, done: 5, planned: 24 });
  assert.equal(m.calories.kcal, Math.round(2000 * (5 / 24)));
  assert.equal(m.protein.grams, Math.round(100 * (5 / 24)));
  assert.equal(m.weight.current, 75);
  assert.equal(m.weight.ratio, 0.5);
});

test("month and all use their own ranges", () => {
  assert.equal(dashboardMetrics({ ...base, logs, period: "month" }).adherence.done, 9);
  assert.equal(dashboardMetrics({ ...base, logs, period: "month" }).adherence.planned, 56);
  assert.equal(dashboardMetrics({ ...base, logs, period: "all" }).adherence.planned, 4 * 45);
});

test("no data in the period gives nulls", () => {
  const m = dashboardMetrics({ ...base, logs: [logs[0]], period: "week" });
  assert.equal(m.adherence.ratio, null);
  assert.equal(m.calories.ratio, null);
  assert.equal(m.weight.current, null);
  assert.equal(m.weight.ratio, null);
});

test("missing goals give nulls but keep the current weight", () => {
  const m = dashboardMetrics({ ...base, logs, period: "week", kcalGoal: null, weightGoal: null });
  assert.equal(m.calories.ratio, null);
  assert.equal(m.protein.ratio, null);
  assert.equal(m.weight.ratio, null);
  assert.equal(m.weight.current, 75);
});

test("weight moving away from the goal clamps at 0", () => {
  const m = dashboardMetrics({ ...base, logs: [{ date: "2026-11-09", meals_done: [], weight_kg: 80 }, { date: "2026-11-13", meals_done: [], weight_kg: 82 }], period: "week" });
  assert.equal(m.weight.ratio, 0);
});

test("rating is stable and within 4.5–5.0; prep time grows with ingredients", () => {
  for (const id of ["abc", "recipe-1", "x"]) {
    const rating = recipeRating(id);
    assert.equal(rating, recipeRating(id));
    assert.ok(rating >= 4.5 && rating <= 5.0);
  }
  assert.equal(prepMinutes(6), 17);
});

// Metric dials (specs/metric-dials, spec v1.4): readouts without unit in the knob, the unit on the line underneath,
// and the meter values a screen reader gets (REQ-3 to REQ-6, REQ-43).
import { metricReadouts } from "../../src/lib/metrics";

// 32 meals planned (4 slots × 8 days, Nov 7 to 14), `done` of them ticked on the logged days; kcal 1,850 and a
// protein share that gives 112 g (1,850 × 24.216216…% ÷ 4).
function readoutsFor(done: number, planned = 32, kcalGoal: number | null = 1850, proteinPct: number | null = (112 * 4 * 100) / 1850) {
  const days = planned / 4;
  const logs = Array.from({ length: days }, (_, i) => {
    const date = `2026-11-${String(7 + i).padStart(2, "0")}`;
    const take = Math.max(0, Math.min(4, done - i * 4));
    return { date, meals_done: slots.slice(0, take) };
  });
  const today = `2026-11-${String(6 + days).padStart(2, "0")}`;
  const metrics = dashboardMetrics({ logs, slotIds: slots, today, period: "all", kcalGoal, proteinPct, weightGoal: null });
  return metricReadouts(metrics);
}

test("REQ-3: Adherencia reads the rounded percentage and how many meals", () => {
  const { adherence } = readoutsFor(25);
  assert.equal(adherence.readout, "78%");
  assert.equal(adherence.line, "25 de 32 comidas");
  assert.equal(readoutsFor(26).adherence.readout, "81%");
  assert.equal(readoutsFor(26).adherence.line, "26 de 32 comidas");
  const one = metricReadouts(dashboardMetrics({ logs: [{ date: "2026-11-14", meals_done: ["a"] }], slotIds: ["a"], today: "2026-11-14", period: "all", kcalGoal: null, proteinPct: null, weightGoal: null }));
  assert.equal(one.adherence.readout, "100%");
  assert.equal(one.adherence.line, "1 de 1 comida");
});

test("REQ-4, REQ-5: Calorías and Proteína use the unrounded fraction; the unit is on the line (v1.4)", () => {
  const { calories, protein } = readoutsFor(25);
  assert.equal(calories.readout, "≈ 1,445");
  assert.equal(calories.line, "meta 1,850 kcal");
  assert.equal(protein.readout, "≈ 88");
  assert.equal(protein.line, "meta 112 g");
});

test("REQ-6: no logs read “—” with the needle at 0; no target drops the meta line; zeros keep their lines", () => {
  const empty = metricReadouts(dashboardMetrics({ logs: [], slotIds: slots, today: "2026-11-14", period: "week", kcalGoal: 1850, proteinPct: 20, weightGoal: null }));
  for (const dial of [empty.adherence, empty.calories, empty.protein]) {
    assert.equal(dial.readout, "—");
    assert.equal(dial.value, 0);
  }
  assert.equal(empty.adherence.line, null);
  assert.equal(empty.calories.line, "meta 1,850 kcal");

  const noTarget = readoutsFor(25, 32, null, null);
  assert.equal(noTarget.calories.readout, "—");
  assert.equal(noTarget.calories.line, null);
  assert.equal(noTarget.protein.readout, "—");
  assert.equal(noTarget.protein.line, null);
  assert.equal(noTarget.adherence.readout, "78%");

  const zero = readoutsFor(0);
  assert.equal(zero.adherence.readout, "0%");
  assert.equal(zero.adherence.line, "0 de 32 comidas");
  assert.equal(zero.calories.readout, "≈ 0");
  assert.equal(zero.calories.line, "meta 1,850 kcal");
  assert.equal(zero.protein.readout, "≈ 0");
  assert.equal(zero.protein.line, "meta 112 g");
  for (const dial of [zero.adherence, zero.calories, zero.protein]) assert.equal(dial.value, 0);
});

test("REQ-43: meter values and value text, with units, built from the strings the card shows", () => {
  const { adherence, calories, protein } = readoutsFor(25);
  assert.deepEqual([adherence.min, adherence.max, adherence.value], [0, 100, 78.125]);
  assert.equal(adherence.valueText, "78%, 25 de 32 comidas");
  assert.deepEqual([calories.min, calories.max, calories.value], [0, 1850, 1445.3125]);
  assert.equal(calories.valueText, "≈ 1,445 kcal, meta 1,850 kcal");
  assert.equal(protein.min, 0);
  assert.ok(Math.abs(protein.max - 112) < 1e-9);
  assert.ok(Math.abs(protein.value - 87.5) < 1e-9);
  assert.equal(protein.valueText, "≈ 88 g, meta 112 g");
});

test("REQ-43: without data the meter is 0–100 at 0 and reads “Sin datos”", () => {
  const empty = metricReadouts(dashboardMetrics({ logs: [], slotIds: slots, today: "2026-11-14", period: "week", kcalGoal: null, proteinPct: null, weightGoal: null }));
  const noTarget = readoutsFor(25, 32, null, null);
  for (const dial of [empty.adherence, empty.calories, empty.protein, noTarget.calories, noTarget.protein]) {
    assert.deepEqual([dial.min, dial.max, dial.value], [0, 100, 0]);
    assert.equal(dial.valueText, "Sin datos");
  }
});

test("thousands use a comma and halves round up", () => {
  const big = readoutsFor(32, 32, 12345, 20);
  assert.equal(big.calories.readout, "≈ 12,345");
  assert.equal(big.calories.line, "meta 12,345 kcal");
});

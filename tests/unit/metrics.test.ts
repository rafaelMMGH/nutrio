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

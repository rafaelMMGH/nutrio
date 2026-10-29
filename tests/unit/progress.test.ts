import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mealsDoneOn, mondayOf, waterGoalGlasses, weekDays, weekExercise, weekMeals, weekWater, weightStats, type ProgressLog } from "@/lib/progress";
import { PARITY_EXPECTED as expected, PARITY_LOGS, PARITY_MONDAY, PARITY_SLOTS, PARITY_SUNDAY, PARITY_TODAY, PARITY_WEIGHT_GOAL } from "../shared/progress-fixture";

const byDate = new Map(PARITY_LOGS.map((log) => [log.date, log]));
const getLog = (date: string): ProgressLog => {
  const log = byDate.get(date);
  return { meals_done: log?.meals_done ?? [], water_glasses: log?.water_glasses ?? 0, exercised: log?.exercised ?? false };
};
const weights = PARITY_LOGS.map((log): [string, number | null] => [log.date, log.weight_kg ?? null]);

describe("progress.ts week", () => {
  it("mondayOf returns the Monday of the week, across month and year edges", () => {
    assert.equal(mondayOf(PARITY_TODAY), PARITY_MONDAY);
    assert.equal(mondayOf(PARITY_MONDAY), PARITY_MONDAY);
    assert.equal(mondayOf(PARITY_SUNDAY), PARITY_MONDAY);
    assert.equal(mondayOf("2027-01-01"), "2026-12-28");
  });

  it("weekDays runs Monday to endDay, at most seven days", () => {
    assert.deepEqual(weekDays(PARITY_MONDAY, PARITY_TODAY), ["2026-10-26", "2026-10-27", "2026-10-28"]);
    assert.equal(weekDays(PARITY_MONDAY, PARITY_SUNDAY).length, 7);
    assert.equal(weekDays(PARITY_MONDAY, PARITY_SUNDAY)[6], PARITY_SUNDAY);
    assert.equal(weekDays(PARITY_MONDAY, "2026-11-15").length, 7);
  });
});

describe("progress.ts water", () => {
  it("waterGoalGlasses is liters / 0.25 clamped to 4-12, default 2 L", () => {
    assert.equal(waterGoalGlasses(2), 8);
    assert.equal(waterGoalGlasses(null), 8);
    assert.equal(waterGoalGlasses(undefined), 8);
    assert.equal(waterGoalGlasses(0.5), 4);
    assert.equal(waterGoalGlasses(2.6), 10);
    assert.equal(waterGoalGlasses(5), 12);
  });

  it("weekWater caps each day at the goal, same result with endDay Sunday or today", () => {
    assert.equal(weekWater(getLog, PARITY_MONDAY, PARITY_SUNDAY, expected.waterGlasses), expected.weekWaterLiters);
    assert.equal(weekWater(getLog, PARITY_MONDAY, PARITY_TODAY, expected.waterGlasses), expected.weekWaterLiters);
    assert.equal(expected.waterGlasses * 0.25 * 7, expected.weekWaterGoalLiters);
  });
});

describe("progress.ts meals", () => {
  it("mealsDoneOn counts only plan slots and never exceeds them", () => {
    for (const [date, done] of Object.entries(expected.mealsByDay)) assert.equal(mealsDoneOn(getLog(date), PARITY_SLOTS), done);
    assert.equal(mealsDoneOn(getLog("2026-10-27"), PARITY_SLOTS.slice(0, 2)), 2);
    assert.equal(mealsDoneOn(getLog("2026-10-29"), PARITY_SLOTS), 0);
    assert.equal(mealsDoneOn(getLog("2026-10-27"), []), 0);
  });

  it("weekMeals sums the days, same result with endDay Sunday or today", () => {
    assert.equal(weekMeals(getLog, PARITY_SLOTS, PARITY_MONDAY, PARITY_SUNDAY), expected.weekMeals);
    assert.equal(weekMeals(getLog, PARITY_SLOTS, PARITY_MONDAY, PARITY_TODAY), expected.weekMeals);
    assert.equal(PARITY_SLOTS.length * 7, expected.weekMealsGoal);
  });
});

describe("progress.ts exercise", () => {
  it("weekExercise counts flagged days of the week only, same result with endDay Sunday or today", () => {
    assert.equal(weekExercise(getLog, PARITY_MONDAY, PARITY_SUNDAY), expected.weekExerciseDays);
    assert.equal(weekExercise(getLog, PARITY_MONDAY, PARITY_TODAY), expected.weekExerciseDays);
  });
});

describe("progress.ts weight", () => {
  it("weightStats gives latest, last before Monday, change and goal ratio", () => {
    const stats = weightStats(weights, PARITY_TODAY, PARITY_MONDAY, PARITY_WEIGHT_GOAL);
    const want = expected.weight;
    assert.equal(stats.start, want.start);
    assert.equal(stats.latest, want.latest);
    assert.equal(stats.latestDate, want.latestDate);
    assert.equal(stats.beforeWeek, want.beforeWeek);
    assert.ok(Math.abs(stats.change! - want.change) < 1e-9);
    assert.ok(Math.abs(stats.ratio - want.ratio) < 1e-9);
  });

  it("ignores weights after today and has no change without a weight before Monday", () => {
    const future = weightStats([...weights, ["2026-10-30", 60]], PARITY_TODAY, PARITY_MONDAY, PARITY_WEIGHT_GOAL);
    assert.equal(future.latest, expected.weight.latest);
    const first = weightStats([["2026-10-27", 70]], PARITY_TODAY, PARITY_MONDAY, null);
    assert.deepEqual(first, { start: 70, latest: 70, latestDate: "2026-10-27", beforeWeek: null, change: null, ratio: 0 });
  });

  it("has no values without weights, and ratio 1 when the first weight is the goal", () => {
    const none = weightStats([["2026-10-27", null]], PARITY_TODAY, PARITY_MONDAY, 63);
    assert.deepEqual(none, { start: null, latest: null, latestDate: null, beforeWeek: null, change: null, ratio: 0 });
    assert.equal(weightStats([["2026-10-20", 63]], PARITY_TODAY, PARITY_MONDAY, 63).ratio, 1);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysBetween, exerciseOver, mealsDoneOn, mondayOf, waterGoalGlasses, weekDays, weekExercise, weekMeals, weekWater, weightStats, type ProgressLog } from "@/lib/progress";
import { PARITY_EXPECTED as expected, PARITY_LOGS, PARITY_MONDAY, PARITY_SLOTS, PARITY_SUNDAY, PARITY_TODAY, PARITY_WEIGHT_GOAL, parityLogs } from "../shared/progress-fixture";

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

  it("exerciseOver counts flagged days of any range, the one weekExercise is built on", () => {
    assert.equal(exerciseOver(getLog, daysBetween(PARITY_MONDAY, PARITY_SUNDAY)), expected.weekExerciseDays);
    assert.equal(exerciseOver(getLog, []), 0);
    assert.equal(exerciseOver(getLog, daysBetween("2026-01-01", "2026-01-10")), 0);
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

describe("progress.ts edges", () => {
  const log = (meals_done: string[]): ProgressLog => ({ meals_done, water_glasses: 0 });
  const near = (actual: number, want: number) => assert.ok(Math.abs(actual - want) < 1e-9, `${actual} is not ${want}`);

  it("mealsDoneOn ignores ids that are not slots and never exceeds the slots", () => {
    assert.equal(mealsDoneOn(log(["m1", "gone"]), PARITY_SLOTS), 1);
    assert.equal(mealsDoneOn(log(["m1", "m1", "m1", "m1", "m1"]), PARITY_SLOTS), 4);
  });

  it("weekDays is empty when endDay is before Monday", () => {
    assert.deepEqual(weekDays(PARITY_MONDAY, "2026-10-25"), []);
  });

  it("weightStats treats a weight on Monday as part of the week, not the one before it", () => {
    const stats = weightStats([["2026-10-20", 67], ["2026-10-26", 66]], PARITY_TODAY, PARITY_MONDAY, null);
    assert.equal(stats.beforeWeek, 67);
    assert.equal(stats.change, -1);
  });

  it("weightStats gives change 0 when the latest weight is the one before Monday", () => {
    const stats = weightStats([["2026-10-20", 67], ["2026-10-25", 66.6]], PARITY_TODAY, PARITY_MONDAY, null);
    assert.equal(stats.latestDate, "2026-10-25");
    assert.equal(stats.beforeWeek, 66.6);
    assert.equal(stats.change, 0);
  });

  it("weightStats ratio follows a gaining goal and is not clamped", () => {
    near(weightStats([["2026-10-20", 60], ["2026-10-27", 62]], PARITY_TODAY, PARITY_MONDAY, 66).ratio, 1 / 3);
    near(weightStats([["2026-10-20", 67], ["2026-10-27", 68]], PARITY_TODAY, PARITY_MONDAY, 63).ratio, -0.25);
    near(weightStats([["2026-10-20", 67], ["2026-10-27", 62]], PARITY_TODAY, PARITY_MONDAY, 63).ratio, 1.25);
  });
});

describe("progress.ts dashboard baseline (T066 fixture, relative to a Monday)", () => {
  // The e2e dashboard test seeds this same fixture on the real Monday of the current week; the numbers do not depend on the weekday.
  const monday = "2026-10-26";
  const { logs, slots, waterGlasses, weightGoal, expected: want } = parityLogs(monday);
  const logOf = new Map(logs.map((log) => [log.date, log]));
  const getBaseLog = (date: string): ProgressLog => {
    const log = logOf.get(date);
    return { meals_done: log?.meals_done ?? [], water_glasses: log?.water_glasses ?? 0, exercised: log?.exercised ?? false };
  };
  const entries = logs.map((log): [string, number | null] => [log.date, log.weight_kg ?? null]);

  it("gives the expected tile numbers whatever weekday it is", () => {
    for (const endDay of [monday, "2026-10-28", "2026-11-01"]) {
      assert.equal(weekWater(getBaseLog, monday, endDay, waterGlasses), want.weekWaterLiters);
      assert.equal(weekMeals(getBaseLog, slots, monday, endDay), want.weekMeals);
      assert.equal(weekExercise(getBaseLog, monday, endDay), want.weekExerciseDays);
    }
    assert.equal(waterGlasses * 0.25 * 7, want.weekWaterGoalLiters);
    assert.equal(slots.length * 7, want.weekMealsGoal);
  });

  it("weightStats on Monday gives latest, change and ratio", () => {
    const stats = weightStats(entries, monday, monday, weightGoal);
    assert.equal(stats.start, want.weight.start);
    assert.equal(stats.latest, want.weight.latest);
    assert.equal(stats.latestDate, monday);
    assert.equal(stats.beforeWeek, want.weight.beforeWeek);
    assert.ok(Math.abs(stats.change! - want.weight.change) < 1e-9);
    assert.ok(Math.abs(stats.ratio - want.weight.ratio) < 1e-9);
  });

  it("change is 0 when the latest weight is the one before Monday", () => {
    const stats = weightStats(entries.slice(0, -1), monday, monday, weightGoal);
    assert.equal(stats.latest, want.weight.beforeWeek);
    assert.equal(stats.change, 0);
  });
});

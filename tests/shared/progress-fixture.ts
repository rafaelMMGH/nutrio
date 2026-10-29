import type { SeedLog } from "./assistant-fixture";

// The REQ-16 parity data, shared by tests/unit/progress.test.ts (T075) and the dashboard baseline (T066). Every number
// below is worked out by hand from the dashboard's rules, not by running progress.ts.
//
// Today is Wednesday 2026-10-28, so the week is Mon 2026-10-26 to Sun 2026-11-01. Plan: four slots and the default 2 L
// of water (8 glasses). Meal ids are positions ("m1" is the first slot); T066 maps them to the seeded meal ids, and
// "gone" stands for a meal that is no longer in the plan.

export const PARITY_TODAY = "2026-10-28";
export const PARITY_MONDAY = "2026-10-26";
export const PARITY_SUNDAY = "2026-11-01";
export const PARITY_SLOTS = ["m1", "m2", "m3", "m4"];
export const PARITY_WEIGHT_GOAL = 63;

// No row is after today: the dashboard cannot log a day that has not arrived (spec Assumptions).
export const PARITY_LOGS: SeedLog[] = [
  { date: "2026-10-20", weight_kg: 67 },
  // Sunday before the week: weight 66.6 is "the last weight before Monday"; its water, meals and exercise stay out of the week.
  { date: "2026-10-25", water_glasses: 8, meals_done: ["m1", "m2", "m3", "m4"], exercised: true, weight_kg: 66.6 },
  { date: "2026-10-26", water_glasses: 5, meals_done: ["m1", "m2", "m3"], exercised: true },
  // 11 glasses count as 8 (the goal); "gone" is not a slot, so 4 meals, not 5.
  { date: "2026-10-27", water_glasses: 11, meals_done: ["m1", "m2", "m3", "m4", "gone"] },
  { date: "2026-10-28", water_glasses: 3, meals_done: ["m1"], exercised: false, weight_kg: 66.2 }
];

export const PARITY_EXPECTED = {
  // Water: min(5,8) + min(11,8) + 3 = 16 glasses × 0.25 L; the week goal is 8 × 0.25 × 7.
  waterGlasses: 8,
  weekWaterLiters: 4,
  weekWaterGoalLiters: 14,
  // Meals: 3 + 4 + 1 of 4 slots × 7 days.
  mealsByDay: { "2026-10-26": 3, "2026-10-27": 4, "2026-10-28": 1 } as Record<string, number>,
  weekMeals: 8,
  weekMealsGoal: 28,
  // Exercise: only Monday counts (Sunday is before the week, Tuesday has no flag, Wednesday is false).
  weekExerciseDays: 1,
  // Weight: logged 67 (first), 66.6, 66.2 (latest); 66.6 is before Monday, so the change is 66.2 - 66.6 = -0.4 and
  // the progress toward 63 is (67 - 66.2) / (67 - 63) = 0.2.
  weight: { start: 67, latest: 66.2, latestDate: "2026-10-28", beforeWeek: 66.6, change: -0.4, ratio: 0.2 }
};

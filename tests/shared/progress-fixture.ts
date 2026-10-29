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

const addDays = (key: string, days: number) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

// The dashboard baseline (T066) must run on any weekday, and the dashboard reads the real date, so it cannot pin one.
// Every log of the week sits on Monday, which is never after today; the weights before the week go earlier. Worked by
// hand: water 6 glasses = 1.5 L of 8 glasses × 0.25 L × 7 = 14 L; meals m1, m2 (not "gone") = 2 of 4 slots × 7 = 28;
// one exercise day; weight 66.2 vs 66.6 before Monday = -0.4, progress (67 - 66.2) / (67 - 63) = 0.2.
export const parityLogs = (monday: string) => ({
  logs: [
    { date: addDays(monday, -8), weight_kg: 67 },
    { date: addDays(monday, -3), weight_kg: 66.6 },
    { date: monday, water_glasses: 6, meals_done: ["m1", "m2", "gone"], exercised: true, weight_kg: 66.2 }
  ] as SeedLog[],
  slots: PARITY_SLOTS,
  waterGlasses: 8,
  weightGoal: PARITY_WEIGHT_GOAL,
  exerciseGoalDays: 3,
  expected: {
    weekWaterLiters: 1.5,
    weekWaterGoalLiters: 14,
    weekMeals: 2,
    weekMealsGoal: 28,
    weekExerciseDays: 1,
    weight: { start: 67, latest: 66.2, beforeWeek: 66.6, change: -0.4, ratio: 0.2 }
  }
});

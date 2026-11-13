// Weekly progress math shared by the dashboard and the assistant (REQ-16). Pure and client-safe: no Prisma, no Next, no
// browser APIs. Dates are YYYY-MM-DD keys and all calendar math runs in UTC, so the result never depends on the machine's
// timezone; the caller decides what "today" is. The week functions take `endDay`: the dashboard passes the Sunday, the
// chat passes today. No day after today can be logged, so both give the same numbers (plan D9).

export const WATER_GOAL_LITERS = 2;
export const WATER_GLASS_LITERS = 0.25;

export type ProgressLog = { meals_done: string[]; water_glasses: number; exercised?: boolean };
/** Returns the log of a day, or an empty one when nothing was logged. */
export type LogOf = (date: string) => ProgressLog;

const toUtc = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const addDays = (key: string, amount: number) => {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

export function mondayOf(day: string) {
  return addDays(day, -((toUtc(day).getUTCDay() + 6) % 7));
}

/** The days of the week from Monday up to `endDay` (at most seven). */
export function weekDays(monday: string, endDay: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index)).filter((day) => day <= endDay);
}

export function waterGoalGlasses(liters: number | null | undefined) {
  return Math.min(12, Math.max(4, Math.round((liters ?? WATER_GOAL_LITERS) / WATER_GLASS_LITERS)));
}

/** Every day from `from` to `to`, both inclusive. */
export function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Water over `days`: liters with each day counting at most the goal, and the days that reached the goal. */
export function waterOver(logOf: LogOf, days: string[], goalGlasses: number) {
  const glasses = days.reduce((sum, day) => sum + Math.min(logOf(day).water_glasses, goalGlasses), 0);
  return { liters: glasses * WATER_GLASS_LITERS, daysMet: days.filter((day) => logOf(day).water_glasses >= goalGlasses).length };
}

/** Liters drunk in the week, each day counting at most the goal. */
export function weekWater(logOf: LogOf, monday: string, endDay: string, goalGlasses: number) {
  return waterOver(logOf, weekDays(monday, endDay), goalGlasses).liters;
}

/** Meals done on a day, counting only slots of the plan and never more than the slots. */
export function mealsDoneOn(log: ProgressLog, slotIds: string[]) {
  const slots = new Set(slotIds);
  return Math.min(slotIds.length, log.meals_done.filter((id) => slots.has(id)).length);
}

export function weekMeals(logOf: LogOf, slotIds: string[], monday: string, endDay: string) {
  return weekDays(monday, endDay).reduce((sum, day) => sum + mealsDoneOn(logOf(day), slotIds), 0);
}

/** Days of `days` with exercise logged. */
export function exerciseOver(logOf: LogOf, days: string[]) {
  return days.filter((day) => logOf(day).exercised).length;
}

export function weekExercise(logOf: LogOf, monday: string, endDay: string) {
  return exerciseOver(logOf, weekDays(monday, endDay));
}

/**
 * Weight tile numbers from [date, kg] pairs: the latest weight up to `today`, the last one before Monday, the change
 * between them (0 when the latest weight is the one before Monday) and the progress from the first weight toward the goal, in
 * whichever direction the goal lies.
 */
export function weightStats(entries: Iterable<[string, number | null | undefined]>, today: string, monday: string, goal: number | null) {
  const weights = [...entries]
    .filter((entry): entry is [string, number] => entry[0] <= today && typeof entry[1] === "number")
    .sort(([a], [b]) => a.localeCompare(b));
  const start = weights[0]?.[1] ?? null;
  const latest = weights.at(-1)?.[1] ?? null;
  const latestDate = weights.at(-1)?.[0] ?? null;
  const beforeWeek = weights.filter(([date]) => date < monday).at(-1)?.[1] ?? null;
  const change = latest !== null && beforeWeek !== null ? latest - beforeWeek : null;
  const ratio = latest !== null && start !== null && goal !== null ? (start === goal ? 1 : (start - latest) / (start - goal)) : 0;
  return { start, latest, latestDate, beforeWeek, change, ratio };
}

// Dashboard "Métricas" math (alt-dashboard §5.5). Pure and client-safe; dates are YYYY-MM-DD keys compared as strings
// and the calendar math runs in UTC, so results never depend on the machine's timezone. The caller decides "today".
import { daysBetween, mealsDoneOn, mondayOf } from "@/lib/progress";

export type Period = "week" | "month" | "year" | "all";
export type MetricLog = { date: string; meals_done: string[]; weight_kg?: number | null };

export type Metrics = {
  /** Meals done ÷ meals planned from the start of the period up to today. null = no logs in the period. */
  adherence: { ratio: number | null; done: number; planned: number };
  /** Estimated: the daily goal × adherence (the app does not record intake). `kcal` is the daily average. */
  calories: { ratio: number | null; kcal: number | null; goal: number | null };
  /** Estimated like calories; the goal in grams is kcal × protein % ÷ 4. `grams` is the daily average. */
  protein: { ratio: number | null; grams: number | null; goal: number | null };
  /** Progress from the first logged weight towards the goal; `current` is the latest weight of the period. */
  weight: { ratio: number | null; current: number | null };
};

type Input = { logs: MetricLog[]; slotIds: string[]; today: string; period: Period; kcalGoal: number | null; proteinPct: number | null; weightGoal: number | null };

/** First day of the period; for "all" the day of the first log (null when nothing was ever logged). */
export function periodStart(period: Period, today: string, logs: MetricLog[]) {
  if (period === "week") return mondayOf(today);
  if (period === "month") return `${today.slice(0, 7)}-01`;
  if (period === "year") return `${today.slice(0, 4)}-01-01`;
  return logs.reduce<string | null>((first, log) => (first === null || log.date < first ? log.date : first), null);
}

export function dashboardMetrics({ logs, slotIds, today, period, kcalGoal, proteinPct, weightGoal }: Input): Metrics {
  const start = periodStart(period, today, logs);
  const inPeriod = start === null ? [] : logs.filter((log) => log.date >= start && log.date <= today);

  const planned = start === null ? 0 : slotIds.length * daysBetween(start, today).length;
  const done = inPeriod.reduce((sum, log) => sum + mealsDoneOn({ meals_done: log.meals_done, water_glasses: 0 }, slotIds), 0);
  const ratio = inPeriod.length && planned ? done / planned : null;

  const proteinGoal = kcalGoal && proteinPct ? (kcalGoal * proteinPct) / 100 / 4 : null;

  const weights = logs.filter((log) => typeof log.weight_kg === "number" && log.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const initial = weights[0]?.weight_kg ?? null;
  const current = weights.filter((log) => start !== null && log.date >= start).at(-1)?.weight_kg ?? null;
  let weightRatio: number | null = null;
  if (initial !== null && current !== null && weightGoal !== null) {
    if (initial === weightGoal) weightRatio = current === weightGoal ? 1 : null;
    else weightRatio = Math.max(0, (initial - current) / (initial - weightGoal));
  }

  return {
    adherence: { ratio, done, planned },
    calories: { ratio: kcalGoal ? ratio : null, kcal: kcalGoal && ratio !== null ? Math.round(kcalGoal * ratio) : null, goal: kcalGoal || null },
    protein: { ratio: proteinGoal ? ratio : null, grams: proteinGoal && ratio !== null ? Math.round(proteinGoal * ratio) : null, goal: proteinGoal || null },
    weight: { ratio: weightRatio, current }
  };
}

/** What a read-only metric dial shows (specs/metric-dials REQ-3 to REQ-6, REQ-43; spec v1.4: no unit in the knob). */
export type DialReadout = {
  /** The number inside the knob: "78%", "≈ 1,445", "≈ 88", or "—" without data. */
  readout: string;
  /** The line under the dial, carrying the unit: "25 de 32 comidas", "meta 1,850 kcal"; null when there is none. */
  line: string | null;
  min: number;
  max: number;
  /** Needle position, unrounded and clamped to min..max; 0 without data. */
  value: number;
  /** aria-valuetext: readout and line with units, or "Sin datos". */
  valueText: string;
};

const NO_DATA = { min: 0, max: 100, value: 0, valueText: "Sin datos" };
const whole = (n: number) => Math.round(n).toLocaleString("en-US");
const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

function estimateDial(ratio: number | null, goal: number | null, unit: string): DialReadout {
  if (!goal) return { readout: "—", line: null, ...NO_DATA };
  const line = `meta ${whole(goal)} ${unit}`;
  if (ratio === null) return { readout: "—", line, ...NO_DATA };
  const estimate = ratio * goal;
  const readout = `≈ ${whole(estimate)}`;
  return { readout, line, min: 0, max: goal, value: clamp(estimate, goal), valueText: `${readout} ${unit}, ${line}` };
}

/** Readouts and meter values of the Adherencia, Calorías and Proteína dials, from the period's metrics. */
export function metricReadouts({ adherence, calories, protein }: Metrics): { adherence: DialReadout; calories: DialReadout; protein: DialReadout } {
  let adherenceDial: DialReadout = { readout: "—", line: null, ...NO_DATA };
  if (adherence.ratio !== null) {
    const percentage = adherence.ratio * 100;
    const readout = `${Math.round(percentage)}%`;
    const line = `${adherence.done} de ${adherence.planned} ${adherence.planned === 1 ? "comida" : "comidas"}`;
    adherenceDial = { readout, line, min: 0, max: 100, value: clamp(percentage, 100), valueText: `${readout}, ${line}` };
  }
  return {
    adherence: adherenceDial,
    calories: estimateDial(adherence.ratio, calories.goal, "kcal"),
    protein: estimateDial(adherence.ratio, protein.goal, "g")
  };
}

/** Fictional but stable rating for a recipe (4.5–5.0): the same id always gives the same score. */
export function recipeRating(recipeId: string) {
  let hash = 0;
  for (const char of recipeId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 4.5 + (hash % 6) / 10;
}

/** Rough preparation time: the recipes carry none, so 5 min plus 2 per ingredient. */
export function prepMinutes(ingredientCount: number) {
  return 5 + 2 * ingredientCount;
}

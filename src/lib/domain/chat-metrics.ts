import type { AppDb } from "@/lib/types";
import type { Intent, Rich, Span } from "@/lib/assistant";
import { CLAMP_LINE, clampPeriod, notUnderstoodLine, type Period, periodLabel } from "@/lib/domain/chat-dates";
import { type Built, pickVariant } from "@/lib/domain/chat-meals";
import { activeSchedule } from "@/lib/domain/plans";
import { daysBetween, type LogOf, mondayOf, WATER_GLASS_LITERS, waterGoalGlasses, waterOver } from "@/lib/progress";

// Metric answers (spec assistant-data-scope REQ-15 to REQ-18): numbers come from `progress.ts`, the same math as the dashboard tiles (REQ-16).

/** At most one decimal with "." and no trailing ".0" (spec Copy, Numbers). */
const number = (value: number) => String(Math.round(value * 10) / 10);
const liters = (value: number) => `${number(value)} ${number(value) === "1" ? "litro" : "litros"}`;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const plain = (text: string): Span => ({ text });
const bold = (text: string): Span => ({ text, highlight: true });
/** The sentences of a lead, one space apart. */
const joinSentences = (sentences: Rich[]): Rich => sentences.flatMap((sentence, index) => (index ? [{ text: " " }, ...sentence] : sentence));

/** Sentences for a period the message named: the clamp line when it was cut (REQ-14). */
function namedPeriod(intent: Intent, today: string): { period?: Period; lead: Rich[] } {
  if (!intent.period) return { lead: intent.periodUnrecognized ? [[plain(notUnderstoodLine("hoy"))]] : [] };
  const { period, clamped } = clampPeriod(intent.period, today);
  return { period, lead: clamped ? [[plain(CLAMP_LINE)]] : [] };
}

const TODAY_WATER: ((glasses: string, liters: string, goal: number) => Rich)[] = [
  (glasses, amount, goal) => [plain("Hoy llevas "), bold(glasses), plain(" de agua ("), bold(amount), plain(`) de tu meta de ${goal} vasos.`)],
  (glasses, amount, goal) => [plain("Hoy has tomado "), bold(glasses), plain(" de agua ("), bold(amount), plain(`) de tu meta de ${goal} vasos.`)]
];

/**
 * Water (REQ-15, REQ-17): with no period, today uncapped plus the week line; "hoy", today only; any other period, its
 * total (each day capped at the goal), the average over every day and the days the goal was met.
 */
export function waterAnswer(db: AppDb, userId: string, question: string, intent: Intent, today: string): Built {
  const logs = new Map(db.dailyLogs.filter((log) => log.user_id === userId).map((log) => [log.date, log]));
  const logOf: LogOf = (date) => logs.get(date) ?? { meals_done: [], water_glasses: 0 };
  const goal = waterGoalGlasses(activeSchedule(db, userId)?.water_goal_liters);
  const { period, lead } = namedPeriod(intent, today);

  const todaySentence = () => {
    const glasses = logOf(today).water_glasses;
    return pickVariant(TODAY_WATER, question)(plural(glasses, "vaso", "vasos"), liters(glasses * WATER_GLASS_LITERS), goal);
  };
  if (period?.kind === "today") return { lead: joinSentences([...lead, todaySentence()]) };

  if (!period) {
    const week: Period = { kind: "thisWeek", from: mondayOf(today), to: today };
    const total = waterOver(logOf, daysBetween(week.from, week.to), goal).liters;
    return { lead: joinSentences([...lead, todaySentence(), [plain(`${periodLabel(week, today)}: `), bold(liters(total)), plain(".")]]) };
  }

  const days = daysBetween(period.from, period.to);
  const { liters: total, daysMet } = waterOver(logOf, days, goal);
  const summary = [
    plain(`${periodLabel(period, today)}: `), bold(`${liters(total)} en total`), plain(", "), bold(`${liters(total / days.length)} por día en promedio`),
    plain(". Cumpliste tu meta "), bold(`${daysMet} de ${plural(days.length, "día", "días")}`), plain(".")
  ];
  return { lead: joinSentences([...lead, summary]) };
}

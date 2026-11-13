import type { AppDb } from "@/lib/types";
import type { Button, Intent, Rich, Span } from "@/lib/assistant";
import { CLAMP_LINE, clampPeriod, dateLabel, notUnderstoodLine, type Period, periodLabel } from "@/lib/domain/chat-dates";
import { type Built, pickVariant } from "@/lib/domain/chat-meals";
import { activeSchedule } from "@/lib/domain/plans";
import { daysBetween, exerciseOver, type LogOf, mondayOf, WATER_GLASS_LITERS, waterGoalGlasses, waterOver, weightStats } from "@/lib/progress";

// Metric answers (spec assistant-data-scope REQ-15 to REQ-18): numbers come from `progress.ts`, the same math as the dashboard tiles (REQ-16).

/** At most one decimal with "." and no trailing ".0" (spec Copy, Numbers). */
const number = (value: number) => String(Math.round(value * 10) / 10);
const liters = (value: number) => `${number(value)} ${number(value) === "1" ? "litro" : "litros"}`;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const plain = (text: string): Span => ({ text });
const bold = (text: string): Span => ({ text, highlight: true });
/** The sentences of a lead, one space apart. */
const joinSentences = (sentences: Rich[]): Rich => sentences.flatMap((sentence, index) => (index ? [{ text: " " }, ...sentence] : sentence));

/** The user's log of a date, or an empty one. */
function logLookup(db: AppDb, userId: string): LogOf {
  const logs = new Map(db.dailyLogs.filter((log) => log.user_id === userId).map((log) => [log.date, log]));
  return (date) => logs.get(date) ?? { meals_done: [], water_glasses: 0 };
}

/** Sentences for a period the message named: the clamp line when it was cut, or the fallback line naming the default shown (REQ-14). */
function namedPeriod(intent: Intent, today: string, fallback: string): { period?: Period; lead: Rich[] } {
  if (!intent.period) return { lead: intent.periodUnrecognized ? [[plain(notUnderstoodLine(fallback))]] : [] };
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
  const logOf = logLookup(db, userId);
  const goal = waterGoalGlasses(activeSchedule(db, userId)?.water_goal_liters);
  const { period, lead } = namedPeriod(intent, today, "hoy");

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
    plain(`${periodLabel(period, today)}: `), bold(liters(total)), plain(" en total, "), bold(liters(total / days.length)), plain(" por día en promedio"),
    plain(". Cumpliste tu meta "), bold(`${daysMet} de ${plural(days.length, "día", "días")}`), plain(".")
  ];
  return { lead: joinSentences([...lead, summary]) };
}

const WEEK_EXERCISE: ((label: string, done: string, left: Rich) => Rich)[] = [
  (label, done, left) => [plain(`${label} llevas `), bold(done), plain(" de ejercicio. "), ...left],
  (label, done, left) => [plain(`${label} has hecho ejercicio `), bold(done), plain(". "), ...left]
];

/**
 * Exercise (REQ-18): with no period or this week, days done against the goal and what is left; a single day, yes or no;
 * any other range, its days (against the goal only for a full Mon–Sun week).
 */
export function exerciseAnswer(db: AppDb, userId: string, question: string, intent: Intent, today: string): Built {
  const logOf = logLookup(db, userId);
  const goal = db.users.find((user) => user.id === userId)?.activity_goal_days ?? 4;
  const { period, lead } = namedPeriod(intent, today, "esta semana");
  const respond = (...sentences: Rich[]): Built => ({ lead: joinSentences([...lead, ...sentences]) });

  if (!period || period.kind === "thisWeek") {
    const week: Period = period ?? { kind: "thisWeek", from: mondayOf(today), to: today };
    const done = exerciseOver(logOf, daysBetween(week.from, week.to));
    if (done >= goal) return respond([plain(`¡Ya cumpliste tu meta de ${plural(goal, "día", "días")} de ejercicio esta semana!`)]);
    const left = goal - done;
    const remaining = [plain(left === 1 ? "Te falta " : "Te faltan "), bold(plural(left, "día", "días")), plain(".")];
    return respond(pickVariant(WEEK_EXERCISE, question)(periodLabel(week, today), `${done} de ${plural(goal, "día", "días")}`, remaining));
  }

  const days = daysBetween(period.from, period.to);
  const done = exerciseOver(logOf, days);
  if (period.kind === "today") return respond([plain(done ? "Hoy sí hiciste ejercicio." : "Hoy no has registrado ejercicio.")]);
  if (days.length === 1) return respond([plain(`${periodLabel(period, today)}: ${done ? "sí hiciste" : "no registraste"} ejercicio.`)]);
  const fullWeek = days.length === 7 && mondayOf(period.from) === period.from;
  return respond([plain(`${periodLabel(period, today)}: hiciste ejercicio `), bold(fullWeek ? `${done} de ${plural(goal, "día", "días")}` : plural(done, "día", "días")), plain(".")]);
}

const LATEST_WEIGHT: ((weight: string, date: string) => Rich)[] = [
  (weight, date) => [plain("Tu último peso es "), bold(weight), plain(` (${date}).`)],
  (weight, date) => [plain("Tu registro más reciente es "), bold(weight), plain(` (${date}).`)]
];

const STALE_WEIGHT_DAYS = 7;
const kg = (value: number) => `${number(value)} kg`;
const unchanged = (change: number) => number(change) === "0";
const direction = (change: number) => (change < 0 ? "bajaste" : "subiste");
/** "bajaste 0.4 kg", "subiste 0.4 kg" or "sin cambio" (a change that rounds to 0 is no change). */
const changeText = (change: number) => (unchanged(change) ? "sin cambio" : `${direction(change)} ${kg(Math.abs(change))}`);
const link = (label: string): Button => ({ type: "link", label, href: "/" });

/**
 * Weight (REQ-19, REQ-27): with no period, the latest record up to today, the distance to the goal, this week's change
 * and a nudge to log when the record is old; a period, its first and last weights with the change, minimum and maximum.
 */
export function weightAnswer(db: AppDb, userId: string, question: string, intent: Intent, today: string): Built {
  const user = db.users.find((item) => item.id === userId);
  const records = db.dailyLogs
    .filter((log) => log.user_id === userId && typeof log.weight_kg === "number")
    .map((log): [string, number] => [log.date, log.weight_kg as number]);
  const { period, lead } = namedPeriod(intent, today, "tu último registro");
  const respond = (sentences: Rich[], blockButtons: Button[] = []): Built => ({ lead: joinSentences([...lead, ...sentences]), blockButtons });

  if (period) {
    const inRange = records.filter(([date]) => date >= period.from && date <= period.to).sort(([a], [b]) => a.localeCompare(b));
    const label = periodLabel(period, today);
    if (!inRange.length) return respond([[plain(`${label}: no registraste tu peso.`)]]);
    const [[firstDate, first], [lastDate, last]] = [inRange[0], inRange[inRange.length - 1]];
    if (inRange.length === 1) return respond([[plain(`${label}: registraste `), bold(kg(first)), plain(` (${dateLabel(firstDate, today)}).`)]]);
    const kilos = inRange.map(([, weight]) => weight);
    return respond([[
      plain(`${label}: empezaste en `), bold(kg(first)), plain(" y terminaste en "), bold(kg(last)),
      plain(` (${changeText(last - first)}; mínimo ${kg(Math.min(...kilos))}, máximo ${kg(Math.max(...kilos))}).`)
    ]]);
  }

  const goal = user?.weight_goal_kg ?? null;
  const stats = weightStats(records, today, mondayOf(today), goal);
  if (stats.latest === null || stats.latestDate === null) return respond([[plain("Aún no registras tu peso.")]], [link("Registrar mi peso")]);

  const sentences: Rich[] = [pickVariant(LATEST_WEIGHT, question)(kg(stats.latest), dateLabel(stats.latestDate, today))];
  const buttons: Button[] = [];
  if (goal === null) {
    sentences.push([plain("No has fijado meta de peso.")]);
    buttons.push(link("Fijar mi meta"));
  } else if (stats.ratio >= 1) sentences.push([plain(`¡Ya alcanzaste tu meta de ${kg(goal)}!`)]);
  else sentences.push([plain("Te faltan "), bold(kg(Math.abs(stats.latest - goal))), plain(` para tu meta de ${kg(goal)}.`)]);

  // The week line needs a record this week and one before Monday: `change` alone is also set for a stale latest record.
  if (stats.latestDate >= mondayOf(today) && stats.beforeWeek !== null && stats.change !== null) {
    sentences.push(unchanged(stats.change) ? [plain("Esta semana: "), bold("sin cambio"), plain(".")] : [plain(`Esta semana ${direction(stats.change)} `), bold(kg(Math.abs(stats.change))), plain(".")]);
  }
  const age = daysBetween(stats.latestDate, today).length - 1;
  if (age > STALE_WEIGHT_DAYS) {
    sentences.push([plain(`Tu último registro fue hace ${age} días.`)]);
    buttons.push(link("Registrar mi peso"));
  }
  return respond(sentences, buttons);
}

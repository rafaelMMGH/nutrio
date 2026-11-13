import type { AppDb } from "@/lib/types";
import type { Button, Intent, Rich, Span } from "@/lib/assistant";
import { CLAMP_LINE, clampPeriod, dateLabel, notUnderstoodLine, type Period, periodLabel } from "@/lib/domain/chat-dates";
import { type Built, noActivePlan, NO_PLAN_LINE, pickVariant, PLAN_LINK } from "@/lib/domain/chat-meals";
import { activePlan, activeSchedule } from "@/lib/domain/plans";
import { daysBetween, exerciseOver, type LogOf, mealsOver, mondayOf, WATER_GLASS_LITERS, WATER_GOAL_LITERS, waterGoalGlasses, waterOver, weekExercise, weekMeals, weekWater, weightStats } from "@/lib/progress";

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

/** The user's weight records as [date, kg], in log order. */
const weightRecords = (db: AppDb, userId: string) =>
  db.dailyLogs.filter((log) => log.user_id === userId && typeof log.weight_kg === "number").map((log): [string, number] => [log.date, log.weight_kg as number]);

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

/** The active plan's schedule, or null when there is none or it has no meal slots: such a plan counts as no plan (REQ-27). */
const withSlots = (db: AppDb, userId: string) => {
  const schedule = activeSchedule(db, userId);
  return schedule?.meals.length ? schedule : null;
};

/** Exercise days per week the user aims for. */
const exerciseGoalDays = (db: AppDb, userId: string) => db.users.find((user) => user.id === userId)?.activity_goal_days ?? 4;

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
  const goal = exerciseGoalDays(db, userId);
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
const link = (label: string, href = "/"): Button => ({ type: "link", label, href });

/**
 * Weight (REQ-19, REQ-27): with no period, the latest record up to today, the distance to the goal, this week's change
 * and a nudge to log when the record is old; a period, its first and last weights with the change, minimum and maximum.
 */
export function weightAnswer(db: AppDb, userId: string, question: string, intent: Intent, today: string): Built {
  const user = db.users.find((item) => item.id === userId);
  const records = weightRecords(db, userId);
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

  // The week line needs a record this week (`change` alone is also set when the latest record is the one before Monday) and one before it.
  if (stats.latestDate >= mondayOf(today) && stats.change !== null) {
    sentences.push(unchanged(stats.change) ? [plain("Esta semana: "), bold("sin cambio"), plain(".")] : [plain(`Esta semana ${direction(stats.change)} `), bold(kg(Math.abs(stats.change))), plain(".")]);
  }
  const age = daysBetween(stats.latestDate, today).length - 1;
  if (age > STALE_WEIGHT_DAYS) {
    sentences.push([plain(`Tu último registro fue hace ${age} días.`)]);
    buttons.push(link("Registrar mi peso"));
  }
  return respond(sentences, buttons);
}

const TODAY_MEALS: ((done: string) => Rich)[] = [
  (done) => [plain("Hoy llevas "), bold(done), plain(".")],
  (done) => [plain("Hoy has hecho "), bold(done), plain(".")]
];

/**
 * Meals done (REQ-20): with no period, today against the slots plus the week; "hoy", today only; a week against slots × 7
 * (the dashboard's total), any other range against slots × its days, with a whole-number %. Without an active plan, or
 * with a plan that has no slots, it is the REQ-27 no-plan reply: there is nothing to count against.
 */
export function mealsDoneAnswer(db: AppDb, userId: string, question: string, intent: Intent, today: string): Built {
  const slotIds = activeSchedule(db, userId)?.meals.map((meal) => meal.id) ?? [];
  if (!slotIds.length) return noActivePlan();
  const logOf = logLookup(db, userId);
  const { period, lead } = namedPeriod(intent, today, "hoy");
  const count = (done: number, total: number) => `${done} de ${plural(total, "comida", "comidas")}`;
  const todaySentence = () => pickVariant(TODAY_MEALS, question)(count(mealsOver(logOf, slotIds, [today]), slotIds.length));
  /** "<Periodo>: **D de N comidas** (p%)." over `days`, against `total` meals. */
  const rangeSentence = (range: Period, days: string[], total: number): Rich => {
    const done = mealsOver(logOf, slotIds, days);
    return [plain(`${periodLabel(range, today)}: `), bold(count(done, total)), plain(` (${Math.round((done / total) * 100)}%).`)];
  };
  const weekSentence = (week: Period) => rangeSentence(week, daysBetween(week.from, week.to), slotIds.length * 7);

  if (period?.kind === "today") return { lead: joinSentences([...lead, todaySentence()]) };
  if (!period) return { lead: joinSentences([...lead, todaySentence(), weekSentence({ kind: "thisWeek", from: mondayOf(today), to: today })]) };
  const days = daysBetween(period.from, period.to);
  return { lead: joinSentences([...lead, period.kind === "thisWeek" ? weekSentence(period) : rangeSentence(period, days, slotIds.length * days.length)]) };
}

/**
 * Goals (REQ-21): the plan objective and the weight, exercise and water goals, or only the one the intent names. The water
 * goal is the plan's liters as glasses (clamped), shown with the plan's own liters, as the spec examples do. With no
 * active plan the objective is left out and the water goal is the 2 L default plus the no-plan line (bare answer only).
 */
export function goalsAnswer(db: AppDb, userId: string, intent: Intent): Built {
  const weightGoal = db.users.find((user) => user.id === userId)?.weight_goal_kg ?? null;
  const days = plural(exerciseGoalDays(db, userId), "día", "días");
  const schedule = withSlots(db, userId);
  const planLiters = schedule?.water_goal_liters ?? WATER_GOAL_LITERS;
  const glasses = plural(waterGoalGlasses(planLiters), "vaso", "vasos");
  const waterTail = ` (${liters(planLiters)}) al día`;

  if (intent.metric === "weight") {
    return weightGoal === null
      ? { lead: [plain("No has fijado meta de peso.")], blockButtons: [link("Fijar mi meta")] }
      : { lead: [plain("Tu meta de peso es "), bold(kg(weightGoal)), plain(".")] };
  }
  if (intent.metric === "exercise") return { lead: [plain("Tu meta de ejercicio es "), bold(days), plain(" por semana.")] };
  if (intent.metric === "water") return { lead: [plain("Tu meta de agua es "), bold(glasses), plain(`${waterTail}.`)] };

  const objective = schedule && activePlan(db, userId)?.current_version?.structured_data.objective?.trim();
  const items: Rich[] = [
    ...(objective ? [[plain(`Objetivo del plan: ${objective}`)]] : []),
    weightGoal === null ? [plain("Peso: sin meta")] : [plain("Peso: "), bold(kg(weightGoal))],
    [plain("Ejercicio: "), bold(days), plain(" por semana")],
    [plain("Agua: "), bold(glasses), plain(waterTail)]
  ];
  const hasPlan = schedule !== null;
  if (!hasPlan) items.push([plain(NO_PLAN_LINE)]);
  return { lead: [plain("Estas son tus metas:")], sections: [{ title: "Metas", items }], blockButtons: hasPlan ? [] : [PLAN_LINK] };
}

/**
 * Weekly progress (REQ-22, REQ-16): this week's exercise, water, meals and weight change from the dashboard's own
 * helpers, ending today. Meals need an active plan with slots; the weight item needs a record this week and one before
 * Monday, as in the weight answer.
 */
export function weeklyAnswer(db: AppDb, userId: string, today: string): Built {
  const logOf = logLookup(db, userId);
  const monday = mondayOf(today);
  const schedule = withSlots(db, userId);
  const slotIds = schedule?.meals.map((meal) => meal.id) ?? [];
  const label = periodLabel({ kind: "thisWeek", from: monday, to: today }, today);
  const goal = plural(exerciseGoalDays(db, userId), "día", "días");

  const items: Rich[] = [
    [plain("Ejercicio: "), bold(`${weekExercise(logOf, monday, today)} de ${goal}`)],
    [plain("Agua: "), bold(liters(weekWater(logOf, monday, today, waterGoalGlasses(schedule?.water_goal_liters))))]
  ];
  if (slotIds.length) items.push([plain("Comidas: "), bold(`${weekMeals(logOf, slotIds, monday, today)} de ${slotIds.length * 7}`)]);
  const { change, latestDate } = weightStats(weightRecords(db, userId), today, monday, null);
  if (latestDate !== null && latestDate >= monday && change !== null) {
    items.push(unchanged(change) ? [plain("Peso: sin cambio")] : [plain(`Peso: ${direction(change)} `), bold(kg(Math.abs(change)))]);
  }
  if (!schedule) items.push([plain(NO_PLAN_LINE)]);
  // "Esta semana (lun 26 – hoy)" lowercased into the lead: the parenthesis is the range.
  return { lead: [plain(`Tu avance de esta semana ${label.slice(label.indexOf("("))}:`)], sections: [{ title: "Avance", items }], blockButtons: schedule ? [] : [PLAN_LINK] };
}

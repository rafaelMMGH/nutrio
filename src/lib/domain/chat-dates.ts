// Date phrases and "today" of the assistant (REQ-13, REQ-14). Labels, the 366-day clamp and the fallback line are T068.

const MEXICO_CITY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" });

/** The server's today as YYYY-MM-DD in America/Mexico_City, fixed in code so the client cannot move it and a UTC server stays right (REQ-13). */
export function serverToday(now: Date): string {
  const parts = MEXICO_CITY.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const WEEKDAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;

/**
 * Words that are always date cues (spec Terms, normalized): today and its neighbours, weekday and month names, and the
 * range words. Period nouns (día, semana, mes, año) are not here: they are cues only inside a time-range construction.
 * One list, shared by the dish matcher (a phrase made only of cue words is not a dish name) and the date parser.
 */
export const DATE_CUES = ["hoy", "ayer", "antier", "anteayer", "desde", "hace", "pasado", "pasada", "ultimo", "ultima", ...WEEKDAYS, ...MONTHS] as const;

/** What a phrase names, for the label (T068); `from` and `to` are YYYY-MM-DD, both inclusive and never after today. */
export type Period = {
  kind: "today" | "yesterday" | "beforeYesterday" | "weekday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "lastDays" | "since";
  from: string;
  to: string;
};

const DAY_MS = 86_400_000;
const dayOf = (key: string) => new Date(`${key}T00:00:00Z`);
const keyOf = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (key: string, days: number) => keyOf(new Date(dayOf(key).getTime() + days * DAY_MS));
/** Monday is 0. */
const weekdayIndex = (key: string) => (dayOf(key).getUTCDay() + 6) % 7;
const monthStart = (year: number, month: number) => keyOf(new Date(Date.UTC(year, month, 1)));

/** The latest day-of-month `day` of `month` (0-based) that is not after `today`, looking back up to 8 years (29 February). */
function latestDate(day: number, month: number, today: string): string | undefined {
  const year = Number(today.slice(0, 4));
  for (let back = 0; back <= 8; back++) {
    const date = new Date(Date.UTC(year - back, month, day));
    if (date.getUTCMonth() === month && keyOf(date) <= today) return keyOf(date);
  }
  return undefined;
}

/** The phrase that starts or is anchored at token `at`, if any. Numbers are whole integers: "7,5" is one token and never matches `\d+$`. */
function phraseAt(tokens: string[], at: number, today: string): Period | undefined {
  const [word, next, third] = [tokens[at], tokens[at + 1], tokens[at + 2]];
  const prev = tokens[at - 1];
  const day = (kind: Period["kind"], key: string): Period => ({ kind, from: key, to: key });
  if (word === "hoy") return day("today", today);
  if (word === "ayer") return day("yesterday", addDays(today, -1));
  if (word === "antier" || word === "anteayer") return day("beforeYesterday", addDays(today, -2));
  const weekday = (WEEKDAYS as readonly string[]).indexOf(word);
  if (weekday >= 0) {
    const back = (weekdayIndex(today) - weekday + 7) % 7;
    return day(back ? "weekday" : "today", addDays(today, -back));
  }
  const [year, month] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  if (word === "semana" && prev === "esta") return { kind: "thisWeek", from: addDays(today, -weekdayIndex(today)), to: today };
  if (word === "semana" && next === "pasada") {
    const monday = addDays(today, -weekdayIndex(today) - 7);
    return { kind: "lastWeek", from: monday, to: addDays(monday, 6) };
  }
  if (word === "mes" && next === "pasado") return { kind: "lastMonth", from: monthStart(year, month - 1), to: addDays(monthStart(year, month), -1) };
  if (word === "mes" && (prev === "este" || (prev === "el" && tokens[at - 2] === "en"))) return { kind: "thisMonth", from: monthStart(year, month), to: today };
  if ((word === "ultimos" || word === "ultimas") && /^\d+$/.test(next ?? "") && third === "dias") {
    const count = Number(next);
    return count <= 1 ? day("today", today) : { kind: "lastDays", from: addDays(today, -(count - 1)), to: today };
  }
  if (word === "desde") {
    const [dayText, monthName] = tokens.slice(at + 1).filter((token) => token !== "el" && token !== "de");
    const month = (MONTHS as readonly string[]).indexOf(monthName ?? "");
    const found = month >= 0 && /^\d{1,2}$/.test(dayText ?? "") ? latestDate(Number(dayText), month, today) : undefined;
    return found ? { kind: "since", from: found, to: today } : undefined;
  }
  return undefined;
}

const ALWAYS_CUES = new Set<string>([...DATE_CUES, "ultimos", "ultimas"]);
const PERIOD_NOUNS = new Set(["dia", "dias", "semana", "semanas", "mes", "meses", "ano", "anos"]);

/**
 * REQ-14: the period a message names, "unrecognized" when it holds a date cue (Terms) that forms no phrase of the
 * table, undefined when it holds no cue. Period nouns count as cues only beside esta/este/anterior or a number.
 * Tokens come from the typed text, so "1,5" and "2.30" stay one number each.
 */
export function parsePeriod(message: string, today: string): Period | "unrecognized" | undefined {
  const tokens = message.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/\d+(?:[.,]\d+)?|\p{L}+/gu) ?? [];
  for (let at = 0; at < tokens.length; at++) {
    const period = phraseAt(tokens, at, today);
    if (period) return period;
  }
  const beside = (at: number) => [tokens[at - 1], tokens[at + 1]].some((token) => token !== undefined && (/^\d/.test(token) || ["esta", "este", "anterior"].includes(token)));
  const cue = tokens.some((token, at) => ALWAYS_CUES.has(token) || (PERIOD_NOUNS.has(token) && beside(at)));
  return cue ? "unrecognized" : undefined;
}

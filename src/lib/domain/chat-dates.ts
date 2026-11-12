// Date phrases and "today" of the assistant (REQ-13, REQ-14). Period bounds, labels, the 366-day clamp and the lead lines.

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
const MAX_LAST_DAYS = 3660;
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

/**
 * The phrase that starts or is anchored at token `at`, if any. "unrecognized" when extra date words around it would change
 * its meaning (user ruling 2026-11-12: "el lunes pasado", "hoy y ayer"...), so the fallback line shows, not a different period.
 * Numbers are whole integers: "7,5" is one token and never matches `\d+$`. */
function phraseAt(tokens: string[], at: number, today: string): Period | "unrecognized" | undefined {
  const [word, next, third] = [tokens[at], tokens[at + 1], tokens[at + 2]];
  const prev = tokens[at - 1];
  const day = (kind: Period["kind"], key: string): Period => ({ kind, from: key, to: key });
  if (word === "hoy") return next === "y" && third === "ayer" ? "unrecognized" : day("today", today);
  if (word === "ayer") return day("yesterday", addDays(today, -1));
  if (word === "antier" || word === "anteayer") return day("beforeYesterday", addDays(today, -2));
  const weekday = (WEEKDAYS as readonly string[]).indexOf(word);
  if (weekday >= 0) {
    if (next === "pasado" || next === "pasada") return "unrecognized";
    const back = (weekdayIndex(today) - weekday + 7) % 7;
    return day(back ? "weekday" : "today", addDays(today, -back));
  }
  const [year, month] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  if (word === "semana" && prev === "esta") return next === "pasada" ? "unrecognized" : { kind: "thisWeek", from: addDays(today, -weekdayIndex(today)), to: today };
  if (word === "semana" && next === "pasada") {
    const monday = addDays(today, -weekdayIndex(today) - 7);
    return { kind: "lastWeek", from: monday, to: addDays(monday, 6) };
  }
  if (word === "mes" && next === "pasado") return { kind: "lastMonth", from: monthStart(year, month - 1), to: addDays(monthStart(year, month), -1) };
  const inTheMonth = prev === "el" && tokens[at - 2] === "en";
  if (word === "mes" && inTheMonth && next === "de" && (MONTHS as readonly string[]).includes(third ?? "")) return "unrecognized";
  if (word === "mes" && (prev === "este" || inTheMonth)) return { kind: "thisMonth", from: monthStart(year, month), to: today };
  if ((word === "ultimos" || word === "ultimas") && /^\d+$/.test(next ?? "") && third === "dias") {
    // Capped (ten years) so no digit run can overflow Date; 400 and up keep their raw bounds for the T067/T068 clamp.
    const count = Math.min(Number(next), MAX_LAST_DAYS);
    return count <= 1 ? day("today", today) : { kind: "lastDays", from: addDays(today, -(count - 1)), to: today };
  }
  if (word === "desde") {
    // Only a date-shaped follower is rejected; "desde luego" / "desde mi casa" keep the scan going so a later phrase wins.
    const head = next === "el" ? third : next;
    const dateShaped = (["hoy", "ayer", "antier", "anteayer", ...WEEKDAYS] as string[]).includes(head ?? "") || /^\d/.test(head ?? "");
    if (!dateShaped) return undefined;
    const [dayText, monthName, afterMonth] = tokens.slice(at + 1).filter((token) => token !== "el" && token !== "de" && token !== "del");
    const month = (MONTHS as readonly string[]).indexOf(monthName ?? "");
    const found = month >= 0 && /^\d{1,2}$/.test(dayText ?? "") ? latestDate(Number(dayText), month, today) : undefined;
    // An explicit year ("de 2024", "del 2024", "del año pasado") is not read, and must not be dropped silently.
    return found && !/^\d{4}$|^ano$/.test(afterMonth ?? "") ? { kind: "since", from: found, to: today } : "unrecognized";
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

const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const WEEKDAY_ABBREVIATIONS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MONTH_ABBREVIATIONS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MAX_DAYS = 366;

/** The lead line when a period was cut to the last 366 days (REQ-14). */
export const CLAMP_LINE = `Solo puedo revisar hasta ${MAX_DAYS} días; te muestro los últimos ${MAX_DAYS}.`;

/** The lead line when a date cue forms no recognized phrase; `periodo` names the default shown ("hoy", "esta semana", "tu último registro"). */
export const notUnderstoodLine = (periodo: string) => `No entendí la fecha; te muestro ${periodo}.`;

const spanDays = (period: Period) => (dayOf(period.to).getTime() - dayOf(period.from).getTime()) / DAY_MS + 1;

/** Future days are never counted, and a span over 366 days becomes the last 366 (computed from the span, so any capped count works). */
export function clampPeriod(period: Period, today: string): { period: Period; clamped: boolean } {
  const to = period.to > today ? today : period.to;
  if (spanDays({ ...period, to }) > MAX_DAYS) return { period: { kind: "lastDays", from: addDays(to, -(MAX_DAYS - 1)), to }, clamped: true };
  return { period: { ...period, to }, clamped: false };
}

/** REQ-14 label: "Ayer (mar 27 oct)", "Esta semana (lun 26 – hoy)", "Últimos 8 días (21 oct – hoy)". */
export function periodLabel(period: Period, today: string): string {
  const year = today.slice(0, 4);
  const short = spanDays(period) <= 7;
  // A short range that crosses a year boundary names its months, so "dom 4" is never ambiguous.
  const withMonth = !short || period.from.slice(0, 4) !== period.to.slice(0, 4);
  const date = (key: string, withWeekday: boolean, withMonth: boolean) => {
    const [dayNumber, month] = [Number(key.slice(8, 10)), MONTH_ABBREVIATIONS[Number(key.slice(5, 7)) - 1]];
    const foreignYear = key.slice(0, 4) !== year;
    const parts = [withWeekday ? WEEKDAY_ABBREVIATIONS[weekdayIndex(key)] : undefined, dayNumber, withMonth || foreignYear ? month : undefined, foreignYear ? key.slice(0, 4) : undefined];
    return parts.filter((part) => part !== undefined).join(" ");
  };
  const single = (title: string) => `${title} (${date(period.from, true, true)})`;
  const range = (title: string) => `${title} (${date(period.from, short, withMonth)} – ${period.to === today ? "hoy" : date(period.to, short, withMonth)})`;
  switch (period.kind) {
    case "today": return "Hoy";
    case "yesterday": return single("Ayer");
    case "beforeYesterday": return single("Antier");
    case "weekday": return single(`El ${WEEKDAY_NAMES[weekdayIndex(period.from)]}`);
    case "thisWeek": return range("Esta semana");
    case "lastWeek": return range("La semana pasada");
    case "thisMonth": return range("Este mes");
    case "lastMonth": return range("El mes pasado");
    case "lastDays": return range(`Últimos ${spanDays(period)} días`);
    case "since": {
      const [month, dayNumber] = [Number(period.from.slice(5, 7)) - 1, Number(period.from.slice(8, 10))];
      return range(`Desde el ${dayNumber} de ${MONTHS[month]}`);
    }
  }
}

// Date phrases and "today" of the assistant (REQ-13, REQ-14). The phrase parser joins this file in US3.

const MEXICO_CITY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" });

/** The server's today as YYYY-MM-DD in America/Mexico_City, fixed in code so the client cannot move it and a UTC server stays right (REQ-13). */
export function serverToday(now: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) => MEXICO_CITY.formatToParts(now).find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Words that are always date cues (spec Terms, normalized): today and its neighbours, weekday and month names, and the
 * range words. Period nouns (día, semana, mes, año) are not here: they are cues only inside a time-range construction.
 * One list, shared by the dish matcher (a phrase made only of cue words is not a dish name) and the date parser (US3).
 */
export const DATE_CUES = [
  "hoy", "ayer", "antier", "anteayer", "desde", "hace", "pasado", "pasada", "ultimo", "ultima",
  "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo",
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
] as const;

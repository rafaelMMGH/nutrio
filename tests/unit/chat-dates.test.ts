import assert from "node:assert/strict";
import { test } from "node:test";
import { clampPeriod, CLAMP_LINE, notUnderstoodLine, parsePeriod, type Period, periodLabel, serverToday } from "@/lib/domain/chat-dates";

// REQ-13: today is the server's date in America/Mexico_City, whatever the process time zone.
test("serverToday is the Mexico City date", () => {
  assert.equal(serverToday(new Date("2026-10-29T03:00:00Z")), "2026-10-28");
  assert.equal(serverToday(new Date("2026-10-29T05:59:59Z")), "2026-10-28");
  assert.equal(serverToday(new Date("2026-10-29T06:00:00Z")), "2026-10-29");
  assert.equal(serverToday(new Date("2026-10-29T18:30:00Z")), "2026-10-29");
});

test("serverToday crosses a year boundary like the calendar does", () => {
  assert.equal(serverToday(new Date("2027-01-01T05:59:00Z")), "2026-12-31");
  assert.equal(serverToday(new Date("2027-01-01T06:00:00Z")), "2027-01-01");
});

test("serverToday uses CDT (UTC-5) in a pre-2022 summer", () => {
  assert.equal(serverToday(new Date("2022-07-01T05:30:00Z")), "2022-07-01");
});

// REQ-14: the phrase table gives the period bounds (labels and the clamp are below). Today is Wednesday 2026-10-28.
const TODAY = "2026-10-28";
const period = (kind: Period["kind"], from: string, to: string = from) => ({ kind, from, to });

const PHRASES: [string, string, ReturnType<typeof period>][] = [
  ["hoy", TODAY, period("today", TODAY)],
  ["¿Cuánta agua tomé hoy?", TODAY, period("today", TODAY)],
  ["últimos 0 días", TODAY, period("today", TODAY)],
  ["últimos 1 días", TODAY, period("today", TODAY)],
  ["el miércoles", TODAY, period("today", TODAY)],
  ["ayer", TODAY, period("yesterday", "2026-10-27")],
  ["antier", TODAY, period("beforeYesterday", "2026-10-26")],
  ["anteayer", TODAY, period("beforeYesterday", "2026-10-26")],
  ["el lunes", TODAY, period("weekday", "2026-10-26")],
  ["el jueves", TODAY, period("weekday", "2026-10-22")],
  ["el domingo", TODAY, period("weekday", "2026-10-25")],
  ["esta semana", TODAY, period("thisWeek", "2026-10-26", TODAY)],
  ["¿Cuántos días hice ejercicio esta semana?", TODAY, period("thisWeek", "2026-10-26", TODAY)],
  ["esta semana", "2026-11-01", period("thisWeek", "2026-10-26", "2026-11-01")],
  ["la semana pasada", TODAY, period("lastWeek", "2026-10-19", "2026-10-25")],
  ["este mes", TODAY, period("thisMonth", "2026-10-01", TODAY)],
  ["en el mes", TODAY, period("thisMonth", "2026-10-01", TODAY)],
  ["el mes pasado", TODAY, period("lastMonth", "2026-09-01", "2026-09-30")],
  ["el mes pasado", "2026-01-15", period("lastMonth", "2025-12-01", "2025-12-31")],
  ["últimos 7 días", TODAY, period("lastDays", "2026-10-22", TODAY)],
  ["últimos 2 días", TODAY, period("lastDays", "2026-10-27", TODAY)],
  ["desde el 5 de noviembre", TODAY, period("since", "2025-11-05", TODAY)],
  ["desde el 5 de octubre", TODAY, period("since", "2026-10-05", TODAY)],
  ["desde el 28 de octubre", TODAY, period("since", TODAY, TODAY)],
  ["desde el 29 de febrero", TODAY, period("since", "2024-02-29", TODAY)],
  // 2100 is not a leap year: the latest 29 February is 2096, four years back.
  ["desde el 29 de febrero", "2100-03-01", period("since", "2096-02-29", "2100-03-01")],
  // Raw bounds up to a sane limit (T067/T068 clamp from the span); a huge count is capped so no date overflows.
  ["últimos 400 días", TODAY, period("lastDays", "2025-09-24", TODAY)],
  ["últimos 999999999 días", TODAY, period("lastDays", "2016-10-21", TODAY)],
  ["últimos 99999999999999999999 días", TODAY, period("lastDays", "2016-10-21", TODAY)],
  // A comma or decimal number elsewhere in the message does not disturb the phrase (it is read from the typed text).
  ["tomé 1,5 L ayer", TODAY, period("yesterday", "2026-10-27")],
  ["a las 2.30 hoy", TODAY, period("today", TODAY)]
];

for (const [message, today, expected] of PHRASES) {
  test(`REQ-14 "${message}" (today ${today}) -> ${expected.kind} ${expected.from}..${expected.to}`, () => {
    assert.deepEqual(parsePeriod(message, today), expected);
  });
}

// A date cue that forms no recognized phrase is "unrecognized" (the fallback line is T068).
test("REQ-14 a cue with no recognized phrase is unrecognized", () => {
  for (const message of ["¿Cuánta agua tomé hace dos semanas?", "desde el 31 de febrero", "el mes anterior", "últimos 7,5 días", "últimos dos días", "este año", "en 2 semanas"]) {
    assert.equal(parsePeriod(message, TODAY), "unrecognized", message);
  }
});

// Period nouns outside a time-range construction are not cues: no period and no fallback.
test("REQ-14 period nouns alone are not date cues", () => {
  for (const message of ["Mi avance de la semana", "¿Cuántos días hice ejercicio?", "¿Cuántas veces entreno a la semana?", "¿Cuánta agua tomé en la semana?", "¿Cuánto peso en el año?", "tomé 1,5 L de agua", "¿Cuántas comidas llevo?"]) {
    assert.equal(parsePeriod(message, TODAY), undefined, message);
  }
});

// User ruling 2026-11-12: extra date-like words around a recognized phrase never answer with a different period.
test("REQ-14 trailing or surrounding date words are unrecognized, never a different period", () => {
  const cases: [string, string][] = [
    ["el lunes pasado", TODAY],
    ["el miércoles pasado", TODAY],
    ["el jueves pasada", TODAY],
    ["desde ayer", TODAY],
    ["desde el lunes", TODAY],
    ["desde el 5 de noviembre de 2024", TODAY],
    ["esta semana pasada", TODAY],
    ["en el mes de enero", TODAY],
    ["hoy y ayer", TODAY]
  ];
  for (const [message, today] of cases) assert.equal(parsePeriod(message, today), "unrecognized", message);
});

// User answers 2026-11-12: "desde" only rejects a date-shaped follower; otherwise a later valid phrase still wins.
test("REQ-14 a non-date 'desde' lets a later valid phrase win", () => {
  assert.deepEqual(parsePeriod("desde luego, ¿cuánta agua tomé hoy?", TODAY), period("today", TODAY));
  assert.deepEqual(parsePeriod("desde mi casa, ¿cuánta agua tomé ayer?", TODAY), period("yesterday", "2026-10-27"));
  assert.deepEqual(parsePeriod("ayer, desde mi casa", TODAY), period("yesterday", "2026-10-27"));
  assert.equal(parsePeriod("desde luego", TODAY), "unrecognized");
});

test("REQ-14 a year after the month is unrecognized, with or without 'del'", () => {
  for (const message of ["desde el 5 de noviembre del 2024", "desde el 5 de noviembre del año pasado", "pasado mañana", "el año pasado"]) {
    assert.equal(parsePeriod(message, TODAY), "unrecognized", message);
  }
});

test("REQ-14 the ruled cases leave their plain forms alone", () => {
  assert.deepEqual(parsePeriod("el lunes", TODAY), period("weekday", "2026-10-26"));
  assert.deepEqual(parsePeriod("la semana pasada", TODAY), period("lastWeek", "2026-10-19", "2026-10-25"));
  assert.deepEqual(parsePeriod("desde el 5 de noviembre, ¿cuánta agua?", TODAY), period("since", "2025-11-05", TODAY));
  assert.deepEqual(parsePeriod("en el mes", TODAY), period("thisMonth", "2026-10-01", TODAY));
  assert.deepEqual(parsePeriod("hoy", TODAY), period("today", TODAY));
});

// REQ-14 labels (today = Wed 2026-10-28 unless given): "<wd> <d>" in ranges of 7 days or less, else "<d> <mon>", year when it differs.
const LABELS: [string, string, string][] = [
  ["hoy", TODAY, "Hoy"],
  ["últimos 0 días", TODAY, "Hoy"],
  ["el miércoles", TODAY, "Hoy"],
  ["ayer", TODAY, "Ayer (mar 27 oct)"],
  ["antier", TODAY, "Antier (lun 26 oct)"],
  ["anteayer", TODAY, "Antier (lun 26 oct)"],
  ["el lunes", TODAY, "El lunes (lun 26 oct)"],
  ["el domingo", TODAY, "El domingo (dom 25 oct)"],
  ["el sábado", TODAY, "El sábado (sáb 24 oct)"],
  ["esta semana", TODAY, "Esta semana (lun 26 – hoy)"],
  ["la semana pasada", TODAY, "La semana pasada (lun 19 – dom 25)"],
  ["este mes", TODAY, "Este mes (1 oct – hoy)"],
  ["en el mes", TODAY, "Este mes (1 oct – hoy)"],
  ["el mes pasado", TODAY, "El mes pasado (1 sep – 30 sep)"],
  ["últimos 7 días", TODAY, "Últimos 7 días (jue 22 – hoy)"],
  ["últimos 8 días", TODAY, "Últimos 8 días (21 oct – hoy)"],
  ["desde el 5 de noviembre", TODAY, "Desde el 5 de noviembre (5 nov 2025 – hoy)"],
  ["desde el 5 de octubre", TODAY, "Desde el 5 de octubre (5 oct – hoy)"],
  ["desde el 25 de octubre", TODAY, "Desde el 25 de octubre (dom 25 – hoy)"],
  // A date outside today's year adds its year.
  ["ayer", "2026-01-01", "Ayer (mié 31 dic 2025)"],
  ["el mes pasado", "2026-01-15", "El mes pasado (1 dic 2025 – 31 dic 2025)"],
  ["la semana pasada", "2026-01-07", "La semana pasada (lun 29 dic 2025 – dom 4 ene)"],
  // Clamped: 366 days from 2025-10-28.
  ["últimos 400 días", TODAY, "Últimos 366 días (28 oct 2025 – hoy)"]
];

for (const [message, today, expected] of LABELS) {
  test(`REQ-14 label "${message}" (today ${today}) -> ${expected}`, () => {
    const named = parsePeriod(message, today);
    assert.ok(typeof named === "object");
    assert.equal(periodLabel(clampPeriod(named, today).period, today), expected);
  });
}

test("REQ-14 the clamp keeps up to 366 days and cuts anything above to the last 366", () => {
  const last = (count: number) => parsePeriod(`últimos ${count} días`, TODAY) as Period;
  assert.deepEqual(clampPeriod(last(366), TODAY), { period: period("lastDays", "2025-10-28", TODAY), clamped: false });
  assert.deepEqual(clampPeriod(last(367), TODAY), { period: period("lastDays", "2025-10-28", TODAY), clamped: true });
  assert.deepEqual(clampPeriod(last(400), TODAY), { period: period("lastDays", "2025-10-28", TODAY), clamped: true });
  // Above the parser's own cap of 3660 days: still the last 366 and the clamp flag.
  assert.deepEqual(clampPeriod(last(99999999999999999999), TODAY), { period: period("lastDays", "2025-10-28", TODAY), clamped: true });
  assert.deepEqual(clampPeriod(period("lastDays", "2020-01-01", TODAY), TODAY).clamped, true);
  assert.deepEqual(clampPeriod(period("today", TODAY), TODAY), { period: period("today", TODAY), clamped: false });
});

test("REQ-14 future days are never counted", () => {
  const cut = clampPeriod(period("thisWeek", "2026-10-26", "2026-11-01"), TODAY);
  assert.deepEqual(cut, { period: period("thisWeek", "2026-10-26", TODAY), clamped: false });
});

test("REQ-14 lead lines", () => {
  assert.equal(CLAMP_LINE, "Solo puedo revisar hasta 366 días; te muestro los últimos 366.");
  assert.equal(notUnderstoodLine("tu último registro"), "No entendí la fecha; te muestro tu último registro.");
});

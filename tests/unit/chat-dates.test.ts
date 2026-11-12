import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePeriod, type Period, serverToday } from "@/lib/domain/chat-dates";

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

// REQ-14: the phrase table gives the period bounds (labels and the clamp are T067). Today is Wednesday 2026-10-28.
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

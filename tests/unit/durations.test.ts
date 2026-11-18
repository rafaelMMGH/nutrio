import assert from "node:assert/strict";
import { test } from "node:test";
import { findDuration, formatClock, pauseTimer, remainingMs, resumeTimer, startTimer, timerLabel } from "@/components/cooking/durations";

const seconds = (text: string) => findDuration(text)?.seconds ?? null;

test("REQ-18: digits with minutes, hours and seconds", () => {
  assert.equal(seconds("Hornear por 10 minutos."), 600);
  assert.equal(seconds("Dejar reposar 1 hora"), 3600);
  assert.equal(seconds("Calentar 30 segundos en el microondas"), 30);
  assert.equal(seconds("Cocer 15 min a fuego bajo"), 900);
  assert.equal(seconds("Cocinar 2 hrs"), 7200);
  assert.equal(seconds("Hervir 1.5 horas"), 5400);
  assert.equal(seconds("Hervir 2,5 minutos"), 150);
});

test("REQ-18: number words, half hours and accents or capitals", () => {
  assert.equal(seconds("Licuar un minuto"), 60);
  assert.equal(seconds("Cocer cinco MINUTOS"), 300);
  assert.equal(seconds("Hornear media hora"), 1800);
  assert.equal(seconds("Hornear una hora y media"), 5400);
  assert.equal(seconds("Hornear 1 hora y media"), 5400);
  assert.equal(seconds("Asar diez minútos"), 600);
});

test("REQ-18: a range uses its upper bound", () => {
  assert.equal(seconds("Cocinar de 5 a 7 minutos"), 420);
  assert.equal(seconds("Cocinar 5-7 min"), 420);
  assert.equal(seconds("Cocinar 3 o 4 minutos"), 240);
});

test("REQ-18: steps without a duration get no timer, including amounts and spray bursts under 10 seconds", () => {
  assert.equal(findDuration("Al sartén agregarle 2 cucharadita de aceite líquido"), null);
  assert.equal(findDuration("o 10 disparos de 1 segundo de aceite en aerosol"), null);
  assert.equal(findDuration("Sofreír primero las verduras y después agregar los huevos."), null);
  assert.equal(findDuration("Usa 2 hojas de lechuga"), null);
  assert.equal(findDuration(""), null);
});

test("REQ-18: the button label is short and readable", () => {
  assert.equal(timerLabel(600), "Temporizador 10 min");
  assert.equal(timerLabel(30), "Temporizador 30 s");
  assert.equal(timerLabel(5400), "Temporizador 1 h 30 min");
  assert.equal(timerLabel(3600), "Temporizador 1 h");
});

test("REQ-19: the clock shows mm:ss, or h:mm:ss past an hour, never negative", () => {
  assert.equal(formatClock(521_000), "08:41");
  assert.equal(formatClock(3_725_000), "1:02:05");
  assert.equal(formatClock(400), "00:01");
  assert.equal(formatClock(-5), "00:00");
});

test("REQ-19: a timer counts down from its end time, pauses and resumes where it was", () => {
  const t0 = 1_000_000;
  const timer = startTimer(2, 600_000, t0);
  assert.equal(remainingMs(timer, t0 + 60_000), 540_000);
  const paused = pauseTimer(timer, t0 + 100_000);
  assert.equal(paused.endsAt, null);
  assert.equal(remainingMs(paused, t0 + 900_000), 500_000);
  const resumed = resumeTimer(paused, t0 + 900_000);
  assert.equal(remainingMs(resumed, t0 + 1_000_000), 400_000);
  assert.equal(remainingMs(timer, t0 + 700_000), 0);
});

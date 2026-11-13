import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatAnswer } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { CLAMP_LINE } from "@/lib/domain/chat-dates";
import { memDb } from "./memdb";
import type { SeedLog } from "../shared/assistant-fixture";

// Spec assistant-data-scope REQ-14 (labels and lead lines), REQ-15, REQ-17 (water) and REQ-13 (no future day), over the
// in-memory logs. Today is Wed 2026-10-28, so the week starts Mon 26; the plan's water goal is the 2 L default (8 glasses).

const TODAY = "2026-10-28";
const ask = (message: string, logs: SeedLog[] = []): ChatAnswer => {
  const { db, user } = memDb({ logs });
  return ragAnswer(db, user, message, TODAY);
};
/** The "llevas" and "has tomado" variants (REQ-28) read the same numbers: compare through "llevas". */
const water = (message: string, logs?: SeedLog[]) => ask(message, logs).answer.replace("Hoy has tomado", "Hoy llevas");
const lit = (date: string, water_glasses: number): SeedLog => ({ date, water_glasses });

test("REQ-15/17 water with no date: today's glasses and liters against the goal, plus the week line", () => {
  const reply = ask("¿Cuánta agua llevo?", [lit("2026-10-26", 4), lit("2026-10-27", 8), lit("2026-10-28", 6)]);
  assert.equal(reply.kind, "answer");
  assert.equal(water("¿Cuánta agua llevo?", [lit("2026-10-26", 4), lit("2026-10-27", 8), lit("2026-10-28", 6)]), "Hoy llevas 6 vasos de agua (1.5 litros) de tu meta de 8 vasos. Esta semana (lun 26 – hoy): 4.5 litros.");
  assert.deepEqual(reply.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text), ["6 vasos", "1.5 litros", "4.5 litros"]);
});

test("REQ-15 an explicit 'hoy' answers today only, with no week line", () => {
  assert.equal(water("¿Cuánta agua tomé hoy?", [lit("2026-10-27", 8), lit("2026-10-28", 1)]), "Hoy llevas 1 vaso de agua (0.3 litros) de tu meta de 8 vasos.");
});

test("REQ-15 'ayer' shows only that day, labeled (REQ-14)", () => {
  assert.equal(water("¿Cuánta agua tomé ayer?", [lit("2026-10-27", 8), lit("2026-10-28", 3)]), "Ayer (mar 27 oct): 2 litros en total, 2 litros por día en promedio. Cumpliste tu meta 1 de 1 día.");
});

test("REQ-17 today is shown uncapped, while the week line counts it at most the goal", () => {
  assert.equal(water("¿Cuánta agua llevo?", [lit("2026-10-28", 10)]), "Hoy llevas 10 vasos de agua (2.5 litros) de tu meta de 8 vasos. Esta semana (lun 26 – hoy): 2 litros.");
});

test("REQ-17 a range: total liters capped per day, the average over every day, and the days the goal was met", () => {
  const logs = [lit("2026-10-21", 8), lit("2026-10-22", 8), lit("2026-10-23", 4), lit("2026-10-24", 12), lit("2026-10-28", 6)];
  assert.equal(water("agua de los últimos 7 días", logs), "Últimos 7 días (jue 22 – hoy): 6.5 litros en total, 0.9 litros por día en promedio. Cumpliste tu meta 2 de 7 días.");
  assert.equal(water("agua de esta semana", [lit("2026-10-26", 8), lit("2026-10-28", 8)]), "Esta semana (lun 26 – hoy): 4 litros en total, 1.3 litros por día en promedio. Cumpliste tu meta 2 de 3 días.");
});

test("REQ-13 a log dated after today leaves the week liters unchanged", () => {
  const reply = water("¿Cuánta agua llevo?", [lit("2026-10-28", 4), lit("2026-10-29", 8)]);
  assert.match(reply, /Esta semana \(lun 26 – hoy\): 1 litro\.$/);
  assert.match(water("agua desde el 26 de octubre", [lit("2026-10-28", 4), lit("2026-10-29", 8)]), /^Desde el 26 de octubre \(lun 26 – hoy\): 1 litro en total/);
});

test("REQ-27 an empty range shows 0 with its label", () => {
  assert.equal(water("¿Cuánta agua tomé el lunes?"), "El lunes (lun 26 oct): 0 litros en total, 0 litros por día en promedio. Cumpliste tu meta 0 de 1 día.");
});

test("REQ-14 more than 366 days is clamped to the last 366, with the clamp line first", () => {
  assert.equal(CLAMP_LINE, "Solo puedo revisar hasta 366 días; te muestro los últimos 366.");
  assert.match(water("agua de los últimos 400 días"), new RegExp(`^${CLAMP_LINE} Últimos 366 días \\(28 oct 2025 – hoy\\): 0 litros en total, `));
});

test("REQ-14 a date cue with no phrase gives the fallback line and the default answer (today plus the week line)", () => {
  const reply = water("¿Cuánta agua tomé hace dos semanas?", [lit("2026-10-28", 2)]);
  assert.equal(reply, "No entendí la fecha; te muestro hoy. Hoy llevas 2 vasos de agua (0.5 litros) de tu meta de 8 vasos. Esta semana (lun 26 – hoy): 0.5 litros.");
  assert.doesNotMatch(water("¿Cuánta agua tomé en la semana?"), /No entendí/);
});

test("REQ-17 a range bolds only the number and unit of the total and the average, not 'en total' or 'por día en promedio'", () => {
  const reply = ask("agua de esta semana", [lit("2026-10-26", 8), lit("2026-10-28", 8)]);
  assert.deepEqual(reply.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text), ["4 litros", "1.3 litros", "2 de 3 días"]);
});

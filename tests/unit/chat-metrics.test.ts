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
const ran = (...dates: string[]): SeedLog[] => dates.map((date) => ({ date, exercised: true }));
const highlights = (reply: ChatAnswer) => reply.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text);
/** The "has hecho ejercicio" variant (REQ-28) reads the same numbers: compare through "llevas". */
const exercise = (message: string, logs: SeedLog[] = [], goalDays = 4) => {
  const { db, user } = memDb({ logs, goals: { days: goalDays } });
  return ragAnswer(db, user, message, TODAY).answer.replace(/has hecho ejercicio (\d+ de \d+ días?)/, "llevas $1 de ejercicio");
};

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

test("REQ-28 questions hitting different lead variants show identical numbers, and the same question twice gives the same variant", () => {
  const logs = [lit("2026-10-28", 6)];
  const [taken, held] = [ask("¿Cuánta agua tomé hoy?", logs).answer, ask("agua hoy", logs).answer];
  assert.equal(taken, "Hoy has tomado 6 vasos de agua (1.5 litros) de tu meta de 8 vasos.");
  assert.equal(held, "Hoy llevas 6 vasos de agua (1.5 litros) de tu meta de 8 vasos.");
  assert.equal(ask("¿Cuánta agua tomé hoy?", logs).answer, taken);
  assert.equal(ask("agua hoy", logs).answer, held);
});

test("REQ-17 the water goal is the plan's liters ÷ 0.25, clamped to 4..12 glasses", () => {
  const goalLine = (liters: number | undefined) => {
    const { db, user } = memDb({ logs: [lit(TODAY, 2)] });
    if (liters !== undefined) db.planVersions[0].structured_data.nutrition_summary = { water_liters: { min: liters } };
    return ragAnswer(db, user, "agua hoy", TODAY).answer;
  };
  assert.match(goalLine(undefined), /de tu meta de 8 vasos\.$/);
  assert.match(goalLine(3), /de tu meta de 12 vasos\.$/);
  assert.match(goalLine(2.5), /de tu meta de 10 vasos\.$/);
  assert.match(goalLine(2.7), /de tu meta de 11 vasos\.$/);
  assert.match(goalLine(0), /de tu meta de 4 vasos\.$/);
  assert.match(goalLine(5), /de tu meta de 12 vasos\.$/);
});

// Exercise (REQ-18): today is Wed 2026-10-28, the week started Mon 26.

test("REQ-18 this week: days done against the goal and what is left, singular 'Te falta 1 día'", () => {
  const two = ask("¿Cuánto ejercicio llevo?", ran("2026-10-26", "2026-10-28"));
  assert.equal(two.answer, "Esta semana (lun 26 – hoy) llevas 2 de 4 días de ejercicio. Te faltan 2 días.");
  assert.deepEqual(highlights(two), ["2 de 4 días", "2 días"]);
  const three = ask("¿Cuánto ejercicio llevo?", ran("2026-10-26", "2026-10-27", "2026-10-28"));
  assert.equal(three.answer, "Esta semana (lun 26 – hoy) llevas 3 de 4 días de ejercicio. Te falta 1 día.");
  assert.deepEqual(highlights(three), ["3 de 4 días", "1 día"]);
  assert.equal(exercise("¿Cuántos días hice ejercicio esta semana?", ran("2026-10-26")), "Esta semana (lun 26 – hoy) llevas 1 de 4 días de ejercicio. Te faltan 3 días.");
});

test("REQ-18 the met line replaces the remaining line once done reaches the goal", () => {
  assert.equal(exercise("¿Cuánto ejercicio llevo?", ran("2026-10-26", "2026-10-27", "2026-10-28"), 3), "¡Ya cumpliste tu meta de 3 días de ejercicio esta semana!");
  assert.equal(exercise("¿Cuánto ejercicio llevo?", ran("2026-10-26", "2026-10-27", "2026-10-28"), 2), "¡Ya cumpliste tu meta de 2 días de ejercicio esta semana!");
  assert.equal(exercise("¿Cuánto ejercicio llevo?", ran("2026-10-26"), 1), "¡Ya cumpliste tu meta de 1 día de ejercicio esta semana!");
});

test("REQ-13 REQ-27 a log dated after today is not counted, and an empty week shows 0 of the goal", () => {
  assert.equal(exercise("¿Cuánto ejercicio llevo?", ran("2026-10-28", "2026-10-29", "2026-11-02")), "Esta semana (lun 26 – hoy) llevas 1 de 4 días de ejercicio. Te faltan 3 días.");
  assert.equal(exercise("¿Cuánto ejercicio llevo?"), "Esta semana (lun 26 – hoy) llevas 0 de 4 días de ejercicio. Te faltan 4 días.");
});

test("REQ-18 today and another single day answer yes or no, never '0 días'", () => {
  assert.equal(exercise("¿Hice ejercicio hoy?", ran("2026-10-28")), "Hoy sí hiciste ejercicio.");
  assert.equal(exercise("¿Hice ejercicio hoy?", ran("2026-10-27")), "Hoy no has registrado ejercicio.");
  assert.equal(exercise("¿Hice ejercicio ayer?", ran("2026-10-27")), "Ayer (mar 27 oct): sí hiciste ejercicio.");
  assert.equal(exercise("¿Hice ejercicio ayer?", ran("2026-10-28")), "Ayer (mar 27 oct): no registraste ejercicio.");
  assert.equal(exercise("¿Hice ejercicio el lunes?", ran("2026-10-26")), "El lunes (lun 26 oct): sí hiciste ejercicio.");
  assert.equal(exercise("¿Hice ejercicio antier?"), "Antier (lun 26 oct): no registraste ejercicio.");
});

test("REQ-18 other ranges: days exercised with the label, singular, and 0 for an empty range", () => {
  const logs = ran("2026-10-22", "2026-10-24", "2026-10-28", "2026-10-29");
  const reply = ask("ejercicio de los últimos 7 días", logs);
  assert.equal(reply.answer, "Últimos 7 días (jue 22 – hoy): hiciste ejercicio 3 días.");
  assert.deepEqual(highlights(reply), ["3 días"]);
  assert.equal(exercise("ejercicio de los últimos 7 días", ran("2026-10-24")), "Últimos 7 días (jue 22 – hoy): hiciste ejercicio 1 día.");
  assert.equal(exercise("ejercicio de los últimos 7 días"), "Últimos 7 días (jue 22 – hoy): hiciste ejercicio 0 días.");
  assert.equal(exercise("ejercicio desde el 26 de octubre", ran("2026-10-26", "2026-10-28")), "Desde el 26 de octubre (lun 26 – hoy): hiciste ejercicio 2 días.");
});

test("REQ-18 only a full Mon–Sun week is compared with the goal", () => {
  const reply = ask("ejercicio la semana pasada", ran("2026-10-19", "2026-10-21", "2026-10-25", "2026-10-26"));
  assert.equal(reply.answer, "La semana pasada (lun 19 – dom 25): hiciste ejercicio 3 de 4 días.");
  assert.deepEqual(highlights(reply), ["3 de 4 días"]);
  assert.equal(exercise("ejercicio la semana pasada", ran("2026-10-19"), 1), "La semana pasada (lun 19 – dom 25): hiciste ejercicio 1 de 1 día.");
});

test("REQ-14 the remaining labels through exercise answers: month, last month", () => {
  assert.equal(exercise("¿Cuántos días hice ejercicio en el mes?", ran("2026-10-02")), "Este mes (1 oct – hoy): hiciste ejercicio 1 día.");
  assert.equal(exercise("ejercicio el mes pasado", ran("2026-09-30", "2026-10-01")), "El mes pasado (1 sep – 30 sep): hiciste ejercicio 1 día.");
});

test("REQ-14 more than 366 days is clamped, with the clamp line first", () => {
  assert.equal(exercise("ejercicio de los últimos 400 días"), `${CLAMP_LINE} Últimos 366 días (28 oct 2025 – hoy): hiciste ejercicio 0 días.`);
});

test("REQ-14 a date cue with no phrase falls back to this week with the fallback line; period nouns alone do not", () => {
  assert.equal(exercise("¿Cuántos días hice ejercicio hace dos semanas?", ran("2026-10-28")), "No entendí la fecha; te muestro esta semana. Esta semana (lun 26 – hoy) llevas 1 de 4 días de ejercicio. Te faltan 3 días.");
  for (const message of ["¿Cuántos días hice ejercicio?", "¿Cuántas veces entreno a la semana?"]) assert.doesNotMatch(exercise(message), /No entendí/, message);
});

test("REQ-28 questions hitting different exercise lead variants show identical numbers, deterministic per question", () => {
  const logs = ran("2026-10-26");
  const [llevas, hecho] = [ask("¿Cuánto ejercicio llevo?", logs).answer, ask("ejercicio", logs).answer];
  assert.equal(llevas, "Esta semana (lun 26 – hoy) llevas 1 de 4 días de ejercicio. Te faltan 3 días.");
  assert.equal(hecho, "Esta semana (lun 26 – hoy) has hecho ejercicio 1 de 4 días. Te faltan 3 días.");
  assert.equal(ask("¿Cuánto ejercicio llevo?", logs).answer, llevas);
  assert.equal(ask("ejercicio", logs).answer, hecho);
});

test("REQ-18 the exercise goal is the user's setting", () => {
  assert.match(exercise("¿Cuánto ejercicio llevo?", [], 6), /llevas 0 de 6 días de ejercicio\. Te faltan 6 días\.$/);
});

// Weight (REQ-19, REQ-27): today is Wed 2026-10-28, the week started Mon 26.

const kilos = (...entries: [string, number][]): SeedLog[] => entries.map(([date, weight_kg]) => ({ date, weight_kg }));
const weightReply = (message: string, logs: SeedLog[] = [], goal: number | null = null) => {
  const { db, user } = memDb({ logs, goals: { weight: goal } });
  return ragAnswer(db, user, message, TODAY);
};
/** The "Tu registro más reciente es" variant (REQ-28) reads the same numbers: compare through "Tu último peso es". */
const weight = (message: string, logs?: SeedLog[], goal?: number | null) => weightReply(message, logs, goal).answer.replace("Tu registro más reciente es", "Tu último peso es");
const linksOf = (reply: ChatAnswer) => reply.blocks[0].buttons.map((button) => (button.type === "link" ? [button.label, button.href] : [button.label]));

test("REQ-19 the latest weight, the distance to the goal and the week change, with only number and unit bold", () => {
  const reply = weightReply("Mi peso", kilos(["2026-10-20", 66.6], ["2026-10-26", 66.2]), 63);
  assert.equal(reply.answer.replace("Tu registro más reciente es", "Tu último peso es"), "Tu último peso es 66.2 kg (26 oct). Te faltan 3.2 kg para tu meta de 63 kg. Esta semana bajaste 0.4 kg.");
  assert.deepEqual(highlights(reply), ["66.2 kg", "3.2 kg", "0.4 kg"]);
  assert.match(weight("Mi peso", kilos(["2026-10-20", 66], ["2026-10-27", 66.5]), 63), /Te faltan 3.5 kg para tu meta de 63 kg\. Esta semana subiste 0.5 kg\.$/);
});

test("REQ-19 the latest weight is the newest record up to today; a later log is ignored (REQ-13)", () => {
  assert.match(weight("Mi peso", kilos(["2026-10-27", 66], ["2026-10-29", 60])), /^Tu último peso es 66 kg \(27 oct\)\./);
});

test("REQ-19 no week line without a record this week or without one before Monday", () => {
  assert.doesNotMatch(weight("Mi peso", kilos(["2026-10-20", 67], ["2026-10-25", 66]), 63), /Esta semana/);
  assert.doesNotMatch(weight("Mi peso", kilos(["2026-10-27", 66]), 63), /Esta semana/);
});

test("REQ-19 'sin cambio' for a zero change, bold, only with a record this week", () => {
  const reply = weightReply("Mi peso", kilos(["2026-10-20", 66.6], ["2026-10-27", 66.6]), 63);
  assert.match(reply.answer, /Esta semana: sin cambio\.$/);
  assert.deepEqual(highlights(reply), ["66.6 kg", "3.6 kg", "sin cambio"]);
  assert.doesNotMatch(weight("Mi peso", kilos(["2026-10-20", 66.6], ["2026-10-25", 66.6]), 63), /sin cambio/);
});

test("REQ-19 a change that rounds to 0.0 reads 'sin cambio', not 'bajaste 0 kg'", () => {
  assert.match(weight("Mi peso", kilos(["2026-10-20", 66.04], ["2026-10-27", 66]), 63), /Esta semana: sin cambio\.$/);
});

test("REQ-19 a goal above the weight shows the distance as a positive number", () => {
  assert.match(weight("Mi peso", kilos(["2026-10-01", 60], ["2026-10-27", 62]), 66), /Te faltan 4 kg para tu meta de 66 kg\./);
});

test("REQ-19 another user's weight records never count", () => {
  const { db, user } = memDb({ logs: kilos(["2026-10-27", 66]) });
  db.dailyLogs.push({ ...db.dailyLogs[0], id: "other", user_id: "someone-else", date: "2026-10-28", weight_kg: 50 });
  assert.match(ragAnswer(db, user, "Mi peso", TODAY).answer, /66 kg \(27 oct\)/);
});

test("REQ-19 'meta alcanzada' once the progress from the first weight reaches 100%, losing or gaining", () => {
  assert.match(weight("Mi peso", kilos(["2026-10-01", 70], ["2026-10-27", 64.5]), 65), /\(27 oct\)\. ¡Ya alcanzaste tu meta de 65 kg!/);
  assert.match(weight("Mi peso", kilos(["2026-10-01", 70], ["2026-10-27", 65]), 65), /¡Ya alcanzaste tu meta de 65 kg!/);
  assert.match(weight("Mi peso", kilos(["2026-10-01", 60], ["2026-10-27", 66]), 65), /¡Ya alcanzaste tu meta de 65 kg!/);
  assert.match(weight("Mi peso", kilos(["2026-10-01", 70], ["2026-10-27", 65.1]), 65), /Te faltan 0.1 kg para tu meta de 65 kg\./);
});

test("REQ-19 just short of the goal (progress 99.92%) is not 'meta alcanzada': the distance shows even when it rounds to 0 (current behavior)", () => {
  assert.equal(weight("Mi peso", kilos(["2026-10-01", 100], ["2026-10-27", 50.04]), 50), "Tu último peso es 50 kg (27 oct). Te faltan 0 kg para tu meta de 50 kg. Esta semana bajaste 50 kg.");
});

test("REQ-19 no goal: the 'no goal' line and the 'Fijar mi meta' button", () => {
  const reply = weightReply("Mi peso", kilos(["2026-10-27", 66]));
  assert.equal(weight("Mi peso", kilos(["2026-10-27", 66])), "Tu último peso es 66 kg (27 oct). No has fijado meta de peso.");
  assert.deepEqual(linksOf(reply), [["Fijar mi meta", "/"]]);
  assert.deepEqual(linksOf(weightReply("Mi peso", kilos(["2026-10-27", 66]), 63)), []);
});

test("REQ-19 a last record over 7 days old adds the age line and 'Registrar mi peso'; 7 days does not", () => {
  const old = weightReply("Mi peso", kilos(["2026-10-15", 66]), 63);
  assert.match(old.answer, /Te faltan 3 kg para tu meta de 63 kg\. Tu último registro fue hace 13 días\.$/);
  assert.deepEqual(linksOf(old), [["Registrar mi peso", "/"]]);
  assert.match(weight("Mi peso", kilos(["2026-10-20", 66]), 63), /hace 8 días\.$/);
  assert.doesNotMatch(weight("Mi peso", kilos(["2026-10-21", 66]), 63), /hace/);
  assert.deepEqual(linksOf(weightReply("Mi peso", kilos(["2026-10-15", 66]))), [["Fijar mi meta", "/"], ["Registrar mi peso", "/"]]);
});

test("REQ-14 a date outside today's year adds its year", () => {
  assert.match(weight("Mi peso", kilos(["2025-12-30", 66]), 63), /^Tu último peso es 66 kg \(30 dic 2025\)\./);
});

test("REQ-19 a range: first and last weights, the change, the minimum and the maximum", () => {
  const logs = kilos(["2026-10-21", 70], ["2026-10-23", 66], ["2026-10-25", 64.9], ["2026-10-28", 65.2], ["2026-10-29", 50]);
  const reply = weightReply("peso de los últimos 7 días", logs);
  assert.equal(reply.answer, "Últimos 7 días (jue 22 – hoy): empezaste en 66 kg y terminaste en 65.2 kg (bajaste 0.8 kg; mínimo 64.9 kg, máximo 66 kg).");
  assert.deepEqual(highlights(reply), ["66 kg", "65.2 kg"]);
  assert.match(weight("peso de los últimos 7 días", kilos(["2026-10-23", 65], ["2026-10-28", 66.5])), /\(subiste 1.5 kg; mínimo 65 kg, máximo 66.5 kg\)\.$/);
  assert.match(weight("peso de los últimos 7 días", kilos(["2026-10-23", 65], ["2026-10-28", 65])), /\(sin cambio; mínimo 65 kg, máximo 65 kg\)\.$/);
});

test("REQ-19 a range or single day with one record names that record; no goal or week lines", () => {
  const reply = weightReply("¿Cuánto pesé ayer?", kilos(["2026-10-27", 66.4]), 63);
  assert.equal(reply.answer, "Ayer (mar 27 oct): registraste 66.4 kg (27 oct).");
  assert.deepEqual(highlights(reply), ["66.4 kg"]);
  assert.deepEqual(linksOf(reply), []);
  assert.equal(weight("peso hoy", kilos(["2026-10-28", 66])), "Hoy: registraste 66 kg (28 oct).");
});

test("REQ-27 no weight logs, or only future ones: the empty state and 'Registrar mi peso'", () => {
  for (const logs of [[], kilos(["2026-10-29", 66])]) {
    const reply = weightReply("Mi peso", logs, 63);
    assert.equal(reply.answer, "Aún no registras tu peso.");
    assert.deepEqual(linksOf(reply), [["Registrar mi peso", "/"]]);
  }
});

test("REQ-27 an empty weight range states its period", () => {
  assert.equal(weight("¿Cuánto pesé ayer?", kilos(["2026-10-20", 66])), "Ayer (mar 27 oct): no registraste tu peso.");
  assert.equal(weight("peso de los últimos 7 días", kilos(["2026-10-20", 66])), "Últimos 7 días (jue 22 – hoy): no registraste tu peso.");
});

test("REQ-14 labels through weight answers, and the clamp line first", () => {
  assert.match(weight("peso el lunes", kilos(["2026-10-26", 66])), /^El lunes \(lun 26 oct\): registraste 66 kg/);
  assert.match(weight("peso el mes pasado", kilos(["2026-09-30", 66], ["2026-09-02", 67])), /^El mes pasado \(1 sep – 30 sep\): empezaste en 67 kg y terminaste en 66 kg/);
  assert.match(weight("peso de los últimos 400 días", kilos(["2026-10-27", 66])), new RegExp(`^${CLAMP_LINE} Últimos 366 días \\(28 oct 2025 – hoy\\): registraste 66 kg`));
});

test("REQ-14 a date cue with no phrase gives the fallback line naming the last record, then the default answer", () => {
  assert.equal(weight("¿Cuánto pesé hace dos semanas?", kilos(["2026-10-27", 66])), "No entendí la fecha; te muestro tu último registro. Tu último peso es 66 kg (27 oct). No has fijado meta de peso.");
  assert.doesNotMatch(weight("¿Cuánto peso en la semana?", kilos(["2026-10-27", 66])), /No entendí/);
});

test("REQ-28 questions hitting different weight lead variants show identical numbers, deterministic per question", () => {
  const logs = kilos(["2026-10-27", 66]);
  const [last, recent] = [weightReply("Mi peso", logs).answer, weightReply("¿Cuál es mi peso?", logs).answer];
  assert.equal(last, "Tu último peso es 66 kg (27 oct). No has fijado meta de peso.");
  assert.equal(recent, "Tu registro más reciente es 66 kg (27 oct). No has fijado meta de peso.");
  assert.equal(weightReply("Mi peso", logs).answer, last);
  assert.equal(weightReply("¿Cuál es mi peso?", logs).answer, recent);
});

// Meals done (REQ-20): the plan has 4 slots (Desayuno, Colación, Comida, Cena); the week starts Mon 26.

const slotId = (position: number) => `chat-e2e-memdb-plan-v1-meal-${position}`;
const marked = (date: string, ...positions: number[]): SeedLog => ({ date, meals_done: positions.map(slotId) });
const mealsReply = (message: string, logs: SeedLog[] = [], meals?: string[]) => {
  const { db, user } = memDb({ logs, meals });
  return ragAnswer(db, user, message, TODAY);
};
/** The "Hoy has hecho" variant (REQ-28) reads the same numbers: compare through "Hoy llevas". */
const meals = (message: string, logs?: SeedLog[], names?: string[]) => mealsReply(message, logs, names).answer.replace("Hoy has hecho", "Hoy llevas");
const weekLogs = [marked("2026-10-26", 0, 1), marked("2026-10-27", 0, 1, 2), marked("2026-10-28", 3)];

test("REQ-20 meals with no date: today against the slots, plus the week against slots × 7 with a whole-number %, only the counts bold", () => {
  const reply = mealsReply("¿Cuántas comidas llevo?", weekLogs);
  assert.equal(reply.kind, "answer");
  assert.equal(meals("¿Cuántas comidas llevo?", weekLogs), "Hoy llevas 1 de 4 comidas. Esta semana (lun 26 – hoy): 6 de 28 comidas (21%).");
  assert.deepEqual(highlights(reply), ["1 de 4 comidas", "6 de 28 comidas"]);
});

test("REQ-20 5 slots and 3 marked today give 'Hoy llevas 3 de 5 comidas.'; an explicit 'hoy' has no week line", () => {
  const names = ["Desayuno", "Colación", "Comida", "Merienda", "Cena"];
  assert.equal(meals("¿Cuántas comidas llevo hoy?", [marked(TODAY, 0, 1, 2)], names), "Hoy llevas 3 de 5 comidas.");
});

test("REQ-20 singular at exactly one slot: '1 de 1 comida'", () => {
  assert.equal(meals("¿Cuántas comidas llevo?", [marked(TODAY, 0)], ["Comida"]), "Hoy llevas 1 de 1 comida. Esta semana (lun 26 – hoy): 1 de 7 comidas (14%).");
});

test("REQ-20 'esta semana' is the dashboard's slots × 7 whatever day it is; a past single day and a range use slots × days", () => {
  assert.equal(meals("¿Cuántas comidas llevo esta semana?", weekLogs), "Esta semana (lun 26 – hoy): 6 de 28 comidas (21%).");
  assert.equal(meals("¿Cuántas comidas hice ayer?", weekLogs), "Ayer (mar 27 oct): 3 de 4 comidas (75%).");
  assert.equal(meals("¿Cuántas comidas hice en los últimos 7 días?", [marked("2026-10-21", 0), ...weekLogs]), "Últimos 7 días (jue 22 – hoy): 6 de 28 comidas (21%).");
  assert.deepEqual(highlights(mealsReply("¿Cuántas comidas hice ayer?", weekLogs)), ["3 de 4 comidas"]);
});

test("REQ-20 marks of a slot not in the plan are ignored and a day never counts more than its slots", () => {
  const crowded: SeedLog = { date: TODAY, meals_done: [slotId(0), slotId(0), slotId(0), slotId(0), slotId(0), "gone"] };
  assert.equal(meals("¿Cuántas comidas llevo hoy?", [crowded]), "Hoy llevas 4 de 4 comidas.");
  assert.equal(meals("¿Cuántas comidas llevo hoy?", [{ date: TODAY, meals_done: ["gone"] }]), "Hoy llevas 0 de 4 comidas.");
});

test("REQ-13 a log dated after today is not counted", () => {
  assert.match(meals("¿Cuántas comidas llevo?", [marked(TODAY, 0), marked("2026-10-29", 0, 1, 2, 3)]), /Esta semana \(lun 26 – hoy\): 1 de 28 comidas \(4%\)\.$/);
  assert.match(meals("¿Cuántas comidas llevo desde el 26 de octubre?", [marked(TODAY, 0), marked("2026-10-29", 0, 1, 2, 3)]), /^Desde el 26 de octubre \(lun 26 – hoy\): 1 de 12 comidas \(8%\)\./);
});

test("REQ-27 an empty range shows 0 with its label", () => {
  assert.equal(meals("¿Cuántas comidas hice el lunes?"), "El lunes (lun 26 oct): 0 de 4 comidas (0%).");
  assert.equal(meals("¿Cuántas comidas llevo?"), "Hoy llevas 0 de 4 comidas. Esta semana (lun 26 – hoy): 0 de 28 comidas (0%).");
});

test("REQ-14 labels through meals answers: last week, month; the clamp line first; the fallback line naming today", () => {
  assert.match(meals("¿Cuántas comidas hice la semana pasada?", [marked("2026-10-20", 0, 1, 2, 3)]), /^La semana pasada \(lun 19 – dom 25\): 4 de 28 comidas \(14%\)\.$/);
  assert.match(meals("¿Cuántas comidas hice este mes?", weekLogs), /^Este mes \(1 oct – hoy\): 6 de 112 comidas \(5%\)\.$/);
  assert.match(meals("¿Cuántas comidas hice en los últimos 400 días?"), new RegExp(`^${CLAMP_LINE} Últimos 366 días \\(28 oct 2025 – hoy\\): 0 de 1464 comidas \\(0%\\)\\.$`));
  assert.equal(meals("¿Cuántas comidas llevo hace dos semanas?", weekLogs), "No entendí la fecha; te muestro hoy. Hoy llevas 1 de 4 comidas. Esta semana (lun 26 – hoy): 6 de 28 comidas (21%).");
});

test("REQ-28 questions hitting different meals lead variants show identical numbers, and the same question twice gives the same variant", () => {
  const logs = [marked(TODAY, 0, 1)];
  const [made, held] = [mealsReply("¿Cuántas comidas llevo hoy?", logs).answer, mealsReply("hoy, ¿cuántas comidas llevo?", logs).answer];
  assert.equal(made, "Hoy llevas 2 de 4 comidas.");
  assert.equal(held, "Hoy has hecho 2 de 4 comidas.");
  assert.equal(mealsReply("¿Cuántas comidas llevo hoy?", logs).answer, made);
  assert.equal(mealsReply("hoy, ¿cuántas comidas llevo?", logs).answer, held);
});

test("REQ-27 with no active plan the meals answer is left to T052: no counts are invented", () => {
  const { db, user } = memDb({ logs: [marked(TODAY, 0)] });
  db.plans = [];
  assert.doesNotMatch(ragAnswer(db, user, "¿Cuántas comidas llevo?", TODAY).answer, /\d+ de \d+ comidas?/);
});

// Goals (REQ-21) and weekly progress (REQ-22, REQ-16): neither has a period, so the answers need no date cue.

const plainOf = (rich: { text: string }[]) => rich.map((span) => span.text).join("");
const goalReply = (message: string, { weight = null, days = 4, waterLiters, plan = true }: { weight?: number | null; days?: number; waterLiters?: number; plan?: boolean } = {}) => {
  const { db, user } = memDb({ goals: { weight, days } });
  if (waterLiters !== undefined) db.planVersions[0].structured_data.nutrition_summary = { water_liters: { min: waterLiters } };
  if (!plan) db.plans = [];
  return ragAnswer(db, user, message, TODAY);
};
const itemsOf = (reply: ChatAnswer) => reply.blocks[0].sections.flatMap((section) => section.items.map(plainOf));
const boldItems = (reply: ChatAnswer) => reply.blocks[0].sections.flatMap((section) => section.items.map((item) => item.filter((span) => span.highlight).map((span) => span.text)));
const FOLLOW_UPS = (...labels: string[]) => labels.map((label) => ({ type: "question", label, message: label }));

test("REQ-21 a bare goal question lists the plan objective and the three goals, only the values bold", () => {
  const reply = goalReply("¿Cuál es mi meta?", { weight: 63, days: 5 });
  assert.equal(reply.kind, "answer");
  assert.equal(plainOf(reply.blocks[0].lead), "Estas son tus metas:");
  assert.deepEqual(reply.blocks[0].sections.map((section) => section.title), ["Metas"]);
  assert.deepEqual(itemsOf(reply), ["Objetivo del plan: Mejorar mi energía", "Peso: 63 kg", "Ejercicio: 5 días por semana", "Agua: 8 vasos (2 litros) al día"]);
  assert.deepEqual(boldItems(reply), [[], ["63 kg"], ["5 días"], ["8 vasos"]]);
  assert.equal(reply.answer, `Estas son tus metas:\nMetas\n${itemsOf(reply).join("\n")}`);
  assert.deepEqual(reply.buttons, FOLLOW_UPS("Mi avance de la semana", "Mi peso"));
  assert.deepEqual(reply.blocks[0].buttons, []);
  assert.deepEqual(reply.sources, []);
});

test("REQ-21 no weight goal reads 'Peso: sin meta'; one exercise day is singular", () => {
  const reply = goalReply("¿Cuál es mi objetivo?", { days: 1 });
  assert.deepEqual(itemsOf(reply), ["Objetivo del plan: Mejorar mi energía", "Peso: sin meta", "Ejercicio: 1 día por semana", "Agua: 8 vasos (2 litros) al día"]);
  assert.deepEqual(boldItems(reply), [[], [], ["1 día"], ["8 vasos"]]);
});

test("REQ-21 'de peso', 'de ejercicio' and 'de agua' narrow to that goal only, with no section and no plan line", () => {
  const weight = goalReply("¿Cuál es mi meta de peso?", { weight: 63 });
  assert.equal(weight.answer, "Tu meta de peso es 63 kg.");
  assert.deepEqual(weight.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text), ["63 kg"]);
  assert.deepEqual(weight.blocks[0].sections, []);
  assert.equal(goalReply("¿Cuál es mi objetivo de ejercicio?", { days: 5 }).answer, "Tu meta de ejercicio es 5 días por semana.");
  assert.equal(goalReply("meta de ejercicio", { days: 1 }).answer, "Tu meta de ejercicio es 1 día por semana.");
  const water = goalReply("¿Cuál es mi objetivo de agua?");
  assert.equal(water.answer, "Tu meta de agua es 8 vasos (2 litros) al día.");
  assert.deepEqual(water.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text), ["8 vasos"]);
});

test("REQ-21 the water goal is the plan's liters as glasses clamped to 4..12; the liters are the plan's own", () => {
  assert.equal(goalReply("¿Cuál es mi meta de agua?", { waterLiters: 1 }).answer, "Tu meta de agua es 4 vasos (1 litro) al día.");
  assert.equal(goalReply("¿Cuál es mi meta de agua?", { waterLiters: 4 }).answer, "Tu meta de agua es 12 vasos (4 litros) al día.");
  assert.equal(goalReply("¿Cuál es mi meta de agua?", { waterLiters: 2.5 }).answer, "Tu meta de agua es 10 vasos (2.5 litros) al día.");
  assert.equal(itemsOf(goalReply("¿Cuál es mi meta?", { waterLiters: 4 })).at(-1), "Agua: 12 vasos (4 litros) al día");
});

test("REQ-21 a narrowed weight goal that is not set says so, with 'Fijar mi meta'", () => {
  const reply = goalReply("¿Cuál es mi meta de peso?");
  assert.equal(reply.answer, "No has fijado meta de peso.");
  assert.deepEqual(reply.blocks[0].buttons, [{ type: "link", label: "Fijar mi meta", href: "/" }]);
});

test("REQ-21 REQ-27 with no active plan the bare answer drops the objective, uses the 2 L default and adds the no-plan line", () => {
  const reply = goalReply("¿Cuál es mi meta?", { weight: 63, days: 5, plan: false });
  assert.deepEqual(itemsOf(reply), ["Peso: 63 kg", "Ejercicio: 5 días por semana", "Agua: 8 vasos (2 litros) al día", "Aún no tienes un plan activo."]);
  assert.deepEqual(reply.blocks[0].buttons, [{ type: "link", label: "Subir mi plan", href: "/plans" }]);
  assert.equal(goalReply("¿Cuál es mi meta de agua?", { plan: false }).answer, "Tu meta de agua es 8 vasos (2 litros) al día.");
  assert.deepEqual(goalReply("¿Cuál es mi meta de agua?", { plan: false }).blocks[0].buttons, []);
  assert.deepEqual(goalReply("¿Cuál es mi meta de ejercicio?", { plan: false }).blocks[0].buttons, []);
});

// Weekly progress: Mon 26 and Tue 27 exercised, 8 + 4 + 10 glasses (10 today, counted at most the goal of 8), 3 meals; 66.6 kg before Monday, 66.2 on Monday.

const weeklyLogs: SeedLog[] = [
  { date: "2026-10-20", weight_kg: 66.6 },
  { date: "2026-10-26", weight_kg: 66.2, exercised: true, water_glasses: 8, meals_done: [slotId(0), slotId(1)] },
  { date: "2026-10-27", exercised: true, water_glasses: 4, meals_done: [slotId(2)] },
  { date: "2026-10-28", water_glasses: 10 }
];
const weeklyReply = (logs: SeedLog[] = weeklyLogs, { days = 4, plan = true, meals, waterLiters }: { days?: number; plan?: boolean; meals?: string[]; waterLiters?: number } = {}) => {
  const { db, user } = memDb({ logs, goals: { days }, meals });
  if (waterLiters !== undefined) db.planVersions[0].structured_data.nutrition_summary = { water_liters: { min: waterLiters } };
  if (!plan) db.plans = [];
  return ragAnswer(db, user, "Mi avance de la semana", TODAY);
};

test("REQ-22 weekly progress: exercise, water, meals and weight change in one block, with the dashboard's numbers", () => {
  const reply = weeklyReply();
  assert.equal(reply.kind, "answer");
  assert.equal(plainOf(reply.blocks[0].lead), "Tu avance de esta semana (lun 26 – hoy):");
  assert.deepEqual(reply.blocks[0].sections.map((section) => section.title), ["Avance"]);
  assert.deepEqual(itemsOf(reply), ["Ejercicio: 2 de 4 días", "Agua: 5 litros", "Comidas: 3 de 28", "Peso: bajaste 0.4 kg"]);
  assert.deepEqual(boldItems(reply), [["2 de 4 días"], ["5 litros"], ["3 de 28"], ["0.4 kg"]]);
  assert.equal(reply.answer, `Tu avance de esta semana (lun 26 – hoy):\nAvance\n${itemsOf(reply).join("\n")}`);
  assert.deepEqual(reply.buttons, FOLLOW_UPS("Mi peso", "¿Cuál es mi meta?"));
  assert.deepEqual(reply.blocks[0].buttons, []);
});

test("REQ-22 singular units, and 'subiste' for a gain", () => {
  const logs: SeedLog[] = [{ date: "2026-10-20", weight_kg: 66 }, { date: "2026-10-27", weight_kg: 66.5, exercised: true, water_glasses: 4 }];
  assert.deepEqual(itemsOf(weeklyReply(logs, { days: 1 })), ["Ejercicio: 1 de 1 día", "Agua: 1 litro", "Comidas: 0 de 28", "Peso: subiste 0.5 kg"]);
});

test("REQ-22 REQ-19 the weight item is omitted without a record this week or without one before Monday; 0 reads 'sin cambio'", () => {
  const without = (logs: SeedLog[]) => itemsOf(weeklyReply(logs)).filter((item) => item.startsWith("Peso"));
  assert.deepEqual(without([{ date: "2026-10-20", weight_kg: 66.6 }]), []);
  assert.deepEqual(without([{ date: "2026-10-26", weight_kg: 66.2 }]), []);
  assert.deepEqual(without([]), []);
  assert.equal(itemsOf(weeklyReply([{ date: "2026-10-20", weight_kg: 66.6 }])).length, 3);
  const flat = weeklyReply([{ date: "2026-10-20", weight_kg: 66 }, { date: "2026-10-27", weight_kg: 66 }]);
  assert.equal(itemsOf(flat).at(-1), "Peso: sin cambio");
  assert.deepEqual(boldItems(flat).at(-1), []);
});

test("REQ-13 REQ-22 a log dated after today never counts in the week", () => {
  const reply = weeklyReply([...weeklyLogs, { date: "2026-10-29", exercised: true, water_glasses: 8, meals_done: [slotId(0), slotId(1), slotId(2), slotId(3)], weight_kg: 60 }]);
  assert.deepEqual(itemsOf(reply), ["Ejercicio: 2 de 4 días", "Agua: 5 litros", "Comidas: 3 de 28", "Peso: bajaste 0.4 kg"]);
});

test("REQ-22 REQ-27 with no active plan the meals item is gone, water uses the default goal and the no-plan line comes with 'Subir mi plan'", () => {
  const reply = weeklyReply(weeklyLogs, { plan: false });
  assert.deepEqual(itemsOf(reply), ["Ejercicio: 2 de 4 días", "Agua: 5 litros", "Peso: bajaste 0.4 kg", "Aún no tienes un plan activo."]);
  assert.deepEqual(reply.blocks[0].buttons, [{ type: "link", label: "Subir mi plan", href: "/plans" }]);
});

// 3e cleanup rows (T050 part 2).

test("REQ-22 the weekly water counts each day up to the plan's own goal: a 4 L plan keeps 12 glasses a day, a 0.5 L plan caps at 4", () => {
  const logs: SeedLog[] = [{ date: "2026-10-26", water_glasses: 12 }, { date: "2026-10-27", water_glasses: 12 }];
  assert.ok(itemsOf(weeklyReply(logs, { waterLiters: 4 })).includes("Agua: 6 litros"));
  assert.ok(itemsOf(weeklyReply(logs, { waterLiters: 0.5 })).includes("Agua: 2 litros"));
  assert.ok(itemsOf(weeklyReply(logs)).includes("Agua: 4 litros"));
});

test("REQ-22 a weekly weight change that rounds to 0.0 reads 'sin cambio', not 'bajaste 0 kg'", () => {
  const reply = weeklyReply([{ date: "2026-10-20", weight_kg: 66.04 }, { date: "2026-10-27", weight_kg: 66 }]);
  assert.equal(itemsOf(reply).at(-1), "Peso: sin cambio");
  assert.deepEqual(boldItems(reply).at(-1), []);
});

test("REQ-21 the narrowed exercise goal has its days in bold, like the weight and water ones", () => {
  assert.deepEqual(goalReply("¿Cuál es mi objetivo de ejercicio?", { days: 5 }).blocks[0].lead.filter((span) => span.highlight).map((span) => span.text), ["5 días"]);
});

/** A second user with the first position in every table: any lookup that forgets the user id would read these rows. */
function withOtherUser(db: ReturnType<typeof memDb>["db"], user: ReturnType<typeof memDb>["user"]) {
  const other = { ...user, id: "someone-else", weight_goal_kg: 50, activity_goal_days: 7 };
  db.users.unshift(other);
  const plan = { ...db.plans[0], id: "other-plan", user_id: other.id, objective: "Objetivo ajeno" };
  const version = { ...db.planVersions[0], id: "other-plan-v1", plan_id: plan.id, structured_data: { ...db.planVersions[0].structured_data, objective: "Objetivo ajeno", nutrition_summary: { water_liters: { min: 4 } } } };
  db.plans.unshift(plan);
  db.planVersions.unshift(version);
  db.mealTypes.unshift({ ...db.mealTypes[0], id: "other-meal", plan_version_id: version.id });
  return other;
}

test("REQ-21 another user's goals, plan and water goal never show in mine", () => {
  const { db, user } = memDb({ goals: { weight: 63, days: 5 } });
  withOtherUser(db, user);
  assert.deepEqual(itemsOf(ragAnswer(db, user, "¿Cuál es mi meta?", TODAY)), ["Objetivo del plan: Mejorar mi energía", "Peso: 63 kg", "Ejercicio: 5 días por semana", "Agua: 8 vasos (2 litros) al día"]);
});

test("REQ-22 another user's logs, plan and goals never count in my weekly progress", () => {
  const { db, user } = memDb({ logs: weeklyLogs });
  const other = withOtherUser(db, user);
  for (const date of ["2026-10-20", "2026-10-26", "2026-10-27", "2026-10-28"]) {
    db.dailyLogs.push({ ...db.dailyLogs[0], id: `other-${date}`, user_id: other.id, date, exercised: true, water_glasses: 12, weight_kg: 50, meals_done: ["other-meal"] });
  }
  assert.deepEqual(itemsOf(ragAnswer(db, user, "Mi avance de la semana", TODAY)), ["Ejercicio: 2 de 4 días", "Agua: 5 litros", "Comidas: 3 de 28", "Peso: bajaste 0.4 kg"]);
});

test("REQ-21 a blank plan objective is left out, and a padded one is trimmed", () => {
  const items = (objective: string) => {
    const { db, user } = memDb({ objective });
    return itemsOf(ragAnswer(db, user, "¿Cuál es mi meta?", TODAY));
  };
  assert.deepEqual(items("   "), ["Peso: sin meta", "Ejercicio: 4 días por semana", "Agua: 8 vasos (2 litros) al día"]);
  assert.equal(items("  Mejorar mi energía  ")[0], "Objetivo del plan: Mejorar mi energía");
});

test("REQ-21 REQ-22 an active plan without a current version is no plan: no objective, the default water goal, the no-plan line", () => {
  const without = (message: string) => {
    const { db, user } = memDb({ goals: { weight: 63 }, logs: weeklyLogs });
    db.planVersions = [];
    return ragAnswer(db, user, message, TODAY);
  };
  assert.deepEqual(itemsOf(without("¿Cuál es mi meta?")), ["Peso: 63 kg", "Ejercicio: 4 días por semana", "Agua: 8 vasos (2 litros) al día", "Aún no tienes un plan activo."]);
  assert.deepEqual(without("¿Cuál es mi meta?").blocks[0].buttons, [{ type: "link", label: "Subir mi plan", href: "/plans" }]);
  assert.deepEqual(itemsOf(without("Mi avance de la semana")).slice(-1), ["Aún no tienes un plan activo."]);
});

// User ruling 2026-11-13: an active plan with zero meal slots is no plan, here as in the plan and slot answers. The plan
// has a 4 L water goal and an objective, so a leak of either shows.
const zeroSlots = (message: string) => {
  const { db, user } = memDb({ goals: { weight: 63 }, logs: weeklyLogs, meals: [] });
  db.planVersions[0].structured_data.nutrition_summary = { water_liters: { min: 4 } };
  return ragAnswer(db, user, message, TODAY);
};

test("REQ-21 REQ-27 an active plan with zero slots is no plan for goals: no objective, the 2 L default, the no-plan line; narrowed answers carry no plan line", () => {
  const bare = zeroSlots("¿Cuál es mi meta?");
  assert.deepEqual(itemsOf(bare), ["Peso: 63 kg", "Ejercicio: 4 días por semana", "Agua: 8 vasos (2 litros) al día", "Aún no tienes un plan activo."]);
  assert.deepEqual(bare.blocks[0].buttons, [{ type: "link", label: "Subir mi plan", href: "/plans" }]);
  const narrowed = zeroSlots("¿Cuál es mi meta de agua?");
  assert.equal(narrowed.answer, "Tu meta de agua es 8 vasos (2 litros) al día.");
  assert.deepEqual(narrowed.blocks[0].buttons, []);
});

test("REQ-22 REQ-27 an active plan with zero slots is no plan for the weekly answer: the 2 L default water goal, the no-plan line and 'Subir mi plan'", () => {
  const reply = zeroSlots("Mi avance de la semana");
  assert.deepEqual(itemsOf(reply), ["Ejercicio: 2 de 4 días", "Agua: 5 litros", "Peso: bajaste 0.4 kg", "Aún no tienes un plan activo."]);
  assert.deepEqual(reply.blocks[0].buttons, [{ type: "link", label: "Subir mi plan", href: "/plans" }]);
});

test("REQ-17 REQ-27 an active plan with zero slots is no plan for water: the goal is the 2 L default (8 vasos), not the plan's 3 L", () => {
  const { db, user } = memDb({ meals: [] });
  db.planVersions[0].structured_data.nutrition_summary = { water_liters: { min: 3 } };
  assert.match(ragAnswer(db, user, "¿Cuánta agua llevo?", TODAY).answer, /de tu meta de 8 vasos\./);
  // Control: with slots the same plan's 3 L goal (12 vasos) applies.
  const withMeals = memDb();
  withMeals.db.planVersions[0].structured_data.nutrition_summary = { water_liters: { min: 3 } };
  assert.match(ragAnswer(withMeals.db, withMeals.user, "¿Cuánta agua llevo?", TODAY).answer, /de tu meta de 12 vasos\./);
});

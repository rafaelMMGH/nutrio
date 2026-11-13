import { ask, createChatUser, deleteChatUser, expect, seedLogs, setGoals, test } from "./assistant-helpers";

// REQ-13 (the date pin) and REQ-14 (periods) through POST /api/rag/chat as a seeded user. Written, not run, until Batch E.

test.beforeAll(() => createChatUser("progress"));
test.afterAll(() => deleteChatUser());

const periodOf = (body: { resolved?: { period?: unknown }[] }) => body.resolved?.[0]?.period;

test("REQ-13 the x-e2e-today pin moves the period bounds in resolved", async ({ chatContext }) => {
  const wednesday = await ask(chatContext.request, "¿Cuánta agua tomé ayer?", { today: "2026-10-28", trace: true });
  expect(periodOf(wednesday.body)).toEqual({ kind: "yesterday", from: "2026-10-27", to: "2026-10-27" });
  const friday = await ask(chatContext.request, "¿Cuánta agua tomé ayer?", { today: "2026-03-13", trace: true });
  expect(periodOf(friday.body)).toEqual({ kind: "yesterday", from: "2026-03-12", to: "2026-03-12" });
});

test("REQ-13 a pin header without the trace header changes no field shape", async ({ chatContext }) => {
  const plain = await ask(chatContext.request, "¿Cuánta agua tomé ayer?");
  const pinned = await ask(chatContext.request, "¿Cuánta agua tomé ayer?", { today: "2026-10-28" });
  expect(pinned.status).toBe(200);
  expect(pinned.body.resolved).toBeUndefined();
  expect(Object.keys(pinned.body).sort()).toEqual(Object.keys(plain.body).sort());
});

test("REQ-14/15 the water answer follows the pinned today and labels its period", async ({ chatContext }) => {
  seedLogs([{ date: "2026-10-27", water_glasses: 8 }, { date: "2026-10-28", water_glasses: 2 }, { date: "2026-03-12", water_glasses: 4 }]);
  const wednesday = await ask(chatContext.request, "¿Cuánta agua tomé ayer?", { today: "2026-10-28" });
  expect(wednesday.body.answer).toBe("Ayer (mar 27 oct): 2 litros en total, 2 litros por día en promedio. Cumpliste tu meta 1 de 1 día.");
  const friday = await ask(chatContext.request, "¿Cuánta agua tomé ayer?", { today: "2026-03-13" });
  expect(friday.body.answer).toBe("Ayer (jue 12 mar): 1 litro en total, 1 litro por día en promedio. Cumpliste tu meta 0 de 1 día.");
});

test("REQ-14 a date cue with no phrase gets the fallback line, and over 366 days the clamp line", async ({ chatContext }) => {
  const fallback = await ask(chatContext.request, "¿Cuánta agua tomé hace dos semanas?", { today: "2026-10-28" });
  expect(fallback.body.answer).toMatch(/^No entendí la fecha; te muestro hoy\. /);
  const clamped = await ask(chatContext.request, "agua de los últimos 400 días", { today: "2026-10-28" });
  expect(clamped.body.answer).toMatch(/^Solo puedo revisar hasta 366 días; te muestro los últimos 366\. /);
});

test("REQ-18 an exercise answer follows the pinned today and labels its period", async ({ chatContext }) => {
  seedLogs([{ date: "2026-10-27", exercised: true }, { date: "2026-10-28", exercised: false }]);
  const yesterday = await ask(chatContext.request, "¿Hice ejercicio ayer?", { today: "2026-10-28" });
  expect(yesterday.body.answer).toBe("Ayer (mar 27 oct): sí hiciste ejercicio.");
  const today = await ask(chatContext.request, "¿Hice ejercicio hoy?", { today: "2026-10-28" });
  expect(today.body.answer).toBe("Hoy no has registrado ejercicio.");
  const fallback = await ask(chatContext.request, "¿Cuántos días hice ejercicio hace dos semanas?", { today: "2026-10-28" });
  expect(fallback.body.answer).toMatch(/^No entendí la fecha; te muestro esta semana\. Esta semana \(lun 26 – hoy\) /);
});

test("REQ-19 the weight answer follows the pinned today: the date label, the week line and the age line", async ({ chatContext }) => {
  seedLogs([{ date: "2026-10-20", weight_kg: 66.6 }, { date: "2026-10-26", weight_kg: 66.2 }]);
  setGoals({ weight: 63 });
  const wednesday = await ask(chatContext.request, "Mi peso", { today: "2026-10-28" });
  expect(wednesday.body.answer).toMatch(/^(Tu último peso es|Tu registro más reciente es) 66\.2 kg \(26 oct\)\. Te faltan 3\.2 kg para tu meta de 63 kg\. Esta semana bajaste 0\.4 kg\.$/);
  const later = await ask(chatContext.request, "Mi peso", { today: "2026-11-12" });
  expect(later.body.answer).toMatch(/Tu último registro fue hace 17 días\.$/);
  expect(later.body.answer).not.toContain("Esta semana");
});

test("REQ-27 no weight logs: the empty state with its button, and no weight goal asks to set one", async ({ chatContext }) => {
  seedLogs([]);
  const empty = await ask(chatContext.request, "Mi peso", { today: "2026-10-28" });
  expect(empty.body.answer).toBe("Aún no registras tu peso.");
  expect(empty.body.blocks[0].buttons).toEqual([{ type: "link", label: "Registrar mi peso", href: "/" }]);
  seedLogs([{ date: "2026-10-27", weight_kg: 66 }]);
  setGoals({ weight: null });
  const noGoal = await ask(chatContext.request, "Mi peso", { today: "2026-10-28" });
  expect(noGoal.body.answer).toContain("No has fijado meta de peso.");
  expect(noGoal.body.blocks[0].buttons).toEqual([{ type: "link", label: "Fijar mi meta", href: "/" }]);
});

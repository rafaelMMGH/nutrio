import { ask, createChatUser, deleteChatUser, expect, seedLogs, test } from "./assistant-helpers";

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

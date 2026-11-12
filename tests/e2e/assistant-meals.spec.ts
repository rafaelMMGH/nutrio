import type { Button, ChatAnswer } from "../../src/lib/assistant";
import { ask, createChatUser, deleteChatUser, expect, resendSweep, seedPlan, test } from "./assistant-helpers";

// REQ-7 (almuerzo), REQ-8 (slot times) and REQ-11 (duplicate slots) through POST /api/rag/chat as a seeded user.
// Written, not run, until Batch E.

const DUPLICATED = ["Desayuno", "Colación", "Comida", "Colación", "Cena"];

test.beforeAll(() => createChatUser("meals"));
test.afterAll(() => deleteChatUser());

const questions = (body: ChatAnswer) => body.buttons.flatMap((button: Button) => (button.type === "question" ? [button] : []));

test("REQ-7 an almuerzo question asks desayuno or comida, one button per slot the plan has", async ({ chatContext }) => {
  seedPlan({ times: "all" });
  const { status, body } = await ask(chatContext.request, "¿A qué hora es mi almuerzo?");
  expect(status).toBe(200);
  expect(body.kind).toBe("clarify");
  expect(body.answer).toBe("¿Te refieres al desayuno o a la comida?");
  expect(questions(body).map((button) => button.label)).toEqual(["Desayuno", "Comida"]);
  await resendSweep(chatContext.request, [body]);

  seedPlan({ times: "all", meals: ["Comida", "Cena"] });
  const single = await ask(chatContext.request, "¿A qué hora es mi almuerzo?");
  expect(questions(single.body).map((button) => button.label)).toEqual(["Comida"]);
});

test("REQ-8 a single slot's time is highlighted, a slot without one says so, and no slot lists them all", async ({ chatContext }) => {
  seedPlan({ times: "some" });
  const timed = await ask(chatContext.request, "¿A qué hora es mi desayuno?");
  expect(timed.body.answer).toBe("Tu horario de desayuno: Entre 7 a 8 am.");
  expect(timed.body.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text)).toEqual(["Entre 7 a 8 am"]);

  const untimed = await ask(chatContext.request, "¿A qué hora es mi colación?");
  expect(untimed.body.answer).toBe("Tu plan no tiene horario para tu colación.");
  expect(untimed.body.blocks[0].lead.some((span) => span.highlight)).toBe(false);

  const all = await ask(chatContext.request, "¿Cuál es mi horario?");
  expect(all.body.blocks[0].sections[0].items.map((item) => item.map((span) => span.text).join(""))).toEqual([
    "Desayuno · Entre 7 a 8 am",
    "Colación",
    "Comida · Entre 2 a 3 pm",
    "Cena"
  ]);
});

test("REQ-11 duplicate colaciones: the buttons answer their own slot, and typed ordinals pick it", async ({ chatContext }) => {
  seedPlan({ times: "all", meals: DUPLICATED });
  const { body } = await ask(chatContext.request, "¿A qué hora es mi colación?");
  expect(body.kind).toBe("clarify");
  expect(body.answer).toBe("Tienes 2 colaciones. ¿Cuál?");
  expect(questions(body).map((button) => button.label)).toEqual(["Primera colación (Entre 10 a 11 am)", "Segunda colación (Entre 8 a 9 pm)"]);
  await resendSweep(chatContext.request, [body]);

  const first = await ask(chatContext.request, "¿A qué hora es mi primera colación?");
  expect(first.body.kind).toBe("answer");
  expect(first.body.answer).toBe("Tu horario de primera colación: Entre 10 a 11 am.");
  for (const typed of ["segunda colacion", "colación 2"]) {
    expect((await ask(chatContext.request, `¿A qué hora es mi ${typed}?`)).body.answer, typed).toBe("Tu horario de segunda colación: Entre 8 a 9 pm.");
  }
});

test("REQ-11 with REQ-6 step 4: '¿Qué lleva la segunda colación?' is the second colación's options, not a not-found reply", async ({ chatContext }) => {
  seedPlan({ times: "all", meals: DUPLICATED });
  const { status, body } = await ask(chatContext.request, "¿Qué lleva la segunda colación?", { trace: true });
  expect(status).toBe(200);
  expect(body.resolved).toEqual([{ topic: "slotOptions", slot: "colacion", ordinal: 2 }]);
  expect(["did_you_mean", "no_match"]).not.toContain(body.kind);
});

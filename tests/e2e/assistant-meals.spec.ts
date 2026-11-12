import type { Button, ChatAnswer } from "../../src/lib/assistant";
import { ask, createChatUser, deleteChatUser, expect, openAssistant, resendSweep, seedPlan, seedRecipes, test } from "./assistant-helpers";

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
  seedPlan({ times: "all", meals: DUPLICATED, fixture: true });
  const { status, body } = await ask(chatContext.request, "¿Qué lleva la segunda colación?", { trace: true });
  expect(status).toBe(200);
  expect(body.resolved).toEqual([{ topic: "slotOptions", slot: "colacion", ordinal: 2 }]);
  expect(["did_you_mean", "no_match"]).not.toContain(body.kind);
  expect(body.answer).toContain("segunda colación");
  expect(questions(body).slice(0, 3).map((button) => button.message)).toEqual([1, 2, 3].map((n) => `Segunda colación, opción ${n}`));
});

test("REQ-9 and REQ-10 typed selection and paging: 'cena opción 2', paging buttons, and an option past the last", async ({ chatContext }) => {
  seedPlan({ times: "all", fixture: true });
  const first = await ask(chatContext.request, "¿Cuál es mi cena?");
  expect(questions(first.body).map((button) => button.message).slice(-1)).toEqual(["Cena, más opciones (página 2)"]);
  const second = await ask(chatContext.request, "Cena, más opciones (página 2)");
  expect(questions(second.body).map((button) => button.label).slice(-1)).toEqual(["Opciones anteriores"]);
  await resendSweep(chatContext.request, [first.body, second.body]);

  const typed = await ask(chatContext.request, "cena opción 2", { trace: true });
  expect(typed.body.resolved).toEqual([{ topic: "slotOptions", slot: "cena", option: 2 }]);
  expect((await ask(chatContext.request, "la 2 de la cena")).body.buttons).toEqual(typed.body.buttons);
  const past = await ask(chatContext.request, "cena opción 7");
  expect(past.body.answer).toContain("Tu cena tiene 5 opciones.");
});

test("REQ-9 UI flow: tapping 'Ver más opciones' sends the paging message and shows 'Opciones anteriores'", async ({ chat }) => {
  seedPlan({ times: "all", fixture: true });
  await chat.goto("/");
  const ui = await openAssistant(chat);
  await ui.input.fill("¿Cuál es mi cena?");
  await ui.send.click();
  await ui.panel.getByRole("button", { name: "Ver más opciones" }).click();
  await expect(ui.userTurns.last()).toHaveText("Cena, más opciones (página 2)");
  await expect(ui.panel.getByRole("button", { name: "Opciones anteriores" })).toBeVisible();
  await ui.panel.getByRole("button", { name: "Opciones anteriores" }).click();
  await expect(ui.userTurns.last()).toHaveText("Cena, más opciones (página 1)");
  await expect(ui.panel.getByRole("button", { name: "Ver más opciones" })).toBeVisible();
});

test("REQ-12 the recipe page keeps its preparation display: the import notes show the empty state, accented sentences stay split", async ({ chat }) => {
  const ids = seedRecipes([
    { name: "Nota importada", description: "Extraído de plan.pdf", ingredients: [{ name: "Pechuga de pollo", quantity: 200 }] },
    { name: "Nota en mayúsculas", description: "EXTRAÍDO DE plan.pdf", ingredients: [{ name: "Pechuga de pollo", quantity: 200 }] },
    { name: "Nota sin acento", description: "Extraido de plan.pdf", ingredients: [{ name: "Pechuga de pollo", quantity: 200 }] },
    { name: "Con pasos", description: "¿Listo? Ásalo. Él sirve.", ingredients: [{ name: "Pechuga de pollo", quantity: 200 }] }
  ]);
  for (const name of ["Nota importada", "Nota en mayúsculas", "Nota sin acento"]) {
    await chat.goto(`/recipes/${ids[name]}`);
    await expect(chat.getByText("Tu plan no incluye instrucciones para esta receta."), name).toBeVisible();
    await expect(chat.locator(".rx-steps li"), name).toHaveCount(0);
  }
  await chat.goto(`/recipes/${ids["Con pasos"]}`);
  await expect(chat.locator(".rx-steps li p")).toHaveText(["¿Listo?", "Ásalo.", "Él sirve."]);
});

import { ask, clearPlan, createChatUser, deleteChatUser, expect, resendSweep, seedPlan, setName, test } from "./assistant-helpers";

// The user's name and the plan's name through POST /api/rag/chat (spec assistant-data-scope US5: REQ-30, REQ-31) and the
// REQ-27 reply without a plan. Written, not run, until Batch E.

test.beforeAll(() => createChatUser("identity"));
test.afterAll(() => deleteChatUser());

const leadOf = (body: { blocks: { lead: { text: string }[] }[] }) => body.blocks[0].lead.map((span) => span.text).join("");
const bolds = (body: { blocks: { lead: { text: string; highlight?: boolean }[] }[] }) => body.blocks[0].lead.filter((span) => span.highlight).map((span) => span.text);

test("REQ-30 '¿Cómo me llamo?' says the name, highlighted, and a blank name says it is not registered", async ({ chatContext }) => {
  seedPlan({ times: "all" });
  setName("Rafael");
  const named = await ask(chatContext.request, "¿Cómo me llamo?");
  expect(named.status).toBe(200);
  expect(named.body.answer).toBe("Te llamas Rafael.");
  expect(bolds(named.body)).toEqual(["Rafael"]);
  await resendSweep(chatContext.request, [named.body]);

  setName("");
  const blank = await ask(chatContext.request, "¿Cómo me llamo?");
  expect(blank.body.answer).toBe("Aún no tengo tu nombre registrado.");
  expect(bolds(blank.body)).toEqual([]);
});

test("REQ-31 '¿Cómo se llama mi plan?' gives only the name without .pdf, and '¿Cuál es mi plan?' has it in the lead", async ({ chatContext }) => {
  seedPlan({ times: "all", planName: "Plan octubre.PDF" });
  const name = await ask(chatContext.request, "¿Cómo se llama mi plan?");
  expect(name.body.answer).toBe("Tu plan activo se llama Plan octubre.");
  expect(bolds(name.body)).toEqual(["Plan octubre"]);
  expect(name.body.blocks[0].sections).toEqual([]);

  const summary = await ask(chatContext.request, "¿Cuál es mi plan?");
  expect(leadOf(summary.body)).toBe("Tu plan activo es Plan octubre. Tu objetivo: Mejorar mi energía");
  expect(bolds(summary.body)).toEqual(["Plan octubre"]);
  await resendSweep(chatContext.request, [name.body]);
});

test("REQ-24 an identity block in a 2-block answer is titled 'Nombre / Plan'", async ({ chatContext }) => {
  seedPlan({ times: "all" });
  setName("Rafael");
  const { body } = await ask(chatContext.request, "cómo me llamo y mi peso");
  expect(body.blocks.map((block) => block.title)).toEqual(["Nombre / Plan", "Peso"]);
});

test("REQ-27 the plan's name without an active plan, or with zero meals, says so with 'Subir mi plan' only", async ({ chatContext }) => {
  for (const setup of [() => clearPlan(), () => seedPlan({ times: "all", meals: [] })]) {
    setup();
    const { body } = await ask(chatContext.request, "¿Cómo se llama mi plan?");
    expect(body.answer).toBe("Aún no tienes un plan activo.");
    expect(body.blocks[0].buttons).toEqual([{ type: "link", label: "Subir mi plan", href: "/plans" }]);
    expect(body.buttons).toEqual([]);
    expect(body.sources).toEqual([]);
  }
});

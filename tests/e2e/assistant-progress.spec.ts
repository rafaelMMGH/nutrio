import { ask, createChatUser, deleteChatUser, expect, test } from "./assistant-helpers";

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

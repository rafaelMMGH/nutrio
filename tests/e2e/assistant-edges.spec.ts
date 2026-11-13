import type { Button } from "../../src/lib/assistant";
import { GREETINGS, NO_MATCH_LEADS, THANKS, slotTime } from "../shared/assistant-copy";
import { ask, createChatUser, deleteChatUser, expect, resendSweep, seedPlan, test } from "./assistant-helpers";

// Chat-like edge cases through POST /api/rag/chat (spec assistant-data-scope US4): REQ-23 greeting and thanks, the
// REQ-28 variants, the plain no-match reply and the dish answers (REQ-26, REQ-29). Written, not run, until Batch E.

const STARTERS = ["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"];

test.beforeAll(() => createChatUser("edges"));
test.afterAll(() => deleteChatUser());

const messages = (buttons: { type: string }[]) => (buttons as Button[]).flatMap((button) => (button.type === "question" ? [button.message] : []));

test("REQ-23 hola and a fuzzy thanks get a lead of their variants and the 4 starters, which resolve", async ({ chatContext }) => {
  // The resend sweep asks "Mi cena de hoy", which needs a plan to answer with options.
  seedPlan({ times: "all" });
  const hello = await ask(chatContext.request, "hola");
  expect(hello.status).toBe(200);
  expect(hello.body.kind).toBe("greeting");
  expect(GREETINGS).toContain(hello.body.answer);
  expect(messages(hello.body.buttons)).toEqual(STARTERS);
  const thanks = await ask(chatContext.request, "grasias");
  expect(thanks.body.kind).toBe("greeting");
  expect(THANKS).toContain(thanks.body.answer);
  await resendSweep(chatContext.request, [hello.body, thanks.body]);
});

test("REQ-28 the same question twice shows the same variant, and the no-match lead is one of the two", async ({ chatContext }) => {
  seedPlan({ times: "all" });
  for (const message of ["hola", "hoal", "¿A qué hora es mi colación?"]) {
    const [first, second] = [await ask(chatContext.request, message), await ask(chatContext.request, message)];
    expect(second.body.answer, message).toBe(first.body.answer);
  }
  const noMatch = await ask(chatContext.request, "hoal");
  expect(noMatch.body.kind).toBe("no_match");
  expect(NO_MATCH_LEADS).toContain(noMatch.body.answer);
  expect(messages(noMatch.body.buttons)).toEqual(STARTERS);
  expect((await ask(chatContext.request, "¿A qué hora es mi colación?")).body.answer).toMatch(slotTime("colación", "Entre 10 a 11 am"));
});

const quoted = (buttons: Button[]) => buttons.flatMap((button) => (button.type === "question" ? [[button.label, button.message]] : []));
const sends = (...names: string[]) => names.map((name) => [name, `¿Qué lleva ${name}?`]);

test("REQ-26 pollo is a did-you-mean with its two recipes, pizza is not found, and the buttons resolve", async ({ chatContext }) => {
  seedPlan({ times: "all", fixture: true });
  const pollo = await ask(chatContext.request, "¿Qué lleva el pollo?");
  expect(pollo.body.kind).toBe("did_you_mean");
  expect(pollo.body.answer).toBe("No encontré exactamente 'pollo'. ¿Quisiste decir…?");
  expect(quoted(pollo.body.buttons)).toEqual(sends("Pollo asado", "Ensalada de pollo"));
  const pizza = await ask(chatContext.request, "¿Qué lleva la pizza?");
  expect(pizza.body.kind).toBe("answer");
  expect(pizza.body.answer).toBe("No encontré 'pizza' en tu plan ni en tus recetas.");
  expect(messages(pizza.body.buttons)).toEqual(["Mi carrito", "Mi cena de hoy"]);
  await resendSweep(chatContext.request, [pollo.body, pizza.body]);
});

test("REQ-29 a question with recipe words and no cue is a did-you-mean in rank order, never a detail", async ({ chatContext }) => {
  seedPlan({ times: "all", fixture: true });
  const { body } = await ask(chatContext.request, "pollo atún ensalada");
  expect(body.kind).toBe("did_you_mean");
  expect(body.answer).toBe("¿Quisiste decir…?");
  expect(quoted(body.buttons)).toEqual(sends("Ensalada de pollo", "Pollo asado", "Sándwich de atún"));
  await resendSweep(chatContext.request, [body]);
});

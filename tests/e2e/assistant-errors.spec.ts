import type { APIRequestContext, Route } from "@playwright/test";
import { expectIssues } from "./fixtures";
import { assistantUi, ask, chatUserId, createChatUser, deleteChatUser, expect, openAssistant, serverLog, test } from "./assistant-helpers";

// chat-polish REQ-23 (v1.9): a failure while building an answer is a 500 with a generic body and a logged error; an
// invalid or unparsable request is a 400 and logs nothing at error level. The failure is injected with the test hook
// x-e2e-fail: chat (plan D4); the UI itself never sends x-e2e-* headers.

const SERVER_ERROR_COPY = "Algo salió mal al responder. Intenta de nuevo.";
const REQUEST_ERROR_COPY = "No pude responder en este momento.";
const API = /\/api\/rag\/chat$/;
const FAILED_500 = [/POST \/api\/rag\/chat → 500/, /Failed to load resource.*500/];
const FAILED_400 = [/POST \/api\/rag\/chat → 400/, /Failed to load resource.*400/];
const LOG_MARK = "[api/rag/chat]";
const INJECTED = "Injected chat failure";

test.beforeAll(() => {
  createChatUser("errors");
});
test.afterAll(() => deleteChatUser());

/** The server log text after `log`'s mark, once it contains `needle` (the pipe through tee may lag), up to 2 s. */
async function logWith(log: ReturnType<typeof serverLog>, needle: string) {
  await expect.poll(() => log.since(), { timeout: 2000 }).toContain(needle);
  return log.since();
}

/**
 * Requires that the request just made logged no error entry. The log pipe may lag, so instead of sleeping, a sentinel
 * request that does fail is logged after it: once the sentinel's entry shows, everything before it is in the log too,
 * and the only entry must be the sentinel's.
 */
async function expectNoErrorLog(request: APIRequestContext, log: ReturnType<typeof serverLog>) {
  await ask(request, "x", { fail: true });
  const text = await logWith(log, INJECTED);
  expect(text.split(LOG_MARK).length - 1).toBe(1);
}

test.describe("API", () => {
  test("an injected builder failure is a 500 with a generic body, and the server logs route, user, message length and stack", async ({ chatContext }) => {
    const message = "¿Qué hay en mi carrito?";
    const log = serverLog();
    const { status, body } = await ask(chatContext.request, message, { fail: true });
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(body)).not.toContain(INJECTED);

    const text = await logWith(log, INJECTED);
    expect(text).toContain(LOG_MARK);
    expect(text).toContain(chatUserId());
    expect(text).toMatch(new RegExp(`messageLength:\\s*${message.length}\\b`));
    expect(text).toMatch(/Error: Injected chat failure[\s\S]*\n\s+at /);
  });

  test("a question without hook headers is answered with a 200", async ({ chatContext }) => {
    const { status } = await ask(chatContext.request, "hola");
    expect(status).toBe(200);
  });

  test("a message of 501 characters is a 400 with the validation issues and no log entry", async ({ chatContext }) => {
    const log = serverLog();
    const response = await chatContext.request.post("/api/rag/chat", { data: { message: "a".repeat(501) } });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request");
    expect(body.issues.fieldErrors.message).toBeDefined();
    await expectNoErrorLog(chatContext.request, log);
  });

  test("a malformed JSON body is a 400 and no error-level log entry", async ({ chatContext }) => {
    const log = serverLog();
    const response = await chatContext.request.post("/api/rag/chat", { data: '{"message":', headers: { "Content-Type": "application/json" } });
    expect(response.status()).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    await expectNoErrorLog(chatContext.request, log);
  });
});

test.describe("panel", () => {
  const failHeader = (route: Route) => route.continue({ headers: { ...route.request().headers(), "x-e2e-fail": "chat" } });

  test.describe("a 500", () => {
    test.use({ expectedIssues: expectIssues(...FAILED_500) });

    test("shows the server-error copy with Reintentar, and Reintentar works once the failure is gone", async ({ chat }) => {
      await chat.route(API, failHeader);
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await ui.input.fill("hola");
      await ui.send.click();
      await expect(ui.assistantTurns).toHaveCount(1);
      await expect(ui.live).toHaveText([SERVER_ERROR_COPY]);
      await expect(ui.panel).not.toContainText(REQUEST_ERROR_COPY);
      const retry = chat.getByRole("button", { name: "Reintentar" });
      await expect(retry).toBeVisible();

      await chat.unroute(API, failHeader);
      await retry.click();
      await expect(ui.assistantTurns).toHaveCount(1);
      await expect(ui.panel).not.toContainText(SERVER_ERROR_COPY);
      await expect(ui.panel).not.toContainText(REQUEST_ERROR_COPY);
      await expect(chat.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
      await expect(ui.live.first()).not.toHaveText("");
      await expect(ui.userTurns).toHaveText(["hola"]);
    });
  });

  test.describe("a 400", () => {
    test.use({ expectedIssues: expectIssues(...FAILED_400) });

    test("keeps the generic copy 'No pude responder en este momento.' with Reintentar", async ({ chat }) => {
      await chat.route(API, (route) => route.continue({ postData: '{"message":' }));
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await ui.input.fill("hola");
      await ui.send.click();
      await expect(ui.assistantTurns).toHaveCount(1);
      await expect(ui.live).toHaveText([REQUEST_ERROR_COPY]);
      await expect(ui.panel).not.toContainText(SERVER_ERROR_COPY);
      await expect(chat.getByRole("button", { name: "Reintentar" })).toBeVisible();
    });
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { testHooks } from "@/lib/server/test-hooks";

// Plan D4: the e2e hooks are headers, honored only when E2E_HOOKS=1 and NODE_ENV is not production.
const hooked = () => new Headers({ "x-e2e-fail": "chat", "x-e2e-today": "2026-03-15", "x-e2e-trace": "1" });

test("the hooks are returned in the test environment", () => {
  assert.deepEqual(testHooks(hooked(), { E2E_HOOKS: "1", NODE_ENV: "development" }), { today: "2026-03-15", fail: true, trace: true });
  assert.deepEqual(testHooks(hooked(), { E2E_HOOKS: "1" }), { today: "2026-03-15", fail: true, trace: true });
});

test("without E2E_HOOKS every hook is ignored", () => {
  assert.deepEqual(testHooks(hooked(), {}), { trace: false });
  assert.deepEqual(testHooks(hooked(), { NODE_ENV: "development" }), { trace: false });
  assert.deepEqual(testHooks(hooked(), { E2E_HOOKS: "0" }), { trace: false });
  assert.deepEqual(testHooks(hooked(), { E2E_HOOKS: "true" }), { trace: false });
});

test("under production every hook is ignored, even with E2E_HOOKS", () => {
  assert.deepEqual(testHooks(hooked(), { E2E_HOOKS: "1", NODE_ENV: "production" }), { trace: false });
});

test("only the documented header values count", () => {
  const env = { E2E_HOOKS: "1" };
  assert.deepEqual(testHooks(new Headers(), env), { trace: false });
  assert.deepEqual(testHooks(new Headers({ "x-e2e-fail": "cart", "x-e2e-trace": "0" }), env), { trace: false });
  assert.deepEqual(testHooks(new Headers({ "x-e2e-today": "15/03/2026" }), env), { trace: false });
  assert.deepEqual(testHooks(new Headers({ "x-e2e-today": "2026-02-31" }), env), { trace: false });
});

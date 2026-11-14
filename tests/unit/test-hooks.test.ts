import assert from "node:assert/strict";
import { mock, test } from "node:test";
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

// A pin that is present but not a real day is a test bug; with hooks on it must be loud, once per request (F1b review).
test("a malformed x-e2e-today warns once with hooks enabled, and is still ignored", () => {
  const warn = mock.method(console, "warn", () => {});
  try {
    for (const value of ["15/03/2026", "2026-02-31", ""]) {
      warn.mock.resetCalls();
      assert.deepEqual(testHooks(new Headers({ "x-e2e-today": value }), { E2E_HOOKS: "1" }), { trace: false });
      assert.equal(warn.mock.callCount(), 1, JSON.stringify(value));
      assert.match(String(warn.mock.calls[0].arguments[0]), /x-e2e-today/);
    }
  } finally {
    warn.mock.restore();
  }
});

test("no warning for a valid or absent pin, or when the hooks are off", () => {
  const warn = mock.method(console, "warn", () => {});
  try {
    testHooks(new Headers({ "x-e2e-today": "2026-03-15" }), { E2E_HOOKS: "1" });
    testHooks(new Headers(), { E2E_HOOKS: "1" });
    testHooks(new Headers({ "x-e2e-today": "nonsense" }), {});
    testHooks(new Headers({ "x-e2e-today": "nonsense" }), { E2E_HOOKS: "1", NODE_ENV: "production" });
    assert.equal(warn.mock.callCount(), 0);
  } finally {
    warn.mock.restore();
  }
});

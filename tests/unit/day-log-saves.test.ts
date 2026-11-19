import assert from "node:assert/strict";
import { test } from "node:test";
import { createDaySaves } from "@/components/nutrio/day-log-saves";
import type { DayLog } from "@/components/dashboard/food";

type Call = { date: string; body: Partial<DayLog>; resolve: () => void; reject: () => void };

// A fake store plus a `send` whose requests stay open until the test settles them.
function setup(initial: Record<string, DayLog> = {}) {
  const logs: Record<string, DayLog> = { ...initial };
  const calls: Call[] = [];
  const errors: string[] = [];
  const saves = createDaySaves({
    send: (date, body) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ date, body: structuredClone(body), resolve, reject: () => reject(new Error("boom")) });
      }),
    read: (date) => logs[date] ?? { meals_done: [], water_glasses: 0 },
    write: (date, log) => {
      logs[date] = log;
    },
    onError: () => errors.push("toast"),
  });
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  return { logs, calls, errors, saves, tick };
}

const DAY = "2026-11-18";

test("REQ-4: a failed save resolves false, rolls the patch back and the toast fires once", async () => {
  const { logs, calls, errors, saves, tick } = setup({ [DAY]: { meals_done: [], water_glasses: 0, weight_kg: 70 } });
  const result = saves.save(DAY, { weight_kg: 71 });
  assert.equal(logs[DAY].weight_kg, 71);
  await tick();
  calls[0].reject();
  assert.equal(await result, false);
  assert.equal(logs[DAY].weight_kg, 70);
  assert.equal(errors.length, 1);
});

test("a successful save resolves true with no toast", async () => {
  const { calls, errors, saves, tick } = setup();
  const result = saves.save(DAY, { weight_kg: 71 });
  await tick();
  assert.deepEqual(calls[0].body, { weight_kg: 71 });
  calls[0].resolve();
  assert.equal(await result, true);
  assert.equal(errors.length, 0);
});

test("REQ-9: setMeal applies one meal optimistically and sends the current list", async () => {
  const { logs, calls, saves, tick } = setup({ [DAY]: { meals_done: ["a"], water_glasses: 2 } });
  const result = saves.setMeal(DAY, "b", true);
  assert.deepEqual(logs[DAY].meals_done, ["a", "b"]);
  assert.equal(logs[DAY].water_glasses, 2);
  await tick();
  assert.deepEqual(calls[0].body, { meals_done: ["a", "b"] });
  calls[0].resolve();
  assert.equal(await result, "saved");
});

test("REQ-25d: a failed mark rolls back only that meal and toasts once", async () => {
  const { logs, calls, errors, saves, tick } = setup({ [DAY]: { meals_done: ["a"], water_glasses: 0 } });
  const result = saves.setMeal(DAY, "b", true);
  await tick();
  calls[0].reject();
  assert.equal(await result, "failed");
  assert.deepEqual(logs[DAY].meals_done, ["a"]);
  assert.equal(errors.length, 1);
});

test("a failed unmark puts the meal back", async () => {
  const { logs, calls, saves, tick } = setup({ [DAY]: { meals_done: ["a", "b"], water_glasses: 0 } });
  const result = saves.setMeal(DAY, "a", false);
  assert.deepEqual(logs[DAY].meals_done, ["b"]);
  await tick();
  calls[0].reject();
  assert.equal(await result, "failed");
  assert.deepEqual(logs[DAY].meals_done.toSorted(), ["a", "b"]);
});

test("REQ-25c: a stale request's late failure does not overwrite the newer action", async () => {
  const { logs, calls, errors, saves, tick } = setup();
  const first = saves.setMeal(DAY, "a", true);
  await tick();
  const second = saves.setMeal(DAY, "a", false); // newer action on the same meal
  assert.deepEqual(logs[DAY].meals_done, []);
  calls[0].reject();
  assert.equal(await first, "stale");
  assert.deepEqual(logs[DAY].meals_done, []);
  assert.equal(errors.length, 0);
  await tick();
  assert.deepEqual(calls[1].body, { meals_done: [] });
  calls[1].resolve();
  assert.equal(await second, "saved");
});

test("REQ-25c: a stale request's late success reports stale and changes nothing", async () => {
  const { logs, calls, saves, tick } = setup();
  const first = saves.setMeal(DAY, "a", true);
  await tick();
  const second = saves.setMeal(DAY, "a", false);
  calls[0].resolve();
  assert.equal(await first, "stale");
  assert.deepEqual(logs[DAY].meals_done, []);
  await tick();
  calls[1].reject();
  assert.equal(await second, "failed");
  assert.deepEqual(logs[DAY].meals_done, ["a"]);
});

test("queue: B waits for A on the same date and each body is built at send time", async () => {
  const { logs, calls, saves, tick } = setup();
  const a = saves.setMeal(DAY, "a", true);
  await tick();
  const b = saves.setMeal(DAY, "b", true);
  await tick();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { meals_done: ["a"] });
  calls[0].resolve();
  assert.equal(await a, "saved");
  await tick();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].body, { meals_done: ["a", "b"] });
  calls[1].resolve();
  assert.equal(await b, "saved");
  assert.deepEqual(logs[DAY].meals_done, ["a", "b"]);
});

test("queue: A fails after B was tapped; only A rolls back and B's body never carried A", async () => {
  const { logs, calls, errors, saves, tick } = setup();
  const a = saves.setMeal(DAY, "a", true);
  await tick();
  const b = saves.setMeal(DAY, "b", true);
  calls[0].reject();
  assert.equal(await a, "failed");
  assert.deepEqual(logs[DAY].meals_done, ["b"]);
  await tick();
  assert.deepEqual(calls[1].body, { meals_done: ["b"] });
  calls[1].resolve();
  assert.equal(await b, "saved");
  assert.equal(errors.length, 1);
});

test("different dates do not wait for each other", async () => {
  const { calls, saves, tick } = setup();
  void saves.setMeal(DAY, "a", true);
  void saves.setMeal("2026-11-17", "a", true);
  await tick();
  assert.equal(calls.length, 2);
});

import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { ADVANCE_DELAY, TAP_LOCK_MS, acceptTap, createAdvance, nextPending } from "@/components/nutrio/mark-logic";

const meals = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("constants match the spec", () => {
  assert.equal(TAP_LOCK_MS, 400);
  assert.equal(ADVANCE_DELAY, 900);
});

test("REQ-25a: taps are ignored while the meal is pending", () => {
  assert.equal(acceptTap({ pending: true, lockedUntil: 0, now: 5000 }), false);
  assert.equal(acceptTap({ pending: false, lockedUntil: 0, now: 5000 }), true);
});

test("REQ-25b: taps are ignored until the lockout ends", () => {
  assert.equal(acceptTap({ pending: false, lockedUntil: 1400, now: 1399 }), false);
  assert.equal(acceptTap({ pending: false, lockedUntil: 1400, now: 1400 }), true);
});

test("REQ-25d: meals are independent (each has its own lock)", () => {
  const locks = new Map([["a", 2000]]);
  assert.equal(acceptTap({ pending: false, lockedUntil: locks.get("a") ?? 0, now: 1000 }), false);
  assert.equal(acceptTap({ pending: false, lockedUntil: locks.get("b") ?? 0, now: 1000 }), true);
});

test("nextPending finds the next pending meal after `from`, wrapping around", () => {
  assert.equal(nextPending(meals, ["a"], 0), 1);
  assert.equal(nextPending(meals, ["a", "b"], 0), 2);
  assert.equal(nextPending(meals, ["a", "c"], 2), 1);
  assert.equal(nextPending(meals, ["b", "c"], 2), 0);
});

test("nextPending returns null when nothing else is pending", () => {
  assert.equal(nextPending(meals, ["a", "b", "c"], 0), null);
  assert.equal(nextPending(meals, ["b", "c"], 0), null);
  assert.equal(nextPending([], [], 0), null);
});

test("REQ-6: the advance does not fire at 800 ms and fires by 1000 ms", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const advance = createAdvance();
  const moves: number[] = [];
  advance.start(0, meals, () => ["a"], (next) => moves.push(next));
  t.mock.timers.tick(800);
  assert.equal(moves.length, 0);
  t.mock.timers.tick(200);
  assert.deepEqual(moves, [1]);
});

test("REQ-6: the target is computed from the done ids at fire time", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const advance = createAdvance();
  let done = ["a"];
  const moves: number[] = [];
  advance.start(0, meals, () => done, (next) => moves.push(next));
  done = ["a", "b"];
  t.mock.timers.tick(ADVANCE_DELAY);
  assert.deepEqual(moves, [2]);
});

test("REQ-6: nothing pending at fire time does nothing", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const advance = createAdvance();
  const moves: number[] = [];
  advance.start(0, meals, () => ["a", "b", "c"], (next) => moves.push(next));
  t.mock.timers.tick(2000);
  assert.equal(moves.length, 0);
});

test("REQ-6: cancel before firing prevents the advance, and a new start restarts the 900 ms", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const advance = createAdvance();
  const moves: number[] = [];
  advance.start(0, meals, () => ["a"], (next) => moves.push(next));
  t.mock.timers.tick(500);
  advance.cancel();
  t.mock.timers.tick(2000);
  assert.equal(moves.length, 0);
  advance.start(0, meals, () => ["a"], (next) => moves.push(next));
  t.mock.timers.tick(899);
  assert.equal(moves.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(moves, [1]);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { splitDays } from "@/lib/domain/period";

// The period planner shares the days among the selected recipes: the shares add up to the period, never beyond it.
test("splits the days exactly, the first recipes taking the remainder", () => {
  assert.deepEqual(splitDays(7, 2), [4, 3]);
  assert.deepEqual(splitDays(7, 3), [3, 2, 2]);
  assert.deepEqual(splitDays(14, 3), [5, 5, 4]);
  assert.deepEqual(splitDays(5, 2), [3, 2]);
  assert.deepEqual(splitDays(1, 1), [1]);
  assert.deepEqual(splitDays(3, 1), [3]);
});

test("the shares always add up to the days and each is at least one", () => {
  for (let days = 1; days <= 60; days++) {
    for (let recipes = 1; recipes <= days; recipes++) {
      const shares = splitDays(days, recipes);
      assert.equal(shares.length, recipes);
      assert.equal(shares.reduce((sum, share) => sum + share, 0), days, `${days} days over ${recipes} recipes`);
      assert.ok(shares.every((share) => share >= 1));
    }
  }
});

test("rejects more recipes than days, and non-integer or non-positive input", () => {
  assert.throws(() => splitDays(2, 3), RangeError);
  assert.throws(() => splitDays(7.5, 2), RangeError);
  assert.throws(() => splitDays(7, 1.5), RangeError);
  assert.throws(() => splitDays(0, 1), RangeError);
  assert.throws(() => splitDays(7, 0), RangeError);
  assert.throws(() => splitDays(-3, 1), RangeError);
  assert.throws(() => splitDays(Number.NaN, 1), RangeError);
});

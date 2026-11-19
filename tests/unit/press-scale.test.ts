import assert from "node:assert/strict";
import { test } from "node:test";
import { pressScale } from "@/components/arc/action-button/press-scale";

test("press scale applies on the first tap regardless of the instant first paint", () => {
  assert.deepEqual(pressScale({ reduced: false, pending: false }), { scale: 0.97 });
});

test("press scale is skipped under reduced motion", () => {
  assert.equal(pressScale({ reduced: true, pending: false }), undefined);
});

test("press scale is skipped while pending", () => {
  assert.equal(pressScale({ reduced: false, pending: true }), undefined);
});

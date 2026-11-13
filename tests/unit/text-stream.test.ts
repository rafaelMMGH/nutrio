import assert from "node:assert/strict";
import { test } from "node:test";
import { TYPE_BUDGET_MS, typingDuration, visibleCharacters } from "@/lib/client/text-stream";

// REQ-33: a long lead completes within the budget (the spec's 1 s), a short one keeps a natural pace.
test("typing time is capped by the budget", () => {
  assert.equal(typingDuration(10), 180);
  assert.equal(typingDuration(5000), TYPE_BUDGET_MS);
  assert.ok(TYPE_BUDGET_MS < 1000);
  assert.equal(typingDuration(0), 0);
});

test("visible characters grow monotonically and finish at the duration", () => {
  const length = 400;
  let previous = 0;
  for (let t = 0; t <= TYPE_BUDGET_MS; t += 50) {
    const shown = visibleCharacters(length, t);
    assert.ok(shown >= previous);
    previous = shown;
  }
  assert.equal(visibleCharacters(length, 0), 0);
  assert.equal(visibleCharacters(length, TYPE_BUDGET_MS), length);
  assert.equal(visibleCharacters(length, 99999), length);
});

test("an empty text is complete at once", () => {
  assert.equal(visibleCharacters(0, 0), 0);
});

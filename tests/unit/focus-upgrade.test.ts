import assert from "node:assert/strict";
import { test } from "node:test";
import { mayUpgradeFocus } from "@/lib/client/focus-upgrade";

// REQ-35: the heading takes focus after the loading state only if the user has not moved it.
test("focus may move to the heading from the body or the main region only", () => {
  const body = {};
  const main = {};
  assert.equal(mayUpgradeFocus(body, body, main), true);
  assert.equal(mayUpgradeFocus(main, body, main), true);
  assert.equal(mayUpgradeFocus(null, body, main), true);
  assert.equal(mayUpgradeFocus({}, body, main), false);
});

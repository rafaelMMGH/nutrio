import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTERS } from "@/lib/assistant";

// One source for the four starter questions (spec Copy; REQ-4): the empty state, the greeting and the no-match reply all use it.

test("the starters are the four questions of the spec Copy, in order", () => {
  assert.deepEqual(STARTERS, ["Mi cena de hoy", "Mi avance de la semana", "Mi peso", "Mi carrito"]);
});

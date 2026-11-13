import assert from "node:assert/strict";
import { test } from "node:test";
import { TYPE_BUDGET_MS, clipRich, graphemes, richLength, typingDuration, visibleCharacters } from "@/lib/client/text-stream";

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

// The reveal is linear in time: pinning the midpoints kills a sqrt, a ceil, a round or a changed rate.
test("visible characters are linear in elapsed time", () => {
  assert.equal(visibleCharacters(400, 450), 200);
  assert.equal(visibleCharacters(10, 90), 5);
  assert.equal(visibleCharacters(10, 100), 5); // 5.55: floor, not round
  assert.equal(visibleCharacters(400, 1), 0);
});

test("a negative elapsed time shows nothing", () => {
  assert.equal(visibleCharacters(400, -50), 0);
  assert.equal(visibleCharacters(10, -1), 0);
});

// REQ-33: revealing by UTF-16 unit would cut "🥑" or a ZWJ family in half.
const MIXED = "Cena 🥑 con 👨‍👩‍👧 y é";
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

test("graphemes keep emoji and ZWJ sequences whole", () => {
  const parts = graphemes(MIXED);
  assert.equal(parts.length, 16);
  assert.ok(parts.includes("🥑"));
  assert.ok(parts.includes("👨‍👩‍👧"));
  assert.equal(parts.join(""), MIXED);
});

test("no reveal step leaves a lone surrogate or a broken cluster", () => {
  const rich = [{ text: "Cena 🥑 con " }, { text: "👨‍👩‍👧", highlight: true as const }, { text: " y é" }];
  const total = richLength(rich);
  assert.equal(total, 16);
  for (let count = 0; count <= total + 2; count++) {
    const text = clipRich(rich, count).map((span) => span.text).join("");
    assert.ok(!LONE_SURROGATE.test(text), `count ${count}`);
    assert.ok(!text.endsWith("\u200d"), `count ${count}`);
    assert.equal(graphemes(text).length, Math.min(count, total), `count ${count}`);
  }
});

test("clipping keeps the highlight and drops spans cut to nothing", () => {
  const rich = [{ text: "Hoy " }, { text: "1800 kcal", highlight: true as const }, { text: " de meta" }];
  assert.deepEqual(clipRich(rich, 6), [{ text: "Hoy " }, { text: "18", highlight: true }]);
  assert.deepEqual(clipRich(rich, 4), [{ text: "Hoy " }]);
  assert.deepEqual(clipRich(rich, 0), []);
  assert.deepEqual(clipRich(rich, 99), rich);
});

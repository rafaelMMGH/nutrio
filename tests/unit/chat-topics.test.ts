import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeText } from "@/lib/assistant";
import { TOPICS, VOCABULARY } from "@/lib/domain/chat-topics";

// The matcher does not normalize vocabulary entries and its never-fuzzy list is accent-free, so entries are stored
// normalized and in the singular (it folds plurals itself). Numbers are not parsed here (US3).

test("every vocabulary entry is normalized, in the singular, and belongs to a topic with a title table row", () => {
  assert.ok(VOCABULARY.length > 0);
  for (const { topic, words, phrases } of VOCABULARY) {
    assert.ok(topic in TOPICS, topic);
    for (const entry of [...words, ...phrases]) {
      assert.equal(entry.replace(/\*$/, ""), normalizeText(entry.replace(/\*$/, "")), `${topic}: ${entry}`);
      for (const part of entry.replace(/\*$/, "").split(" ")) assert.ok(!part.endsWith("s"), `${topic}: "${entry}" has a plural-looking word "${part}"`);
    }
  }
});

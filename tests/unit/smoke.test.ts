import assert from "node:assert/strict";
import { test } from "node:test";
import { words } from "@/lib/assistant";
import { ragAnswer } from "@/lib/domain/chat";
import { listRecipes } from "@/lib/domain/plans";
import { emptyDb } from "@/lib/storage/db";

// Proves the unit runner resolves `@/` (also transitively inside src/) and that the chat.ts import chain loads
// without Prisma, Next or a database (plan D10).
test("@/ imports resolve, including the chat and plans chains", () => {
  assert.equal(typeof words, "function");
  assert.equal(typeof listRecipes, "function");
  const db = emptyDb();
  assert.equal(db.users.length, 1);
});

test("ragAnswer answers on an empty db", () => {
  const db = emptyDb();
  const answer = ragAnswer(db, db.users[0], "hola", "2026-10-28");
  assert.equal(typeof answer.answer, "string");
  assert.ok(answer.answer.length > 0);
  assert.equal(answer.kind, "greeting");
});

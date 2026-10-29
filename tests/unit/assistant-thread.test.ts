import assert from "node:assert/strict";
import { test } from "node:test";
import { questionButtonsTurnId, type ThreadTurn } from "@/lib/client/assistant-thread";

const user = (id: string): ThreadTurn => ({ id, role: "user" });
const assistant = (id: string, status: "pending" | "answer" | "error", retrying = false): ThreadTurn => ({ id, role: "assistant", status, retrying });

// REQ-5 client: question buttons sit only under the latest finished answer.
test("the latest finished answer owns the question buttons", () => {
  const turns = [user("u1"), assistant("a1", "answer"), user("u2"), assistant("a2", "answer")];
  assert.equal(questionButtonsTurnId(turns), "a2");
});

test("a pending new question keeps the buttons on the previous answer", () => {
  assert.equal(questionButtonsTurnId([user("u1"), assistant("a1", "answer"), user("u2"), assistant("a2", "pending")]), "a1");
});

test("an error as the latest finished turn hides the buttons, and so does a pending retry", () => {
  assert.equal(questionButtonsTurnId([assistant("a1", "answer"), assistant("a2", "error")]), null);
  assert.equal(questionButtonsTurnId([assistant("a1", "answer"), assistant("a2", "pending", true)]), null);
});

test("an empty thread has no buttons", () => {
  assert.equal(questionButtonsTurnId([]), null);
});

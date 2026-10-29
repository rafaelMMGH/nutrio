import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_MESSAGE } from "@/lib/assistant";
import { chatSchema } from "@/lib/validation/schemas";

// REQ-4: the request is { message }; scope and recipe_id from old clients are dropped (contract).
test("chatSchema strips scope and recipe_id", () => {
  assert.deepEqual(chatSchema.parse({ message: "¿Qué hay en mi carrito?", scope: "Receta", recipe_id: "rec-1" }), { message: "¿Qué hay en mi carrito?" });
  assert.deepEqual(chatSchema.parse({ message: "hola" }), { message: "hola" });
});

test("chatSchema trims the message and keeps the 1 to 500 limit on the trimmed text", () => {
  assert.deepEqual(chatSchema.parse({ message: `  ${"a".repeat(MAX_MESSAGE)}  ` }), { message: "a".repeat(MAX_MESSAGE) });
  for (const message of ["", "   ", "a".repeat(MAX_MESSAGE + 1), 42]) assert.throws(() => chatSchema.parse({ message }), JSON.stringify(message));
});

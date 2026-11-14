import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_MESSAGE } from "@/lib/assistant";
import { cartItemSchema, chatSchema } from "@/lib/validation/schemas";

// REQ-4: the request is { message }; scope and recipe_id from old clients are dropped (contract).
test("chatSchema strips scope and recipe_id", () => {
  assert.deepEqual(chatSchema.parse({ message: "¿Qué hay en mi carrito?", scope: "Receta", recipe_id: "rec-1" }), { message: "¿Qué hay en mi carrito?" });
  assert.deepEqual(chatSchema.parse({ message: "hola" }), { message: "hola" });
});

test("chatSchema trims the message and keeps the 1 to 500 limit on the trimmed text", () => {
  assert.deepEqual(chatSchema.parse({ message: `  ${"a".repeat(MAX_MESSAGE)}  ` }), { message: "a".repeat(MAX_MESSAGE) });
  for (const message of ["", "   ", "a".repeat(MAX_MESSAGE + 1), 42]) assert.throws(() => chatSchema.parse({ message }), JSON.stringify(message));
});

// Bug period-planner-days: a recipe cart item may not plan fewer than one day (0-day items counted as 1).
test("cartItemSchema rejects a recipe item planned for less than one day", () => {
  const recipe = (period_days: unknown) => ({ source_type: "recipe", source_id: "rec-1", period_days });
  for (const days of [0, 0.5, -1, null]) assert.throws(() => cartItemSchema.parse(recipe(days)), String(days));
  for (const days of [1, 3]) assert.equal(cartItemSchema.parse(recipe(days)).source_type, "recipe");
  assert.equal(cartItemSchema.parse({ source_type: "recipe", source_id: "rec-1" }).source_type, "recipe");
});

test("cartItemSchema still accepts the manual and shopping_list shapes", () => {
  assert.ok(cartItemSchema.parse({ source_type: "manual", name: "Sal", quantity: 1 }));
  assert.ok(cartItemSchema.parse({ source_type: "shopping_list", source_id: "list-1", period_days: 0 }));
});

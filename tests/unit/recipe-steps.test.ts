import assert from "node:assert/strict";
import { test } from "node:test";
import { recipeSteps } from "@/lib/recipe-steps";

// Spec assistant-data-scope REQ-12: the assistant and the recipe page split a plan's preparation note the same way.
test("the import notes carry no steps, whatever their case or accents", () => {
  for (const note of ["Extraído de plan.pdf", "EXTRAÍDO DE plan.pdf", "Extraido de plan.pdf", "", "   "]) {
    assert.deepEqual(recipeSteps(note), [], note);
  }
});

test("a note splits into one step per sentence, keeping accented and inverted starts", () => {
  assert.deepEqual(recipeSteps("¿Listo? Ásalo. Él sirve."), ["¿Listo?", "Ásalo.", "Él sirve."]);
  assert.deepEqual(recipeSteps("Sazonar el pollo. Asar 20 minutos."), ["Sazonar el pollo.", "Asar 20 minutos."]);
});

test("missing description gives no steps and one-letter fragments are dropped", () => {
  assert.deepEqual(recipeSteps(undefined), []);
  assert.deepEqual(recipeSteps("A. Mezclar todo."), ["Mezclar todo."]);
});

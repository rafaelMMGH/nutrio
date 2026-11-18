import assert from "node:assert/strict";
import { test } from "node:test";
import { WIZARD_STEPS, confirmChanges, goTo, nameMissing, next, prev, resetAfterChange, uploadCounts, type WizardState } from "@/components/app/upload-wizard/upload-wizard-logic";
import { WIZARD_PLAN } from "../shared/wizard-plan-fixture";

const data = WIZARD_PLAN.structured_data;
const state = (step: number, furthest: number, withData = true): WizardState => ({ step, furthest, data: withData ? WIZARD_PLAN : null });

test("REQ-1: four steps in order with their labels and descriptions", () => {
  assert.deepEqual(
    WIZARD_STEPS.map((s) => [s.id, s.label, s.description]),
    [
      ["subir", "Subir", "Tu PDF del plan"],
      ["datos", "Datos", "Nombre, objetivo y calorías"],
      ["comidas", "Comidas", "Opciones, ingredientes y complementos"],
      ["confirmar", "Confirmar", "Revisa y activa el plan"]
    ]
  );
});

test("REQ-3: next advances and raises furthest", () => {
  const after = next(state(0, 0));
  assert.equal(after.step, 1);
  assert.equal(after.furthest, 1);
});

test("REQ-3: next stops on the last step and without data", () => {
  assert.deepEqual(next(state(3, 3)), state(3, 3));
  assert.deepEqual(next(state(0, 0, false)), state(0, 0, false));
});

test("REQ-3: prev and a jump back keep furthest", () => {
  assert.deepEqual(prev(state(3, 3)), state(2, 3));
  assert.deepEqual(goTo(state(3, 3), 1), state(1, 3));
});

test("REQ-5: prev stops on Subir", () => {
  assert.deepEqual(prev(state(0, 2)), state(0, 2));
});

test("REQ-3: next after a jump back does not lower furthest", () => {
  assert.deepEqual(next(state(1, 3)), state(2, 3));
});

test("REQ-1/3: a locked target is refused", () => {
  assert.deepEqual(goTo(state(1, 1), 2), state(1, 1));
  assert.deepEqual(goTo(state(1, 1), 3), state(1, 1));
  assert.deepEqual(goTo(state(1, 1), 4), state(1, 1));
  assert.deepEqual(goTo(state(1, 1), -1), state(1, 1));
});

test("REQ-4: resetAfterChange returns to an empty Subir with everything locked", () => {
  assert.deepEqual(resetAfterChange(), { step: 0, furthest: 0, data: null });
});

test("REQ-4: uploadCounts of the shared fixture", () => {
  assert.deepEqual(uploadCounts(data), { meals: 4, options: 6, ingredients: 11, complements: 2 });
});

test("REQ-4: uploadCounts tolerates missing meals, options and add-ons", () => {
  assert.deepEqual(uploadCounts({ ...data, meals: [] }), { meals: 0, options: 0, ingredients: 0, complements: 0 });
  assert.deepEqual(uploadCounts({ ...data, meals: undefined }), { meals: 0, options: 0, ingredients: 0, complements: 0 });
});

test("REQ-5: nameMissing uses the edit when there is one, else the detected name, trimmed", () => {
  assert.equal(nameMissing(data, {}), false);
  assert.equal(nameMissing(data, { name: "   " }), true);
  assert.equal(nameMissing(data, { name: "" }), true);
  assert.equal(nameMissing({ ...data, name: "" }, {}), true);
  assert.equal(nameMissing({ ...data, name: "" }, { name: " Plan " }), false);
});

test("REQ-5: confirmChanges is the confirmed status plus trimmed, non-empty edits", () => {
  assert.deepEqual(confirmChanges({ name: "  Plan nuevo ", objective: " Ganar músculo " }), { processing_status: "confirmed", name: "Plan nuevo", objective: "Ganar músculo" });
  assert.deepEqual(confirmChanges({ name: "Plan", objective: "   " }), { processing_status: "confirmed", name: "Plan" });
  assert.deepEqual(confirmChanges({}), { processing_status: "confirmed" });
});

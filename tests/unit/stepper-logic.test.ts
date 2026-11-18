import assert from "node:assert/strict";
import { test } from "node:test";
import { announcement, compactCaption, stepView } from "@/components/ui/stepper-logic";

const view = (i: number, current: number, furthest: number, extra: { error?: boolean; disabled?: boolean } = {}) =>
  stepView(i, { current, furthest, error: false, disabled: false, ...extra });

test("REQ-3/6: a step before furthest is completada with a check", () => {
  assert.deepEqual(view(0, 1, 1), { status: "completed", marker: "check", srStatus: "completada", selectable: true });
});

test("REQ-6: a reached step that was not passed is disponible", () => {
  assert.deepEqual(view(2, 1, 2), { status: "available", marker: "number", srStatus: "disponible", selectable: true });
});

test("REQ-6: a step beyond furthest is sin iniciar and locked", () => {
  assert.deepEqual(view(3, 0, 0), { status: "pending", marker: "number", srStatus: "sin iniciar", selectable: false });
});

test("REQ-6: Confirmar reads disponible after reaching it and jumping back to Datos", () => {
  assert.equal(view(3, 1, 3).srStatus, "disponible");
  assert.equal(view(2, 1, 3).srStatus, "completada");
});

test("REQ-6: Confirmar reads sin iniciar when nothing beyond Subir was reached", () => {
  assert.equal(view(3, 0, 0).srStatus, "sin iniciar");
});

test("REQ-6: the current step has no srStatus and the current marker, even when passed earlier", () => {
  const datosAgain = view(1, 1, 3);
  assert.equal(datosAgain.srStatus, null);
  assert.equal(datosAgain.marker, "current");
  assert.equal(datosAgain.status, "current");
  assert.equal(view(0, 0, 0).srStatus, null);
});

test("REQ-6: error wins on a locked step", () => {
  assert.deepEqual(view(2, 0, 0, { error: true }), { status: "error", marker: "error", srStatus: "con error", selectable: false });
});

test("REQ-6: error wins on the current step and keeps its selectability", () => {
  assert.deepEqual(view(2, 2, 2, { error: true }), { status: "error", marker: "error", srStatus: "con error", selectable: true });
});

test("REQ-6: error wins over completada", () => {
  assert.equal(view(2, 3, 3, { error: true }).srStatus, "con error");
});

test("REQ-3: selectable up to furthest, never beyond", () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => view(i, 1, 2).selectable), [true, true, true, false]);
});

test("REQ-3: error never affects selectability", () => {
  assert.equal(view(2, 0, 2, { error: true }).selectable, true);
  assert.equal(view(2, 0, 1, { error: true }).selectable, false);
});

test("REQ-14: disabled makes every step unselectable", () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => view(i, 1, 3, { disabled: true }).selectable), [false, false, false, false]);
});

test("REQ-6: announcement reads Paso N de total: label", () => {
  assert.equal(announcement(2, 4, "Comidas"), "Paso 3 de 4: Comidas");
  assert.equal(announcement(0, 4, "Subir"), "Paso 1 de 4: Subir");
});

test("REQ-2: compact caption is the error text when present, otherwise the label", () => {
  assert.equal(compactCaption({ label: "Comidas", error: "2 opciones necesitan revisión" }), "2 opciones necesitan revisión");
  assert.equal(compactCaption({ label: "Datos" }), "Datos");
  assert.equal(compactCaption({ label: "Datos", error: "" }), "Datos");
});

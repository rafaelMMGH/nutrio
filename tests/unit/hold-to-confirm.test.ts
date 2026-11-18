import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyClick, clampProgress, distanceOutside, holdDescription, remainingMs } from "@/components/nutrio/hold-to-confirm-logic";

test("a hold resumes from where the fill is: the time left is proportional to what is missing", () => {
  assert.equal(remainingMs(0, 800), 800);
  assert.equal(remainingMs(0.25, 800), 600);
  assert.equal(remainingMs(0.5, 800), 400);
  assert.equal(remainingMs(1, 800), 0);
});

test("progress read from the page is clamped to 0..1 and garbage counts as empty", () => {
  assert.equal(clampProgress(-0.04), 0);
  assert.equal(clampProgress(1.2), 1);
  assert.equal(clampProgress(0.4), 0.4);
  assert.equal(clampProgress(Number.NaN), 0);
  assert.equal(remainingMs(-1, 800), 800);
  assert.equal(remainingMs(2, 800), 0);
});

test("the distance outside the button is zero inside it and measured to the nearest edge or corner outside", () => {
  const rect = { left: 100, top: 100, right: 200, bottom: 140 };
  assert.equal(distanceOutside(rect, 150, 120), 0);
  assert.equal(distanceOutside(rect, 100, 140), 0);
  assert.equal(distanceOutside(rect, 224, 120), 24);
  assert.equal(distanceOutside(rect, 150, 60), 40);
  assert.equal(distanceOutside(rect, 203, 144), 5);
  assert.equal(distanceOutside(rect, 96, 137), 4);
});

test("a click with a pointer or key press behind it is already handled; a bare click is how assistive technology activates", () => {
  assert.equal(classifyClick(true, false), "ignore");
  assert.equal(classifyClick(true, true), "ignore");
  assert.equal(classifyClick(false, false), "confirm");
  assert.equal(classifyClick(false, true), "undo");
});

test("the hidden hint states the hold length derived from the duration", () => {
  assert.equal(holdDescription(800), "Mantén presionado 0.8 segundos para confirmar. Con el teclado, mantén Espacio o Enter.");
  assert.equal(holdDescription(1000), "Mantén presionado 1 segundo para confirmar. Con el teclado, mantén Espacio o Enter.");
  assert.equal(holdDescription(1500), "Mantén presionado 1.5 segundos para confirmar. Con el teclado, mantén Espacio o Enter.");
});

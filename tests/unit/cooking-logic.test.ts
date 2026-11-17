import assert from "node:assert/strict";
import { test } from "node:test";
import { RESUME_MS, backIndex, mealToMark, nextIndex, readyLabel, resumeFrom, screensFor } from "@/components/cooking/cooking-logic";

test("REQ-6/10/15: ingredients come first, then one screen per step, then the end", () => {
  assert.deepEqual(screensFor(3, 2), ["before", "step-0", "step-1", "done"]);
});

test("REQ-9: a recipe with no ingredients skips Antes de empezar", () => {
  assert.deepEqual(screensFor(0, 2), ["step-0", "step-1", "done"]);
});

test("REQ-13: a recipe with no steps gets the Sin pasos screen before the end", () => {
  assert.deepEqual(screensFor(4, 0), ["before", "no-steps", "done"]);
  assert.deepEqual(screensFor(0, 0), ["no-steps", "done"]);
});

test("REQ-10: next stops at the end and back stops at the first screen (step 1 goes back to the ingredients)", () => {
  const screens = screensFor(2, 2);
  assert.equal(nextIndex(screens, 0), 1);
  assert.equal(nextIndex(screens, 3), 3);
  assert.equal(backIndex(1), 0);
  assert.equal(screens[backIndex(1)], "before");
  assert.equal(backIndex(0), 0);
});

test("REQ-6/8: the counter counts what is ready and says ¡Todo listo! when everything is", () => {
  assert.equal(readyLabel(0, 6), "0 de 6 listos");
  assert.equal(readyLabel(1, 6), "1 de 6 listo");
  assert.equal(readyLabel(3, 6), "3 de 6 listos");
  assert.equal(readyLabel(6, 6), "¡Todo listo!");
});

const meals = [
  { id: "m1", name: "Desayuno", recipeIds: ["r1"] },
  { id: "m2", name: "Colación", recipeIds: ["r2", "r9"] },
  { id: "m3", name: "Cena", recipeIds: ["r9"] }
];

test("REQ-16: the first of today's meals that uses the recipe and is not done is offered", () => {
  assert.deepEqual(mealToMark(meals, "r9", []), { state: "pending", meal: { id: "m2", name: "Colación" } });
  assert.deepEqual(mealToMark(meals, "r9", ["m2"]), { state: "pending", meal: { id: "m3", name: "Cena" } });
});

test("REQ-17: when every matching meal is done, the screen says so; a recipe outside today's meals gets nothing", () => {
  assert.deepEqual(mealToMark(meals, "r9", ["m2", "m3"]), { state: "done", meal: { id: "m2", name: "Colación" } });
  assert.deepEqual(mealToMark(meals, "r5", []), { state: "none" });
});

const now = Date.UTC(2026, 10, 17, 18, 0);
const saved = { screen: "step-1", checked: [0, 2], timers: [{ step: 1, totalMs: 600000, endsAt: now + 60000, leftMs: null }], ingredients: 3, steps: 2, savedAt: now - 1000 };

test("REQ-20: saved progress for the same recipe shape resumes", () => {
  assert.deepEqual(resumeFrom(saved, now, 3, 2), saved);
});

test("REQ-20: progress older than 12 hours is discarded", () => {
  assert.equal(resumeFrom({ ...saved, savedAt: now - RESUME_MS - 1 }, now, 3, 2), null);
  assert.ok(resumeFrom({ ...saved, savedAt: now - RESUME_MS + 1 }, now, 3, 2));
  assert.equal(RESUME_MS, 12 * 60 * 60 * 1000);
  assert.equal(resumeFrom({ ...saved, savedAt: now - 13 * 60 * 60 * 1000 }, now, 3, 2), null);
});

test("REQ-20: progress is discarded when the ingredient or step count changed", () => {
  assert.equal(resumeFrom(saved, now, 4, 2), null);
  assert.equal(resumeFrom(saved, now, 3, 1), null);
});

test("REQ-20: garbage or a screen that no longer exists is ignored, and out-of-range marks are dropped", () => {
  assert.equal(resumeFrom(null, now, 3, 2), null);
  assert.equal(resumeFrom("x", now, 3, 2), null);
  assert.equal(resumeFrom({ ...saved, screen: "step-7" }, now, 3, 2), null);
  assert.equal(resumeFrom({ ...saved, checked: "0" }, now, 3, 2), null);
  assert.deepEqual(resumeFrom({ ...saved, checked: [0, 5, -1, 1.5] }, now, 3, 2)?.checked, [0]);
  assert.deepEqual(resumeFrom({ ...saved, timers: [{ step: 9, totalMs: 1, endsAt: 1, leftMs: null }, "x"] }, now, 3, 2)?.timers, []);
});

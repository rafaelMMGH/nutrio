import assert from "node:assert/strict";
import { test } from "node:test";
import type { Meal } from "@/components/dashboard/food";
import { listScrollTop, rowLabel, timelineRows } from "@/components/nutrio/timeline-logic";

function meal(id: string, name: string, time_window = ""): Meal {
  return { id, name, display_order: 0, time_window, options_count: 1, recipe: null };
}

const four = [meal("a", "Desayuno", "07:00"), meal("b", "Colacion", "10:00"), meal("c", "Comida", "14:00"), meal("d", "Cena", "20:00")];

test("REQ-2: first unchecked meal in plan order is next, the rest pending", () => {
  const { rows } = timelineRows(four, ["a", "c"]);
  assert.deepEqual(rows.map((row) => row.state), ["done", "next", "done", "pending"]);
});

test("REQ-2: all done gives no next", () => {
  const { rows } = timelineRows(four, ["a", "b", "c", "d"]);
  assert.deepEqual(rows.map((row) => row.state), ["done", "done", "done", "done"]);
});

test("REQ-2: foreign and duplicate done ids are ignored", () => {
  const { rows } = timelineRows(four, ["zzz", "a", "a"]);
  assert.deepEqual(rows.map((row) => row.state), ["done", "next", "pending", "pending"]);
});

test("REQ-3: no times gives hasTimes false and null times", () => {
  const { rows, hasTimes } = timelineRows([meal("a", "Desayuno"), meal("b", "Cena")], []);
  assert.equal(hasTimes, false);
  assert.deepEqual(rows.map((row) => row.time), [null, null]);
});

test("REQ-3: one timed meal keeps plan order and null elsewhere", () => {
  const { rows, hasTimes } = timelineRows([meal("a", "Desayuno"), meal("b", "Comida", "14:00"), meal("c", "Cena")], []);
  assert.equal(hasTimes, true);
  assert.deepEqual(rows.map((row) => [row.id, row.time]), [["a", null], ["b", "14:00"], ["c", null]]);
});

test("REQ-3: never sorted by time", () => {
  const { rows } = timelineRows([meal("a", "Cena", "20:00"), meal("b", "Desayuno", "07:00")], []);
  assert.deepEqual(rows.map((row) => row.id), ["a", "b"]);
});

test("names go through mealLabel", () => {
  const { rows } = timelineRows([meal("a", "colacion")], []);
  assert.equal(rows[0].name, "Colación");
});

test("REQ-4: rowLabel with and without time", () => {
  assert.equal(rowLabel({ id: "a", time: "07:00", name: "Desayuno", state: "next" }), "07:00, Desayuno, Siguiente");
  assert.equal(rowLabel({ id: "d", time: null, name: "Cena", state: "done" }), "Cena, Cumplida");
  assert.equal(rowLabel({ id: "d", time: null, name: "Cena", state: "pending" }), "Cena, Pendiente");
});

test("REQ-4: a 60-character name is kept whole", () => {
  const name = "A".repeat(60);
  assert.equal(rowLabel({ id: "x", time: "08:00", name, state: "pending" }), `08:00, ${name}, Pendiente`);
});

const view = { scrollTop: 100, height: 200, scrollHeight: 1000, pad: 20 };

test("REQ-5: a row above the view scrolls to it plus the fade pad", () => {
  assert.equal(listScrollTop({ ...view, top: 60, bottom: 100 }), 40);
});

test("REQ-5: a row below the view scrolls by the fade pad", () => {
  assert.equal(listScrollTop({ ...view, top: 300, bottom: 340 }), 160);
});

test("REQ-19: a visible row keeps scrollTop", () => {
  assert.equal(listScrollTop({ ...view, top: 150, bottom: 190 }), 100);
});

test("REQ-5: the result is clamped to 0 and the maximum", () => {
  assert.equal(listScrollTop({ ...view, top: 5, bottom: 45 }), 0);
  assert.equal(listScrollTop({ ...view, top: 950, bottom: 1000 }), 800);
});

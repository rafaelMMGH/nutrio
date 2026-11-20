import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compliance } from "@/lib/compliance";

const slotIds = ["a", "b", "c", "d"];
const log = (date: string, meals_done: string[]) => ({ date, meals_done });

describe("compliance", () => {
  it("REQ-12: 4 meals created 12 nov, today 14 nov plan 12", () => {
    assert.equal(compliance({ logs: [], slotIds, start: "2026-11-12", today: "2026-11-14" }).planned, 12);
  });

  it("REQ-13: 4 + 3 + 2 done gives 9 / 2 / 1", () => {
    const logs = [log("2026-11-12", ["a", "b", "c", "d"]), log("2026-11-13", ["a", "b", "c"]), log("2026-11-14", ["a", "b"])];
    assert.deepEqual(compliance({ logs, slotIds, start: "2026-11-12", today: "2026-11-14" }), { planned: 12, done: 9, unmarked: 1, pending: 2 });
  });

  it("REQ-13: with 13 nov missing, Sin marcar is 4", () => {
    const logs = [log("2026-11-12", ["a", "b", "c", "d"]), log("2026-11-14", ["a", "b"])];
    assert.deepEqual(compliance({ logs, slotIds, start: "2026-11-12", today: "2026-11-14" }), { planned: 12, done: 6, unmarked: 4, pending: 2 });
  });

  it("REQ-17: day 1 with 1 done gives 4 / 1 / 0 / 3", () => {
    assert.deepEqual(compliance({ logs: [log("2026-11-14", ["a"])], slotIds, start: "2026-11-14", today: "2026-11-14" }), {
      planned: 4,
      done: 1,
      unmarked: 0,
      pending: 3
    });
  });

  it("REQ-12: a start after today counts as today", () => {
    assert.deepEqual(compliance({ logs: [], slotIds, start: "2026-11-20", today: "2026-11-14" }), { planned: 4, done: 0, unmarked: 0, pending: 4 });
  });

  it("REQ-13: foreign, duplicate, before-start and after-today ids are ignored", () => {
    const logs = [
      log("2026-11-13", ["a", "a", "zzz"]),
      log("2026-11-14", ["b", "b", "b"]),
      log("2026-11-11", ["a", "b", "c", "d"]),
      log("2026-11-15", ["a", "b", "c", "d"])
    ];
    assert.deepEqual(compliance({ logs, slotIds, start: "2026-11-12", today: "2026-11-14" }), { planned: 12, done: 2, unmarked: 7, pending: 3 });
  });

  it("REQ-14: 23:59 with 2 unchecked gives Pendientes 2, never Sin marcar", () => {
    const result = compliance({ logs: [log("2026-11-14", ["a", "b"])], slotIds, start: "2026-11-14", today: "2026-11-14" });
    assert.equal(result.pending, 2);
    assert.equal(result.unmarked, 0);
  });

  it("REQ-14: the invariant and no negative figure over a grid", () => {
    const ids = ["a", "b", "c", "d", "x"];
    const dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"];
    for (const slots of [[], ["a"], ["a", "b", "c"], slotIds]) {
      for (const start of ["2026-11-08", "2026-11-10", "2026-11-12", "2026-11-13"]) {
        for (const today of ["2026-11-10", "2026-11-12", "2026-11-13"]) {
          for (let seed = 0; seed < 20; seed++) {
            const logs = dates.map((date, i) => log(date, ids.filter((_, j) => (seed * 7 + i * 3 + j * 5) % 3 === 0).concat(i % 2 ? ["a"] : [])));
            const r = compliance({ logs, slotIds: slots, start, today });
            assert.equal(r.planned, r.done + r.unmarked + r.pending);
            for (const n of Object.values(r)) assert.ok(n >= 0);
          }
        }
      }
    }
  });

  it("REQ-10, REQ-15: no meals gives all zeros", () => {
    assert.deepEqual(compliance({ logs: [log("2026-11-14", ["a"])], slotIds: [], start: "2026-11-12", today: "2026-11-14" }), {
      planned: 0,
      done: 0,
      unmarked: 0,
      pending: 0
    });
  });

  it("REQ-11: the next day moves yesterday's unchecked meals to Sin marcar", () => {
    const logs = [log("2026-11-14", ["a", "b"])];
    const same = compliance({ logs, slotIds, start: "2026-11-14", today: "2026-11-14" });
    const next = compliance({ logs, slotIds, start: "2026-11-14", today: "2026-11-15" });
    assert.deepEqual(same, { planned: 4, done: 2, unmarked: 0, pending: 2 });
    assert.deepEqual(next, { planned: 8, done: 2, unmarked: 2, pending: 4 });
  });
});

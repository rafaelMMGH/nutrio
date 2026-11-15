import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countDoneToday, countSince, kpiContexts } from "@/lib/kpis";

describe("countDoneToday", () => {
  it("counts only done ids that belong to today's meals", () => {
    assert.equal(countDoneToday(["a", "b", "c"], ["b", "c", "gone"]), 2);
  });
  it("ignores repeated ids and handles no meals", () => {
    assert.equal(countDoneToday(["a"], ["a", "a"]), 1);
    assert.equal(countDoneToday([], ["a"]), 0);
  });
});

describe("countSince", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  it("counts dates inside the last 7 days, boundary included", () => {
    const dates = ["2026-11-15T11:00:00Z", "2026-11-08T12:00:00Z", "2026-11-08T11:59:59Z", "2026-10-01T00:00:00Z"];
    assert.equal(countSince(dates, now, 7), 2);
  });
  it("ignores unparseable dates", () => {
    assert.equal(countSince(["nope"], now, 7), 0);
  });
});

describe("kpiContexts", () => {
  const base = { planned: 5, planName: "Plan A", newRecipes: 3, groceries: { source: "list" as const, total: 12 } };
  it("describes a full day", () => {
    assert.deepEqual(kpiContexts(base), { meals: "de 5 hoy", plan: "Plan A", recipes: "+3 esta semana", groceries: "de 12 en lista" });
  });
  it("describes empty states", () => {
    assert.deepEqual(kpiContexts({ planned: 0, planName: null, newRecipes: 0, groceries: { source: "none", total: 0 } }), {
      meals: "sin plan hoy",
      plan: "sin plan activo",
      recipes: "sin nuevas",
      groceries: "sin lista"
    });
  });
  it("says cart when there is no list", () => {
    assert.equal(kpiContexts({ ...base, groceries: { source: "cart", total: 4 } }).groceries, "en el carrito");
  });
});

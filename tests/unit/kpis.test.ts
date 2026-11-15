import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countDoneToday, countSince, kpiContexts, planContext } from "@/lib/kpis";

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

describe("planContext", () => {
  const now = new Date("2026-11-15T18:00:00Z");
  it("says since which day the active plan exists", () => {
    assert.equal(planContext({ createdAt: "2026-11-12T16:00:00Z", plans: 3 }, now), "desde 12 nov");
    assert.equal(planContext({ createdAt: "2026-03-01T16:00:00Z", plans: 1 }, now), "desde 1 mar");
  });
  it("adds the year when the plan is from another year", () => {
    assert.equal(planContext({ createdAt: "2025-11-12T16:00:00Z", plans: 2 }, now), "desde nov 2025");
  });
  it("uses the Mexico City day, not UTC", () => {
    assert.equal(planContext({ createdAt: "2026-11-13T02:00:00Z", plans: 1 }, now), "desde 12 nov");
    assert.equal(planContext({ createdAt: "2026-01-01T03:00:00Z", plans: 1 }, now), "desde dic 2025");
  });
  it("judges the year by the Mexico City date of now too", () => {
    // 3:00 UTC on 1 Jan is still 31 Dec 2025 in Mexico City, so a December 2025 plan is from the same year.
    const earlyUtcNewYear = new Date("2026-01-01T03:00:00Z");
    assert.equal(planContext({ createdAt: "2025-12-20T16:00:00Z", plans: 1 }, earlyUtcNewYear), "desde 20 dic");
  });
  it("tells apart no active plan from no plans", () => {
    assert.equal(planContext({ createdAt: null, plans: 2 }, now), "sin plan activo");
    assert.equal(planContext({ createdAt: null, plans: 0 }, now), "sin planes");
  });
});

describe("kpiContexts", () => {
  const base = { planned: 5, plan: "desde 12 nov", newRecipes: 3, recipes: 20, pending: 12, groceries: { source: "list" as const, total: 12 } };
  it("describes a full day", () => {
    assert.deepEqual(kpiContexts(base), { meals: "de 5 hoy", plan: "desde 12 nov", recipes: "+3 esta semana", groceries: "de 12 en lista" });
  });
  it("describes empty states", () => {
    assert.deepEqual(kpiContexts({ planned: 0, plan: "sin planes", newRecipes: 0, recipes: 0, pending: 0, groceries: { source: "none", total: 0 } }), {
      meals: "Día libre",
      plan: "sin planes",
      recipes: "sin recetas",
      groceries: "sin pendientes"
    });
  });
  it("keeps the user's wording for recipes that are all old", () => {
    assert.equal(kpiContexts({ ...base, newRecipes: 0 }).recipes, "Ninguna esta semana");
  });
  it("says nothing pending when every item of the list is checked", () => {
    assert.equal(kpiContexts({ ...base, pending: 0 }).groceries, "sin pendientes");
  });
  it("says cart when there is no list", () => {
    assert.equal(kpiContexts({ ...base, groceries: { source: "cart", total: 4 }, pending: 4 }).groceries, "en el carrito");
  });
});

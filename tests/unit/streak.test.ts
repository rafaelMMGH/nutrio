import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { streaks } from "@/lib/streak";

const slotIds = ["a", "b", "c", "d"];
const all = slotIds;
// Days relative to today = 2026-11-18.
const today = "2026-11-18";
const log = (date: string, meals_done: string[]) => ({ date, meals_done });

describe("streaks (REQ-11 to REQ-13)", () => {
  it("counts complete past days and today when complete", () => {
    const logs = [log("2026-11-15", all), log("2026-11-16", all), log("2026-11-17", all), log(today, ["a", "b"])];
    assert.deepEqual(streaks({ logs, slotIds, today }), { current: 3, best: 3 });
    assert.deepEqual(streaks({ logs: [...logs.slice(0, 3), log(today, all)], slotIds, today }), { current: 4, best: 4 });
  });
  it("an incomplete today does not break; an incomplete yesterday does", () => {
    assert.deepEqual(streaks({ logs: [log("2026-11-17", ["a"]), log(today, ["a"])], slotIds, today }), { current: 0, best: 0 });
    assert.deepEqual(streaks({ logs: [log("2026-11-17", ["a"]), log(today, all)], slotIds, today }), { current: 1, best: 1 });
  });
  it("ignores done ids that are not in the schedule", () => {
    assert.deepEqual(streaks({ logs: [log("2026-11-17", ["a", "b", "c", "gone"])], slotIds, today }), { current: 0, best: 0 });
    assert.deepEqual(streaks({ logs: [log("2026-11-17", ["a", "b", "c", "d", "gone"])], slotIds, today }).current, 1);
  });
  it("judges past days against the current schedule when the plan grows", () => {
    assert.deepEqual(streaks({ logs: [log("2026-11-17", all)], slotIds: [...slotIds, "e"], today }), { current: 0, best: 0 });
  });
  it("starts at the earliest logged date", () => {
    const logs = [log("2026-11-16", all), log("2026-11-17", all)];
    assert.deepEqual(streaks({ logs, slotIds, today }), { current: 2, best: 2 });
  });
  it("a day without a log between logged days breaks the run", () => {
    const logs = [log("2026-11-10", all), log("2026-11-11", all), log("2026-11-12", all), log("2026-11-17", all)];
    assert.deepEqual(streaks({ logs, slotIds, today }), { current: 1, best: 3 });
  });
  it("best is a past run longer than the current one, and grows with current", () => {
    const past = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map((d) => log(d, all));
    const logs = [...past, log("2026-11-16", all), log("2026-11-17", all)];
    assert.deepEqual(streaks({ logs, slotIds, today }), { current: 2, best: 5 });
    const longer = [...past, ...["06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17"].map((d) => log(`2026-11-${d}`, all))];
    assert.deepEqual(streaks({ logs: longer, slotIds, today }), { current: 17, best: 17 });
  });
  it("unmarking today's last meal lowers the best (first-ever day, run ending yesterday)", () => {
    assert.deepEqual(streaks({ logs: [log(today, all)], slotIds, today }), { current: 1, best: 1 });
    assert.deepEqual(streaks({ logs: [log(today, ["a", "b", "c"])], slotIds, today }), { current: 0, best: 0 });
    const run = ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"].map((d) => log(d, all));
    assert.deepEqual(streaks({ logs: [...run, log(today, all)], slotIds, today }), { current: 6, best: 6 });
    assert.deepEqual(streaks({ logs: [...run, log(today, all.slice(1))], slotIds, today }), { current: 5, best: 5 });
  });
  it("no logs or an empty schedule gives 0/0", () => {
    assert.deepEqual(streaks({ logs: [], slotIds, today }), { current: 0, best: 0 });
    assert.deepEqual(streaks({ logs: [log("2026-11-17", all), log(today, all)], slotIds: [], today }), { current: 0, best: 0 });
  });
});

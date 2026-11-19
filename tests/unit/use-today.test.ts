import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextToday } from "@/components/nutrio/useToday";

describe("nextToday (REQ-28)", () => {
  it("returns the same key within the same local day", () => {
    assert.equal(nextToday("2026-11-18", new Date(2026, 10, 18, 23, 59, 59)), "2026-11-18");
  });
  it("returns the new key once local midnight has passed", () => {
    assert.equal(nextToday("2026-11-18", new Date(2026, 10, 19, 0, 0, 1)), "2026-11-19");
  });
});

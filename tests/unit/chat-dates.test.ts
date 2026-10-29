import assert from "node:assert/strict";
import { test } from "node:test";
import { serverToday } from "@/lib/domain/chat-dates";

// REQ-13: today is the server's date in America/Mexico_City, whatever the process time zone.
test("serverToday is the Mexico City date", () => {
  assert.equal(serverToday(new Date("2026-10-29T03:00:00Z")), "2026-10-28");
  assert.equal(serverToday(new Date("2026-10-29T05:59:59Z")), "2026-10-28");
  assert.equal(serverToday(new Date("2026-10-29T06:00:00Z")), "2026-10-29");
  assert.equal(serverToday(new Date("2026-10-29T18:30:00Z")), "2026-10-29");
});

test("serverToday crosses a year boundary like the calendar does", () => {
  assert.equal(serverToday(new Date("2027-01-01T05:59:00Z")), "2026-12-31");
  assert.equal(serverToday(new Date("2027-01-01T06:00:00Z")), "2027-01-01");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTime } from "@/components/dashboard/food";

// Regression for specs/bugs/meal-time-hydration.md: the label must not depend on the engine's CLDR data,
// otherwise the server ("8:30 a.m.") and a browser ("8:30 am") hydrate differently.
test("formatTime ignores the engine's locale data", () => {
  const dateFormat = Date.prototype.toLocaleTimeString;
  const intlFormat = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format")!;
  Date.prototype.toLocaleTimeString = () => "8:30 am";
  Object.defineProperty(Intl.DateTimeFormat.prototype, "format", { configurable: true, get: () => () => "8:30 am" });
  try {
    assert.equal(formatTime("08:30"), "8:30 a.m.");
    assert.equal(formatTime("14:30"), "2:30 p.m.");
  } finally {
    Date.prototype.toLocaleTimeString = dateFormat;
    Object.defineProperty(Intl.DateTimeFormat.prototype, "format", intlFormat);
  }
});

test("formatTime renders a 12-hour clock with a.m./p.m.", () => {
  const cases: Record<string, string> = {
    "00:00": "12:00 a.m.",
    "12:00": "12:00 p.m.",
    "08:30": "8:30 a.m.",
    "8:30": "8:30 a.m.",
    "14:30": "2:30 p.m.",
    "23:59": "11:59 p.m.",
    "07:05": "7:05 a.m.",
    "07:15": "7:15 a.m.",
    "08:30:15": "8:30 a.m."
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(formatTime(input), expected, input);
});

// Free text from the PDF ("Entre 7 a 8 am" is stored as a parsed window, but anything unparsable may remain).
test("formatTime keeps returning 'Invalid Date' for unparsable input", () => {
  for (const input of ["", "8", "Entre 7 a 8 am", "ab:cd"]) assert.equal(formatTime(input), "Invalid Date", input);
});

test("formatTime wraps out-of-range values around the clock like Date did", () => {
  assert.equal(formatTime("24:00"), "12:00 a.m.");
  assert.equal(formatTime("25:00"), "1:00 a.m.");
  assert.equal(formatTime("08:75"), "9:15 a.m.");
});

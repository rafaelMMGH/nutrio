# Bug: meal time hydration mismatch on the dashboard

**Status:** fixed · **Branch:** fix/meal-time-hydration

## Symptom

React logs a hydration error on the dashboard: the `<time>` in DayCard renders "8:30 a.m." from the server and "8:30 am" in the user's browser.

## Reproduction

1. Run the app on Node 20 (ICU 77.1) and open the dashboard in a browser whose es-MX CLDR data abbreviates the meridiem as "am".
2. Open the console.

Expected: no hydration warning · Actual: text mismatch on every meal time.

## Root cause

`formatTime` in `src/components/dashboard/food.ts` (was lines 132-135) called `toLocaleTimeString("es-MX", ...)`. Same locale, different engine data: Node gives "8:30 a.m." (plain space), some browsers "8:30 am". Used by `DashboardView.tsx:439-441` and `src/components/app/AppShell.tsx:266`.

Why e2e did not catch it: a single Desktop Chrome project runs on the same machine as the server, so both sides use the same ICU.

## Fix

`formatTime` now parses hour and minute and builds the 12-hour label by hand ("8:30 a.m.", "2:30 p.m."), with no `Intl`. Same signature and output as before; unparsable input still returns "Invalid Date" and out-of-range values wrap around the clock as `Date` did.

## Regression test

`tests/unit/food-time.test.ts`: "formatTime ignores the engine's locale data" stubs the engine formatters to return "8:30 am" and asserts the fixed output (failed before the fix), plus a table of 12-hour edge cases and invalid input.

## Known follow-up (same class, out of scope)

Other locale-dependent date/time labels can mismatch the same way (text or attributes, ICU-dependent; the ones using `new Date()` in render can also differ by timezone):
- `src/components/dashboard/DashboardView.tsx:137, 348, 383, 669` (`toLocaleDateString("es-MX")`); the `today` value at `:123` (`dateKey(new Date())`) uses the runtime timezone, server versus browser, near midnight.
- `src/components/groceries/CartView.tsx:64` (`new Date().toLocaleDateString`, also server date versus client date).
- `src/components/groceries/TemplatesView.tsx:61` and `src/components/groceries/SaveTemplateDialog.tsx:39` (the default name, a `defaultValue`, lower risk).
- `src/components/trash/TrashView.tsx:27` (`toLocaleString("es-MX")`, ICU and timezone).
- Number formatting, lower risk: `DashboardView.tsx:525` and `:735`, `src/components/dashboard/food.ts` (`qty`).
A shared, timezone-pinned, table-based formatter (like `src/lib/domain/chat-dates.ts`) would fix them in one place.

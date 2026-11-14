# Bug: assistant header title runs under the "Nueva conversación" pill on desktop

**Status:** fixed · **Branch:** feature/assistant-data-scope (user decision: no new branch) · **ID:** BUG-B9

## Symptom

Above 640 px (641-1440 checked), once the thread is non-empty the pill "Nueva conversación" appears and the h2 "Asistente" (93 px) spills about 20 px under it. The subtitle ellipsizes to almost nothing.

## Reproduction

1. Viewport 1280x800 (or 641x800), open the assistant, ask any question.
2. Look at the header.

Expected: the title ends clear of the pill. Actual: the title text overlaps the pill's left edge.

## Root cause

`src/components/shared/assistant-chat.css`: the panel is 400 px wide; header padding 20 + 20, gaps 12 + 12, the 42 px icon and the pill with its 125 px label leave the heading column 73 px. The h2 has no overflow rule, so its 93 px text overflows the column. The 640 px sheet rules already avoid this below that width.

## Why e2e missed it

The header tests covered only the 360 px sheet (icon-only pill) and 1024x420 (subtitle hidden); none measured the title against the pill on a normal desktop window.

## Fix

CSS only, base rules: header gap 12 -> 8 px and padding 20/20/14 -> 16/16/12; pill gap 6 -> 4 px and padding 7/12 -> 7/10. The <=640 px overrides are untouched. Guard (user-approved after review LOW-1): `.assistant-chat h2` also gets `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, so a wider fallback font truncates the title instead of spilling under the pill.

## Regression test

`tests/e2e/assistant-a11y.spec.ts`, "REQ-15: the narrow header" > "at 1280x800" / "at 641x800": the h2 `scrollWidth <= clientWidth` and its text ends at least 4 px before the pill. Red before the fix, green after.

With the guard, `scrollWidth <= clientWidth` still detects truncation (scrollWidth reports the full text width even when clipped), so the tests stay real. Verified: "Asistente" is not clipped at 641 px or 1440 px with the loaded font; shown red with a throwaway `max-width: 60px` on the h2 (not kept).

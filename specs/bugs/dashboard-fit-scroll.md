# Bug: the dashboard shows a page scrollbar when everything fits

**Status:** fixed · **Branch:** alt-dashboard (the redesign lives only here; no `fix/` branch, user's decision)

## Symptom

On wide, short windows the dashboard shows a vertical page scrollbar although every card is visible. Reported at about 1957×914, 1954×792 and 1952×752. Related, from commit `05e2f46`: horizontal page scroll at 1280px wide and below, and the yellow calories card clipped by 17px at 1440×900 and 1440×780.

## Reproduction

1. Open the dashboard in a window about 1920px wide and 800px tall.

Expected: no page scrollbar. · Actual: the page scrolls by roughly 110px.

## Root cause

From the investigator report (static analysis; not yet measured in a browser).

1. **Vertical scroll.** The decorative hero plate (`src/components/nutrio/dashboard.css` `.nt-plate` ~54-61, `.nt-plate-dish` ~70-74) is absolutely positioned, 128% of the hero width and rotated -30deg. Above 1279px nothing clips it (`.nt-hero { overflow: hidden }` exists only at max-width 1279), so its faded lower edge extends the document. Its bottom is about `84 + H/2 + 0.664·W` (H = dashboard height, W = hero width): the overflow grows with width and shrinks with height. At 1957 wide it scrolls below about 1019px tall. The same geometry exists at `caa6e7e`.
2. **Below 768px tall** the 660px minimum height of `.nt-dash` adds scroll by design (16px at 752). Kept for now (user's decision).
3. **Horizontal scroll at ≤1280.** `05e2f46` gave `.nt-cta` `margin-inline: 84px` (`shell.css` ~83), adding 168px of fixed width to the top bar.
4. **Calories card clipping.** `05e2f46` raised `.nt-data` top padding from 8px to 25px, taking 17px from the card row (`.nt-cal`: needs 290, gets 273).

## Fix

Decided with the user: clip the plate so it cannot add scroll height (a hard bottom edge on the plate at short heights is accepted); shrink the CTA margins on narrower windows; recover the 17px where the height is tight while keeping the 25px look when there is room.

- **Plate.** `Hero.tsx` wraps `.nt-plate` in `.nt-plate-clip` (same box as the hero), which gets `overflow-y: clip` at 1280px and up. A first attempt, `overflow-y: clip` plus `overflow-clip-margin: 16px` on `.nt-dash`, cut the prep card's shadow: Chromium ignores the clip margin when only one axis is clipped.
- **CTA.** `.nt-cta` `margin-inline: clamp(12px, 12px + (100vw - 1280px) * 0.45, 84px)`: 84px from 1440px wide, 12px at 1280px. The slack at 1280px relies on the "Notas" button staying removed.
- **Padding.** `.nt-data` `padding-top: clamp(8px, 100dvh - 892px, 25px)` at 1280px and up: 25px from about 917px tall, 8px at 900px and below. 892 is tuned to the 1440×900 case.

Known gap, not fixed: between 860px and 899px tall the calories card is still clipped (up to about 40px at 860). It predates `05e2f46`: the compact layout ends at 859px and the roomy one fits from about 900px. No test covers it.

## Regression test

`tests/e2e/dashboard.spec.ts`, the "fits" tests, with a wide, short size (1920×800) added. Before the fix it failed with 121px of vertical page scroll; after, all five sizes pass. The user allowed this one e2e change; no other e2e work. Nothing guards the prep card's shadow; it was checked by reading pixels in `dashboard-1440x780.png`.

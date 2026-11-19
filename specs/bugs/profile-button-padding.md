# Bug: profile button ring sticks out of the avatar below 1280px

**Status:** fixed · **Branch:** feature/cooking-mode

## Symptom

In the top bar, below 1280px the profile button's outer ring extends to the right of the "R" avatar circle.

## Reproduction

1. Open the dashboard at a viewport width under 1280px (for example 1024px or 390px).
2. Look at the profile button in the top bar.

Expected: the ring hugs the 44px avatar · Actual: the button is 54px wide around a 44px avatar.

## Root cause

`src/components/nutrio/shell.css:100` sets `.nt-profile-btn { padding: 0 10px 0 0; box-shadow: 0 0 0 1px var(--nt-glass-line) }`. The right padding is for the name and chevron. The `@media (max-width: 1279px)` block hides `.nt-profile-text` and `.nt-profile-btn > svg` but kept the padding (introduced in c006995).

## Fix

Add `.nt-profile-btn { padding: 0; }` to the `@media (max-width: 1279px)` block. Desktop (>=1280px) is unchanged.

## Regression test

Deferred because of the e2e freeze. Suggested: at 1024px and 390px, the bounding box width of `.nt-profile-btn` equals that of `.nt-avatar` (44px).

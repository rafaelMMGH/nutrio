# Bug: Escape on a popup also closes the assistant panel

**Status:** fixed · **Branch:** fix/escape-popups

## Symptom

With the assistant panel open, pressing Escape while the account menu, the dashboard weight or activity popover, or the ingredient suggestions (cart) is open closes the popup and the panel at once.

## Reproduction

1. Open the assistant panel, then the account menu (chip "Cuenta de <name>").
2. Press Escape.

Expected: only the menu closes; a second Escape closes the panel and focuses the FAB. · Actual: both close.

## Root cause

The panel listens for `keydown` on `window` and skips only `event.defaultPrevented` (`src/components/shared/AssistantChat.tsx:52-63`, the pattern from assistant-chat-polish). The popups close on Escape without `preventDefault()`: `src/components/useDismiss.ts:13` (UserMenu, WeightPopover, activity popover) and `src/components/groceries/ManualAddForm.tsx:65-66` (suggestion list). base-ui dialogs already prevent default.

## Fix

`useDismiss` and the `ManualAddForm` Escape branch call `event.preventDefault()` before closing. The suggestion list keeps its `showList` guard, so Escape without a list still reaches the panel. No `stopPropagation`.

## Regression test

`tests/e2e/assistant-a11y.spec.ts`, "REQ-22: desktop is non-modal": the three "Escape closes the ... first" tests (account menu, weight popover, ingredient suggestions). They check `aria-expanded` on the FAB, since the panel stays "visible" during its close transition. Fail before the fix, pass after. The activity popover shares `useDismiss` and is not tested separately.

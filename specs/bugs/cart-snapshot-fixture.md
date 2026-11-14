# Bug: the cart visual snapshot depends on the cloned real data and today's date

**Status:** fixed · **Branch:** feature/assistant-data-scope (same PR)

## Symptom

`tests/e2e/a-theme-visual.spec.ts` "signed in, light > cart looks as it did" fails whenever the real cart changes or the day changes.

## Reproduction

1. Capture the baseline, then add or remove an item in the real cart (or wait one day), and re-run the test.

Expected: the cart snapshot is stable. Actual: image diff above the 1% threshold.

## Root cause

The test screenshots the cart of the cloned real database, so the item count and names vary. `src/components/groceries/CartView.tsx:64` also renders today's date, and `.groceries-nav em` shows counts that depend on real recipes and templates. `dynamicMasks` covers none of them.

## Fix

Test-side only (nothing under `src/`). For the cart case, the spec soft-deletes the first active cart's live items in the e2e clone, inserts fixed manual items (`e2e-cart-item-NN`), and restores after the body, even if it failed (delete the fixed items, undelete the captured ids), checking that the restored count matches the captured count. The cart's title block (`.order-head > div`, title plus date) is masked, not only the date `<p>`, because the date text sets the box width. `.groceries-nav em` is in `dynamicMasks`, so the groceries, cart and templates shots all mask it. If the restore fails while the test body also failed, the thrown error carries both messages (the original is the `cause`); a count mismatch still fails a passing body.

## Regression test

`tests/e2e/a-theme-visual.spec.ts`, "signed in, light > cart looks as it did". The local baseline must be regenerated once after this change (it is gitignored).

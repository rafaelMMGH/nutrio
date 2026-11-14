# Bug: the period planner overcounts days

**Status:** fixed · **Branch:** fix/period-planner-days

Source: `specs/bugs/shopping-list-findings.md` #1.

## Symptom

"Planificar periodo" (Despensa) with 7 days and 2 recipes adds 4 + 4 = 8 planned days to the Carrito, and the ingredient quantities are scaled for 8 days.

## Reproduction

1. Open `/groceries`, pick "7 días", select two recipes, press "Agregar 2 recetas al carrito".
2. Open the Carrito. Expected: the two recipes cover 4 and 3 days (7 planned days). Actual: 4 and 4 (8).

## Root cause

`src/components/groceries/GroceriesView.tsx:104` posts `Math.ceil(days / selected.length)` as `period_days` for every recipe, so the shares add up to more than the period (7×3 gives 3+3+3). The stats (`queries.ts:71`, `CartView.tsx:22`) just sum the stored `period_days` and are correct. A 0-day item would count as 1 (`cart.ts:5,89`).

## Decisions (2026-11-14)

- Exact split: `base = floor(days / n)`; the first `days % n` recipes, in click order, get `base + 1` (7×2 -> 4,3; 7×3 -> 3,2,2; 14×3 -> 5,5,4).
- Fewer days than selected recipes: blocked in the UI (disabled submit plus the hint "Elige máximo tantas recetas como días del periodo."), never 0-day items.
- The days input only accepts whole numbers >= 1; otherwise submit is blocked with a hint.
- Server: the recipe cart-item schema requires `period_days >= 1` when sent (`addRecipe` and the other callers send none). The manual and shopping_list schemas and the DB schema are unchanged.

## Fix

Pure helper `splitDays(days, n)` in the import-free `src/lib/domain/period.ts` (not `cart.ts`, which pulls Node modules into the client bundle), used by the planner; the guards and hints in `GroceriesView.tsx`; `min(1)` in `schemas.ts`. The helper has a single caller; it exists so the split has a fail-first unit test (Constitution 1).

Carts that already hold items stored as 4 + 4 are not migrated: remove and re-add them.

## Regression test

- `tests/unit/period-split.test.ts` (missing module before the fix; passes after).
- `tests/unit/schemas.test.ts`: `cartItemSchema` rejects a recipe item with `period_days` 0, 0.5, -1 or null and accepts 1, 3 or none; the manual and shopping_list shapes still parse (failed with "Missing expected exception: 0" when `min(1)` was reverted).
- `tests/e2e/dashboard.spec.ts` "planner": 7 days over two recipes stores 4 and 3 (failed with `[4, 4]` before); more recipes than days disables the submit and shows the hint.

# Bug: generic recipe names ignore the plan's own slot names (B8)

**Status:** fixed on feature/assistant-data-scope (the code exists only on this branch); full e2e 399/399 at 2f86a4b (2026-11-14); pending merge · **Branch:** feature/assistant-data-scope

Source: read-only drift check of spec v1.7 against the code, with probes (2026-11-13). Spec: REQ-3 and the Terms definition of a generic name ("<slot name> opción n"); the plan's own slot names count as slot words (recorded in spec v1.8).

## Symptom

A recipe named "<slot name> opción n" is treated as generic only when the slot name is a vocabulary slot word. With a custom plan slot "Postre", the recipe "Postre opcion 1" is not generic: it is a dish candidate and can open as a dish.

## Reproduction

1. Use a plan with a custom slot "Postre" and a recipe named "Postre opcion 1".
2. Ask the assistant for that recipe by name.

Expected: not-found, no recipe detail, no button (the name is generic). · Actual: the recipe is a candidate and can open as a dish.

## Root cause

`isGeneric` in `src/lib/domain/chat-dish.ts` (~34-37) checked only the `SLOT_WORDS` vocabulary, not the active plan's slot names.

## Fix

Commit e24a633. `isGeneric(name, slotNames = [])` also accepts the plan's own slot names (normalized, multi-word) before "opcion" and a number. `matchDish`, `rankDish` and `rank` take optional `slotNames`; `namedRecipes` in `chat.ts` passes `planSlots(...)?.slots.map(name) ?? []`. e24a633 also threaded the names through `optionLabel` and `recipeDetail` in `chat-meals.ts`; 2f86a4b (T086, decision B) removed those two call sites again.

## Regression test

- `tests/unit/chat-dish.test.ts`, 5 asserts: "Colación 11 opcion 2" with ["Colación 11"] → true; "POSTRE   OPCIÓN 3" with ["postre"] → true; "Pre entreno opcion 1" with ["Pre-entreno"] → true; "Postre opcion 1" with [""] → false; "Opción 1" with ["Opción"] → false.
- `tests/unit/chat-edges.test.ts`, 1 row: a `ragAnswer` over a plan with a "Postre" slot → not-found with no detail and no button.
- Mutants killed: `isGeneric` ignoring slot names; `namedRecipes` not passing them.

## Verification

Unit 819/819 at the fix; 823/823 after T085-T087 (2026-11-14). No dedicated e2e row; the full e2e suite ran as the regression run (T088): 399/399 at 2f86a4b, 2026-11-14.

## Open

- None for this bug. MEDIUM-2 (reviewer: the threading into `optionLabel` and `recipeDetail` was untested) is **closed by T086** (2f86a4b, 2026-11-14): both call sites are back to `isGeneric(recipe.name)`. They were unreachable through any question (a custom slot cannot be asked about: "¿Qué hay de postre?" gives no-match); they differed only for data where a non-vocabulary-slot-named generic recipe sits in a vocabulary slot (decision B, user 2026-11-14: drop). The B8 fix itself stays through `namedRecipes`/`matchDish`/`rankDish`. tsc clean, unit 823/823, reviewer PASS.

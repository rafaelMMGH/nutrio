# Bug: generic recipe names ignore the plan's own slot names (B8)

**Status:** fixed on feature/assistant-data-scope (the code exists only on this branch); pending the full e2e run and merge · **Branch:** feature/assistant-data-scope

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

Commit e24a633. `isGeneric(name, slotNames = [])` also accepts the plan's own slot names (normalized, multi-word) before "opcion" and a number. `matchDish`, `rankDish` and `rank` take optional `slotNames`; `namedRecipes` in `chat.ts` passes `planSlots(...)?.slots.map(name) ?? []`. Also threaded through `optionLabel` and `recipeDetail` in `chat-meals.ts`.

## Regression test

- `tests/unit/chat-dish.test.ts`, 2 rows: "Colación 11 opcion 2" with ["Colación 11"] → true; "POSTRE   OPCIÓN 3" with ["postre"] → true; "Pre entreno opcion 1" with ["Pre-entreno"] → true; "Postre opcion 1" with [""] → false; "Opción 1" with ["Opción"] → false.
- `tests/unit/chat-edges.test.ts`, 1 row: a `ragAnswer` over a plan with a "Postre" slot → not-found with no detail and no button.
- Mutants killed: `isGeneric` ignoring slot names; `namedRecipes` not passing them.

## Verification

Unit 819/819 on the branch. Not covered by e2e; the full e2e suite has not run since the bug-fix series.

## Open

- MEDIUM-2 (reviewer): the threading into `optionLabel` and `recipeDetail` is untested and unreachable (a custom slot cannot be asked about, since only vocabulary slot words are recognized: "¿Qué hay de postre?" gives no-match). Reverting either call site leaves unit 819/819. Decide: drop the two call sites or accept them.

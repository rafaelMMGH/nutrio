# Bug: identity words leak into the dish phrase (B4)

**Status:** fixed on feature/assistant-data-scope (the code exists only on this branch); pending the full e2e run and merge · **Branch:** feature/assistant-data-scope

Source: read-only drift check of spec v1.7 against the code, with probes (2026-11-13). Spec: REQ-6 (step order: identity is step 3, the dish step is step 4). Recorded in spec v1.9 (REQ-6 rule, Known limitation, Decisions 2026-11-14).

## Symptom

A question that mixes a dish cue with an identity question gets a did-you-mean about a dish made of the whole tail of the sentence, instead of the identity answer.

## Reproduction

1. Ask the assistant "¿Qué lleva el pollo asado y cómo me llamo?".

Expected: "Te llamas Ana." · Actual: "No encontré exactamente 'pollo asado y cómo me llamo'" (did-you-mean).

## Root cause

`resolve` in `src/lib/domain/chat-intent.ts` (~113-121) ran the dish step (4) and returned before identity (3), which was handled only as an item (~128). The identity words stayed in the dish phrase.

## Fix

Commit c56b7aa. When a hit has topic "identity", step 4 is skipped (`identified` guard, 3 lines): the identity is answered and the dish part is dropped silently.

User decision 2026-11-14 ("Continua con la opción (a) de B4"): reading (a) as above. Rejected: (b) consume the identity words and answer the dish, dropping the identity; (c) identity plus the dish as two blocks (contradicts "a dish is never a block of a 2-block answer").

Probes after the fix:
- "cómo me llamo y qué lleva la pizza" → identity only.
- "¿cómo se llama mi plan y qué lleva el pollo asado?" → the plan name only.
- "¿Qué lleva el pollo asado y mi nombre y mi peso?" → identity + weight blocks, no dish.
- "¿Cómo me llamo y cómo se llama mi plan y qué lleva el pollo asado?" → both identity blocks, no dish.
- "¿Qué lleva el pollo asado de mi plan?" and "¿Qué lleva el pollo asado y cuánta agua llevo?" → unchanged (did-you-mean).

## Regression test

- `tests/unit/chat-intent.test.ts`: 4 asserts (the probe; "la pizza" plus the plan name; identity first; an unchanged no-identity case).
- `tests/unit/chat-edges.test.ts`: 1 `ragAnswer` row.
- Both rows red before the fix; reverting the `identified` guard fails exactly 2 tests (reviewer-verified).

## Verification

Unit only; not covered by e2e. Unit suite 819/819 on the branch. The full e2e suite has not run since the bug-fix series.

## Open

None for this bug beyond the full e2e run and merge.

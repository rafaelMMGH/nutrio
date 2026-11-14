# Bug: assistant options are never announced and render outside the bubble (B1)

**Status:** fixed on feature/assistant-data-scope (the code exists only on this branch); verified (full e2e 399/399, 360 px check passed), pending merge · **Branch:** feature/assistant-data-scope

Source: read-only drift check of spec v1.7 against the code, with probes (2026-11-13). Spec: REQ-33 (option announcement), T056 DOM contract; REQ-34 (360 px) and REQ-35 (focus order) affected by the placement. Recorded in spec v1.8.

## Symptom

- A screen reader never hears "N opciones: A; B; C" ("1 opción" in the singular, labels joined with "; ") for a real options answer.
- The real option buttons render in the `.assistant-chips` row after the bubble instead of inside the bubble's `.assistant-actions`, against the T056 DOM contract.

## Reproduction

1. Ask the assistant "¿Qué puedo cenar?" with a plan that has dinner options.
2. Inspect the reply: the API gives `blockButtons [[]]`; the labels are only in `answer.buttons`.

Expected: the live region announces "N opciones: …" once, and the option buttons sit in `.assistant-bubble > .assistant-actions`. · Actual: no announcement; options in the chips row outside the bubble.

## Root cause

The server puts option buttons at the answer level (`answer.buttons`, layout "option", `src/lib/domain/chat.ts` ~248-266); block buttons hold only links. `AssistantTurn.tsx` built the sr-only announcement from `block.buttons`, which is always empty for a real answer.

Why it was not caught: the e2e fixture `optionsAnswer()` (`tests/e2e/assistant-helpers.ts`) put the options in `blocks[0].buttons`, a shape the server never sends, so the row "an options answer is announced once…" (`tests/e2e/assistant-a11y.spec.ts` ~367-407) passed on a mock. No unit test took a real answer through the selection logic.

## Fix

Commit 3316cd6 (61fea0c is a separate `ReplyKind` cleanup). Pure functions `optionButtons(answer)` and `optionAnnouncement(answer, blockIndex)` in `src/lib/assistant.ts`. `BlockContent` takes the announcement as a prop (sr-only span in the live region, rendered with the lead, so announced once). Option buttons render in `.assistant-bubble > .assistant-actions` after the live region and before block links; the answer-level chips row keeps non-option buttons (paging chips "Ver más opciones" / "Opciones anteriores" stay outside the bubble).

2-block heuristic: the announcement goes to the block whose title the first option's message starts with ("Cena, opción 2" → block "Cena"; the comma stops "Colación" matching "Colación 11"), else block 0. Exact for everything the server produces today (the only producer of layout "option" is `slotOptions`, `chat-meals.ts` ~225-232, title = `slot.ref`). A marker field in the contract would be more robust; it needs the user's yes and was not done.

## Regression test

- `tests/unit/assistant-options.test.ts`, 4 rows over a real `ragAnswer`: "¿Qué puedo cenar?", singular "1 opción", no options, both block orders of a 2-block answer. Failed before the functions existed.
- `optionsAnswer()` now has the real shape; the e2e row went red at `assistant-a11y.spec.ts:393` with the new fixture and the old component.
- REQ-34 (360 px) and REQ-35 (focus order) rows went red after a first fix that left options outside the bubble, green after moving them in.
- Mutants killed: labels taken from block buttons; block-index check removed.

## Verification

Ran: 8 e2e files in one run (answers, a11y, next-step, composer, errors, meals, look, noscope): 158 passed; unit 819/819; reviewer verdict PASS (conditional). Later (2026-11-14): full e2e 399/399 at 2f86a4b (T088, includes the six API-only specs); unit 823/823; 360 px visual check passed (T089).

## Open

Nothing open; pending merge.

- MEDIUM-3: closed by T085 (unit rows for the 2-block heuristic: duplicated-slot ref, a first block not in the plan, the block-0 fallback).
- LOW-1: closed by c78af89 (stale `Block` comment refreshed).
- LOW-2: closed by the comment commit 6ccfcb4 (T091): the `first.type === "question"` narrowing is kept, since options are `Button[]` and only the `question` variant has `message` (TS2339 without it).
- LOW-3: closed by T089 (360 px visual check passed).

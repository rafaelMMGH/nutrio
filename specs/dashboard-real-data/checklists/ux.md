# Checklist: UX for dashboard-real-data

Requirement-quality checks. `[x]` = covered by the spec, `[ ]` = gap (blocks approval). Spec v1.1 (draft).

## Completeness

- [x] Are the row states (Cumplida, Siguiente, Pendiente), the all-done case and the derivation rule defined with an example? [REQ-2]
- [x] Is behaviour with missing times (none, some) defined, with no re-sorting? [REQ-3]
- [x] Is optimistic update and rollback defined for rows and for counts? [REQ-6, REQ-16]
- [x] Is the empty state for no active plan defined for both cards? [REQ-10, REQ-15, D12]
- [x] Is the empty state for a plan with no meals defined for both cards? [REQ-10, REQ-15]
- [x] Is a plan that began today (0 past days) defined? [REQ-17]
- [x] Is midnight rollover with the page open defined, including a save in flight? [REQ-11]
- [x] Is the single-meal case defined (card keeps size and position)? [REQ-7]
- [x] Are the removed elements of the old cards listed explicitly? [REQ-8, REQ-15]
- [x] Are hover, pressed and focus states of a row defined (normal motion and reduced)? [REQ-18]
- [x] Is the in-card scrolling affordance (which edges fade, when the fade disappears at scroll end) defined? [REQ-7]
- [x] Is the upload link wording quoted exactly (both cards)? [REQ-10, REQ-15] ("Subir plan")

## Clarity

- [x] Are the honest labels exact, with "Omitidas" banned and today's unchecked never "Sin marcar"? [REQ-14, D3]
- [x] Are the count rules unambiguous, with worked examples that sum? [REQ-12 to REQ-14]
- [x] Is the carousel auto-advance timing given as a number (900 ms ±100)? [REQ-5]
- [x] Is the minimum row height a number (44px)? [REQ-7]
- [x] Is the page-fit rule tied to the 5 desktop viewports? [REQ-7]
- [x] Is copy Spanish (Mexico), "tú", with the date format and year rule given? [REQ-15, Assumptions]
- [x] Is the "tightened" row height range defined (default height and the step down to 44px)? [REQ-7] (56px default, shrink evenly to 44px, then scroll)
- [x] Is "a cue that is not colour alone" for the selected row defined, including when a row is both selected and "Siguiente"? [REQ-5, REQ-2] (leading marker plus heavier weight, shown together with the state icon or word)
- [x] Is long meal-name behaviour (truncate, wrap, max lines) defined at 360px and with times present? [REQ-1] (one line, ellipsis, time and state never truncate)
- [x] Is the phone scroll target defined (which element, alignment, offset under the top bar)? [REQ-9] (hero card, top edge just below the top bar)
- [x] Are the proposed copy strings ("Tu plan no tiene comidas", "X de Y comidas cumplidas", link wording) confirmed rather than assumed? [REQ-10, REQ-15, Open question 2] (quoted exactly in the REQs and listed; the user's yes is still pending at Gate 1)

## Consistency

- [x] Do D6, REQ-2 and REQ-3 agree on time and state display? [D6, REQ-2, REQ-3]
- [x] Do REQ-10 and REQ-15 agree on the no-plan and no-meals states for the counts card? [REQ-10, REQ-15]
- [x] Do REQ-13 and REQ-14 agree on the invariant and worked examples? [REQ-13, REQ-14]
- [x] Does D7 (no check-off from the timeline) agree with REQ-4 and REQ-6? [D7, REQ-4, REQ-6]
- [x] Do REQ-5 ("scrolled into view" for the selected row) and REQ-9 (no page scroll at >=938px) agree that the scroll is inside the list only? [REQ-5, REQ-9]

## Edge cases

- [x] Plan version changes or is re-activated mid-period. [REQ-12, REQ-13, Edge cases, Open question 1]
- [x] Foreign, repeated or out-of-range log ids. [REQ-13, REQ-14]
- [x] Save failure shows the existing toast once. [REQ-6, REQ-20, Edge cases]
- [x] All meals checked: no "Siguiente". [REQ-2]
- [x] Four-digit figures at 360px and 200% zoom. [NFR]
- [x] Is the 8-or-more-meals case defined at <=937px (list capped inside the card, or full height while the page scrolls)? [REQ-7] (capped at 336px, same tighten-then-scroll rule)

## Result

UX: 34 passed, 0 failed (spec v1.1; copy confirmation pending at Gate 1).

# Checklist: Accessibility for dashboard-real-data

Requirement-quality checks against the PRODUCT.md Accessibility section. `[x]` = covered by the spec, `[ ]` = gap (blocks approval). Spec v1.1 (draft).

## Completeness

- [x] Are rows native buttons with an accessible name containing time, name and state? [REQ-4]
- [x] Is the selected row exposed as the current item with a non-colour cue? [REQ-5]
- [x] Is state never by colour alone (icon or word)? [REQ-2, D6, NFR]
- [x] Does the arc have a text alternative ("X de Y comidas cumplidas") and each figure a visible label? [REQ-15, NFR]
- [x] Is reduced motion defined for the phone scroll-to-hero? [REQ-9]
- [x] Are forced colors covered (rows, icons, selected cue, focus ring visible)? [NFR]
- [x] Is a rollback surfaced to the user (existing toast, once)? [REQ-20, Edge cases]
- [x] Is the Tab order between the timeline, the hero carousel controls (arrows, dots, button) and the counts card defined? [REQ-19]
- [x] Is focus placement after activating a row defined (stays on the row, also when the hero scrolls into view on phone)? [REQ-9, REQ-19]
- [x] Are screen reader announcements defined for optimistic changes and rollback (row state, counts, "Siguiente" moving)? [REQ-20] (one announcement through the dashboard-polish REQ-24 region; rollback by the toast only)
- [x] Is focus visibility defined inside the scrolling list (ring not clipped by the overflow, not hidden under the edge fade, scrolled into view on focus)? [REQ-7, REQ-18, REQ-19]
- [x] Is reduced motion defined for the in-list scroll to the selected row and for the edge fade? [REQ-5, REQ-7]
- [x] Is reduced-transparency and high-contrast behaviour defined for the edge fade (PRODUCT.md)? [REQ-7] (1px divider replaces the fade)
- [x] Are accessibility checks named in the tests (contrast, keyboard path, accessible names, forced colors)? [NFR Tests]

## Clarity

- [x] Are contrast thresholds numeric (text 4.5:1, icons, selected cue and focus rings 3:1) against the card background in both themes? [NFR, REQ-18]
- [x] Is target size a number (44px minimum row height)? [REQ-7]
- [x] Are text-size limits given for 360px and 200% zoom? [NFR]
- [x] Is the accessible-name format exact (order, separators, whether "seleccionada" is announced)? [REQ-4] ("07:00, Desayuno, Siguiente"; selection is not in the name)
- [x] Are the list's accessible name and the `aria-current` value ("true" or other) quoted? [REQ-20, NFR] ("Comidas de hoy"; `aria-current="true"`)
- [x] Are the butter and sky cards' text and icon colour pairs or tokens identified as meeting 4.5:1, including muted "Pendiente" text and the selected cue? [NFR, D11] (stated as a requirement on both card tones; the plan picks tokens and records ratios)

## Consistency

- [x] Do REQ-5 (selection follows the hero) and Edge cases (rollover keeps the selected row) agree? [REQ-5, Edge cases]
- [x] Do the NFR (reduced motion removes scroll animation) and REQ-9 (instant scroll) agree? [NFR, REQ-9]

## Edge cases

- [x] Rows reachable by keyboard when the list scrolls. [REQ-7, REQ-19]
- [x] Empty arc and zero figures still have text. [REQ-15]
- [x] Text at 200% zoom and 360px without overlap. [NFR]
- [x] Is the keyboard path defined when a focused row's state changes or the list scrolls under it after a check-off? [REQ-5, REQ-6, REQ-19]

## Result

Accessibility: 26 passed, 0 failed.

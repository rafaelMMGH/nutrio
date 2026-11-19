# Checklist: UX for dashboard-polish

Requirement-quality checks. `[x]` = covered by the spec, `[ ]` = gap (blocks approval). Spec v1.3 (approved).

## Completeness

- [x] Are idle, saving, success and failure states defined for "Marcar cumplida"? [REQ-3, REQ-4]
- [x] Is the unmark flow (optimistic, failure return) defined? [REQ-5]
- [x] Are empty states for Racha defined (no logs, no plan, free day)? [REQ-11, REQ-12, REQ-14]
- [x] Is the pill's behaviour with no recipe defined? [REQ-18]
- [x] Is carousel behaviour after mark, unmark, failure, rollback, manual switch and none pending defined, with the delay starting at "Cumplida"? [REQ-6]
- [x] Are motion rules and the reduced-motion fallback defined? [REQ-7, REQ-19]
- [x] Are pill hover and press defined for normal motion, and is "no entrance motion in either mode" stated? [REQ-30]
- [x] Is behaviour defined when the local date rolls over (midnight) while the dashboard is open? [REQ-28]
- [x] Is the Racha KPI row layout at <=937px defined (existing 2x2 grid)? [REQ-10, REQ-29]
- [x] Is the pill's behaviour defined when the dish name is empty or the recipe title is missing? [REQ-31]

## Clarity

- [x] Are Racha counting rules unambiguous with worked examples? [REQ-11 to REQ-14]
- [x] Are copy strings quoted exactly, including singular/plural? [REQ-3, REQ-14, REQ-24]
- [x] Are timing numbers given (900 ms +-100 after "Cumplida", 400 ms tap lockout, 600 ms settle, same frame on pointerdown, scale 0.97, 150 ms hover)? [REQ-5, REQ-6, REQ-7, REQ-25, REQ-30, NFR]
- [x] Is "same size as today's button" given as numbers (height, padding, radius, colours)? [REQ-2]
- [x] Is "the pill never grows beyond the plate" defined with one fixed limit per range (>=938px 70%, <=937px 60%, no fallback)? [REQ-21, REQ-22]
- [x] Is "clearly visible in light and dark" for the capsule tied to a single measurable rule? [REQ-19]

## Consistency

- [x] Do D5 and REQ-21 agree (no subtitle at <=937px)? [D5, REQ-21]
- [x] Do REQ-4 and REQ-5 agree on failure return states? [REQ-4, REQ-5]
- [x] Do REQ-3, REQ-5, REQ-9 and REQ-25 agree on ignored taps (during "Guardando" and 400 ms after a state change), so no example needs a mark followed by an immediate unmark? [REQ-3, REQ-5, REQ-9, REQ-25]
- [x] Do REQ-4, REQ-8 and REQ-9 agree that the button and `aria-pressed` follow the visible state while dials and Racha are optimistic? [REQ-4, REQ-8, REQ-9]
- [x] Do REQ-23 and D4 agree on the recipe page keeping its ring-and-dot icon? [REQ-23, D4]
- [x] Does REQ-3 (done meal shows "Cumplida" with no animation when reached by the carousel) agree with REQ-6 (auto-advance after a mark)? [REQ-3, REQ-6]
- [x] Is the "Guardando" label reconcilable with the optimistic update (which source shows during the save)? [REQ-9]

## Edge cases

- [x] Tap during "Guardando" ignored. [REQ-25]
- [x] Meal switched while saving; failure toast still shows. [REQ-4, REQ-24, REQ-25]
- [x] Long dish name truncation. [REQ-22]
- [x] Are double taps (on "Cumplida" and on "Marcar cumplida") and late results of an older request defined? [REQ-25]
- [x] Is the pill's behaviour defined when the plate is very small (<360px) or hidden? [REQ-21, Out of scope]

## Result

UX: all items covered by spec v1.3 (approved; 0 unchecked); re-verify pending.

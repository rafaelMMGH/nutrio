# Checklist: Accessibility for dashboard-polish

Requirement-quality checks. `[x]` = covered by the spec, `[ ]` = gap (blocks approval). Spec v1.3 (approved).

## Completeness

- [x] Keyboard activation (Enter, Space) for the action button. [REQ-1, REQ-8]
- [x] Keyboard stop and visible focus for the pill, link semantics. [REQ-20]
- [x] Status announcements limited to Guardando, Cumplida, and the unmark. [REQ-24]
- [x] Reduced motion fallback (no scale, spring, stroke draw, hover or press change); the pill has no entrance motion in either mode. [REQ-7, REQ-30]
- [x] Reduced transparency fallback (opaque capsule, same contrast). [REQ-19]
- [x] Focus kept on the button while saving. [REQ-8]
- [x] Is the failure of a save or unmark announced exactly once, by the existing toast and not repeated by the status region? [REQ-24]
- [x] Is a minimum touch target size defined for "Marcar cumplida"? [REQ-2] (44x44)
- [x] Is high-contrast / forced-colors behaviour defined for the pill and the button? [REQ-19, REQ-27]
- [x] Is the Racha card's accessible text defined (icon decorative, one phrase)? [REQ-29]

## Clarity

- [x] Contrast thresholds are numeric: text 4.5:1, focus ring 3:1, capsule edge 3:1. [REQ-19, REQ-20, REQ-26]
- [x] Pill height >= 44 px. [REQ-20]
- [x] Is the button's accessible name defined (stable name plus aria-pressed), with aria-pressed following the visible state (false idle and "Guardando", true "Cumplida", false at once on unmark, true again on a failed unmark) and aria-busy while saving? [REQ-8]
- [x] Do per-letter animated spans stay out of the accessible text? [REQ-8]
- [x] Does the reduced-transparency requirement define the opaque capsule and the fallback when the preference is not reported? [REQ-19]
- [x] Are non-text contrast (3:1) requirements stated for the arrow and check icons, and the idle button text? [REQ-26]

## Consistency

- [x] Do REQ-8, REQ-9 and REQ-24 agree on aria-pressed, aria-busy and the status region? [REQ-8, REQ-9, REQ-24]
- [x] Do REQ-20 (name "Modo Cocina" + dish) and REQ-21/22/31 (no subtitle, truncated, empty name) keep a coherent accessible name? [REQ-20, REQ-21, REQ-22, REQ-31]
- [x] Does the status region agree with "tap during Guardando is ignored" and `aria-busy`, and is it limited to the meal on screen? [REQ-8, REQ-24, REQ-25] (an ignored tap, during "Guardando" or the 400 ms lockout, is signalled by `aria-busy` and the announcement already made; no extra announcement)

## Edge cases

- [x] Reduced motion with stroke draw: final states identical. [REQ-7]
- [x] Is the focus position defined when the carousel auto-advances (focus stays, new state announced)? [REQ-6, REQ-24]
- [x] Is behaviour defined under 200% zoom for the pill, button and Racha? [NFR, REQ-29]

## Result

Accessibility: all items covered by spec v1.3 (approved; 0 unchecked); re-verify pending.

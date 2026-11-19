# Checklist: UX for metric-dials

Re-checked against spec v1.3 on 2026-11-15 (earlier passes: v1.1, v1.2). Sources used: spec, the user's decisions D1 to D20 (brief sections 2, 2b, 2c), the stock dial source (cited by line), `DataColumn.tsx:67` (Métricas is `<Card tone="black">`), constitution.
`[x]` = PASS, `[ ]` = FAIL, `[~]` = N/A for the spec, settled in the plan (the note says what the plan must record). Severity: H blocks, M fix before approval, L can wait for the plan.

Totals: 91 items, 85 PASS, 0 FAIL, 6 N/A (for the plan).

## 1. States

- [x] S1 Dial with data [REQ-3, 4, 5, 20]
- [x] S2 No data: "—", needle at 0 [REQ-6]
- [x] S3 No plan target [REQ-6, D18o]
- [x] S4 Before the first weight [REQ-21]
- [x] S5 Loading: no placeholder, first render shows values directly [Assumptions, "First render"]
- [x] S6 Saving: dial stays usable, no busy look [REQ-40, Assumptions]
- [x] S7 Save failed [REQ-30]
- [x] S8 Read-only: opacity 1, no change, name and value read [REQ-2, REQ-43]
- [x] S9 Focused: ring at least 3:1 in both themes, never clipped; read-only dials take no focus [REQ-49, REQ-44, REQ-2]
- [~] S10 Pressed and dragging look: for the plan. The plan must record that Peso keeps the stock grabbing look (grab cursor, border change; stock dial lines 522-524) and that the three read-only dials show none.
- [x] S11 At a limit: needle stops with soft resistance, keys and wheel stop, button disabled, value unchanged [REQ-50, D3]
- [x] S12 Goal reached [REQ-35]
- [x] S13 No goal [REQ-34, 35]
- [x] S14 Stored weight outside 30-150 [REQ-24]

## 2. Feedback

- [x] F1 Save success toast, 8 s [REQ-27]
- [x] F2 Failed save [REQ-30]
- [x] F3 Deshacer success: the toast closes and no other toast shows; the announcement is not a toast [REQ-29 (text and Given), REQ-51]
- [x] F4 Failed Deshacer: error toast replaces the Deshacer toast, no retry [REQ-39, D20d]
- [x] F5 Goal saved, removed, failed [REQ-12, 15, 37, 38]
- [x] F6 Refusals inline under the field, focus on the first one, results as toasts [REQ-46, D20g]
- [x] F7 Toast lifetime: Deshacer toast 8 s with pause; other toasts keep the app's normal behaviour [REQ-27, D20l]
- [~] F8 Stacking and position: for the plan. The plan must record where toasts sit, that a new weight toast replaces the previous one (REQ-51), and that they never cover − / +.
- [x] F9 Polite announcement [REQ-46, REQ-51]
- [x] F10 Deshacer reachable by keyboard, timer pauses [REQ-27, D20l]

## 3. Input methods

- [x] I1 Mouse drag [REQ-25, D3]
- [x] I2 Touch drag, only the knob captures [REQ-31, D8]
- [x] I3 Flick saves when the dial settles, clamped by the dial [REQ-27, D20m]
- [x] I4 Keyboard steps [REQ-25]
- [x] I5 Wheel only when focused [REQ-25, D3]
- [x] I6 − / + press and hold [REQ-26]
- [x] I7 Scroll starting on the knob: accepted, Deshacer covers it [D8, REQ-31; stock `touch-none` on the knob only, line 522]
- [x] I8 Double-click does nothing [REQ-25, D3]
- [x] I9 Timings [REQ-26, 27]
- [x] I10 Interrupted gesture: cancel and lost capture settle like a release [Assumptions; stock lines 537-538]. Escape is not a stock behaviour and is not required.
- [x] I11 Pending save flushed on leaving; a failed flush is logged, no toast [REQ-27, D20m]

## 4. Accessibility

- [x] A1 Role, name, value text: table plus slider with min and max [REQ-43, REQ-49, D3]
- [x] A2 Read-only announced as a read-only value, not a slider [REQ-2, REQ-43]
- [x] A3 "—" read as "Sin datos" and "Sin registro de peso" [REQ-43, D20k]
- [x] A4 Focus order and read-only not stops [REQ-49, REQ-2, D20h]
- [x] A5 Knob touch target at least 44px on compact [Assumptions; buttons REQ-26]
- [x] A6 Contrast 4.5:1 text, 3:1 graphics, on the black card in both themes [REQ-44, Assumptions; `DataColumn.tsx:67`]
- [x] A7 Reduced motion [NFR Motion, REQ-7, REQ-52]
- [x] A8 Meaning not by colour alone [REQ-53, Assumptions]

## 5. Copy

- [x] C1 Accessible label of the Aumentar / Disminuir group: "Objetivo", with a Given that it is a named group [REQ-11; the Assumptions section marks the wording as proposed, to be confirmed at approval]
- [x] C2 Number formats [REQ-4, 5, D18q]
- [x] C3 Goal and distance format, trailing ".0" dropped [REQ-35, D20i]
- [x] C4 "≈" and half-up rounding [REQ-4, 5]
- [x] C5 "1 de 1 comida"; "faltan" invariable [REQ-3, REQ-35 examples "faltan 0.1 kg", "faltan 1 kg"]
- [x] C6 Month names [REQ-14]
- [x] C7 Year rule [REQ-14, D18t]
- [x] C8 Refusal wording [REQ-12, 13]
- [x] C9 Failure toasts [REQ-30, 37, 38, 39]
- [x] C10 Capitalisation approved as written [Assumptions]

## 6. Layout

- [x] L1 Five sizes, no page scrollbar; the guarantee covers only those five sizes [REQ-9, 33, 45]
- [x] L2 937 and 938 boundary [REQ-45]
- [x] L3 2x2 compact grid [REQ-9, 45]
- [x] L4 Smallest width 360px, no horizontal scroll [REQ-45, D20j]
- [x] L5 Number inside or above by a numeric rule [REQ-8, 9, D4]
- [x] L6 Long values never clip or truncate [REQ-45, REQ-33]
- [x] L7 − / + and the longest line at 360px with 44x44 targets [REQ-33]
- [x] L8 End labels show the limits, which change only after a save [D3 keeps stock labels, stock line 23; REQ-8, REQ-23]
- [~] L9 Reflow at 200% zoom and landscape: for the plan. The plan must record the check and the allowed page scroll there.

## 7. Consistency

- [x] K1 Peso vs read-only cards [REQ-1, 9, 33]
- [x] K2 Reached rule on card and assistant [REQ-35, 42, D17]
- [x] K3 Same wording and tenth rounding on card and assistant [REQ-42, D20a, D20i]
- [x] K4 Interim after US1 [Delivery notes]
- [x] K5 Interim after US2 [Delivery notes, REQ-17]
- [x] K6 Interim after US3 [Delivery notes]
- [x] K7 Narrow-scale defect closed: widen to 5 kg only under 5 kg [REQ-22, D20b]
- [x] K8 Configuración pattern [Assumptions]

## 8. Discoverability

- [x] D1 Peso turns: grab cursor on the knob and visible − / + buttons, no tooltip [Assumptions]
- [x] D2 Finding the goal [REQ-18, 35]
- [x] D3 Link lands in view [REQ-18, 35]
- [x] D4 Link affordance [REQ-53, Assumptions]

## 9. Error prevention and recovery

- [x] E1 Limits table with examples [REQ-22]
- [x] E2 Temporary limit: no hint, the scale re-opens after the save [Assumptions, REQ-23]
- [x] E3 Stored weight out of range [REQ-24]
- [x] E4 Form refusal says rule and number [REQ-13]
- [x] E5 Guardar meta and Quitar meta disabled while a goal request is in flight, enabled again on success or failure [REQ-46 (text and Given)]
- [x] E6 Unchanged release saves nothing [REQ-27]
- [x] E7 Quitar meta with no confirmation [D18p, REQ-15]

## 10. Themes and motion

- [~] M1 Theme change while open: for the plan. The plan must record that the dials follow a theme change at once with no glide (the card is black in both themes, so only focus rings and page tokens can change).
- [x] M2 Glide on tab change [REQ-7]
- [x] M3 Glide after Deshacer, failed-save revert and rescale [REQ-52]
- [x] M4 First render without entrance animation [Assumptions]

## 11. New in v1.2

- [~] N1 Where the Deshacer toast sits in the Tab order (REQ-27 says focus can reach it; REQ-49's order stops at +): for the plan. The plan must record the toast's place in the focus order and that focus returns to the knob when it closes.
- [x] N2 A focused or held − / + that reaches a limit keeps keyboard focus (on the Peso card's controls, not the page body); the mechanism is left to the plan [REQ-50 (text and Given), REQ-26]
- [~] N3 Inline refusals: clearing when the field changes, and linking to the field for screen readers (REQ-46): for the plan. The plan must record both.
- [x] N4 After Deshacer the Peso name and value are announced [REQ-51]
- [x] N5 Read-only dials: no tab stop yet still readable, no contradiction between REQ-2, 43, 49 [REQ-2, REQ-43, D20h]
- [x] N6 Toast timer pause for pointer and focus, with Givens [REQ-27, D20l]

## Needs a user decision

None blocking. The group label "Objetivo" (C1) is proposed wording that the user confirms at approval (spec Assumptions).

# Spec change proposal: v1.3 → v1.4 (option (c), from T006)

**Status:** approved by the user 2026-11-17 with Q1 = (A) "Peso (kg)"; applied to spec.md · **Date:** 2026-11-17 · **Trigger:** T006, the user chose option (c) (plan.md "Chosen (T006)").

Option (c) moves the unit out of the knob and onto the line under the dial. v1.3 quotes the readouts with their units and allows "above" placement, so these REQs change. No REQ id added or renumbered. UI copy stays es-MX.

## Changes

| REQ | v1.3 | v1.4 |
|---|---|---|
| REQ-4 | readout "≈ N kcal"; "meta N kcal" underneath. Example "≈ 1,445 kcal" and "meta 1,850 kcal" | readout "≈ N" (same formula, whole kcal, half up, thousands comma); "meta N kcal" underneath. Example "≈ 1,445" and "meta 1,850 kcal" |
| REQ-5 | readout "≈ N g"; "meta N g". Example "≈ 88 g" | readout "≈ N"; "meta N g" underneath. Example "≈ 88" and "meta 112 g" |
| REQ-6 | zeros example: Calorías "≈ 0 kcal", Proteína "≈ 0 g" | Calorías "≈ 0" (with "meta 1,850 kcal"), Proteína "≈ 0" (with "meta 112 g") |
| REQ-9 | "the number inside the knob when legible (the same numeric rule as REQ-8), else above" | "the number inside the knob at every supported size; its font size follows a numeric rule the plan records (never below the plan's minimum, 10px)". The "above" placement is removed |
| REQ-43 | unchanged | unchanged: the value text keeps the units ("≈ 1,445 kcal, meta 1,850 kcal", "≈ 88 g, meta 112 g", "71.5 kg"), since a screen reader does not see the layout; the unit is a string the card shows (on the line or the name, see Q1) |
| REQ-35, D20i | "the dial readout keeps one decimal ("72.0 kg")" | "the dial readout keeps one decimal ("72.0")"; the rounding examples read "70.0" / "70.1" in the knob |
| Format (NFR) | "The dial readout and Configuración show one decimal ("71.5 kg")" | "The dial readout shows one decimal without unit ("71.5"); Configuración keeps "71.5 kg"" |

Adherencia ("78%") is unchanged.

## Open question Q1: where Peso shows "kg"

Calorías and Proteína always carry the unit on their line when there is a number. Peso's line does not always have one: "Sin meta" and "Meta alcanzada · Fijar nueva meta" carry no "kg", so with (c) the weight would show as a bare "74.5".

- **(A, recommended)** The tile name reads "Peso (kg)" (the accessible name stays "Peso"). The unit is always visible and the knob keeps the (c) size.
- (B) Peso alone keeps "kg" in the knob ("74.5 kg"): its number drops to 11.6px at 1440×900 and 9.3px at 1280×768 (below the 10px minimum).
- (C) The line always carries it: "kg · Sin meta", "kg · Meta alcanzada".

## Change log row (to add on approval)

| 1.4 | 2026-11-17 | T006 chose option (c): REQ-4, 5, 6 readouts without unit, unit on the line; REQ-9 number always inside the knob (no "above"); REQ-35, D20i and Format: Peso readout without "kg"; Peso unit per Q1. REQ-43 unchanged. |

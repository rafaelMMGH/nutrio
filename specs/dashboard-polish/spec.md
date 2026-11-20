# Spec: Dashboard polish

**Status:** implemented (merged to `main` as PR #16, commit c8b9e98; marked implemented by the user 2026-11-19. T037 screenshots and T038 snapshot regeneration were left open, see `specs/BACKLOG.md`. Earlier: Gate 2: plan and 38 tasks approved by the user 2026-11-18; Gate 1 approved 2026-11-18, all defaults accepted; v1.3 amendments approved 2026-11-18)
**Version:** 1.3 · **Branch:** feature/dashboard-polish, from `main` · **Owner:** Rafael Martinez · **Date:** 2026-11-18

> The *what* and *why* only. UI copy is quoted in Spanish (Mexico). Existing UI elements are named as the user sees them. Supersedes `specs/cooking-mode/spec.md` REQ-4 and D1 (hero text link and plate dot) and `specs/alt-dashboard/plan.md` §5.4 KPI 1 ("Comidas de hoy").

## Overview

Three small changes to the signed-in dashboard, shipped together because they touch the same surface. (1) "Marcar cumplida" asks the user to hold a button for 800 ms; it becomes a one-tap action button with a smooth press, a "Guardando" state and a drawn check. (2) The first KPI card, "Comidas", repeats the "N de M comidas" line under the Adherencia dial; it becomes "Racha", the number of consecutive fully completed days. (3) The hero has two "Modo Cocina" entry points, a text button next to "Marcar cumplida" and a dot at the centre of the plate; the text button goes and the dot becomes a frosted-glass pill that names the dish.

## Goals / Non-goals

- Goals: marking and unmarking a meal feels immediate and smooth, and never shows success when the save failed (US1); a KPI that adds information instead of repeating a dial (US2); one clear, good-looking "Modo Cocina" entry on the plate (US3).
- Non-goals: the static cards "Cumplimiento del plan" and "Resumen calórico" (backlog; superseded by `specs/dashboard-real-data/`, which gives them real data); new data, schema, API or dependency; recipe photos; the KPIs "Planes", "Recetas", "Compras"; changing Modo Cocina itself or the recipe page's button and its ring-and-dot icon.
- Out of scope: DST and timezone travel (dates are browser-local), several tabs open at once, viewports under 360px.

## Decisions

Confirmed by the user on 2026-11-18 (Gate 1). Numbering is kept; D7, D9, D10, D13, D14, D17, D18 were removed in v1.2 because they only pointed at a REQ.

- D1 One spec and one PR for the three parts; the overridden decisions in cooking-mode and alt-dashboard are annotated, not run as separate spec-change routes: same surface, faster.
- D2 Remove the "Modo Cocina" text button beside "Marcar cumplida": redundant with the plate entry.
- D3 The plate's centre dot becomes a smoked dark glass pill with white text in both themes, modelled on the user's reference (REQ-17); the hover tooltip goes: a clearer entry that names the dish.
- D4 The beef icon appears only in the pill; the recipe page keeps its ring-and-dot mark: the user asked for the beefsteak here, the established mark stays elsewhere.
- D5 At ≤937px the pill drops its subtitle: it must not cover the plate.
- D6 KPI 1 "Comidas" becomes "Racha" (flame icon): Comidas duplicates the Adherencia dial; a streak uses existing data and is shown nowhere else. Rejected: Próxima comida, Días perfectos, Día del plan, Agua, Días activos (water and exercise have no write UI; plan days left and intake need migrations).
- D8 An incomplete today does not break the streak and free days are skipped (REQ-12): the day is not over yet, and a free day is not a failure. "Día libre" is an existing UI term.
- D11 The user asked for the uiarc action-button look and motion as the reference for "Marcar cumplida"; today's size and colours are kept (REQ-2), only behaviour and motion change. The button is written in-house with the project's existing libraries; uiarc is only the look-and-motion reference (credited in a comment) and no third-party source is copied, because uiarc names no licence.
- D12 A single tap marks (no hold): undo is one tap, so accidental-tap risk is low; the loss of hold protection is accepted.
- D15 The save must report failure to its caller: never show success on failure (constitution 6).
- D19 Hold-to-confirm is removed entirely, with its unit test: the hero was its only user, so this is not a constitution 1 violation.
- D20 The e2e freeze is lifted only for the affected tests and three new ones, all listed under Non-functional requirements, run once per batch, not the full suite. The dashboard visual snapshots are regenerated in the final batch, after the user's visual check.
- D21 `specs/metric-dials/spec.md` is set to `implemented` (the dials shipped on `main`; the user confirmed).

## User stories

### US1 (P1): Mark a meal done with the action button
As a user, I want to mark my meal with one smooth tap so that logging my day takes no effort and I can trust what it shows.

- **REQ-1:** "Marcar cumplida" completes with a single tap, click, Enter or Space; no hold gesture, progress ring or hold hint exists anywhere in the app.
  - Given a pending meal on screen, when I tap once and release, then the meal is saved as done.
- **REQ-2:** Idle look equals today's hero button (quoted from the CSS), light / dark: height 40 px, horizontal padding 16 px, gap 6 px, 14 px text, 1 px border (#e6e7ea / #2c2e35), pill radius, background #ffffff / #1a1b20, text #0e0e10 / #f3f4f6; only the trailing arrow is new. The done state keeps today's look: ink fill (#0e0e10 / #f3f4f6) with inverse text. The touch target is at least 44×44 px, extended around the visible 40 px pill without changing the layout.
  - Given either theme, when I compare the idle button with these values, then they match and the arrow is the only difference; given the button, then its hit area is at least 44×44 px.
- **REQ-3:** Labels follow the state: idle "Marcar cumplida" plus a trailing arrow; saving "Guardando" until the request settles; saved "Cumplida" plus a check that draws itself, kept while the meal is done. A meal already done on load, or reached by the carousel or auto-advance, shows "Cumplida" from the first paint with no draw or letter animation.
  - Given I tap, then "Guardando" shows until the save finishes, then "Cumplida" and the drawn check; given I reload, or move by carousel to a done meal, then it reads "Cumplida" without animating.
- **REQ-4:** Failure never shows success: if the save fails the button returns to "Marcar cumplida" (not pressed throughout), the optimistic state rolls back (REQ-9) and the existing toast "No se pudo guardar tu registro del día" shows once. "Cumplida" appears only after a confirmed save.
  - Given the save request fails, when I tap, then the button never reads "Cumplida", ends as "Marcar cumplida", the dials and Racha return to their earlier values, and the toast shows once.
- **REQ-5:** Tapping "Cumplida" unmarks at once (subject to REQ-25): no "Guardando", the check and arrow motion reverses, the meal reads pending, the carousel does not move. If the unmark fails, the button returns to "Cumplida" (pressed again) and the same toast shows.
  - Given a done meal, when I tap "Cumplida", then within one frame it reads "Marcar cumplida" with the arrow; given the unmark request fails, then it ends as "Cumplida" with the toast.
- **REQ-6:** After a mark is saved, the carousel advances to the next pending meal about 900 ms (±100 ms) after "Cumplida" shows (the save is confirmed). The advance is cancelled by a manual meal switch, by an unmark, or by a rollback inside that window; it does not happen after a failure or when no meal is pending. Focus stays on the button after the advance.
  - Given three pending meals and I mark the first, then ~900 ms after "Cumplida" shows the second is on screen and focus is still on the button; given I switch meal manually, or unmark, or a rollback occurs inside the window, then no advance happens.
- **REQ-7:** Motion: changed letters rise from a soft blur, the width springs to fit the label, the press scales to about 0.97. Under reduced motion the label changes with an instant fade, with no press scale, width spring or stroke draw; final states are identical.
  - Given reduced motion, when I tap, then no scale transform, width animation or animated stroke occurs and the labels still change.
- **REQ-8:** The button is native, operable with Enter and Space, with a stable accessible name "Marcar cumplida" in every state. `aria-pressed` follows the visible state: false while idle and while "Guardando" (then `aria-busy` is true); true once "Cumplida" shows; false immediately on unmark; true again if the unmark fails and rolls back. The animated per-letter label is hidden from assistive technology and one visually hidden copy names the button, so it is never read letter by letter. Focus stays on the button in every state.
  - Given a screen reader, when "Cumplida" shows, then it reads "Marcar cumplida, pressed"; during "Guardando" and idle, "not pressed" (busy while saving); given Enter, then focus never leaves the button.
- **REQ-9:** Source of truth during a save: the button (label and `aria-pressed`, REQ-8) shows the confirmed state; the Adherencia dial, Calorías, Proteína and Racha update optimistically at once, on mark and on unmark, and roll back on failure. On a slow or offline connection "Guardando" stays until the request settles, the button stays focusable, and no new timeout is added.
  - Given a delayed response, when I tap, then the dial moves at once while the button reads "Guardando" and is not pressed until the response arrives.
- **REQ-24:** A status region announces only "Guardando" when a mark starts, "Cumplida" when it is saved and "Comida desmarcada" on unmark, and only for the meal on screen. A failed save or unmark is announced exactly once, by the existing toast "No se pudo guardar tu registro del día"; the region does not repeat it. After a carousel move to a meal already done, it announces "Cumplida".
  - Given a screen reader and Enter on a pending meal, then "Guardando" then "Cumplida" are announced; given the save fails, then the failure is announced once; given I switch meal while a save is pending, then the other meal's result is not announced.
- **REQ-25:** Concurrency, per meal. (a) While the button reads "Guardando" every tap is ignored: no second save, no unmark. (b) After any tap that changes state (mark or unmark) the button ignores further taps for 400 ms. (c) The last accepted user action wins: an older request's late result, success or failure, never overwrites a newer accepted action, and a rollback targets the meal the save started on. (d) Meals are independent in outcome: a rollback only affects the meal acted on. A day's meals are saved in one request per date, so saves for the same date run one at a time; meal B may show "Guardando" while meal A's earlier save for the same date is still in flight (accepted: single user, one device).
  - Given "Guardando", when I tap again, then nothing happens (one request, meal not unmarked).
  - Given "Cumplida", when I double tap within 400 ms, then it is one unmark and ends "Marcar cumplida".
  - Given "Marcar cumplida", when I double tap within 400 ms, then it is one mark and ends marked (or rolled back if the save fails).
  - Given an unmark in flight and, after 400 ms, a newer mark accepted, when the unmark's response fails late, then the button keeps the mark's state and is not rolled back to "Cumplida"; given A pending and B unmarked, then A's failure rolls back only A.
- **REQ-26:** Contrast, in both themes, against the button's computed background: label text at least 4.5:1; arrow and check icons and the focus ring at least 3:1.
  - Given each theme and state (idle, done), when I measure, then the ratios hold.
- **REQ-27:** Forced colors (high contrast): the button, its check and its focus ring stay visible (explicit border, system colours).
  - Given forced colors, then the idle and done button show an edge and the check and focus ring are visible.

### US2 (P2): Racha KPI
As a user, I want to see how many days in a row I completed my whole plan so that I stay motivated.

- **REQ-10:** The first KPI card reads "Racha" (flame icon) and replaces "Comidas"; "Planes", "Recetas" and "Compras" keep their place and values. At ≤937px the row stays the existing 2×2 grid; at ≥938px four across.
  - Given the dashboard, then the order is Racha, Planes, Recetas, Compras and no "Comidas" card exists; given 360px, then two rows of two.
- **REQ-11:** A day is complete when it has at least one planned meal and every planned meal is marked done on that date (browser-local). A day with no planned meals is a free day ("Día libre"). With today's plans every day has the same planned meals, so a free day occurs only with an empty schedule; the rule stays for future per-day schedules and its example is not exercised by tests today. Done entries for meals not in the current schedule are ignored (plans are not versioned, so past days are judged against the current schedule; a plan change can retroactively change streak and best, accepted).
  - Given 4 planned meals and 4 done, then complete; 3 of 4, then not; 0 planned, then free; given a log marking a meal no longer in the schedule, then it counts for nothing; given the plan grows from 4 to 5 meals, then yesterday's 4 done is incomplete.
- **REQ-12:** The current streak is the number of consecutive complete days ending yesterday, plus 1 when today is complete. Free days are skipped (see REQ-11: with today's plans only an empty schedule yields one; the Mon-Wed-Thu example below is not exercised by tests today); a past day with planned meals and not all done (including no log) breaks it; an incomplete today does not. The walk starts at the earliest date that has any daily log: earlier days are neither counted nor breaks.
  - Given yesterday and the two days before complete and today 2 of 4 done, then 3; marking the last two gives 4. Given yesterday and today incomplete, then 0; yesterday incomplete and today complete, then 1. Given Mon, Tue complete, Wed free, Thu (yesterday) complete, then 3. Given the earliest log was 2 days ago and complete, yesterday complete, then 2.
- **REQ-13:** The best streak is the longest run of complete days from the earliest logged date through yesterday, plus today only when today is complete (same rules), evaluated after the optimistic update, never below the current streak. Unmarking today's last meal can therefore lower the best.
  - Given a past run of 9 and a current streak of 3, then best 9; given the current streak reaches 10, then best 10. Given a first-ever complete day (current 1, best 1), when I unmark its last meal, then "0 días", best 0, "Empieza hoy". Given a run of 5 ending yesterday and today complete (6, "¡Tu mejor racha!"), when I unmark, then "5 días" and, the 5 now being the best, still "¡Tu mejor racha!".
- **REQ-14:** Copy: value "N días" ("1 día", "0 días"); context "mejor: N" normally; "¡Tu mejor racha!" when the current streak equals the best and is above 0; "Empieza hoy" when the current streak is 0.
  - Given current 3 and best 9, then "3 días" and "mejor: 9"; current 9 and best 9, then "¡Tu mejor racha!"; current 1 and best 1, then "1 día" and "¡Tu mejor racha!"; current 0 and best 9, then "0 días" and "Empieza hoy"; no logs ever (or no plan), then "0 días" and "Empieza hoy".
- **REQ-15:** The card updates immediately, without reload and without an extra request, when a meal is marked or unmarked (including a rollback after failure).
  - Given yesterday and earlier complete and today 3 of 4 done, when I mark the 4th, then the value goes up by 1 at once; when I unmark it, it goes back.
- **REQ-28:** When the browser-local date changes while the page is open, "today", Racha and the day's meal state recompute, at the latest on the next tab focus or visibility change.
  - Given the page open past midnight with yesterday complete and today untouched, when the tab regains focus, then Racha counts through the new yesterday and today reads as an incomplete day.
- **REQ-29:** The Racha tile fits at 360px for "999 días" with the longest context line ("¡Tu mejor racha!"), without clipping or overlap, in both themes. The flame icon is decorative; the tile reads as one phrase "Racha, N días, <context>".
  - Given 360px and a value of 999, then nothing is clipped; given a screen reader, then it reads "Racha, 3 días, mejor: 9" with no separate icon.

### US3 (P3): Modo Cocina glass pill
As a user, I want one clear "Modo Cocina" entry on the plate so that I can start cooking the dish I am looking at.

- **REQ-16:** The hero no longer shows a "Modo Cocina" text button next to "Marcar cumplida"; the plate's centre dot and its hover tooltip no longer exist.
  - Given the hero, then the only action beside the rating is "Marcar cumplida", and hovering the plate centre shows no tooltip.
- **REQ-17:** At the plate's centre (the former dot's position) a frosted, translucent capsule of smoked dark glass, the same in light and dark theme, shows a round glass badge with a beef icon on the left, the title "Modo Cocina" in white and, muted, the current dish's name as subtitle, following the meal on screen. Reference: `specs/dashboard-polish/reference-glass-pill.png` (translucent capsule over a food photo, round white-bordered steak badge on the left, bold white title, muted subtitle).
  - Given the pizza meal on screen, then the pill reads "Modo Cocina" and the dish name; given I move to the next meal, then the subtitle shows that dish.
- **REQ-18:** The whole pill is one link to the cooking mode of that dish (same destination as the recipe page's "Modo Cocina" button). A meal with no recipe shows no pill.
  - Given a meal with a recipe, when I click anywhere on the pill, then `/recipes/<id>/cook` opens; with no recipe, no pill shows.
- **REQ-19:** Legibility, light and dark, measured against the pill's own computed background over the plate-dish colour: text at least 4.5:1, capsule edge at least 3:1. When the OS asks for reduced transparency the capsule is opaque and meets the same ratios; where the preference is not reported, the default capsule must meet the ratios itself. Forced colors: the pill, badge and focus ring stay visible (explicit border).
  - Given each theme, and the opaque variant, when I measure, then the ratios hold; given forced colors, then the capsule edge shows.
- **REQ-20:** The pill is a keyboard stop (Enter activates) with a visible focus ring of at least 3:1, its accessible name contains "Modo Cocina" and the dish name, and its height is at least 44 px.
  - Given Tab, when focus reaches the pill, then a ring shows and a screen reader reads "Modo Cocina: <dish name>".
- **REQ-21:** Width, one fixed limit per range: at ≥938px at most 70% of the plate's width; at ≤937px (down to 360px) at most 60%, with the subtitle hidden (same accessible name) and the badge kept. The pill is part of the plate: where the plate is not shown, neither is the pill.
  - Given 1280px, then the pill is at most 70% of the plate's width; given 937px, 390px and 360px, then no subtitle and at most 60%.
- **REQ-22:** A long dish name is cut with an ellipsis on one line; the pill never grows beyond the limits of REQ-21 and the accessible name keeps the full name.
  - Given an 80-character name, then the subtitle is one cut line and the pill's right edge stays inside the plate.
- **REQ-23:** The beef icon is used only in this pill. The recipe page's "Modo Cocina" button keeps its ring-and-dot icon and behaviour.
  - Given a recipe page, then its button and icon are unchanged.
- **REQ-30:** Hover and press (normal motion): the pill changes brightness or scale subtly within 150 ms. Under reduced motion hover and press change nothing. In neither mode does the pill play an entrance motion: it is not part of the plate's entrance, so it stays still while the plate animates in on load and on meal change.
  - Given hover, then a visible change completes within 150 ms; given reduced motion, then none; given the dashboard loads or the meal changes, then the plate animates in while the pill stays still, with no entrance animation in either mode.
- **REQ-31:** A missing or empty dish name hides the subtitle; the pill keeps the title and the accessible name "Modo Cocina".
  - Given a meal whose dish name is empty, then only "Modo Cocina" shows.

## Non-functional requirements

- No new data, endpoint, migration or dependency; the action button reuses libraries already installed (CLAUDE.md "Always ask" 2 is not triggered).
- Timing: the pressed style applies on pointerdown in the same frame; "Guardando" to "Cumplida" settles within 600 ms of the save finishing; tap lockout 400 ms (REQ-25); carousel advance ~900 ms ±100 after "Cumplida" shows.
- The pill, the button and the Racha tile show without clipping at 200% browser zoom, light and dark.
- Compact breakpoints are 937/938 only (CLAUDE.md). UI copy is Spanish (Mexico); existing tokens, plus new tokens scoped to the pill (D3); no console errors.
- Tests (constitution 1): unit tests first for the streak rules (REQ-11 to REQ-14) and the failure reporting, ordering and tap lockout of the save (REQ-4, REQ-25). E2E (D20), rewritten for the new UI and run once per batch: in `tests/e2e/dashboard.spec.ts`, "KPI tiles show real counts with at least two digits", "KPI tiles still animate when the OS asks for reduced motion" (its first-tile comment), '"Marcar cumplida" saves the meal, moves the adherence and slides to the next pending meal', '"Marcar cumplida" on the last pending meal stays on that slide' and '"Marcar cumplida" makes the Comidas number go up by one' (plus the hold helper and `aria-pressed` checks); in `tests/e2e/cooking-mode.spec.ts`, "REQ-4/5: the dashboard hero links to Modo Cocina, and an unknown recipe is a 404"; in `tests/e2e/metric-dials.spec.ts`, "REQ-3: marking one more meal done moves Adherencia, Calorías and Proteína without a reload". Three new e2e tests are also allowed, in the same files: (a) "Marcar cumplida" with a failed save, a double tap and reduced motion (REQ-4, REQ-7, REQ-25); (b) Racha rules, including "999 días" fitting and the midnight recompute (REQ-12, REQ-28, REQ-29); (c) the Modo Cocina pill layout at 1280, 938, 937, 390 and 360 px (REQ-21, REQ-22). The dashboard visual snapshot (`tests/e2e/a-theme-visual.spec.ts`, "home") and the `dashboard.spec.ts` screenshots are regenerated in the final batch, after the user's visual check. The full suite is not run.

## Notes for the plan

- The user asked for the per-letter blur-rise (REQ-7); the reference's docs describe it but its published source crossfades the whole label. The plan decides how to get the effect.
- REQ-24 relies on the existing toast reaching assistive technology; the plan confirms that.

## Assumptions

- Planned meals per date follow the schedule the dashboard already knows (REQ-11); "today" and each log's date are browser-local.
- The 900 ms delay is carried over from today; on a fast save "Guardando" may show only briefly. Switching meal while saving: the button follows the meal on screen, the save finishes for its own meal (REQ-25).
- Today's done look (full ink fill) is kept for "Cumplida" (REQ-2). At ≤937px the badge stays beside the title (REQ-21).

## Open questions

Resolved at Gate 1: defaults accepted (user, 2026-11-18). No open question remains. Accepted defaults:

- Taps ignored during "Guardando" and for 400 ms after any mark or unmark; last accepted action wins (REQ-25).
- `aria-pressed` follows the visible button state while dials and Racha stay optimistic (REQ-8, REQ-9).
- Auto-advance delay starts when "Cumplida" shows; cancelled by manual switch, unmark or rollback (REQ-6).
- Status region says only "Guardando", "Cumplida", "Comida desmarcada"; failures only by the existing toast (REQ-24).
- D11 / REQ-2: idle as today's bordered surface pill, done as ink (the old wording said "dark ink pill"); touch target 44×44 px; status region says "Cumplida" on reaching an already-done meal (REQ-24).
- Pill width ≤70% / ≤60% (REQ-21); contrast 4.5:1 / 3:1 (REQ-19, REQ-26); hover within 150 ms (REQ-30).
- History uses the current schedule; walks start at the earliest logged date; Racha recomputes on tab focus after midnight (REQ-11, REQ-12, REQ-28).

## Progress

- [x] US1 (P1): action button (REQ-1 to REQ-9, REQ-24 to REQ-27)
- [x] US2 (P2): Racha KPI (REQ-10 to REQ-15, REQ-28, REQ-29)
- [x] US3 (P3): Modo Cocina glass pill (REQ-16 to REQ-23, REQ-30, REQ-31)
- [x] Housekeeping: annotations in cooking-mode and alt-dashboard, metric-dials set to implemented, affected e2e rewritten (D20, D21)

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-18 | Initial spec from the grilling session (D1 to D21) |
| 1.1 | 2026-11-18 | Verify round 1 and checklists: icon, streak rules, button numbers and accessibility, pill limits. New REQs 24 to 31 |
| 1.2 | 2026-11-18 | Verify round 2: tap lockout and aria-pressed follow the visible state (REQ-3 to 9, 25), auto-advance after "Cumplida" (REQ-6), failure announced once by the toast (REQ-24), one width limit per range (REQ-21), no pill entrance motion (REQ-30); shorter Decisions and no how-leaks |
| 1.2.1 | 2026-11-18 | Gate 1 approved, defaults accepted (status approved, Open questions resolved); REQ-24 drops "auto-advance" from the done-meal announcement; REQ-5 "subject to REQ-25"; checklist citations point to REQ ids |
| 1.3 | 2026-11-18 | Amendments approved by the user after the plan analyze: pill stays still while the plate animates in (REQ-30); three new e2e tests and visual snapshots regenerated in the final batch (D20); button written in-house, uiarc only as reference (D11); pill-scoped tokens and smoked dark glass in both themes (D3, REQ-17); same-date saves run one at a time (REQ-25d); free days only with an empty schedule today (REQ-11, REQ-12); "(proposed)" tags removed |

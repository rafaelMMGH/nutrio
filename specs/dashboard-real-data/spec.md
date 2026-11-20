# Spec: Dashboard real data

**Status:** planned (Gate 2 approved by the user 2026-11-19: plan v1.2 and 46 tasks, decisions D15-D20; Gate 1 approved 2026-11-19)
**Version:** 1.2 · **Branch:** feature/dashboard-real-data, from `main` · **Owner:** Rafael Martinez · **Date:** 2026-11-19

> The *what* and *why* only. UI copy is quoted in Spanish (Mexico). Existing UI elements are named as the user sees them. Supersedes the "static cards" non-goals of `specs/dashboard-polish/spec.md` and `specs/metric-dials/spec.md`, and `specs/alt-dashboard/plan.md` §5.6 ("solo visuales"). Over the ~150-line budget on purpose: large feature, two stories, a counting rule with worked examples.

## Overview

The signed-in home dashboard has two cards that show invented numbers: "Resumen calórico" (1,850 kcal, +12.8%, bars) and "Cumplimiento del plan" (32 planned, 25 done, "En vivo"). They look real and are not, which breaks the product's first principle (the plan is the authority) and its second (never make the user reopen the PDF). "Resumen calórico" becomes "Comidas de hoy", a timeline of today's meals from the active plan, each with its time and state, which also lets the user jump to a meal in the hero. "Cumplimiento del plan" shows real counts (Planificadas, Cumplidas, Sin marcar, Pendientes) since the active plan version began. No new data is recorded.

## Goals / Non-goals

- Goals: today's meals and their state at a glance, with no invented time (US1); honest plan-compliance counts from the plan and the day logs (US2).
- Non-goals (D2): the hero's star rating, the fixed 68% prep bar and "Tiempo estimado" stay as they are and unmarked; the "Preparación actual" card is unchanged. Rating and prep progress are future phases (see Backlog).
- Non-goals: recording real intake or showing kcal on these cards (the Calorías dial in "Métricas" is untouched); an explicit "skip" mark (D3); the parser keeping the full time range (Backlog); check-off from the timeline; changing how Adherencia or Racha are calculated; the "Métricas" tabs driving these cards (D4); new data, schema, API or dependency.
- Out of scope: DST and timezone travel (dates are browser-local), several tabs open at once, viewports under 360px.

## Decisions

D1 to D14 confirmed by the user on 2026-11-19 in the grilling session (D12 only loses a code path, now in Notes for the plan; its "link" wording is superseded by D15). D15 to D20 were decided by the user at Gate 2 on 2026-11-19 (v1.2).

- D1 One spec, two stories: US1 (P1) timeline replaces the bigger fake card; US2 (P2) real counts: both touch the same pair of cards.
- D2 Hero placeholders (rating, 68% prep bar, "Tiempo estimado") are a non-goal: the rating is useful once several users share recipes and meals; prep progress will come from Modo Cocina's stepper, which will store each started recipe's progress per meal of the day.
- D3 "Skipped" is derived and labelled honestly: a planned meal not checked off on a past day is "Sin marcar", not "Omitidas", because the app cannot tell "forgot to tap" from "skipped". Today's unchecked meals are "Pendientes", never "Sin marcar". Rejected: an explicit skip mark (needs a migration, makes the one-tap hero button three-state); a time-based rule (needs the window's end time, which the parser discards).
- D4 Counts period is "since the active plan version began", not the "Métricas" tabs: the tabs would repeat the Adherencia dial, and meal ids change per plan version, so older logs do not match anyway.
- D5 Count rules (REQ-12 to REQ-14): start = the date the active plan version was created; Planificadas = meals per day × days from the start through today, inclusive; Cumplidas = meals checked off in that range; Pendientes = today's meals not checked; Sin marcar = the remaining past-day meals; days with no log count fully as Sin marcar, consistent with Adherencia counting unlogged days as planned; arc = Cumplidas ÷ Planificadas.
- D6 Timeline is today only, browser-local date like the rest of the dashboard. Each row: start time only ("HH:MM" as stored, no range), meal name, state (Cumplida with a check, Pendiente, or "Siguiente" on the first pending meal). States always carry an icon or text, never colour alone: PRODUCT accessibility. The full range ("7:00–8:00 a.m.") is a Backlog item (parser change).
- D7 Rows are buttons that select that meal in the hero carousel: gives desktop an alternative to the 8px pager dots. No check-off from the timeline; the hero's one action stays (dashboard-polish REQ-1).
- D8 The selected row follows the carousel (arrows, dots, auto-advance). A check-off flips the row at once with the same optimistic update and rollback as the dials (dashboard-polish REQ-9); the counts card updates the same way.
- D9 Overflow: rows tighten to a 44px minimum target, then the list scrolls inside the card with a visible edge fade; nothing is clipped silently. The card used to clip at 860 to 899px tall (backlog, `specs/bugs/dashboard-fit-scroll.md`).
- D10 At ≤937px the cards stack under the hero; a row tap also scrolls the hero into view (instantly under reduced motion).
- D11 Both cards keep their colour, size and position. Their content is replaced as described in REQ-8 and REQ-15.
- D12 Empty states: no active plan, both cards say "Sin plan activo" and offer the "Subir plan" button (a button that opens the upload wizard, not a link: D15). A plan without times lists meals in plan order with no time column; times are never invented, and the made-up-hours fallback is deleted. A new plan with 0 past days shows "Sin marcar" 0.
- D13 No schema, API or dependency change; breakpoints 937/938px only; UI copy in Spanish (Mexico).
- D14 The superseded notes are added to `specs/metric-dials/spec.md`, `specs/dashboard-polish/spec.md` and `specs/alt-dashboard/plan.md` §5.6 (notes only); `specs/alt-dashboard/entrega.md` open question 3 gets a pointer.
- D15 "Subir plan" is a button that opens the upload wizard, not a link (REQ-10, REQ-15, REQ-19). Reason: no upload page exists; uploading happens in the wizard behind "Procesar plan". The copy "Subir plan" is unchanged.
- D16 The list height cap of REQ-7 applies from 360px up to 1279px, not only up to 937px. Reason: REQ-7 was silent at 938 to 1279px, where 8 or more meals would stretch both cards. The five desktop viewports (1280 wide and up) keep the no-page-scrollbar rule.
- D17 The hero's pager is named "Elegir comida" for assistive technology (REQ-21). Reason: today it is "Comidas de hoy", which duplicates the new list's name (REQ-20); it was never in a spec and is an AT-visible change.
- D18 Hero selection behaviour is unchanged (REQ-22): activating the dot of the meal already shown still re-announces it, and a stale selection (the selected meal disappears) clamps to the nearest valid index, not to the first pending meal. Reason: no behaviour change was asked for; moving the selection state out of the hero (REQ-5) must not alter either.
- D19 A click on a timeline row cancels a pending auto-advance, like the pager dots do today, and adds no announcement of its own (REQ-23). Reason: the user's explicit choice is the same as a dot press, and consistent with REQ-20.
- D20 DESIGN.md and PRODUCT.md become tracked in git. Reason: housekeeping, since this spec and others cite them; no REQ (Notes for the plan).

## User stories

### US1 (P1): Today's meal timeline
As a user, I want to see today's meals with their time and state so that I know what is next and can jump to any of them without reopening the PDF.

- **REQ-1:** The card "Comidas de hoy" lists every meal of the active plan for today, in plan order, one row each: start time ("HH:MM" exactly as stored, no range), meal name, and state. A long meal name is cut to one line with an ellipsis; the time and the state never truncate and the name takes the remaining width, at every width down to 360px with a time present, with no horizontal scroll. The full name is always in the row's accessible name (REQ-4).
  - Given a plan with Desayuno 07:00, Comida 14:00, Cena 20:00, when I open the dashboard, then three rows show in that order with those times and names; given a 60-character meal name at 360px with a time, then the name ends in an ellipsis on one line and the time and state are fully visible.
- **REQ-2:** State is one of: "Cumplida" with a check icon (the meal is checked off today); "Siguiente" (the first meal in plan order that is not checked off); "Pendiente" (any other unchecked meal). When every meal is checked off, all rows read "Cumplida" and none reads "Siguiente". Each state shows its icon or word, never colour alone.
  - Given 4 meals with the 1st and 3rd checked, then rows read Cumplida, Siguiente, Cumplida, Pendiente.
- **REQ-3:** Times are never invented. A meal whose stored time is empty shows no time; if no meal has a time, the time column is absent and rows keep plan order; the list is never re-sorted by time.
  - Given a plan with no times, then rows show name and state only; given a plan where only the 2nd meal has a time, then the other rows show no time and the order is unchanged.
- **REQ-4:** Each row is a native button. Activating it (click, tap, Enter, Space) shows that meal in the hero carousel; it does not check the meal off. Its accessible name is "<time>, <name>, <state>" (time omitted when absent; the name never truncated; selection is not part of the name, see REQ-5).
  - Given the hero on meal 1, when I click the row of meal 3, then the hero shows meal 3 and no meal changes state; given Desayuno 07:00 as the first pending meal, then its accessible name is "07:00, Desayuno, Siguiente"; given a done meal with no time, then "Cena, Cumplida".
- **REQ-5:** Exactly one row is selected: the row of the meal on screen in the hero. On load it is the hero's initial meal (the first pending meal, as dashboard-polish defines it). It follows every change of the hero: arrows, pager dots, a row activation, and the auto-advance after "Marcar cumplida". The selected row is exposed to assistive technology as the current item and shows a cue that is not colour alone: a leading marker on the row's start edge plus a heavier name weight. The cue is independent of state: a selected row shows it together with its own state icon or word ("Siguiente", "Pendiente" or the check of "Cumplida"). A selected row outside the visible part of a scrolling list is scrolled into view; this moves only the list, never the page, at any width, and is instant under reduced motion.
  - Given I mark meal 1 and the carousel auto-advances, then 900 ms (±100) after "Cumplida" shows, the row of meal 2 is selected and, in a scrolling list, visible; given meal 2 is Siguiente and selected, then its row shows the marker, the heavier name and the word "Siguiente"; given 8 meals and the page not scrolled, when the selection moves to meal 8, then only the list scrolls.
- **REQ-6:** Checking off or unchecking a meal in the hero updates its row at once (Cumplida / Pendiente) and recomputes "Siguiente", using the same optimistic update as the dials; if the save fails the row rolls back with the dials (dashboard-polish REQ-4, REQ-9). The timeline has no check-off control.
  - Given a pending meal and a delayed response, when I tap "Marcar cumplida", then its row reads "Cumplida" before the response arrives; given the save fails, then the row returns to its earlier state.
- **REQ-7:** Rows and overflow. The default row height is 56px (the current design's row rhythm; adjustable in the plan after measuring). When the meals do not fit at 56px, rows shrink evenly down to 44px (the minimum target). When they do not fit at 44px, the list scrolls inside the card; the page never scrolls because of the list. Scrolling shows a fade about 16px tall on each edge that has hidden rows (top and bottom); an edge's fade is gone when the list is scrolled to that end. The fade never covers a focused row or its focus ring and does not intercept pointer input. When the OS asks for reduced transparency or more contrast, or forced colors are on, the fade is replaced by a 1px divider at those edges that meets 3:1 against the card. Under reduced motion the fade appears and disappears without animation. No row is clipped without a way to reach it, by pointer or keyboard. From 360px up to 1279px (the compact layout and the 938 to 1279px tier) the list is capped inside the card at the height of 6 rows at 56px (336px; adjustable in the plan) and follows the same rule: 7 or more meals tighten, then scroll, so that 8 or more meals never stretch both cards. At 1280px and wider there is no such cap and the page-scrollbar rule applies: at 1440×900, 1440×780, 1280×768, 1920×1080 and 1920×800 the page shows no scrollbar.
  - Given 8 meals at 1280×768, then every row is reachable (scroll or Tab), rows are at least 44px tall, the bottom edge shows the fade until I reach the last row, and the page has no scrollbar; given 8 meals at 390px or at 1100px, then the list is capped inside the card and scrolls the same way and the cards are not stretched; given 1 meal, then the card keeps its size and position and rows are 56px; given reduced transparency, then dividers show instead of fades.
- **REQ-8:** Card content. The title reads "Comidas de hoy". The 1,850 kcal figure, "+12.8%", "Comidas completadas", "Promedio por comida", the bars, the hour labels and the decorative "Hoy" pill no longer exist. The card keeps its colour, size and position.
  - Given the dashboard, then none of those elements is present and the title is "Comidas de hoy".
- **REQ-9:** At ≤937px the cards stack under the hero. Activating a row also scrolls the page so that the hero card's top edge sits just below the top bar (not hidden under it), instantly when the OS asks for reduced motion. Focus stays on the activated row. At ≥938px a row activation does not scroll the page.
  - Given 390px wide and the hero off screen, when I tap a row, then the hero card is brought into view with its top edge below the top bar and focus is still on that row; given reduced motion, then without animation.
- **REQ-10:** Empty states. With no active plan the card reads "Sin plan activo" with a button "Subir plan" that opens the upload wizard (not a link, D15). A plan with no meals reads "Tu plan no tiene comidas" on this card, and the counts card shows all four figures at 0 and an empty arc (REQ-15).
  - Given no active plan, then the card shows "Sin plan activo" and the button "Subir plan" opens the upload wizard; no rows and no invented times appear; given a plan with no meals, then "Tu plan no tiene comidas" shows and the counts card shows 0, 0, 0, 0.
- **REQ-11:** When the browser-local date changes while the page is open, the timeline and the counts recompute for the new day, at the latest on the next tab focus or visibility change (dashboard-polish REQ-28). A save already in flight across midnight settles against the day it was made for: its result or rollback applies to that day and does not alter the new day's rows.
  - Given the page open past midnight with all meals Cumplida, when the tab regains focus, then every row reads Pendiente (the first as Siguiente) and yesterday's meals count toward Sin marcar if unchecked; given a check-off sent at 23:59:59 that fails at 00:00:02, then yesterday's meal returns to unchecked (Sin marcar) and today's rows are unaffected.
- **REQ-18:** Row interaction states, reusing the dashboard-polish conventions. Hover (normal motion): a subtle background change within 150 ms (the timing of dashboard-polish REQ-30). Pressed: the change shows in the same frame as the press. Under reduced motion, hover and press still show the state change, but instantly: 0 ms, no transition, no scale or translate, background or colour change only. Keyboard focus shows a ring of at least 3:1 against the card in both themes and in both motion modes; it is never replaced by hover or the selected cue.
  - Given hover, then a visible change completes within 150 ms; given reduced motion, then the same background change appears instantly with no transition; given Tab onto a row, then a ring shows, also on the selected row.
- **REQ-19:** Keyboard and focus. Tab order follows the reading order: hero controls, then the "Métricas" card, then the timeline rows in plan order (each row is its own tab stop), then the counts card (only its "Subir plan" button when there is no plan). Activating a row keeps focus on that row, including when the page scrolls to the hero (REQ-9). A change of a row's state after a check-off never moves focus and never scrolls the list by itself; the only list scroll is REQ-5's, and it never moves focus. A focused row is scrolled fully into view (clear of the fade) and its focus ring is never clipped by the list.
  - Given 8 meals in a scrolling list, when I Tab to row 6, then it is fully visible with its ring; given focus on row 3 and I mark meal 3 in the hero, then focus stays on row 3, which now reads Cumplida, and the list does not jump.
- **REQ-20:** Assistive announcements. The list is named "Comidas de hoy". Check-off changes shown in the timeline and the counts are announced through the existing status region and the existing sequence of dashboard-polish REQ-24 ("Guardando", then "Cumplida" or "Comida desmarcada", only for the meal on screen); the timeline and counts add no second region and no extra message, and "Siguiente" moving is not announced separately. When a row activation moves the hero to a meal that is already done, the existing REQ-24 announcement on reaching that meal is the only message that follows; the timeline adds none of its own. A rollback is announced once, by the existing toast "No se pudo guardar tu registro del día"; the status region does not repeat it.
  - Given a screen reader, when I mark a meal, then "Guardando" and then "Cumplida" are announced once each, in that order, and the rows and figures update silently; given the save fails, then only the toast is announced.
- **REQ-21:** The hero's pager (the dots that pick a meal) has the accessible name "Elegir comida". It is no longer "Comidas de hoy", which names only the timeline list (REQ-20), so no two regions on the dashboard share a name. The visible UI of the pager is unchanged.
  - Given a screen reader on the dashboard, when I list the landmarks and groups, then the pager is "Elegir comida" and the timeline list is "Comidas de hoy", each once.
- **REQ-22:** Constraint, hero selection behaviour is unchanged (D18), including after the selection state moves out of the hero (REQ-5). (a) Activating the pager dot of the meal already shown re-announces that meal, as today. (b) When the selected meal disappears (stale selection, for example the plan changes), the hero clamps to the nearest valid index, as today, and does not jump to the first pending meal.
  - Given the hero on meal 2, when I press the dot of meal 2, then it is announced again as today; given the hero on the last of 4 meals and a refresh leaves 3 meals, then the hero shows the last of the 3 (nearest index), not the first pending one.
- **REQ-23:** A click on a timeline row, including the row of the meal already shown, cancels a pending auto-advance (after "Marcar cumplida"), as pager dots do today, so the hero stays on the meal I chose. The timeline adds no announcement of its own for this (REQ-20); any message comes only from the hero's existing selection path (dashboard-polish REQ-24).
  - Given I mark meal 1 and, within the 900 ms before the auto-advance, click the row of meal 1 or of meal 3, then the hero does not auto-advance to meal 2 (it stays on meal 1 or shows meal 3), and the timeline announces nothing.

### US2 (P2): Real plan-compliance counts
As a user, I want honest counts of my plan since it began so that I see how I am really following it.

- **REQ-12:** The card "Cumplimiento del plan" shows four figures with these labels: "Planificadas", "Cumplidas", "Sin marcar", "Pendientes". Start = the date (browser-local) the active plan version was created; if that is after today, the start is today. Planificadas = meals per day × days from the start through today, inclusive.
  - Given 4 meals per day and a plan created 12 nov, when today is 14 nov, then Planificadas is 12.
- **REQ-13:** Cumplidas = meals checked off on dates from the start through today whose id belongs to the active plan version's meals (each meal once per day). Entries for meals not in the active plan, dates before the start, and dates after today are ignored. Pendientes = today's meals not checked off. Sin marcar = Planificadas − Cumplidas − Pendientes, which is the past-day meals not checked off; days with no log count fully.
  - Given the 12-meal example with 4 checked on 12 nov, 3 on 13 nov and 2 today, then Cumplidas 9, Pendientes 2, Sin marcar 1; given 13 nov has no log at all, then Cumplidas 6 and Sin marcar 4.
- **REQ-14:** Invariant, always: Planificadas = Cumplidas + Sin marcar + Pendientes, with no figure negative. Today's unchecked meals are never "Sin marcar", even late in the evening; past days' unchecked meals are never "Pendientes". The word "Omitidas" appears nowhere.
  - Given any plan, logs and date (including a log with ids foreign to the plan), then the invariant holds; given 23:59 with 2 meals unchecked, then they count as Pendientes.
- **REQ-15:** Card content. The header reads "Desde <fecha>" with the plan start in short es-MX form, "Desde 12 nov", or with the year when it is not the current year, "Desde 12 nov 2025"; it replaces "En vivo". The black arrow that looked like a link is removed. The arc fills in proportion Cumplidas ÷ Planificadas and exposes it in text ("X de Y comidas cumplidas"), the total Planificadas stays at its centre, and each figure shows its label text. No percentage text appears anywhere on the card. With no active plan the card reads "Sin plan activo" with the button "Subir plan" that opens the upload wizard (D15); with a plan with no meals all four figures are 0 and the arc is empty (still with the text "0 de 0 comidas cumplidas"). The card keeps its colour, size and position. No fixed or invented number remains.
  - Given 9 of 12, then the arc is 75% filled, the text reads "9 de 12 comidas cumplidas", the header "Desde 12 nov" and no "%" appears; given no active plan, then "Sin plan activo" and the button "Subir plan" show, and the button opens the upload wizard.
- **REQ-16:** The figures update at once, with the same optimistic update and rollback as the dials, when a meal is checked off or unchecked: Cumplidas and Pendientes move by 1 in opposite directions, Sin marcar does not change.
  - Given Cumplidas 9 and Pendientes 2, when I check off a meal, then 10 and 1 at once; given the save fails, then 9 and 2 again.
- **REQ-17:** A plan version that began today (day 1) shows Sin marcar 0.
  - Given a plan created today with 4 meals and 1 checked, then Planificadas 4, Cumplidas 1, Pendientes 3, Sin marcar 0.

## Edge cases and errors

- A new plan version becomes active mid-period: the start moves to that version's creation date and the counts restart; logs written against the previous version do not match the new meal ids and are ignored (REQ-12, REQ-13).
- An older version is re-activated: this is a limitation, not a feature. The schema stores no activation date, so the start is that version's original creation date and every day since then without matching logs counts as Sin marcar, even days before it was re-activated. Open question 1 asks whether to accept it (REQ-12, REQ-13).
- A log lists meal ids not in the plan, repeats an id, or is dated before the start or after today: ignored or counted once; the invariant holds (REQ-13, REQ-14).
- Midnight passes with the page open, or a save crosses midnight: see REQ-11. Dates are browser-local.
- 1 meal: one row, the card unchanged in size; 8 or more meals: REQ-7.
- Plan without times, or only some times: REQ-3. Very long meal name: REQ-1.
- All of today's meals checked: all Cumplida, no "Siguiente" (REQ-2).
- Save failure: rows and counts roll back with the dials and the existing toast "No se pudo guardar tu registro del día" shows once (REQ-6, REQ-16, REQ-20).
- A meal on screen in the hero while its day rolls over: its row stays the selected row; only the state resets (REQ-5, REQ-11).

## Non-functional requirements

- No new data, endpoint, migration or dependency; all figures come from data the dashboard already has plus the active plan version's creation date. No extra request on check-off.
- Accessibility: state and selection never by colour alone; forced colors keep rows, icons, the selected cue and the focus ring visible; the arc is an image with its text, like the dials; the selected row carries `aria-current="true"`. Contrast, in both themes and on both card tones: text, including the muted "Pendiente" and the time, at least 4.5:1 against the card; state icons, the selected cue and focus rings at least 3:1 (the plan picks the tokens and records the measured ratios).
- Responsive: compact layout up to 937px, wide from 938px (CLAUDE.md). Four figures up to four digits each (8 meals × 365 days) fit without clipping or overlap at 360px and at 200% zoom, light and dark.
- UI copy Spanish (Mexico), "tú"; no console errors.
- Tests (constitution 1): unit tests first for the count rules and the state derivation (REQ-2, REQ-12 to REQ-14, including the worked examples and the invariant). E2E, rewritten and run once per batch: the dashboard test "yellow and sky cards are static" (replaced by REQ-1 to REQ-6 and REQ-15, REQ-16), the dashboard fit and screenshot tests, the metric-dials clipped-cards test, and the visual snapshot "home" (regenerated after the user's visual check). New e2e: overflow with 8 meals at desktop, 938 to 1279px (for example 1100px) and phone width, auto-advance cancelled by a row click (REQ-23), phone row tap scroll with focus kept, no-plan state. The accessibility checks are named tests: keyboard path (Tab order, Enter and Space on a row, focus kept after a check-off), accessible names (list, rows and pager, REQ-4, REQ-20, REQ-21), measured contrast of text, icons and the selected cue in both themes (including "Pendiente"), forced colors (rows, icons, cue, focus ring visible), reduced motion (instant list scroll, no fade animation) and reduced transparency (dividers instead of fades).

## Notes for the plan

- The plan version's creation date is not in the dashboard's props today; the plan decides how it arrives, with no schema or endpoint change. The stored data has no activation date: the plan has `status` and `updated_at` (changes on any edit) and the version has `is_current` and `created_at`.
- `planContext` uses Mexico City time while the dashboard uses the browser's date; this feature uses the browser's (mixed clocks, accepted).
- Delete the made-up-hours fallback (D12) in `food.ts`.
- DESIGN.md §8.12 ("solo visuales") and the `// TODO: solo visual` comments need updating when this ships.
- E2E files to rewrite: `dashboard.spec.ts` (static-cards test, fit tests, screenshots), `metric-dials.spec.ts` (clipped-cards list), `a-theme-visual.spec.ts` ("home" snapshot).
- Measure the 56px default and the 336px cap (now applying up to 1279px, D16) against the current card (REQ-7) and adjust them there. Check the 938 to 1279px tier explicitly.
- The pager's accessible name changes from "Comidas de hoy" to "Elegir comida" (REQ-21, D17); update any e2e or selector that finds it by the old name.
- Moving the selection state out of the hero (REQ-5) must preserve the dot re-announce and the nearest-index clamp of a stale selection (REQ-22, D18), and a row click must cancel the pending auto-advance like a dot (REQ-23, D19).
- "Subir plan" opens the upload wizard behind "Procesar plan" as a button; no upload page exists (D15). Reuse the wizard's existing entry point.
- Housekeeping (D20): DESIGN.md and PRODUCT.md become tracked in git (no REQ).

## Backlog (future, not in this spec)

- Rating from shared recipes (multi-user phase): the star rating becomes real once several users share recipes and meals.
- Prep progress from Modo Cocina's stepper: store each started recipe's progress and show it per meal of the day, replacing the fixed 68%.
- The parser keeps the full time range ("7:00–8:00 a.m."), then the timeline can show it.

## Assumptions

- D11 in the grilling notes names "Resumen calórico" sky and "Cumplimiento del plan" butter; the code and DESIGN.md §8.12 have them the other way round (Resumen calórico yellow, Cumplimiento sky). This spec names cards by title and each keeps the colour it has today.
- The plan start is the creation timestamp converted to the browser-local date. "Desde <fecha>" is the creation (upload) date, not proof that the plan was used from then; the label stays short and makes no claim about use.
- "Siguiente" is the first unchecked meal in plan order, not by clock time (the parser keeps no end time and times may be missing).
- Copy not given in grilling is proposed and quoted in the REQs for Gate 1 (Open question 2). Figures are plain numbers without leading zeros (the old "05" was decoration).
- The arc shows no percentage figure (REQ-15); a numeric percentage would repeat Adherencia.
- Every planned meal has a hero slide, so every row can select one.
- "Same-row click" (D19) is read as a click on any timeline row, including the row of the meal already shown; whether a click on the shown meal's row re-announces it like its dot does (REQ-22a) is left to the hero's existing selection path, the timeline adds nothing.
- The 56px default row height, the 336px cap (up to 1279px) and the 16px fade are design defaults, not user decisions; the plan may adjust them after measuring, keeping the 44px minimum.
- Row hover and press follow dashboard-polish REQ-30 for the 150 ms normal-motion timing only; under reduced motion the same background change appears instantly (0 ms, no transition, no scale or translate); focus ring always shows.

## Open questions

None. Resolved at Gate 1 (2026-11-19):

1. **Plan start for a re-activated older version:** (a) accepted. Counts start at the version's creation date (D5). Re-activating an older version counts the days since then as Sin marcar; this is a known limitation (Edge cases). Storing an activation date (c) stays possible later as a separate change.
2. **Copy:** approved as written: "Subir plan" (a link at Gate 1; a button that opens the upload wizard since v1.2, D15, the copy unchanged), "Tu plan no tiene comidas", "X de Y comidas cumplidas", "Desde 12 nov" / "Desde 12 nov 2025", and the accessible name "07:00, Desayuno, Siguiente".

## Progress

- [x] US1 (P1): today's meal timeline (REQ-1 to REQ-11, REQ-18 to REQ-23)
- [x] US2 (P2): real plan-compliance counts (REQ-12 to REQ-17)
- [x] Housekeeping: superseded notes (D14), affected e2e rewritten, made-up-hours fallback deleted

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-19 | Initial spec from the grilling session (D1 to D14) |
| 1.1 | 2026-11-19 | Verify and checklist fixes: row sizing, fade, selected cue, long names, hover/focus, keyboard and announcements (new REQ-18 to REQ-20); quoted copy; REQ-17 narrowed to day 1; re-activation limitation as Open question 1; paths moved to Notes. Decisions unchanged |
| 1.1.1 | 2026-11-19 | REQ-18 and Assumptions: under reduced motion hover and press show the change instantly (no transition, scale or translate) instead of nothing; REQ-20: reuses REQ-24's "Guardando" then "Cumplida" or "Comida desmarcada" sequence, and a row activation onto an already-done meal adds no timeline message. Decisions unchanged |
| 1.1.2 | 2026-11-19 | Gate 1 approved: status approved; Open question 1 resolved as (a), copy approved as written |
| 1.2 | 2026-11-19 | Gate 2 decisions (D15 to D20): "Subir plan" is a button opening the upload wizard (REQ-10, REQ-15, REQ-19, D12 wording, Open question 2 note); REQ-7 list cap extended to 938 to 1279px; new REQ-21 (pager name "Elegir comida"), REQ-22 (hero selection behaviour unchanged), REQ-23 (row click cancels auto-advance); Notes for the plan, Tests and Assumptions updated. No REQ renumbered |

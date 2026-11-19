# Spec: Cooking mode

**Status:** partial (implemented on `feature/cooking-mode`; the e2e test is written and waits for the user to lift the e2e freeze, D10). Gate 1 approved 2026-11-17; Gate 2 (plan) approved 2026-11-17.
**Version:** 1.0.3 · **Branch:** feature/cooking-mode, from `alt-dashboard` · **Owner:** Rafael Martinez · **Date:** 2026-11-17

> The *what* and *why* only. UI copy is quoted in Spanish (Mexico). URLs are in English (project rule, 2026-11-17).

## Overview

The recipe page is built for reading at a desk: ingredients and steps sit in two panels, the text is small, and the phone screen turns off while the user cooks. A helper app should also work in the kitchen, with wet hands, the phone propped on the counter. "Modo Cocina" is a full-screen view of one recipe that walks through it in two phases, "gather what you need" then "one step at a time", with large type, big targets, the screen kept awake, timers when a step names a time, and voice commands so the user does not touch the phone. It ends where the user's day continues: marking the meal as done.

The data shapes the design. In the current data, 8 of 13 recipes have preparation steps, and those have 1 to 3 short steps (`recipeSteps` splits the plan's note into sentences). So the ingredient phase is not an extra: for many recipes it is the whole job, and a recipe with no steps must still have a useful Modo Cocina.

## Goals / Non-goals

- Goal: cook a recipe from the phone without touching small controls, scrolling or waking the screen (US1, US3).
- Goal: a friendly "before you start" screen with what to gather (US2).
- Goal: hands-free control with "siguiente", "atrás" and "repetir" (US6).
- Goal: a timer offered only on steps that name a time (US5).
- Goal: finish by marking today's meal as done, the same record the dashboard's "Marcar cumplida" writes (US4).
- Non-goal: editing a recipe or its steps inside Modo Cocina (the recipe page keeps "Editar").
- Non-goal: scaling portions. Quantities are always the nutrition plan's (user, Q5).
- Non-goal: any data-model, migration or API change, and any new dependency.

## Decisions

Q1 to Q7 answered by the user on 2026-11-17.

- D1 (Q1) Entry points: a "Modo Cocina" button on the recipe page and a "Modo Cocina" link on the dashboard hero's current meal.
- D2 (Q2) The first screen is a "before you start" page: what to gather, in a friendlier form than a checklist (welcoming title, the dish, illustrated rows, encouraging copy), still tappable to mark what is ready.
- D3 (Q3) A recipe without steps still opens Modo Cocina; the end screen offers "Marcar como hecha".
- D4 (Q4) Timers appear only on a step whose text names a duration; no timer otherwise.
- D5 (Q5) No portion scaling.
- D6 (Q6) Voice control is in this feature: at least "siguiente", "atrás" and "repetir". "Repetir" reads the current step aloud, so steps can be spoken by the app.
- D7 (Q7) Branch from `alt-dashboard`.
- D8 Own page at `/recipes/<id>/cook` (English URL, project rule), without the top bar, sidebar or assistant button: back and reload work, nothing competes for the screen.
- D9 Progress (current screen and checked ingredients) is kept in the browser for 12 hours per recipe: a reload or a locked phone must not lose the user's place. A convenience, not a record.
- D10 The e2e freeze stays (user, 2026-11-17). The e2e test is written last and run only when the user lifts the freeze; until then the status stops at `partial` (constitution principle 1).
- D11 (default) While voice control is on, each new step is read aloud once; "repetir" reads it again. Reason: with hands busy, hearing the step is the point of voice control.

## User stories

### US1 (P1): Open and leave Modo Cocina
As a user cooking from my phone, I want a full-screen view that keeps the screen on so that I can follow the recipe without touching the phone.

- **REQ-1:** The recipe page's summary shows a "Modo Cocina" button (chef hat icon) above "Agregar … al carrito". It opens `/recipes/<id>/cook` on the first screen, or on the saved screen (REQ-20).
- **REQ-2:** Modo Cocina shows no top bar, sidebar or assistant button. "Salir" (X, `aria-label="Salir del Modo Cocina"`), Escape and the browser's back button return to the recipe page.
- **REQ-3:** While Modo Cocina is visible the screen stays awake where the browser allows it; the lock is taken again when the tab becomes visible and released on exit. When the browser refuses or lacks it, a one-line note reads "Tu pantalla podría apagarse mientras cocinas." and nothing else changes.
- **REQ-4:** On the dashboard hero, the plate's middle dot (the white ring with a centre dot) is the "Modo Cocina" link for the meal on screen. Hovering or focusing it shows a "Modo Cocina" tooltip that rises and fades in; on touch screens the tooltip stays visible. The plate has no other dots: the decorative dots are removed. A meal with no recipe shows no dot. (User, 2026-11-17, v1.0.2; v1.0.3.)
- **REQ-5:** An unknown or deleted recipe id shows the app's 404, as the recipe page does.

### US2 (P1): Before you start
As a user, I want a friendly screen with everything I need so that nothing is missing halfway.

- **REQ-6:** The first screen is titled "Antes de empezar" with the dish name and illustration and a one-line intro ("Ten esto a la mano y lo demás será fácil."). It lists every ingredient with its icon, name and amount, in the recipe's order, as cards or rows at least 56 px tall that the user taps to mark as ready (a check appears; the row dims). A counter reads "3 de 6 listos".
- **REQ-7:** Names that cannot be read show "Ingrediente por revisar", as on the recipe page.
- **REQ-8:** "Empezar" is always enabled. When everything is marked, the counter reads "¡Todo listo!" and "Empezar" gains emphasis.
- **REQ-9:** A recipe with no ingredients skips this screen.

### US3 (P1): One step at a time
As a user, I want one step per screen in large type so that I can read it from arm's length.

- **REQ-10:** Each step is its own screen: "Paso 2 de 3", the step text (at least 28 px on desktop and 24 px on phones), a progress bar, and "Anterior" and "Siguiente" buttons at least 56 px tall in the bottom third. "Anterior" on step 1 returns to "Antes de empezar".
- **REQ-11:** Navigation also works with the arrow keys and Space (next) and a horizontal swipe on touch screens. Step changes are announced to screen readers.
- **REQ-12:** An "Ingredientes" button on every step opens the list over the step with the same marks; closing it returns to the same step.
- **REQ-13:** A recipe without steps shows, after "Antes de empezar", "Tu plan no incluye pasos para esta receta." with "Escribir los pasos" (the recipe page with its edit dialog open) and "Terminar".
- **REQ-14:** A step longer than the screen scrolls inside its own area; the buttons stay in place.

### US4 (P2): Finish and mark the meal
- **REQ-15:** After the last step (or "Terminar"), a "¡Listo!" screen shows the recipe name and "Volver a la receta".
- **REQ-16:** When the recipe is an option of one of today's meals (browser-local date, as the dashboard) not yet done, the screen also shows "Marcar como hecha (<comida>)", naming the first such meal in the plan's order. It writes the same record as the dashboard. Success: toast "<Comida> marcada como hecha" with "Deshacer". Failure: toast "No se pudo guardar tu registro del día"; the button stays.
- **REQ-17:** When that meal is already done: "Ya marcaste esta comida hoy." and no button.

### US5 (P2): Timers when a step names a time
- **REQ-18:** A step whose text names a duration (for example "10 minutos", "1 hora", "30 segundos", "media hora", "5 a 7 minutos") shows a "Temporizador 10 min" button; a range uses its upper bound. Steps without a duration show none.
- **REQ-19:** A started timer counts down on its step and as a chip ("Paso 2 · 08:41") on every other screen; tapping the chip returns to its step. It can be paused and cancelled. At zero: a sound, a vibration where supported, and "¡Tiempo! Paso 2" until dismissed. Timers stop when Modo Cocina is left.

### US1 (continued): Keep my place
- **REQ-20:** The current screen, marks and running timers' end times are kept for 12 hours per recipe; reopening resumes there with "Empezar de nuevo". Leaving from "¡Listo!" clears it. Discarded when the ingredient or step count changed. Works without resuming when the browser's storage is unavailable.

### US6 (P2): Hands-free voice control
- **REQ-21:** A "Control por voz" toggle (microphone icon) turns listening on and off; the state is visible ("Escuchando…"). It is shown only where the browser supports speech recognition; elsewhere a note reads "Tu navegador no permite control por voz."
- **REQ-22:** While listening, "siguiente" goes forward, "atrás" (also "anterior", "regresa") goes back, and "repetir" (also "repite", "otra vez") reads the current screen aloud in Spanish (Mexico). Matching ignores accents and case, and acts on a command word within a longer phrase ("ok, siguiente").
- **REQ-23:** While voice control is on, each new step is read aloud once when it appears (D11). "Antes de empezar" is read as the list of ingredients with their amounts.
- **REQ-24:** Listening restarts on its own after silence or a browser timeout while the toggle is on, and stops when Modo Cocina is left or the tab is hidden. A refused microphone turns the toggle off and shows "Permite el acceso al micrófono para usar tu voz."
- **REQ-25:** The app does not react to its own reading (listening pauses while it speaks).

## Edge cases and errors

- Recipe deleted while cooking: the next reload shows the 404 (REQ-5).
- Screen rotated: the layout reflows, the current step and timers are kept.
- Two timers at once (two steps with times): both run, the chip shows the one ending first and a count.
- A timer ends while the tab is hidden: the alert shows on return, with the time it ended.
- A command heard twice in one phrase ("siguiente siguiente") moves once.
- A duration under 10 seconds is not a cooking time and gets no timer: the plan's "10 disparos de 1 segundo de aceite en aerosol" is a spray, not a wait (REQ-18, clarified in 1.0.1).
- Speech recognition failing for another reason than a refused microphone (no network for the browser's service, for example) turns voice control off with "No se pudo usar el control por voz. Intenta de nuevo." (REQ-24, clarified in 1.0.1).

## Non-functional requirements

- No page scrollbar at 390×844, 1440×900 and 1920×1080 for steps up to 300 characters.
- Every control keyboard reachable with a visible focus ring; targets at least 44×44 px (56 px for the main buttons).
- Motion respects `prefers-reduced-motion`; light and dark themes use the existing tokens; text contrast at least 4.5:1.
- Voice: no audio leaves the device beyond what the browser's own speech service does; nothing is sent to the app's server or another AI service.
- UI copy in Spanish (Mexico); URLs in English; no console errors.

## Assumptions

- Screen Wake Lock works in current Chrome, Edge and Safari 16.4+; Firefox may lack it (REQ-3's note).
- Speech recognition is the browser's (Chrome, Edge, Safari); Firefox and Brave lack a working one (REQ-21's note). Speech synthesis (reading aloud) is available in all of them.
- Steps keep coming from `recipeSteps(recipe.description)`, as on the recipe page and in the assistant.

## Progress

- [x] US1 (P1) · [x] US2 (P1) · [x] US3 (P1) · [x] US4 (P2) · [x] US5 (P2) · [x] US6 (P2): built and checked in a browser with unit tests; e2e written, not run (freeze); phone check pending (`checklists/manual.md`).

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-17 | Draft with defaults |
| 1.0.3 | 2026-11-17 | User's request: the plate keeps only the Modo Cocina dot; the decorative dots are removed and a meal with no recipe shows no dot (REQ-4). |
| 1.0.2 | 2026-11-17 | User's request: the dashboard entry becomes the plate's middle dot with an animated tooltip (REQ-4); the Modo Cocina icon is a ring with a centre dot. |
| 1.0.1 | 2026-11-17 | Clarifications found while building, no behaviour the user approved changes: durations under 10 s get no timer; a non-permission recognition failure turns voice off with a message. |
| 1.0 | 2026-11-17 | User's answers: `/cook` URL, "Modo Cocina", friendly "Antes de empezar", timers from step text (US5), voice control (US6), base `alt-dashboard`, e2e freeze kept. Approved. |

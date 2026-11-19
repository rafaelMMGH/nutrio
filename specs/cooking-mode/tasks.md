# Tasks: Cooking mode ("Modo Cocina")

**Spec:** [spec.md](spec.md) v1.0 · **Plan:** [plan.md](plan.md) revision 1 · 21 tasks, approved 2026-11-17; done on `feature/cooking-mode` except running the e2e test (freeze) and the user's phone check.

Format: `- [ ] T### [P] [US#] Description (path)`. Commits reference task and REQ ids. Sub-batches of about 300 lines; review after each phase.

## Phase 1: Setup

- [x] T001 Create `feature/cooking-mode` from `alt-dashboard` once the user confirms the dials work is committed; baseline `npx tsc --noEmit` and `npm run test:unit` green.

## Phase 2: Pure rules (fail-first)

- [x] T002 [P] [US1-US4] Failing tests: screens, marks, meal choice, resume (REQ-6, 8, 9, 10, 13, 15-17, 20) (`tests/unit/cooking-logic.test.ts`)
- [x] T003 [P] [US5] Failing tests: durations (REQ-18) (`tests/unit/durations.test.ts`)
- [x] T004 [P] [US6] Failing tests: commands and read-aloud text (REQ-22, REQ-23) (`tests/unit/voice-commands.test.ts`)
- [x] T005 Implement `cooking-logic.ts`, `durations.ts`, `voice-commands.ts` until T002–T004 pass (`src/components/cooking/`)

## Phase 3: US1 Open, leave, stay awake (P1)

- [x] T006 [US1] `(cooking)` layout and `recipes/[id]/cook` page: session guard, recipe, 404, today's matching meals, logs (REQ-2, REQ-5)
- [x] T007 [US1] `useWakeLock` and the "Tu pantalla podría apagarse…" note (REQ-3)
- [x] T008 [US1] "Modo Cocina" button on the recipe page; exits by X, Escape, back (REQ-1, REQ-2)

## Phase 4: US2 + US3 Before you start, steps (P1)

- [x] T009 [US2] "Antes de empezar": friendly header, illustrated rows, marks, counter, "¡Todo listo!", skip when empty (REQ-6 to REQ-9) (`BeforeYouStart.tsx`, `cooking.css`)
- [x] T010 [US3] Step screens: "Paso n de m", large type, progress, buttons, inner scroll (REQ-10, REQ-14)
- [x] T011 [US3] Keys, swipe, announcements, "Ingredientes" overlay (REQ-11, REQ-12)
- [x] T012 [US3] "Sin pasos" screen and `?edit=1` opening the edit dialog (REQ-13)
- [x] T013 [US1] Resume and "Empezar de nuevo" (REQ-20)

**Checkpoint (stop for the user):** screenshots at 390×844 and 1440×900, light and dark.

## Phase 5: US4 + US5 Finish and timers (P2)

- [x] T014 [US4] "¡Listo!", "Marcar como hecha (<comida>)" with Deshacer and failure toast, "Ya marcaste…" (REQ-15 to REQ-17)
- [x] T015 [US5] `useTimers`, timer button on steps with a duration, countdown, pause, cancel, chip, alert at zero (REQ-18, REQ-19) (`useTimers.ts`, `TimerChip.tsx`)

## Phase 6: US6 Voice (P2)

- [x] T016 [US6] Export `recognitionCtor`; `useVoiceControl` with auto-restart, stop on hide, microphone refusal (REQ-21, REQ-24) (`useDictation.ts`, `useVoiceControl.ts`)
- [x] T017 [US6] `speak()`, read each new step and "repetir", pause listening while speaking; "Control por voz" toggle and states (REQ-22, REQ-23, REQ-25) (`speak.ts`, `CookingMode.tsx`)

## Phase 7: Entry from the dashboard and wrap-up

- [x] T018 [US1] Hero "Modo Cocina" link for the current meal (REQ-4) (`Hero.tsx`, `dashboard.css`)
- [x] T019 Write `tests/e2e/cooking-mode.spec.ts` with stubbed browser APIs; **do not run** while the e2e freeze holds (spec D10).
- [x] T020 Manual phone check list for the user (iPhone Safari, Android Chrome): voice in a noisy kitchen, wake lock, timer sound and vibration, swipe (`specs/cooking-mode/checklists/manual.md`)
- [x] T021 Spec Progress ticked, status `partial` (e2e pending the freeze), `BACKLOG.md` entry; stop for the user before any push.

**Stops for the user:** T001 (dials committed?), Phase 4 screenshots, T020 phone check, push.

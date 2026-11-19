# Tasks: Upload wizard stepper

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

Format: `- [ ] T### [P] [US#] Description (path/to/file)`. `[P]` means the task touches different files from the other `[P]` tasks in its phase and does not depend on them.

- After every batch, run `npx tsc --noEmit` and `npm run test:unit`.
- Write each test before the code it covers, and see it fail first.
- Write the e2e tests now, but do not run them while the freeze is on. T016 runs them.
- `W/` is short for `src/components/app/upload-wizard/`.

## Phase 1: Setup

- [x] T001 Setup. Three steps:
  1. Create `feature/upload-wizard-stepper` from `alt-dashboard`. Confirm the baseline: `npx tsc --noEmit` and `npm run test:unit` are green.
  2. Use the uiarc source in the session scratchpad as reference only. It is Free tier and MIT; do not commit it.
  3. Do a pure move of `UploadWizard`/`WizardStep` out of AppShell into the wizard folder, with no behavior change, and commit it on its own. (`W/UploadWizard.tsx`, `src/components/app/AppShell.tsx`)

## Phase 2: Foundational

None. The pure move in T001 is the only blocker.

## Phase 3: US1 (P1) Four-step wizard with vertical stepper and navigation

Batch 1a: pure logic and shared fixture (~250 lines)
- [x] T002 [P] [US1] Write failing tests for the stepper logic, then implement it. (`tests/unit/stepper-logic.test.ts`, `src/components/ui/stepper-logic.ts`)
  - `stepView` status and srStatus:
    - completada, disponible, sin iniciar and con error;
    - error on a locked step and on the current step;
    - Confirmar reads "disponible" after a jump back to Datos;
    - only Comidas can be "con error".
  - The current step has no srStatus and shows the "current" marker even when it was passed earlier.
  - `selectable` up to `furthest`, and `disabled`.
  - `announcement`: "Paso 3 de 4: Comidas".
  - `compactCaption`.
  - Covers REQ-2, REQ-3 and REQ-6.
- [x] T003 [P] [US1] Write the shared plan fixture, then failing tests for the wizard logic, then implement it. (`tests/shared/wizard-plan-fixture.ts`, `tests/unit/upload-wizard-logic.test.ts`, `W/upload-wizard-logic.ts`)
  - Fixture: 4 meals shaped like `STRUCTURED_PLAN`, 2 options needing review, no supplements, 1 recommendation. It imports nothing from Playwright, so `tsx --test` can load it (as with `progress-fixture.ts`).
  - `WIZARD_STEPS`: order and copy.
  - `goTo`/`next`/`prev`: a jump back keeps `furthest`; a locked target is refused.
  - `resetAfterChange`.
  - `uploadCounts`: meals, options, ingredients and complements of the shared fixture.
  - `nameMissing`.
  - `confirmChanges` returns the same payload as today.
  - Covers REQ-1, REQ-3, REQ-4 and REQ-5.

Batch 1b: Stepper (~300 lines; split if the diff exceeds ~300 lines)
- [x] T004 [US1] Write a failing contrast test for the stepper token pairs in light and dark: text at 4.5:1, and marker, connector and focus ring at 3:1. Then write the stepper styles until it passes:
  - prefixed classes;
  - upstream `--accent` mapped to `--brand`;
  - the focus ring;
  - a 44px hit area in compact mode;
  - a `prefers-reduced-motion` rule.
  
  Covers REQ-2, REQ-7 and REQ-19. (`tests/unit/stepper-contrast.test.ts`, `src/components/ui/stepper.css`)
- [x] T005 [US1] Adapt the uiarc Stepper and keep the MIT notice. Requirements:
  - it renders from `stepView`;
  - it accepts `furthest` and `disabled`;
  - strings are in Spanish, with no `completeLabel`;
  - roving arrow, Home and End keys over selectable steps, plus Enter and Space;
  - a polite announcement;
  - `useReducedMotion`;
  - local motion tokens.
  
  Covers REQ-3, REQ-6 and REQ-7. (`src/components/ui/stepper.tsx`)

Batch 1c: step bodies, wizard shell and layout (~290 lines; split if the diff exceeds ~300 lines)
- [x] T006 [US1] Write the step bodies first, so the shell can import them. (`W/SubirStep.tsx`, `W/DatosStep.tsx`, `W/ComidasStep.tsx`, `W/ConfirmarStep.tsx`)
  - Subir: the upload form, or the "PDF procesado" result with a `tabIndex=-1` heading, `uploadCounts` and "Cambiar PDF".
  - Datos: today's fields.
  - Comidas and Confirmar: today's content for now; US2 and US3 replace it.
  - Each step has its own heading ref.
  - Covers REQ-1, REQ-4 and REQ-11 (fields).
- [x] T007 [US1] Build the wizard shell on top of T006. (`W/UploadWizard.tsx`, `src/components/app/AppShell.tsx`, delete `src/components/ui/stepper-12.tsx`)
  - State: `{ step, furthest, data }`, `edits` and `busy`.
  - Stepper: `onStepSelect`, a vertical rail at 938px and up, compact at 937px and below.
  - Footer: Anterior; Siguiente, hidden before upload; Confirmar plan, disabled when the name is empty.
  - Busy state: disables every control, including the X.
  - X: closes without asking.
  - Cambiar PDF: DELETE, then reset on success; on failure, a toast and the result stays.
  - Confirm failure: a toast, and the wizard stays on Confirmar.
  - Focus refs for REQ-16. After an upload succeeds, the wizard stays on Subir and focus moves to the "PDF procesado" heading.
  - Covers REQ-1, REQ-4, REQ-5 and REQ-14 to REQ-17.
- [x] T008 [P] [US1] Write the layout CSS:
  - a flex column with a fixed header and footer;
  - scrolling content;
  - a 200px rail grid at 938px and up;
  - full width at 937px and below;
  - `overflow-wrap: anywhere`;
  - 44px footer buttons in compact mode.
  
  Then remove the obsolete wizard rules. Covers REQ-2, REQ-18 and REQ-19. (`W/upload-wizard.css`, `src/app/globals.css`)

Batch 1d: e2e, written but not run (~320 lines; split if the diff exceeds ~300 lines)
- [x] T009 [P] [US1] Update `openWizard` and the wizard entries for the 4 steps: file, result ("PDF procesado"), Datos, Comidas and Confirmar. (`tests/e2e/theme-palette.spec.ts`)
- [x] T010 [P] [US1] Write the navigation e2e tests. The upload response comes from `tests/shared/wizard-plan-fixture.ts`; DELETE and PATCH are mocked; see the plan. (`tests/e2e/upload-wizard.spec.ts`)
  - There is no Siguiente before upload, and Anterior is disabled.
  - After the upload, the wizard stays on Subir with focus on the heading, and the result shows again after Anterior.
  - A stepper jump keeps focus on the stepper; Siguiente moves focus to the heading.
  - Confirmar is not focusable from Datos.
  - An empty name disables Confirmar plan.
  - Cambiar PDF sends one DELETE, empties the form, focuses the file input and locks the steps.
  - The X closes the wizard with no prompt and no DELETE.
  - Confirming successfully closes the wizard and shows "Plan confirmado"; the captured PATCH body has the trimmed name and objective and `processing_status: "confirmed"`.
  - Covers REQ-1, REQ-3, REQ-4, REQ-5, REQ-16 and REQ-17.
- [x] T011 [US1] Write the failure, busy, layout and accessibility e2e tests in their own file (split from T010 to keep each file under about 300 lines; shared mocks and locators in `tests/e2e/upload-wizard-helpers.ts`). Each failure test lists its intended issues with `expectIssues` (two patterns per mocked 500; see the plan). (`tests/e2e/upload-wizard-checks.spec.ts`)
  - Delayed upload, PATCH and DELETE: the button shows busy; steps, Anterior, Siguiente, Cambiar PDF, the inputs and the X are disabled; a second click sends no request; controls come back afterwards (REQ-14).
  - PATCH 500: toast, the wizard stays on Confirmar, the edited name is intact, and focus is on "Confirmar plan" (REQ-15, REQ-16).
  - DELETE 500: toast, the result stays, and focus is on "Cambiar PDF" (REQ-4, REQ-16).
  - Upload 500: focus is on "Procesar PDF" (REQ-16).
  - Stepper found with `getByRole("navigation", { name: "Progreso" })` (REQ-6):
    - the current step has `aria-current="step"` and no status text, and the others do not;
    - sr status text: "completada" on passed steps, "sin iniciar" beyond `furthest`, and Confirmar reads "disponible" after reaching it and jumping back to Datos;
    - the polite live region reads "Paso N de 4: <label>" after each step change;
    - ArrowDown/ArrowUp (ArrowRight/ArrowLeft when compact), Home and End move focus among selectable steps only, and Enter and Space select the focused step.
  - At 1280px the rail's bounding box is 200px wide and the content column starts to its right; at 390px the stepper shows compact markers in the header and the content spans the full modal width (REQ-2).
  - Under `emulateMedia({ reducedMotion: "reduce" })`, the stepper has no running animations (REQ-7).
  - At 390px there is no horizontal scroll (REQ-18), and the compact marker and footer buttons are at least 44px by 44px (REQ-19).

**Checkpoint:** US1 is complete. tsc and the unit tests are green, and the e2e tests are written. Review, then continue, ship or stop.

## Phase 4: US2 (P2) Comidas review with collapsible cards (~230 lines)

- [x] T012 [US2] Write failing tests for `reviewCount` and `comidasError`, then implement them. Cases: no meals, 1 option, 2 options, and nothing to review. Covers REQ-10. (`tests/unit/upload-wizard-logic.test.ts`, `W/upload-wizard-logic.ts`)
- [x] T013 [US2] Build the Comidas cards and their styles. (`W/ComidasStep.tsx`, `W/DatosStep.tsx`, `W/UploadWizard.tsx`, `W/upload-wizard.css`)
  - Card header: a button with `aria-expanded`, showing name, time window and option count.
  - Body: options with ingredients and a confidence badge, add-ons, equivalents, and "Sin opciones detectadas".
  - Cards that need review start open, with the "Requiere revisión" label and a border.
  - Headers are 44px in compact mode and have a focus ring.
  - The Comidas `error` passes to the stepper as soon as data exists.
  - Datos shows "El nombre es obligatorio" inline and blocks Siguiente.
  - Covers REQ-8 to REQ-11, REQ-19 and REQ-20.
- [x] T014 [US2] Write the review e2e tests. (`tests/e2e/upload-wizard-review.spec.ts`; the old checks file was also split into `upload-wizard-checks.spec.ts` and `upload-wizard-layout.spec.ts`)
  - The error caption at 1280px.
  - The compact caption "2 opciones necesitan revisión" at 390px on Comidas.
  - The error marker shows while Comidas is locked, and the "Progreso" stepper's sr status for the locked Comidas reads "con error" (REQ-6).
  - The card is expanded and labelled, and Enter and Space toggle `aria-expanded`.
  - The card header is at least 44px at 390px.
  - Siguiente and Confirmar plan still work while Comidas is in error.
  - Covers REQ-6 (con error), REQ-8 to REQ-10, REQ-19 and REQ-20.

**Checkpoint:** US2 is complete. tsc and the unit tests are green.

## Phase 5: US3 (P3) Confirmar summary (~100 lines)

- [x] T015 [US3] Build the Confirmar summary and extend the e2e tests.
  - Summary: the name (with edits), kcal, meal and option counts, supplements, and recommendations in a collapsed button disclosure (same pattern as the US2 cards). Leave out any block with no data, and show the reuse note verbatim.
  - E2e: the note text, recommendations collapsed, and no supplements block.
  - Covers REQ-12 and REQ-13. (`W/ConfirmarStep.tsx`, `W/upload-wizard.css`, `tests/e2e/upload-wizard-confirm.spec.ts`)

**Checkpoint:** US3 is complete. tsc and the unit tests are green.

## Phase 6: US4 (P1, v1.3.2) File dropzone upload

Only the v1.3 difference plus the v1.3.1 decisions, the v1.3.2 shared Alert (Q23) and the identical-rejection rule (Q24); see the [plan's v1.3 section](plan.md#v13-delta-file-dropzone-us4). Size: medium, 16 tasks (T026 was merged into T027). Every logic task writes its tests first and sees them fail. Each batch is one commit unless it says otherwise.

Batch 4a: server limit and file checks (~215 lines)
- [x] T017 [US4] REQ-26: write failing tests, then `MAX_PDF_BYTES` (20 MiB), `PDF_TOO_LARGE` ("El PDF pesa más de 20 MB"), `BodyTooLarge` and `readCapped(body, declaredLength, limit)`; then the route reads through it before `ingestPdfPlan` and answers 413. (`tests/unit/body-limit.test.ts`, `src/lib/http/body-limit.ts`, `src/app/api/plans/upload/route.ts`)
  - Declared 20 MiB + 1: throws before the stream is pulled.
  - Exactly 20 MiB, declared or not: returns the bytes.
  - No declared length and a 64 KiB-chunk stream that errors if read past 21,037,056 bytes: throws `BodyTooLarge`, the reader is cancelled, the stream never errors.
  - Declared length below the real size: still capped.
- [x] T018 [US4] REQ-22: write failing tests, then `isPdf` and `checkFiles(files, hasRow)` returning the first rejection message or the file. (`tests/unit/upload-phase.test.ts`, `W/upload-phase.ts`)
  - Order: count (2 files, or 1 while a row exists), type, empty, size; one case per message, and a file failing several checks gets the earliest.
  - PDF rule: `application/pdf`; `PLAN.PDF` and `x.Pdf` with no type accepted; `image/png` and `plan.pdf.png` refused.
  - Size: exactly `MAX_PDF_BYTES` accepted, one byte more refused.

Batch 4b: XHR helper, then phase model, reason and size format (~310 lines in two commits: T020 ~120, then T019 ~190)
- [x] T020 [US4] REQ-23, REQ-24, REQ-26: write failing tests with a fake XHR, then `uploadWithProgress` and `UploadNetworkError`, and export `REQUEST_FAILED` from `api.ts` (no behavior change for `api()`). Lands first: T019's `failureReason` tests import both. (`tests/unit/upload-xhr.test.ts`, `src/lib/client/upload.ts`, `src/lib/client/api.ts`)
  - Sends POST with `Content-Type: application/pdf` and URI-encoded `X-File-Name`.
  - Progress percent; `onSent` on `upload.onload`.
  - 413 with JSON, empty and HTML bodies → `ApiError` status 413; 500 → `ApiError` with the body's `error`; 500 with an HTML body → `ApiError(REQUEST_FAILED, 500)`.
  - `onerror`/`ontimeout` (status 0) → `UploadNetworkError`; abort via `signal` → `xhr.abort()` and `AbortError`, with no later callback.
- [x] T019 [US4] REQ-4, REQ-14, REQ-15, REQ-16, REQ-21, REQ-22, REQ-23, REQ-24, REQ-26: after T020, write failing tests, then `uploadReducer`, `subirControls`, `failureReason` and `formatSize`. (`tests/unit/upload-phase.test.ts`, `W/upload-phase.ts`)
  - Transitions: add → uploading 0; progress is monotonic and only applies while uploading; sent → processing; done → processed; fail → failed with reason; reject413 → empty with the rejection; remove → empty from uploading, failed or processed; retry → uploading 0 with the same file; delete start → deleting, delete fail → processed with `rowError` "No se pudo quitar el PDF. Inténtalo de nuevo.", delete ok → empty; `rowError` cleared by the next delete start.
  - Rejection: `reject(message)` sets `rejection: { message, id }` and keeps the phase (413 also empties the row); a new rejection replaces the old one; add, remove and retry clear it. **Q24:** two `reject` events with the same message give different `id`s.
  - A stale `attempt` (after remove or retry) changes nothing: second ✕, late progress, late done.
  - `subirControls(phase)` equals the REQ-14 table, one assertion per row, `deleting` included.
  - `failureReason`: readable `ApiError` message kept; `ApiError` with `REQUEST_FAILED` or empty message → "error del servidor (500)" (and 502); `UploadNetworkError` and a fetch `TypeError` → "sin conexión con el servidor".
  - `formatSize`: 1,258,291 → "1.2 MB"; plus B, KB and ≥10 MB cases (upstream rules).

Batch 4c: contrast helpers and shared Alert (~240 lines; T021 is its own commit, ~60 moved lines)
- [x] T021 [US4] (refactor) Move the colour helpers (`declarations`, `resolve`, `rgb`, `luminance`, `contrast`) from `stepper-contrast.test.ts` into `tests/unit/contrast.ts` and import them there; no assertion changes. **Commit separately** from T033 and T022. `dial-contrast.test.ts` keeps its own copy on purpose (separate feature, out of scope). (`tests/unit/contrast.ts`, `tests/unit/stepper-contrast.test.ts`)
- [x] T033 [US4] REQ-4, REQ-15, REQ-19, REQ-22, REQ-25, REQ-26 (Q23): write a failing contrast test for the `.alert-live` aliases with the T021 helpers (tones `danger` and `warning` only, on the tone background, light and dark: title and body text 4.5:1, icon and edge 3:1), then `alert.css`, then adapt the uiarc Alert with the MIT header (Elia Kuratli) and a "Changes" note, per plan item 7. **Note:** `info` and `success` are kept from upstream, are unused, and are not tested. (`tests/unit/alert-contrast.test.ts`, `src/components/ui/alert.css`, `src/components/ui/alert.tsx`)
  - Props as upstream: `title`, `tone` (default `info`), `children?`, `open?`, `onDismiss?`, `...props`; motion tokens in a local const; Spanish dismiss label "Cerrar: <title>".
  - `role` (`alert` for danger, `status` otherwise) and `aria-atomic` on an always-mounted, unstyled `alert-live` wrapper; the presence box inside it.
  - Copy keyed by an internal open counter so each opening is a fresh insertion; the exiting copy `aria-hidden`; last title kept during the exit.
  - `alert-` classes only (never a bare `.alert`, `.danger`, `.warning`, `.title`, `.icon`; `globals.css` already has `.alert`); aliases onto `--danger-*`, `--warn-*`, `--text-1`, `--surface`, `--brand*`; dark block as in `stepper.css`; edge from `--danger-edge`/`--warn-text`, not `--warn-line`.
  - Reduced motion: `useReducedMotion` (instant, no height spring) plus a `prefers-reduced-motion` rule.

Batch 4d: dropzone styles (~150 lines)
- [x] T022 [US4] REQ-19, REQ-25: write a failing contrast test for `.fdz-root` aliases in light and dark (text 4.5:1: prompt, secondary, note, row name and meta, REQ-24 failure text; the rejection and row-error messages are the T033 Alert and are not styled here; non-text 3:1: dashed outline, drag-over outline, progress fill and track, ✕ icon and its spinner, focus ring), then write the styles. (`tests/unit/file-dropzone-contrast.test.ts`, `src/components/ui/file-dropzone.css`)
  - `fdz-` classes only; aliases onto `--brand*`, `--text-muted`, `--danger-text`, `--focus-ring`; dark override block as in `stepper.css`.
  - Row: grid with `minmax(0, 1fr)` name column, one-line ellipsis, size and ✕ never shrink; the row-error Alert sits below the row at full width.
  - Indeterminate bar keyframes; visible focus ring on the zone, ✕ and "Reintentar".
  - `@media (max-width: 937px)`: zone, ✕ and "Reintentar" at least 44px by 44px.
  - `prefers-reduced-motion`: no indeterminate animation and no drag-over transitions.

Batch 4e: dropzone component (~205 lines)
- [x] T023 [US4] REQ-4, REQ-14, REQ-21 to REQ-25: adapt the uiarc File dropzone into a controlled, single-file component with the MIT header and a "Changes" note. (`src/components/ui/file-dropzone.tsx`)
  - One button trigger: click, Enter and Space open the hidden input (no `name`, `tabIndex=-1`, `aria-hidden`); input value cleared after each change; an empty change does nothing.
  - Drop, picker and paste (armed by hover or focus-within; ignores text-only clipboards and editable targets) all call `onFiles` with every file, so the wizard runs `checkFiles`.
  - Prompt "Arrastra tu PDF aquí"; "Suelta el PDF para subirlo" while a file drag is over it **and there is no row** (with a row the normal prompt stays); "o elígelo desde tu equipo"; "Solo PDF · máximo 20 MB".
  - Row per phase from props, size from `file.sizeLabel`: "Subiendo… N%" with `role=progressbar` and `aria-valuenow`; "Procesando PDF…" with an indeterminate bar and no ✕; failure text "No se pudo procesar el PDF: <reason>" with "Reintentar"; processed ✓; **deleting**: ✕ shows a spinner, `aria-busy="true"`, disabled; under a processed row, `<Alert tone="warning" open={!!rowError} title={rowError ?? ""}>` (T033). ✕ names and tooltip per the plan. The REQ-24 failure text stays in the row, not an Alert.
  - Under the zone, `<Alert tone="danger" open={rejectionOpen} title={rejection ?? ""}>` (T033) replaces the own alert slot; no `onDismiss`. `rejectionOpen` comes from the wizard (T025, Q24), so the component does no re-open logic itself. Both Alerts stay rendered (closed) while their slot exists, so the live region is in place before a message arrives. A `role=status` polite region for the announcement prop.
  - `useReducedMotion` for the `TextSwap`; local motion tokens.

Batch 4f: Subir wiring (~265 lines; T024 and T025 land in the same commit, because T024 alone leaves `SubirStep` and `UploadWizard` out of step and `tsc` fails)
- [x] T024 [US4] REQ-4, REQ-21: rewrite Subir: heading "Sube tu PDF", the dropzone, and after processing the row plus the "PDF procesado" card (counts and review note as today, `tabIndex=-1` heading). Remove the intro paragraph, the `name="pdf"` input, "Procesar PDF" and "Cambiar PDF". (`W/SubirStep.tsx`)
- [x] T025 [US4] REQ-4, REQ-5, REQ-14, REQ-16, REQ-17, REQ-22 to REQ-26: split and wire, on top of T024. (`W/useSubirUpload.ts`, `W/UploadWizard.tsx`, `W/upload-wizard.css`)
  - **Split:** new hook `useSubirUpload({ onProcessed, onReset, refresh })` holds the reducer (including the rejection), `uploadWithProgress` with one `AbortController` per attempt, the 413 → reject413 mapping, the draft DELETE and the announcement string; it returns state, `rejectionOpen`, `onFiles`, `onRemove`, `onRetry` and the pending focus target. `UploadWizard.tsx` keeps navigation, confirm, layout and focus, and stays under ~200 lines.
  - `locked` covers uploading, processing, deleting and confirming; footer, X and stepper read `subirControls`.
  - `onFiles` → `checkFiles` → `reject` on a message; a rejection replaces the previous one and is cleared on the next add, the ✕ and "Reintentar" (reducer, T019).
  - **Q24:** when `rejection.id` changes while `rejectionOpen` is true, set it to false and back to true on the next animation frame (cancelled on unmount), so the Alert's open counter treats it as a new opening and the message is announced and shown again. No new Alert prop. The pure part (a new `id` per rejection) is unit-tested in T019; the effect is covered by T028.
  - Other errors and no response → failed row with `failureReason`, no toast; the "PDF procesado" success toast is removed.
  - Row ✕: abort, reset, or `DELETE` (failure → `rowError`, which the dropzone shows in its `warning` Alert, announced once by that Alert, focus ✕, no toast; `rowError` cleared by the next delete start; success → reset, `setEdits({})`, `refresh()`).
  - Focus: processed → "PDF procesado" heading; failed → "Reintentar"; removed, 413, retry, and the cancel ✕ unmounting while focused → dropzone; failed DELETE → ✕.
  - Polite announcements, once each: "Se agregó <nombre>", "PDF procesado: <nombre>", "No se pudo procesar el PDF: <motivo>". The delete failure is **not** put in the announcement string (its Alert announces it; two regions would announce it twice).
  - "Confirmar plan" shows `Loader2 .spin` while confirming.

Batch 4g: no-toast check and Confirmar without toasts (~85 lines)
- [x] T031 [US4] REQ-4, REQ-15, REQ-24, REQ-25: write the no-toast check first: no file in `W/` imports `sonner` or calls `toast`. Moved to batch 4f (T032 landed first in parallel, commit 542b0b2): write it first in 4f, where it fails on the remaining Subir toasts (upload success/failure, delete failure), and it passes once T025 removes them. T025 also adds the missing visible spinner on "Confirmar plan" (REQ-14, review of T032). (`tests/unit/upload-wizard-no-toast.test.ts`)
- [x] T032 [US4] REQ-15, REQ-16: replace both confirm toasts. (`W/UploadWizard.tsx`, `W/ConfirmarStep.tsx`, `W/upload-wizard.css`)
  - Failure: `confirmError` "No se pudo confirmar el plan: <motivo>" (`failureReason`) in `<Alert tone="warning" open={!!confirmError} title={confirmError ?? ""}>` (T033, `role="status"`) above the footer, always rendered (closed) on Confirmar so its region exists before a failure, no `onDismiss`; stay on Confirmar, keep edits, focus "Confirmar plan".
  - Cleared (`open` false) when "Confirmar plan" is pressed again, so a repeated failure is a fresh insertion and announced again, once; and on any step change.
  - Success: close and `refresh()`, no "Plan confirmado" toast. Remove the `sonner` import; T031 now passes.

**Checkpoint (code):** tsc and unit tests green (including T031); the wizard works by hand in the dev server (drop, pick, paste, cancel, retry, ✕ restart, the same image dropped twice, failed delete and confirm with no toast).

Batch 4h: e2e helpers and migration of existing tests (~280 lines)
- [x] T027 [US4] REQ-4, REQ-5, REQ-14 to REQ-16, REQ-21 to REQ-26: rework the e2e helpers, then migrate every test that used the file input, "Procesar PDF", "Cambiar PDF" or a wizard toast. (`tests/e2e/upload-wizard-helpers.ts`, `tests/e2e/upload-wizard.spec.ts`, `tests/e2e/upload-wizard-checks.spec.ts`, `tests/e2e/upload-wizard-confirm.spec.ts`, `tests/e2e/theme-palette.spec.ts`)
  - Helpers: `dropzone(page)`; `addPdf(page, file?)` through the `filechooser` event after clicking the dropzone; `dropFiles` and `pasteFiles` through an in-page `DataTransfer`; `rowRemove`, `retry`.
  - Helpers: `fakeUploadXhr(page)` (`addInitScript`, only for `POST /api/plans/upload`) with `progress(n)`, `sent()`, `respond(status, body)`, `drop()` and `aborted()`; `heldUpload(page)`, a `page.route` that holds the upload until `release(status, body)`, swallowing the fulfil error after an abort.
  - Helpers: `uploadPdf` adds the file and waits for focus on "PDF procesado"; remove `choosePdf`, `submitPdf`, `changePdf` and the `toast` locator; add `expectNoToast(page)` (`[data-sonner-toast]` count 0) and drop the sonner `pointer-events` style tag; `alertWith(page, text)` = `getByRole("alert").filter({ hasText })`, `statusWith(page, text)` = `getByRole("status").filter({ hasText })`, `expectNoAlert(page)` = no `alert` role with any text (the wrappers are always mounted, so never a bare count 0).
  - Empty Subir: heading, prompt, note, no intro and no "Procesar PDF" (REQ-21); no "Siguiente" (REQ-5).
  - "Cambiar PDF" test → processed ✕: one DELETE, dropzone empty and focused, Datos edits gone, steps locked (REQ-4).
  - Busy test → held upload in "Procesando PDF…": X, Anterior, stepper locked, no ✕, no second request (REQ-14). DELETE busy: the ✕ shows a spinner and `aria-busy`. Confirm busy: "Confirmar plan" shows a visible spinner (REQ-14).
  - Upload 500 → failed row "No se pudo procesar el PDF: <message>", "Reintentar" focused, `expectNoAlert`, no toast (REQ-24).
  - DELETE 500 → `statusWith("No se pudo quitar el PDF. Inténtalo de nuevo.")` count exactly 1, below the row, `expectNoAlert`; row and card stay, focus on the ✕, no toast (REQ-4, REQ-16, REQ-25).
  - PATCH 500 → `statusWith("No se pudo confirmar el plan: <message>")` count exactly 1, above the footer, `expectNoAlert`; still on Confirmar, edited name intact, focus on "Confirmar plan", no toast; Anterior clears it (count 0 after the exit); a second failing attempt shows it again (REQ-15, REQ-16, REQ-25).
  - Confirm success → the wizard closes, no "Plan confirmado" toast, PATCH body unchanged (REQ-15).
  - `theme-palette` `openWizard`: state 1 via `addPdf`; drop the toast comment. Its `/plans` "success toast"/"error toast" entries are outside the wizard and stay.

Batch 4i: dropzone e2e, adding and rejecting (~280 lines)
- [x] T028 [P] [US4] REQ-21, REQ-22, REQ-25, REQ-26. (`tests/e2e/upload-wizard-dropzone.spec.ts`)
  - Drag-over prompt and its reset on leave; with a processed row, drag-over keeps "Arrastra tu PDF aquí"; drop starts "Subiendo"; Enter on the zone opens the chooser; paste of a PDF with focus on the zone starts it; text-only paste does nothing.
  - The row shows the size as "1.2 MB" for a 1,258,291-byte file; the polite status reads "Se agregó plan.pdf".
  - Rejections with zero uploads: 2 files; a file while a row exists; an image; `PLAN.PDF` with no type accepted; 0-byte; 20 MiB + 1. `alertWith(message)` count 1, below the zone, one at a time (a new rejection replaces it), gone after the next add, ✕, "Reintentar" and closing the wizard; no `statusWith` holds the message; no toast.
  - **Q24:** two image drops in a row: after the first, mark the alert's text element in the page (a `data-` attribute via `evaluate`); after the second, `alertWith(message)` count 1 again and no marked element remains, so the alert reappeared as a new copy.
  - Mocked 413 with JSON, empty and HTML bodies: row removed, `alertWith("El PDF pesa más de 20 MB")`, dropzone focused, no toast (two declared issues each).
  - Under `reducedMotion: "reduce"` the rejection Alert has no running animations (contrast is unit-tested in T033).
  - Real server: `page.request.post` of 20 MiB + 1 byte → 413, plan list unchanged, no new file in `data/private-pdfs`.

Batch 4j: dropzone e2e, phases and outcomes (~325 lines; split T029 and T030 into two commits if larger)
- [x] T029 [P] [US4] REQ-14, REQ-16, REQ-23, REQ-25, REQ-26 with the fake XHR. **Limit:** these tests prove the wizard's reaction to XHR events, not `uploadWithProgress` against the browser's XHR; T020 and the real-XHR check in T030 cover that. (`tests/e2e/upload-wizard-phases.spec.ts`)
  - "Subiendo… 40%" with `aria-valuenow=40`; X, Anterior and stepper disabled; no "Siguiente".
  - Cancel ✕ ("Cancelar subida de plan.pdf"): aborted, row gone, dropzone focused; a second click and a late `respond(200)` change nothing.
  - `sent()` → "Procesando PDF…", no ✕; if the ✕ had focus, focus is on the dropzone.
  - 413 during "Subiendo": row removed, `alertWith("El PDF pesa más de 20 MB")`, dropzone focused, no toast.
  - Polite status: "Se agregó plan.pdf", then "PDF procesado: plan.pdf", once each; no toast.
- [x] T030 [P] [US4] REQ-4, REQ-17, REQ-19, REQ-23, REQ-24, REQ-25 with `page.route`. (`tests/e2e/upload-wizard-outcomes.spec.ts`)
  - **Real-XHR cancel:** `heldUpload` holds the request; the row shows "Subiendo"; the ✕ cancels; then `release(200, fixture)`: no "PDF procesado", no completion announcement, no processed row, no DELETE, and the plan list is unchanged (no draft). See the plan's risk row if Chromium reports the body sent early.
  - 500 with a message, 500 with an HTML body ("error del servidor (500)") and `route.abort("connectionreset")` ("sin conexión con el servidor"): failed row, "Reintentar" focused, `expectNoAlert` (REQ-24 is not an Alert), no toast, one polite announcement; "Reintentar" → "Subiendo", dropzone focused, then processed; failed-row ✕ sends no DELETE; X closes with no DELETE.
  - ✕ restart with a second plan of different counts: only its own counts and Comidas error show.
  - 120-character name at 390px: one line with ellipsis, full name in the accessible name and `title`, size and ✕ visible, no horizontal scroll.
  - At 390px: zone, ✕ and "Reintentar" at least 44px; focus ring visible on each in light and dark.
  - Reduced motion: "Procesando PDF…" bar has no running animation.

**Checkpoint:** US4 complete. tsc and unit tests green, e2e written. Review, then T016.

## Phase 7: Gate

- [x] T016 [US1][US2][US3][US4] When the user lifts the freeze, run the e2e suite: `theme-palette`, every `upload-wizard*` spec (including `-dropzone`, `-phases` and `-outcomes`), `dashboard` and `theme-switch`. Confirm:
  - the declared guard patterns for 413 and connection reset match what Chromium reports;
  - the T030 real-XHR cancel reaches "Subiendo" with a held route (otherwise apply the CDP upload throttle from the plan's risk table);
  - no wizard test sees a `[data-sonner-toast]`;
  - the Alert role checks (`alert` for rejections, `status` for the delete and confirm failures) pass as written.
  
  Fix the test, not the behavior, if a pattern differs. It must pass before merge. (`npm run test:e2e`)

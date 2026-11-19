# Plan: Upload wizard stepper

**Spec:** [spec.md](spec.md) · **Version:** 1.3.2 · **Branch:** `feature/upload-wizard-stepper` from `alt-dashboard` · **Size:** small (v1.2.x, built); medium (v1.3 delta, 16 tasks, see the last section)

> **Note:** the [v1.3 delta](#v13-delta-file-dropzone-us4) at the end supersedes the "Client only", "Procesar PDF", "Cambiar PDF" and toast text in the sections above, which describe the built v1.2.3 scope.

## Approach

Client only: the parser, API routes, data model and confirm payload stay as they are.

1. A pure move takes `UploadWizard` out of `AppShell.tsx` into `src/components/app/upload-wizard/`, with no behavior change, in its own commit.
2. That folder becomes the 4-step wizard: the `UploadWizard.tsx` shell (state `{ step, furthest, data }`, `edits`, `busy: null | "upload" | "confirm" | "delete"`, footer, focus refs, layout) plus one body per step (`SubirStep`, `DatosStep`, `ComidasStep`, `ConfirmarStep`). Every file stays at or under about 200 lines.

**Stepper.** The uiarc Stepper (`https://uiarc.dev/r/stepper.json`, Free, MIT) is adapted into `src/components/ui/stepper.tsx`, replacing the single-use `stepper-12.tsx`; the file keeps a header with the source URL and MIT notice. Adaptations: a `furthest` prop (selectability and connector fill), a "disponible" status, no `completeLabel`, a one-line compact caption `error ?? label`, motion tokens in a local const.

**Logic.** All decisions are pure and unit-tested first, in `src/components/ui/stepper-logic.ts` and `upload-wizard/upload-wizard-logic.ts`; components only render what these return.

**Layout.** At 938px and up, a 200px rail beside a scrolling content column, header and footer outside the scroll. At 937px and below, `useMediaQuery("(max-width: 937px)")` puts a `horizontal compact` stepper in the header (server snapshot `false` is safe: the modal opens only on click).

**CSS.** Plain CSS with `stepper-`/`uw-` prefixes (no bare `.ring`/`.fill`/`.label`, which Tailwind v4 turns into utilities). Upstream `--accent` maps to `--brand`. Reduced motion: `useReducedMotion` plus a `prefers-reduced-motion` rule.

## Components

| Component | Change | Files |
|---|---|---|
| Stepper and its logic | new (`stepper-12.tsx` deleted) | `src/components/ui/stepper.tsx`, `stepper.css`, `stepper-logic.ts` |
| Wizard shell, steps, logic, CSS | moved, then rewritten | `src/components/app/upload-wizard/*` |
| AppShell | imports the wizard; `openUpload` sets `{ step: 0, furthest: 0, data: null }` | `src/components/app/AppShell.tsx` |
| Old wizard rules | removed if unused | `src/app/globals.css` |

## Interfaces

- **Stepper props:** `steps: { id; label; description?; error? }[]` (only Comidas ever gets `error`), `current`, `furthest`, `orientation?`, `onStepSelect?`, `details?`, `compact?`, `disabled?`, `label?`, `className?`.
- **`stepView(i, { current, furthest, error, disabled })`** → `{ status, marker, srStatus, selectable }`. Error wins ("con error"), even when locked or current. Otherwise the current step gets `aria-current="step"`, `srStatus: null` and the current marker even if passed; before `furthest` is "completada" (check), at `furthest` "disponible", after it "sin iniciar". `selectable = i <= furthest && !disabled`; locked steps get `tabIndex=-1` and are skipped by roving keys.
- **Stepper helpers:** `announcement` ("Paso N de 4: <label>"), `compactCaption`.
- **Wizard logic:** `WIZARD_STEPS`, `goTo`/`next`/`prev` (keep max `furthest`, refuse locked), `resetAfterChange`, `uploadCounts`, `reviewCount`, `comidasError`, `nameMissing`, `confirmChanges` (same payload as today). After a successful "Procesar PDF" the wizard stays on Subir and focus moves to the "PDF procesado" heading (`tabIndex=-1`).

## Data model / Dependencies

No change. `motion@14.14.0` is already installed and used in `DetentDial.tsx`.

## Testing strategy

- **Unit, fail first** (`node:test` via `npm run test:unit`): `stepper-logic.test.ts` (REQ-2, 3, 6), `upload-wizard-logic.test.ts` (REQ-1, 3–5, 10), `stepper-contrast.test.ts` on the `dial-contrast` pattern (REQ-19). `npx tsc --noEmit` after each batch.
- **Shared fixture:** `tests/shared/wizard-plan-fixture.ts` (the existing convention for data used by both suites, e.g. `progress-fixture.ts`): a 4-meal plan shaped like `STRUCTURED_PLAN`, 2 options needing review, no supplements, 1 recommendation. Unit tests use it for `uploadCounts`; e2e uses it as the mocked upload response.
- **E2E:** update `theme-palette.spec.ts`, add `upload-wizard.spec.ts`; written now, not run during the freeze, T016 gates the merge. No PDF fixture exists and a real upload would archive the clone's active plan, so `page.route` mocks `POST /api/plans/upload` and `DELETE`/`PATCH /api/plans/<id>` (200, 500, or held for busy tests).
- **Guard** (`tests/e2e/fixtures.ts`): intended failures are declared with `expectIssues(...)` (a multiset); each mocked 500 adds `METHOD /api/plans/… → 500` and `/Failed to load resource.*500/`, as in `assistant-next-step.spec.ts`.
- **Known gap:** the REQ-4 outcome "the draft appears in the Papelera" relies on the existing soft-delete endpoint and is not tested end to end; no existing e2e test asserts a deleted plan in `/trash` (`theme-helpers.ts` only visits the page).

## Risks

- Focus falls to `body` while busy buttons are disabled: set focus in an effect once `busy` clears.
- Mocks drift from the real API: the fixture mirrors the `ingestPdfPlan` result theme-palette already uses.
- E2E not run during the freeze: unit tests cover the logic; T016 gates the merge.

## v1.3 delta: file dropzone (US4)

**Size: medium** (16 tasks). Plans only the difference from v1.2.3 ([spec change log](spec.md#change-log)): the v1.3.1 decisions (no toasts in the wizard, copy, size format, drag-over with a row), the v1.3.2 shared Alert (Q23) and the identical-rejection rule (Q24). `W/` is `src/components/app/upload-wizard/`. Where it conflicts with the sections above, this section wins. No new dependency: `motion@14.14.0` and `lucide-react` are installed; the uiarc sources (dropzone, Alert, motion tokens) are reference only and not committed.

### Approach

1. **Server limit first.** A pure `readCapped(body, declaredLength, limit)` in `src/lib/http/body-limit.ts` throws `BodyTooLarge` when `Content-Length` exceeds 20 MiB (body cancelled unread) or, with no or a wrong length, cancels the reader once more than 20 MiB has arrived. The upload route calls it before `ingestPdfPlan` and maps `BodyTooLarge` to `json({ error: "El PDF pesa más de 20 MB" }, 413)`, so nothing is written. It takes the stream and header, not a `Request`, so the unit test controls `content-length`. Middleware matches only `/` (verified), so Next's 10 MB middleware body buffer does not apply.
2. **Pure client logic** in `W/upload-phase.ts` (keeps `upload-wizard-logic.ts` under 200 lines): `isPdf`, `checkFiles(files, hasRow)` in REQ-22 order; `uploadReducer` over `{ phase, file, progress, failure, rowError, rejection, attempt }` with phases `empty | uploading | processing | processed | deleting | failed`; `subirControls(phase)` returning one REQ-14 table row. Events carry their `attempt` and stale ones are ignored, which gives "a second click or a late completion does nothing" (REQ-14, REQ-23) without timers. `rejection` is `{ message, id } | null`; every `reject` (file check or 413) bumps `id`, even for the same message (Q24). Also `failureReason(err)` (readable `ApiError` message → itself; `REQUEST_FAILED` or no message → "error del servidor (<status>)"; `UploadNetworkError` or a fetch `TypeError` → "sin conexión con el servidor") and `formatSize` (upstream `formatFileSize` rules, "1.2 MB"); the wizard passes a `sizeLabel`, so the ui component stays dumb.
3. **XHR helper** `uploadWithProgress(url, file, { onProgress, onSent, signal, createXhr? })` in `src/lib/client/upload.ts`: today's headers (`Content-Type: application/pdf`, URI-encoded `X-File-Name`); `upload.onprogress` → percent; `upload.onload` → `onSent` ("Procesando PDF…", so the ✕ goes when the body is sent); non-2xx → `ApiError(body.error || REQUEST_FAILED, status)`, `REQUEST_FAILED` exported from `api.ts`; `onerror`/`ontimeout` → `UploadNetworkError`; abort → `xhr.abort()` and `AbortError`. `createXhr` is the test seam (Node has no XHR). The wizard maps `status === 413` to a rejection whatever the body.
4. **Dropzone.** The uiarc File dropzone (`https://uiarc.dev/r/file-dropzone.json`, MIT, Elia Kuratli) becomes `src/components/ui/file-dropzone.tsx` + `.css` (MIT header as in `stepper.tsx`), **controlled and single-file**: the wizard owns phase, progress, failure and rejection; the component renders the button trigger (hidden input, `tabIndex=-1`, no `name`), drag depth counting, paste armed by hover or focus-within, the `TextSwap` prompt, one row, the rejection Alert and a polite status region. Props: `phase`, `file?: { name; sizeLabel }`, `progress`, `failure?`, `rowError?`, `rejection?`, `rejectionOpen`, `announcement`, `onFiles(files)`, `onRemove()`, `onRetry()`, refs `dropRef`, `rowXRef`, `retryRef`; never disabled (REQ-14). Copy from REQ-21 to REQ-24; ✕ names "Cancelar subida de <name>" (uploading) and "Quitar <name>" (otherwise), tooltip "Quitar y empezar de nuevo" when processed; in `deleting` the ✕ shows a spinner, `aria-busy`, disabled. Drag-over says "Suelta el PDF para subirlo" only with no row. Dropped from upstream: multi-file list and arrow keys, thumbnails, `compactAt`/`listPlacement`, glow and wash, SVG edge (a CSS dashed border instead), shake. CSS: `fdz-` classes, `.fdz-root` aliases onto `--brand*`, `--text-muted`, `--danger-text`, `--focus-ring`, dark block as in `stepper.css`, 44px targets under `max-width: 937px`, reduced motion stops the bar and drag-over transitions. If it passes ~200 lines, the row splits into a local `FdzRow`.
5. **Wizard wiring.** `SubirStep` renders "Sube tu PDF", the dropzone and, when processed, the "PDF procesado" card; no intro, "Procesar PDF" or "Cambiar PDF". A new hook `W/useSubirUpload.ts` owns the reducer, the XHR call and its `AbortController`, the 413 mapping, the draft DELETE and the polite announcements, so `UploadWizard.tsx` stays under ~200 lines. `locked = phase ∈ {uploading, processing, deleting} || confirming`. Row ✕ by phase: abort, reset, or `DELETE /api/plans/<id>` (failure → `rowError` in a `warning` Alert under the row, focus ✕). **Q24:** when `rejection.id` changes while the alert is open, the hook sets `rejectionOpen` false and back to true on the next animation frame, so the Alert counts a new opening and re-announces and re-shows the message; no new Alert prop. `pendingFocus`: `heading | dropzone | retry | rowX | result | confirm`. "Confirmar plan" gets `Loader2 .spin` while confirming.
6. **No toasts in the wizard.** Every `toast` call and the `sonner` import leave `W/`. Confirm failure → `confirmError` ("No se pudo confirmar el plan: <motivo>") in a `warning` Alert above the footer; cleared on the next press and on any step change; step, edits and focus on "Confirmar plan" kept. Success closes and calls `refresh()`. Toasts outside the wizard are untouched.
7. **Shared Alert (Q23).** The uiarc Alert (`https://uiarc.dev/r/alert.json`, MIT, Elia Kuratli) becomes `src/components/ui/alert.tsx` + `alert.css` with the MIT header and a "Changes" note; upstream props (`title`, `tone`, `children?`, `open?`, `onDismiss?`, `...props`). Three uses (Constitution 3): rejection (`danger`, under the zone), delete failure and confirm failure (`warning`). The REQ-24 failed row is not an Alert. The wizard never passes `onDismiss`; each alert closes through `open`. Adaptations so each opening is announced once:
   - `role` (`alert` for danger, `status` otherwise) and `aria-atomic` sit on an always-mounted wrapper `div.alert-live`, with the animated box inside, because an inserted pre-filled `role="status"` is often skipped. The copy is keyed by an internal open counter (closed → open), the exiting copy is `aria-hidden`, and the last title is kept while closing.
   - `alert-` classes only (a bare `.alert` would pick up `globals.css` line 607); plain CSS with literal spacing; `.alert-live` aliases onto `--danger-*`, `--warn-soft`/`--warn-text`, `--text-1`, `--surface`, `--brand*`, dark block as in `stepper.css`, edge not `--warn-line` (under 3:1). Dismiss label "Cerrar: <title>". Reduced motion: `useReducedMotion` plus a media rule. `info` and `success` are kept from upstream but unused and not contrast-tested.

### Components

| Component | Change | Files |
|---|---|---|
| Upload limit | new helper; route returns 413 | `src/lib/http/body-limit.ts`, `src/app/api/plans/upload/route.ts` |
| Phase model, file checks, reason, size | new | `W/upload-phase.ts` |
| XHR upload | new; `api.ts` only exports `REQUEST_FAILED` | `src/lib/client/upload.ts`, `src/lib/client/api.ts` |
| Dropzone and shared Alert | new, adapted from uiarc | `src/components/ui/file-dropzone.tsx`/`.css`, `alert.tsx`/`.css` |
| Wizard | hook split out, rewired, toasts removed | `W/useSubirUpload.ts`, `W/SubirStep.tsx`, `W/ConfirmarStep.tsx`, `W/UploadWizard.tsx`, `W/upload-wizard.css` |
| Contrast helpers | extracted (a 3rd copy would appear); `dial-contrast.test.ts` keeps its own | `tests/unit/contrast.ts` |

### Testing strategy

- **Unit, fail first:** `body-limit.test.ts` (REQ-26), `upload-phase.test.ts` (REQ-22 order, reducer and stale attempts, Q24 rejection `id`, `subirControls` row by row, `failureReason`, `formatSize`), `upload-xhr.test.ts` with a fake XHR, `file-dropzone-contrast.test.ts` and `alert-contrast.test.ts` (`danger` and `warning` only, light and dark, via `tests/unit/contrast.ts`), `upload-wizard-no-toast.test.ts` (static: no `sonner` in `W/`; the fail-first proof while e2e is frozen).
- **E2E (written, not run):** `page.route` for outcomes through the real XHR (200, 500, 413 with JSON/empty/HTML, connection reset); an `addInitScript` fake XHR for mid-transfer states, since a routed body is buffered and progress jumps to 100%. The fake proves the wizard's reaction, not the XHR wiring; T020 and one real-XHR cancel in T030 cover that. The server limit is hit with `page.request.post` (20 MiB + 1). Alerts and toasts are asserted through the T027 helpers (role plus text, never a bare count 0, because the wrappers are always mounted).
- **Guard:** 413 adds `POST /api/plans/upload → 413` and `/Failed to load resource.*413/`; 500 the two existing patterns; a reset `/Failed to load resource.*ERR_CONNECTION_RESET/`. Fake-XHR and `page.request` tests declare nothing. Inferred patterns; T016 confirms them.
- **Known gaps:** "exactly 20 MiB is processed" is unit-only (no PDF fixture). The same-instant cancel race and an early 413 seen as a network error are accepted in the spec (REQ-23, REQ-24). Screen-reader announcement itself is not automatable.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A routed upload never shows "Subiendo… N%" | phase tests vacuous | fake XHR for mid-transfer states; route only for outcomes |
| Guard patterns for 413/reset differ in Chromium | false failures at T016 | declared per test; adjust at T016 |
| Focus lost when the cancel ✕ unmounts at 100% | focus on `body` | on `sent`, if the ✕ has focus, queue `dropzone` focus |
| A held route lets Chromium fire `upload.onload` early | T030 real-XHR cancel cannot cancel | assert "Subiendo" first; else throttle with CDP `Network.emulateNetworkConditions` in that test |
| Repeated identical alert (confirm failure twice, Q24 rejection twice) not re-announced | REQ-15/REQ-22 missed | `open` goes false between them; the open counter re-keys the copy inside the always-mounted region; e2e checks the copy is replaced |

### Constitution check

1 unit tests fail first per batch, e2e gated by T016. 3 contrast helpers extracted because a third copy would appear; the Alert has three uses; `createXhr` has the real call and the test. 4 no dependency. 6 every XHR outcome is mapped; a failed DELETE or confirm shows an inline, announced message with its reason. 7 one batch per commit (4b in two); the helper extraction (T021) is its own commit.

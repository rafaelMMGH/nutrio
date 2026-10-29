# Tasks: Assistant data scope

**Spec:** [spec.md](spec.md) (v1.5) · **Plan:** [plan.md](plan.md) · **Contract:** [contracts/chat-api.md](contracts/chat-api.md)

Format: `- [ ] T### [P] [US#] Description (path/to/file)`. `[P]` = parallel with other `[P]` tasks in the same batch (different files, no shared dependency). IDs T066–T068 were added in plan revision 2; T069–T070 in revision 3; T071 in revision 4; T072 in revision 5 (the scope-free API tests, split out of T008 so T008 runs on unchanged code). They sit where they run.

**Batches:** each `Batch` is one implement/review cycle ending in a **Review checkpoint**. Sizes below include tests.

**Gate per batch:** `npx tsc --noEmit`, the affected spec files while iterating, then one full `npm run test:e2e`. Exception, the red window: Batches 1a1, 1a2 and 1b1 run tsc plus the explicit spec lists in their checkpoints (and, from 1a2, the red-list check); the full run gates the end of 1b2.

**Red-window rules (1a1 to 1b2):**
- `tests/e2e/.red-window.txt` (committed by T008) lists, one per line, the exact `<file> › <title>` of every test expected to fail, copied from `npx playwright test --list` output.
- Each line may end with ` # <matched string>`; that suffix is a comment. The check strips everything from ` # ` to the end of the line (and surrounding whitespace) before comparing titles.
- At the 1a2 and 1b1 checkpoints: failing titles ⊆ the file. A failing test not in the file is handled in exactly one of two ways, both named in the batch note:
  - (a) If it is a UI test of UI this batch removed (scope menu, filter button, chips, header row 2), it is fixed in the same batch: the test edit (file and title) is named in the batch note.
  - (b) Otherwise, if and only if the failure is traced to the intentional scope/chip removal or the intentional wire/kind change, the orchestrator adds its title to the file with a one-line reason in the batch note.
  - Anything else is a regression and blocks the checkpoint.
- From 1a2 on, a listed test that passes is removed from the file in that batch and named in the batch note. At 1a1 the code is unchanged, so every listed test still passes and stays listed.
- `test.skip`, `test.fixme`, `test.fail` or deleting a listed test to make it "pass" is forbidden in 1a1, 1a2 and 1b1 (the reviewer greps the diff); listed tests are rewritten or deleted only by T013 in 1b2, which also deletes the file. assistant-api.spec.ts is never on the list: T008 prunes it on unchanged code (1a1) so it is green at every checkpoint, and each title it deletes is named in the 1a1 batch note with the task that supersedes it.
- Snapshot-only failures (`toHaveScreenshot`) in assistant-look and a-theme-visual confined to the assistant panel or the dashboard search bar are not red-list items: they follow the Snapshots rule. Any other failure in those specs follows the unlisted-failure rule above.

**Global rules:**
- e2e runs are sequential (one cloned DB). Never two at once, never left in the background.
- Every new or changed test is shown red by temporarily breaking the code it protects.
- Commits are path-limited and per task, tests first then code; messages cite US, T and REQ IDs. chat.ts, chat-intent.ts, chat-meals.ts and chat-metrics.ts are edited across stories: commit a task before the next task touches the same file, never `git add -A`. No `specs/` in commits unless the user asks.
- Never run `next build` in place, never add packages other than T025, no migrations.
- Copy is verbatim from spec Copy (es-MX).
- The assistant-api.spec.ts tests T008 keeps assert the old top-level `lead`/`sections` (kept until T016) and copy that 1a2 does not change. A later task that changes behavior or copy one of them asserts rewrites that test first, in the same task, and names it in its batch note; T016 moves any remaining top-level `lead`/`sections` assertions to `blocks`.
- `resolved` (test-only, plan D2) may be asserted while a builder is pending, but no REQ is covered by it alone; each REQ's text assertion is listed in the Coverage table.
- **Known failures on main** (not this feature): `dashboard.spec.ts:91`, `dashboard.spec.ts:213` (data-dependent), and the `a-theme-visual` cart snapshot. List them in every batch note.
- **Snapshots:** whether a diff is confined to the assistant panel/FAB or the dashboard search bar (REQ-4) is judged by the reviewer from the diff image and listed per test name in the batch note. Confined diffs are reported to the orchestrator; a diff elsewhere is a regression. There are exactly two refreshes, each run with `--update-snapshots` only after the user's explicit yes for that refresh: T071 at the end of Batch 1b2 and T057 at the end of Batch 6c.
- **prompt-kit attribution** (copied or adapted files): `// Adapted from prompt-kit (https://github.com/ibelick/prompt-kit), MIT License` plus the verbatim copyright line.

## Phase 1: Setup

- [ ] T001 [setup] Create `feature/assistant-data-scope` from `main` (local, no push).
- [ ] T002 [setup] Baseline: `npx tsc --noEmit` and a full `npm run test:e2e`. Record the pass/fail list (expect only the known failures). Nothing is committed.

## Phase 2: Foundational (blocks all stories)

**Batch F1a: harness**, about 240 lines

- [ ] T003 [P] [foundational] e2e server env and log (playwright.config.ts, .gitignore)
  - `E2E_HOOKS: "1"` in `webServer.env`; `webServer.command` = `sh -c "npx next dev -p 3200 2>&1 | tee tests/e2e/.server.log"` (plan D5); gitignore the log.
  - First-run check after the suite ends: no `next` process holds :3200 (`lsof -i :3200` empty) and no `<name>-e2e` database remains (`psql -l`). Record it in the batch note; if either is left over, stop and report.
- [ ] T004 [P] [foundational] Harness (tests/e2e/assistant-helpers.ts)
  - `seedPlan` default fixture (plan Testing strategy): 19 generic names across the slots, "Pollo asado", "Ensalada de pollo", "Sándwich de atún", and distractors that must not fire. Recipes with ingredients (qty/unit/none), descriptions, `meal_options`, `plan_version_recipes`, add-ons with `add_on` usages. `meals` override for duplicate slots and other counts. No real data.
  - New: `seedLogs(rows)`, `setGoals({weight, days})`, `setName(name)`, `ask(request, message, { today?, fail?, trace? })` (headers). Until T008 the third parameter also accepts the legacy scope string (with `recipeId` fourth) so assistant-api.spec.ts compiles unchanged; T008 removes the string form and the `ScopeKey` use in `ask`. `pinToday(context, date)`, `serverLog()` (offset + `since()`), `resendSweep(request, answers)` (plan Testing strategy).

**Review checkpoint F1a:** helpers compile; existing suite green (helpers unused yet).

**Batch F1b: test hooks, 500 path (chat-polish REQ-23)**, about 250 lines

- [ ] T005 [chat-polish REQ-23] Tests (tests/e2e/assistant-errors.spec.ts)
  - Injected failure → 500, body has no internal text, the log has route, user id, message length and stack.
  - 501 characters → 400 with issues and no log entry.
  - Malformed JSON body (e.g. `{"message":`) → 400, not 500, and no error-level log entry. Shown red first.
  - Panel: 500 shows "Algo salió mal al responder. Intenta de nuevo." with Reintentar (retry works); 400 keeps "No pude responder en este momento.". Injection through the UI: `page.route("**/api/rag/chat", r => r.continue({ headers: { ...r.request().headers(), "x-e2e-fail": "chat" } }))` for the 500 (unroute before Reintentar so the retry succeeds), and `r.continue({ postData: '{"message":' })` for the 400. The UI itself never sends any `x-e2e-*` header.
  - Node-side: `testHooks()` with a non-test env (no `E2E_HOOKS`, or `NODE_ENV=production`) ignores `x-e2e-fail`, `x-e2e-today` and `x-e2e-trace`.
- [ ] T006 [chat-polish REQ-23] Server (src/lib/server/test-hooks.ts, src/app/api/rag/chat/route.ts)
  - `testHooks(headers, env)` per plan D4; the route reads headers only through it.
  - Route: JSON parse or zod failure → `badRequest`. Anything after → inline 500 with `console.error` (plan Interfaces). The `fail` hook throws inside the builder call.
- [ ] T007 [chat-polish REQ-23] Client (src/lib/client/api.ts, src/components/app/assistant.tsx, src/components/shared/AssistantTurn.tsx)
  - `ApiError` with `status` (message unchanged for other callers).
  - The error turn records `server: status === 500` and renders the 500 copy. Reintentar is unchanged.

**Review checkpoint F1b:** chat-polish REQ-23 green. Reviewer checklist: hooks inert without `E2E_HOOKS` or under production; **the route reads headers only through `testHooks()`**; 400 paths log nothing at error level.

## Phase 3: US1 (P1) Understand me, about everything

**Batch 1a1: red list and assistant-api pruning, on unchanged code**, about 420 lines (about 80% deletions; no `src/` change)

- [ ] T008 [US1] Red list and assistant-api pruning (tests/e2e/.red-window.txt, tests/e2e/assistant-api.spec.ts, tests/e2e/assistant-helpers.ts)
  - On the unchanged code: run `npx playwright test --list` and write `tests/e2e/.red-window.txt` (Red-window rules): every test in assistant-scope.spec.ts, plus each test in assistant-answers, -next-step, -a11y, -composer and -look whose body asserts chips, scope, "Alcance", "Preguntar en Todo", the old placeholder, `follow_ups`, or the kinds `out_of_scope`/`missing_recipe`/`overview` (found by grep, each line ends with ` # <matched string>`).
  - The grep runs over the whole `tests/e2e/` directory (every `*.spec.ts`, assistant-api.spec.ts, assistant-helpers.ts, fixtures, and every non-assistant spec) for `home-search-filter`, `home-scope`, `Alcance`, `Preguntar en Todo`, `follow_ups`, `out_of_scope`, `missing_recipe`, `overview`, `chipsFor`, `defaultScope` and the `scope` request field. Hits outside the six old-UI specs are recorded in the batch note as "edited in task X", not as red-list items: theme-palette.spec.ts:82-91 (`sharedUi` "home scope menu") → edited in T069; assistant-api.spec.ts `FOLLOW_UPS`, `expectTopic`, `expectFixedReply`, the `FollowUp`/`ScopeKey` imports and every test using them → replaced in T008; assistant-helpers.ts `ask` scope/`recipeId` parameters → edited in T008; assistant-helpers.ts `buildAnswer`, `mockChat`, `UNKNOWN_LEAD`, `UNKNOWN_ANSWER`, `CAPABILITY_LINE` and the `ChatAnswer`/`Section` old-shape imports → edited in T013. Known false positives to note and ignore: `.user-chip` (theme-switch, theme-palette), the `scope` option of `auditNow` (theme-audit.ts, theme-login), and any other bare `scope` or `overview` hit in theme-* files that does not touch the assistant. dashboard.spec.ts:368 and theme-switch.spec.ts use only the search input, the FAB and `#assistant-chat-panel` and survive unchanged.
  - Delete or rewrite, in this task, every assistant-api.spec.ts test asserting scope, recipe_id, `unknown`/`out_of_scope`/`missing_recipe`/`overview` kinds, UNKNOWN_LEAD, context_used by scope, or the old FOLLOW_UPS lists. This includes the chat-polish REQ-19 winners table, which T070 re-creates in the new vocabulary. A rewrite keeps only assertions true on both the old and the new server (no `scope` argument, no `follow_ups`, no kind other than `answer`), so it passes on the unchanged code. Supersession for the 1a1 batch note (title → task): chat-polish REQ-19 winners table, unknown reply in Todo, whole-word rule → T070 (and T017); every chat-polish REQ-20 scope/overview/missing-recipe test, `context_used` by scope, the "Carrito actual" alias → T072; old fallback texts and the unknown-reply test → T048; chat-polish REQ-6 "unrecognized question" → T048; Plan activo overview and Recetario "hola" → T048 (greeting) and T050; every "Esta receta" builder test → T034; chat-polish REQ-5 follow-ups of the Topics table and page suggestions → T072 (server repeat rule, sweep) and T012; the `sources` test drops its out-of-scope case (kept for the rest). Builder tests on cart, recipe list, plan and meal times stay, minus their `expectTopic`/scope parts.
  - `ask(request, message, { today?, fail?, trace? })` loses the legacy string form and its `ScopeKey` use (T004).
  - Commits: path-limited sub-commits are allowed (the red list; the helper edit; one per pruned test group), per Constitution 7.
  - Gate: `npx tsc --noEmit`; `grep -En "ScopeKey|FollowUp|FOLLOW_UPS|follow_ups|UNKNOWN_LEAD|expectTopic|scope|recipe_id|overview|out_of_scope|missing_recipe" tests/e2e/assistant-api.spec.ts` returns nothing; no `test.skip`/`fixme`/`fail` added.

**Review checkpoint 1a1:** `npx tsc --noEmit`; run explicitly, one at a time: (1) `npx playwright test assistant-api` → green; (2) the six old-UI specs → green (code unchanged, so every listed test passes and stays listed); every line of `.red-window.txt` matches a title in `--list` output. Batch note: the file's line count, the T008 "edited in task X" hits, and each deleted assistant-api title with its superseding task. No full run.

**Batch 1a2: wire model and scope-free server**, about 360 lines. Changes server behavior; not additive.

- [ ] T072 [US1] Tests REQ-4 (API), REQ-5, REQ-13 clock (tests/e2e/assistant-noscope.spec.ts)
  - Same answer with and without `scope` and `recipe_id` (incl. "Receta" + a recipe id), sent with a raw `request.post` since `ask` no longer takes them (T008).
  - No `out_of_scope`, `missing_recipe` or `overview` kind; `context_used` = "Todo el sistema".
  - `blocks` and `buttons` present; `answer` equals the concatenated blocks; `resolved` absent without the trace header.
  - REQ-5 (partial): the server repeat rule on follow-ups; `resendSweep` over the starters and follow-ups whose builders exist (cart, recipes, meal times, plan). The sweep fails on placeholders or an empty set, so it never passes vacuously. REQ-5 is claimed only after the T063 final sweep.
  - Node-side: `serverToday(new Date("2026-10-29T03:00Z"))` = "2026-10-28".
  - Shown red on the unchanged server first (the tests-first commit of 1a2).
- [ ] T009 [US1] Wire types `Button`, `Block`, new `ReplyKind`, `Intent`, optional `resolved`. Keep old top-level fields so the old client compiles (src/lib/assistant.ts)
- [ ] T010 [US1] Server answer (src/lib/domain/chat.ts, src/lib/domain/chat-topics.ts)
  - `ragAnswer(db, user, message, today)` with no scope; `reply()` builds blocks, buttons and `answer`.
  - Follow-ups become question buttons per the Topics table; server repeat rule; the 4 Topics starters.
  - `resolved` filled only when the route passes `trace`; topics with no builder use the D3 placeholder.
- [ ] T011 [US1] Request, loading, today (src/lib/validation/schemas.ts, src/lib/domain/queries.ts, src/lib/domain/chat-dates.ts, src/app/api/rag/chat/route.ts)
  - `chatSchema` = `{ message }`; `needs.chat`; the route uses `loadFor(user, "chat")`.
  - `serverToday(now)` via `Intl` in America/Mexico_City (final implementation, no stub); the route passes `serverToday(new Date())` and `trace` from `testHooks()`.

**Review checkpoint 1a2:** `npx tsc --noEmit`; run explicitly, one at a time: (1) `npx playwright test assistant-api assistant-noscope assistant-errors dashboard theme-login theme-motion theme-palette theme-public theme-switch a-theme-visual` → green apart from the known failures; (2) `npx playwright test assistant-scope assistant-answers assistant-next-step assistant-a11y assistant-composer assistant-look` → failing titles ⊆ `.red-window.txt`. Batch note: every failure outside the file with its handling (a), (b) or regression, and listed tests now passing, removed from the file (Red-window rules). No full run.

**Batch 1b1: scope-free client state, button renderer and pages**, about 400 lines (about 45% deletions; code added ≤ ~220)

- [ ] T012 [US1] Tests REQ-4 UI, REQ-5 client (tests/e2e/assistant-noscope.spec.ts)
  - On a recipe page, "¿Qué hay en mi carrito?" gives the cart answer.
  - The search bar opens the panel and sends "¿Cuál es mi peso?" (the request carries only `{ message }`; copy asserted in T044).
  - No "Alcance", scope menu or "Preguntar en Todo" on `/`, `/recipes/<id>`, `/groceries` or `/plans`.
  - The 4 starters on every page; the page subtitle is a label and never changes the request.
  - REQ-4 subtitle: the same question asked on `/recipes/<id>` and on `/groceries` (different subtitles) gives identical visible answer text and identical buttons.
  - 360 px header row 1: title, "Nueva conversación" and ×, each ≥44×44, no overlap.
  - Placeholder "Pregunta por tu plan, tu avance o tus compras" and aria name "Preguntar al asistente".
  - Every assertion above is made green inside 1b1 (T014, T015, T069); none is on the red list.
- [ ] T014 [US1] Client state (src/components/app/assistant.tsx, src/components/app/AppShell.tsx)
  - Remove scope state, `chipsFor`, page suggestions and `askInScope` scope; `send({ message })`, `askAssistant(message)`.
  - So every task commit type-checks: `askAssistant`/`askInScope` keep an optional, ignored second `scope?: ScopeKey` parameter and the page-context type keeps `defaultScope?`/`suggestions?` optional and ignored until T069 removes the call sites and then these parameters. `ScopeKey`, `SCOPE_LABEL` and the suggestion builders stay in src/lib/assistant.ts until T016.
  - Likewise the `AssistantChat`/`ScopeSwitcher` props stay optional or are still passed by AppShell until T015 removes them, or T014 and T015 land as one commit; `npx tsc --noEmit` passes at every task commit.
- [ ] T015 [US1] Renderer and header (src/components/shared/AssistantTurn.tsx, src/components/shared/AssistantChat.tsx, src/components/shared/assistant-chat.css; delete src/components/shared/ScopeSwitcher.tsx)
  - Render blocks (title, lead, sections, block buttons) and answer buttons; question buttons only under the latest answer; links (`next/link`) on every answer. Header row 2 removed.
- [ ] T069 [US1] Pages (src/components/dashboard/DashboardView.tsx, src/components/dashboard/home.css, src/components/recipes/RecipeDetail.tsx, src/components/groceries/GroceriesChat.tsx, src/components/app/assistant.tsx, src/components/app/AppShell.tsx, tests/e2e/theme-palette.spec.ts)
  - Search bar: scope menu, filter button and their CSS removed; fixed placeholder and aria name (spec Copy); `onAsk(message)`.
  - In the same commit as the CSS removal: delete the `sharedUi` entry "home scope menu" in tests/e2e/theme-palette.spec.ts (lines ~82-91; it clicks `.home-search-filter` and expects `.home-scope-menu`, and feeds the sweeps at ~336 and ~406). The batch note names this edit.
  - RecipeDetail and GroceriesChat register a subtitle label only (no `defaultScope`, no `suggestions`).
  - Then drop the temporary optional `scope`/`defaultScope`/`suggestions` parameters from T014.

**Review checkpoint 1b1:** `npx tsc --noEmit`; run explicitly, one at a time: (1) `npx playwright test assistant-noscope assistant-api assistant-errors dashboard theme-login theme-motion theme-palette theme-public theme-switch a-theme-visual` → green apart from the known failures and reported snapshot-only diffs, with every T012 assertion green; (2) the six old-UI specs → failing titles ⊆ `.red-window.txt`; listed tests now passing are removed from the file and named in the batch note. No full run.

**Batch 1b2: test churn and leftovers**, about 330 lines (mostly test rewrites and deletions)

- [ ] T013 [US1] Test churn: delete tests/e2e/assistant-scope.spec.ts; move `buildAnswer`/`mockChat` to the new shape and replace `UNKNOWN_LEAD`/`UNKNOWN_ANSWER`/`CAPABILITY_LINE` and every `follow_ups` use in assistant-helpers.ts; rewrite or delete every remaining test listed in `.red-window.txt` (assistant-answers, -next-step, -a11y, -composer, -look); then delete tests/e2e/.red-window.txt (tests/e2e/*.spec.ts, tests/e2e/assistant-helpers.ts, tests/e2e/.red-window.txt)
- [ ] T016 [US1] Leftovers (tests/e2e/assistant-api.spec.ts, src/lib/assistant.ts, src/lib/domain/chat.ts)
  - First, as the tests-first commit: move every remaining top-level `lead`/`sections`/`body` assertion in tests/e2e/assistant-api.spec.ts to `blocks` (green on the current server, which sends both).
  - Gate, before removing anything: `grep -rEn "ScopeKey|SCOPE_LABEL|FollowUp|follow_ups|chipsFor" tests/e2e` returns nothing, `grep -En "\.lead|\.sections|\.body" tests/e2e/assistant-api.spec.ts | grep -v "blocks"` returns nothing, and `npx tsc --noEmit` passes. A hit blocks T016 and goes back to T013.
  - Remove `ScopeKey`, `SCOPE_LABEL`, the suggestion builders and the old top-level response fields (no caller remains after T069 and T013).
- [ ] T071 [US1] Snapshot refresh 1 of 2 (tests/e2e/*-snapshots): after the full run, the reviewer lists each snapshot-only diff per test name with the confinement judgment (Snapshots rule). Only after the user's explicit yes, run `--update-snapshots` for those tests only (assistant-look, a-theme-visual); commit the images alone. Any unconfined diff blocks instead.

**Review checkpoint 1b2:** red window closed: `.red-window.txt` gone; full `npm run test:e2e` green apart from the known failures; T071 done (or waiting on the user's yes, which blocks the checkpoint).

**Batch 1c1: normalizer and word matcher**, about 240 lines (about 100 are the node-side table)

- [ ] T017 [US1] Tests REQ-2, node-side (tests/e2e/assistant-match.spec.ts)
  - The full REQ-2 matcher table on `matchWord` (imported from src/lib/domain/chat-match.ts), each ✓ and ✗ row, plus multi-word phrase consumption and `normalizeText` per spec Terms (ñ→n, punctuation → space).
- [ ] T018 [US1] `normalizeText` per spec Terms (non-letter/digit → space, ñ→n) and `words` (src/lib/assistant.ts)
- [ ] T019 [US1] Matcher (src/lib/domain/chat-match.ts)
  - OSA distance and length allowance (≤4 exact, 5–7 one edit, ≥8 two); singular/plural (s, es, z→ces); `*` stems exact prefix only.
  - First-letter rule, never-fuzzy words, no fuzzy when the word exactly equals any entry.
  - Multi-word phrases with per-word allowance; the longest phrase consumes its words.

**Review checkpoint 1c1:** T017 green (node-side REQ-2 table); the rest of the suite unchanged.

**Batch 1c2: vocabulary through the API**, about 200 lines

- [ ] T070 [US1] Tests REQ-1, REQ-2 through `ask()` (tests/e2e/assistant-match.spec.ts, tests/e2e/assistant-api.spec.ts)
  - REQ-1 Givens whose expected topic list equals the matched topics in order of first appearance (no REQ-6 rule needed), via `resolved`, plus answer text for the topics with builders (cart, recipes, meal times, plan). Givens that need a REQ-6 rule (combinations, possessor, step order) are asserted in T021.
  - The REQ-2 table through `ask()`: each ✓ row resolves to its topic, each ✗ row does not.
  - "¿Qué hago ahora?" → `no_match` with the starters.
  - Re-create the superseded chat-polish REQ-19 table to the new vocabulary.
- [ ] T020 [US1] Vocabulary (src/lib/domain/chat-topics.ts, src/lib/domain/chat.ts)
  - Every Topics trigger, the frozen recipe-list filter words, the Button/Title/Follow-ups table, the starters.
  - Interim until T022 (1d): chat.ts derives the intent list as the matched topics in order of first appearance, capped at 2 plus overflow, with no REQ-6 rules; `resolved` and the answers use that list. T023 replaces it with the resolver.
  - chat.ts drops its `nutrition.normalize` import (plan D6; nutrition.ts and food.ts untouched).

**Review checkpoint 1c2:** REQ-1 (first-appearance Givens) and REQ-2 green.

**Batch 1d: resolution order**, about 330 lines

- [ ] T021 [US1] Tests REQ-6 Givens (tests/e2e/assistant-match.spec.ts)
  - The REQ-1 Givens left out of T070 (those needing a REQ-6 rule), via `resolved`.
  - Via `resolved`: ingredientes + desayuno, cuándo/hora + compro, ingredientes + comprar, meta de peso, recetas + plan, the button "¿Qué recetas hay en mi plan?", nombre de mi plan, cuántas comidas llevo, qué lleva la cena, cuánto llevo.
  - Answer text now for the cart, recipes, meal-times and plan Givens.
  - Every Topics Button, Follow-up and starter **of topics that exist at 1d** resolves to exactly its single topic; extend `resendSweep` to them. "<Slot ref>" buttons move to T028, "¿Qué lleva <receta>?" to T026.
- [ ] T022 [US1] Resolver (src/lib/domain/chat-intent.ts)
  - REQ-6 steps 1–8, with hooks for step 2 (US2) and step 4 (T027); phrase consumption.
  - Combinations: time + slot, goal + metric, "plan" possessor, Plan only when alone, ingredientes + cart, a time word without a slot ignored. At most 2 topics plus overflow.
- [ ] T023 [US1] Wire the resolver into `ragAnswer`, replacing T020's first-appearance list; existing builders (cart, recipes, meal times, plan) answer their intents (src/lib/domain/chat.ts)

**Review checkpoint 1d:** REQ-6 resolution green for existing topics.

**Batch 1e: dish matcher (fuse.js)**, about 180 lines

- [ ] T024 [US1] Spike, outside the repo
  - Copy the project to the session scratchpad as a real copy (excluding node_modules and .next*), then `npm ci` and `npm install fuse.js@7.5.0 --save-exact` inside the copy. **Never symlink node_modules** (unlike the CLAUDE.md build recipe): an install through a symlink would change the real project's node_modules.
  - `npx tsx` over the REQ-3 table with the real recipe names and with the T004 fixture; pick threshold and options that pass both; record them in the batch note.
  - Real names are read read-only (GET /api/recipes on :3000 or a single `SELECT name`); nothing else on :3000, the real DB or the repo is touched; real names never enter the repo.
- [ ] T025 [US1] Install fuse.js exactly 7.5.0 in the repo. The orchestrator runs it, with the user's yes already given (package.json, package-lock.json)
- [ ] T026 [US1] Tests REQ-3 (tests/e2e/assistant-match.spec.ts)
  - Every table row except "la comida opcion 1" via `resolved` on the T004 fixture (recipe id, candidates, or not found), including "la opcion 1" → not found and "la pizza" → not found. Generic names and distractors are never candidates. The "la comida opcion 1" row needs resolver step 2 and is asserted in T031.
  - The "¿Qué lleva <receta>?" button message for each fixture resolves to that recipe; added to `resendSweep` once the detail exists (T034).
- [ ] T027 [US1] Dish matcher with the spike's threshold (constant with a comment) and REQ-6 step 4 (exact non-generic name beats a slot reading) (src/lib/domain/chat-dish.ts, src/lib/domain/chat-intent.ts)

**Checkpoint:** US1 complete for resolution (REQ-1 to REQ-6) except the REQ-3 row "la comida opcion 1", which needs resolver step 2 (T031, 2b); text coverage for REQ-3 and the slot/metric rows of REQ-1/REQ-6 completes in US2–US4 (Coverage table).

## Phase 4: US2 (P1) Meal detail

**Batch 2a: slots and times**, about 320 lines

- [ ] T028 [US2] Tests REQ-7, REQ-8, REQ-11 (duplicates) (tests/e2e/assistant-meals.spec.ts)
  - REQ-7: almuerzo question and buttons (1 or 2), merienda/snack → colación, not-in-plan.
  - REQ-8: one slot's time highlighted, a slot without a time, all slots.
  - REQ-11: two colaciones → 2 buttons with "(<time>)"; "colación 2" and "segunda colacion"; 11 slots → "Colación 11"; masculine ordinals.
  - REQ-5: `resendSweep` over every "<Slot ref>" and almuerzo-clarify button.
  - Answer text for the slot Givens of REQ-1 and REQ-6.
- [ ] T029 [US2] Slots (src/lib/domain/chat-meals.ts)
  - Slot list from `activeSchedule`, word-to-slot mapping, almuerzo/merienda/snack rules.
  - Slot refs and ordinals (feminine/masculine, >10), slot buttons (times vs options message); slot times builder and variants.
- [ ] T030 [US2] Resolver: slot words, typed ordinals and "<slot> <n>" for duplicated slots (src/lib/domain/chat-intent.ts)

**Review checkpoint 2a**

**Batch 2b: options, paging, selection**, about 310 lines

- [ ] T031 [US2] Tests REQ-9, REQ-10, REQ-11 (option buttons) (tests/e2e/assistant-meals.spec.ts)
  - API: 5 options → 3 + "Ver más opciones"; page 2 → 4–5 + "Opciones anteriores"; 7 options → page 3 shows option 7 with "Opciones anteriores" only; page 9 → last page.
  - Generic labels: "Opción 2: Pollo, Arroz, Brócoli…" (4 ingredients); exactly 3 ingredients → no "…"; 0 ingredients → "Opción <n>".
  - "cena opción 2", "cena opcion 2", "la 2 de la cena" equal; "cena opción 7" → "Tu cena tiene 4 opciones." + first page.
  - REQ-11: "Segunda colación" lists the second slot's options with buttons sending "Segunda colación, opción <n>".
  - REQ-3 row "la comida opcion 1": `resolved` is option selection, comida, option 1, never a dish match or did-you-mean (`kind` is neither `did_you_mean` nor `no_match`).
  - REQ-5: `resendSweep` over option and paging buttons (incl. "Segunda colación, opción <n>").
  - One UI flow: tap through the pages; the user turn shows the sent message.
- [ ] T032 [US2] Options builder: lead variants, `layout: "option"` buttons in plan order, labels, paging messages, out-of-range (src/lib/domain/chat-meals.ts)
- [ ] T033 [US2] Resolver step 2: option selection and paging, incl. page 1 and no number = page 2 (src/lib/domain/chat-intent.ts)

**Review checkpoint 2b**

**Batch 2c: dish detail**, about 330 lines

- [ ] T034 [US2] Tests REQ-12, REQ-11 (single option), REQ-3 text (tests/e2e/assistant-meals.spec.ts)
  - 12 ingredients all shown; steps 1–2 equal the recipe page's first 2, plus "Ver receta completa" (opens `/recipes/<id>`).
  - "Extraído de plan.pdf" → the no-preparation item.
  - Recipe page (before T035 swaps its normalizer): descriptions "Extraído de plan.pdf", "EXTRAÍDO DE plan.pdf" and "Extraido de plan.pdf" show the empty-steps state; an accented multi-sentence description ("¿Listo? Ásalo. Él sirve.") keeps its step split. Green before and after T035.
  - Complement "Agua natural · 1 vaso" shown; none → no heading. By dish name: complements only if the recipe is in exactly one slot.
  - Ingredient formats with no unit and with neither; a generic-name lead.
  - A single-option slot goes straight to the detail.
  - REQ-3 text: each found row of the table shows the detail lead, and "la comida opcion 1" shows comida option 1's detail.
  - End of US2 sweep: `resendSweep` over every Topics button of existing topics, slot, option, paging and "¿Qué lleva <receta>?" button.
- [ ] T035 [US2] Shared `recipeSteps(description)` using `normalizeText`, used by the recipe page (no display change) (src/lib/recipe-steps.ts, src/components/recipes/RecipeDetail.tsx)
- [ ] T036 [US2] Detail builder: lead, uncapped "Ingredientes", "Preparación" (2 steps + link), "Acompaña con" from the slot's add-ons and `add_on` usages (src/lib/domain/chat-meals.ts)

**Checkpoint:** US2 complete (REQ-7 to REQ-12).

## Phase 5: US3 (P2) Weekly goals and date-based data

**Batch 3a: shared progress math (refactor)**, about 260 lines

- [ ] T066 [US3] Dashboard baseline for REQ-16 (tests/e2e/assistant-parity.spec.ts)
  - The chat user's dashboard with `timezoneId: "America/Mexico_City"` and `page.clock.setFixedTime` (2026-10-28), seeded logs on both sides of Monday and none after today; tile numbers (exercise days, water liters with a capped day, meals D de N, weight change) equal hand-computed expected values. Green on main code before T037, and after T038.
- [ ] T037 [US3] Pure module (src/lib/progress.ts)
  - UTC date-key helpers, `mondayOf`, `weekDays`, `waterGoalGlasses(liters)` (clamp 4–12, 2 L default).
  - `weekWater` (capped), `mealsDoneOn` (filtered to slot ids, clamped), `weekMeals`, `weekExercise`, each with `endDay` (plan D9); `weightStats` (latest, before Monday, change, goal ratio).
- [ ] T038 [US3] DashboardView uses `progress.ts` with `endDay` = Sunday and identical output. Gate: T066, dashboard.spec and a-theme-visual unchanged apart from the known failures (src/components/dashboard/DashboardView.tsx)

**Review checkpoint 3a:** no display change; T066 green before and after.

**Batch 3b1: today pin and date parser**, about 280 lines

- [ ] T039 [US3] Tests REQ-13, REQ-14 periods (tests/e2e/assistant-progress.spec.ts)
  - API: a pinned date is used (period bounds in `resolved` follow the pin); a pin header without the trace header changes no field shape.
  - Every REQ-14 phrase → its period bounds in `resolved` (cue and period-noun rules).
  - No fallback for "Mi avance de la semana", "¿Cuántos días hice ejercicio?", "a la semana", "en la semana"; "en el mes" = this month.
- [ ] T040 [US3] Date parser: cue and period-noun rules, the phrase table → `Period` (src/lib/domain/chat-dates.ts)
- [ ] T041 [US3] The route passes the pinned today from `testHooks()` (else `serverToday`); the resolver attaches the period to metric intents (src/app/api/rag/chat/route.ts, src/lib/domain/chat-intent.ts)

**Review checkpoint 3b1**

**Batch 3b2: period labels, clamp, fallback**, about 230 lines

- [ ] T067 [US3] Tests REQ-14 labels (tests/e2e/assistant-progress.spec.ts)
  - Every REQ-14 row → its label in `resolved` (interim; text in T042/T044); year suffix; future-day cut.
  - "últimos 400 días" → 366 days plus the clamp line; fallback for "hace dos semanas", "31 de febrero", "el mes anterior".
- [ ] T068 [US3] Labels (es-MX abbreviations in code), year suffix, future-day cut, clamp, fallback line (src/lib/domain/chat-dates.ts)

**Review checkpoint 3b2**

**Batch 3c: water and exercise**, about 330 lines

- [ ] T042 [US3] Tests REQ-15, REQ-17, REQ-18, REQ-13/14 text, with seeded logs and a pinned date (tests/e2e/assistant-progress.spec.ts)
  - Water: today plus the week line; "hoy" only; "ayer" only; uncapped 10 glasses with the week line counting 2 litros; range totals, average and days met.
  - Exercise: week remaining with singular "Te falta 1 día", the met line, today yes/no, another single day, full-week vs other ranges.
  - REQ-14 on answer text: every period label row through water or exercise answers; the clamp line ("Solo puedo revisar hasta 366 días; te muestro los últimos 366.") and the fallback line ("No entendí la fecha; te muestro <periodo>.") appear in the answer.
  - REQ-13 on answer text: the pinned today changes the "hoy" answer; a separate test (own seeded logs, not the parity fixture) adds a water log dated the day after the pinned today and the "Esta semana (…)" liters in the answer text are unchanged.
  - REQ-27 empty ranges for water and exercise: 0 with the period label.
  - REQ-16 parity, before T043: extend T066 (tests/e2e/assistant-parity.spec.ts) with the same pin header; the chat's water week liters and exercise days equal the dashboard tiles.
  - Answer text for the metric Givens of REQ-1 and REQ-6.
- [ ] T043 [US3] Water and exercise builders on `progress.ts`, `endDay` = today, incl. the 0-with-label empty range (src/lib/domain/chat-metrics.ts)

**Review checkpoint 3c**

**Batch 3d: weight and meals done**, about 320 lines

- [ ] T044 [US3] Tests REQ-19, REQ-20, REQ-14 text, REQ-16 (meals, weight), REQ-27 (weight), plus the T012 search-bar weight copy (tests/e2e/assistant-progress.spec.ts, tests/e2e/assistant-noscope.spec.ts, tests/e2e/assistant-parity.spec.ts)
  - REQ-19: the exact sentence; no week line without a record this week; "sin cambio"; "meta alcanzada"; no goal → "Fijar mi meta"; last record over 7 days → the line + "Registrar mi peso"; range min/max.
  - REQ-20: today 3 de 5, week ×7, a range with %.
  - REQ-14 on answer text: range labels and the fallback line in weight and meals answers.
  - REQ-27: no weight logs → "Aún no registras tu peso." + "Registrar mi peso" (/); an empty weight range → "<Periodo>: no registraste tu peso."; an empty meals range → 0 with the label.
  - REQ-16 parity, before T045: extend the T066 fixtures; the chat's meals done (D de N) and weight change equal the dashboard tiles.
- [ ] T045 [US3] Weight and meals-done builders, incl. the no-weight-logs reply and empty ranges tested in T044; the no-active-plan reply for meals done is left to T052 (src/lib/domain/chat-metrics.ts)

**Review checkpoint 3d**

**Batch 3e: goals, weekly progress, parity**, about 270 lines

- [ ] T046 [US3] Tests REQ-21, REQ-22, REQ-16 (tests/e2e/assistant-progress.spec.ts, tests/e2e/assistant-parity.spec.ts)
  - REQ-21: bare goals, narrowed water goal, no active plan. Unclamped liters: a plan of 1 L → "Tu meta de agua es **4 vasos** (1 litro) al día."; a plan of 4 L → "**12 vasos** (4 litros)".
  - REQ-22: 4 items / 3 without a weight change / no plan.
  - Parity (REQ-16), before T047: the goals answer's exercise and water goals and every weekly-progress item equal the dashboard tiles under the T066 pin (water and exercise parity are in T042, meals and weight in T044).
  - REQ-5: `resendSweep` over metric follow-ups, "Fijar mi meta"/"Subir mi plan" excluded (links).
- [ ] T047 [US3] Goals and weekly-progress builders, incl. the no-plan line and "Subir mi plan" (src/lib/domain/chat-metrics.ts)

**Checkpoint:** US3 complete (REQ-13 to REQ-22).

## Phase 6: US4 (P2) Chat-like edge cases

**Batch 4a: greeting, variants, no-match, did-you-mean**, about 300 lines

- [ ] T048 [US4] Tests REQ-23, REQ-26, REQ-28, REQ-29, REQ-3 text (tests/e2e/assistant-edges.spec.ts)
  - "hola" → greeting + 4 buttons; thanks; "Hola, ¿cuánto peso?" → weight.
  - Pizza not-found quotes "pizza"; pollo → did-you-mean with 2 buttons (no distractor offered); "la opcion 1" → not found.
  - The same question twice → the same variant; REQ-28: for each answer with variants, questions hitting different variants show identical numbers and units.
  - Capital de Francia → no-match + 4 starters; a near recipe name → did-you-mean.
  - REQ-5: `resendSweep` over greeting, no-match and did-you-mean buttons.
- [ ] T049 [US4] Builders and variant picker; REQ-29 matching on the whole question minus stop words (src/lib/domain/chat.ts, src/lib/domain/chat-dish.ts)

**Review checkpoint 4a**

**Batch 4b: multi-topic, clarifications, missing data**, about 340 lines

- [ ] T050 [US4] Tests REQ-24, REQ-25, REQ-27 (tests/e2e/assistant-edges.spec.ts)
  - "agua, ejercicio y peso" → 2 titled blocks + "Mi peso"; desayunar y cenar → options + "¿Cuál es mi cena?".
  - Clarify answers stand alone; "¿Cuánto llevo?" → 3 buttons; a dish cue with no dish → 3 recipe buttons, or slot buttons when none.
  - The REQ-27 cases not tested earlier: no active plan for plan, slot and meals-done questions; a slot word not in the plan ("¿Qué puedo cenar?" without cena → "Tu plan no tiene cena." + one button per slot, starters when none); a slot with no options. Tested elsewhere (before their code): no weight logs and empty ranges (T042, T044), goals/progress without a plan (T046), identity-plan without a plan (T053).
  - REQ-5: `resendSweep` over clarify, did-you-mean and overflow buttons; none resolves to another question or no-match.
- [ ] T051 [US4] `reply()` 2-block rules: titles, one option block, follow-ups then overflow, a later clarify omitted (src/lib/domain/chat.ts)
- [ ] T052 [US4] Clarify replies and the missing-data replies tested in T050 only (src/lib/domain/chat-meals.ts, src/lib/domain/chat-metrics.ts)

**Checkpoint:** US4 complete (REQ-23 to REQ-29).

## Phase 7: US5 (P3) Identity

**Batch 5: identity**, about 140 lines

- [ ] T053 [US5] Tests REQ-30, REQ-31 (tests/e2e/assistant-identity.spec.ts)
  - "Te llamas Rafael." highlighted; a blank name.
  - "Plan octubre.PDF" → "Plan octubre"; the plan summary lead has the name; no plan → REQ-27. Answer text for the identity Givens of REQ-6.
- [ ] T054 [US5] Identity builders and the plan-summary lead (src/lib/domain/chat.ts)

**Checkpoint:** US5 complete (REQ-30, REQ-31).

## Phase 8: US6 (P3) Conversation UI

**Batch 6a: bubbles, avatar, button variants**, about 330 lines

- [ ] T055 [US6] Tests REQ-32, REQ-34, REQ-35 (visuals) (tests/e2e/assistant-look.spec.ts, tests/e2e/assistant-a11y.spec.ts)
  - Sides and avatar (32 px `Bot`, aria-hidden, also on errors).
  - Contrast in both themes: text 4.5:1, boundary 3:1, for bubbles, avatar and the `ArrowUpRight` icon (3:1 against its button).
  - 360 px: a 500-character message and an 80-character token have no overflow.
  - Vertical option buttons stretch, wrap, ≥44 px; nav links ≥44×44 px at 360 px.
  - Visible focus ring on option buttons and nav links, both themes. Bubbles are not keyboard-focusable (spec v1.5): assert they have no tabindex and are skipped by Tab; bubbles and the avatar get only the contrast assertion above.
  - Only the last answer has question buttons; `aria-disabled` while pending (focusable, sends nothing); links work on old answers.
  - The arrow icon is aria-hidden; the accessible name equals the label.
- [ ] T056 [US6] Single button component with `option` and `link` variants (`ArrowUpRight`); bubbles and avatar with theme tokens only (src/components/shared/PromptSuggestion.tsx, src/components/shared/AssistantTurn.tsx, src/components/shared/assistant-chat.css)

**Review checkpoint 6a:** snapshot diffs reported, not refreshed.

**Batch 6b: typing and live region**, about 300 lines

- [ ] T058 [US6] Fetch https://prompt-kit.com/c/response-stream.json into the scratchpad (no install); adapt it with attribution (src/components/shared/ResponseStream.tsx)
- [ ] T059 [US6] Tests REQ-33 (tests/e2e/assistant-look.spec.ts, tests/e2e/assistant-a11y.spec.ts)
  - A long lead completes within 1 s; buttons appear only after it; tapping completes it; reduced motion → immediate.
  - The live region changes once and includes "3 opciones" and the labels.
  - No replay after close/reopen or navigation; the scroll uses the final height.
- [ ] T060 [US6] Type the first lead only (precomputed full-height layout); fades ≤200 ms; reduced motion; typed-once flag; hidden option count in the live region (src/components/shared/AssistantTurn.tsx, src/components/shared/assistant-chat.css)

**Review checkpoint 6b**

**Batch 6c: keyboard, focus, navigation, snapshots**, about 240 lines plus snapshot images

- [ ] T061 [US6] Tests REQ-35, REQ-34 (navigation close) (tests/e2e/assistant-a11y.spec.ts)
  - Tab order, Enter/Space.
  - Focus after option, paging, slot, clarify and did-you-mean buttons (360 px: log while pending, then the new turn; desktop: input).
  - At 360 px, "Registrar mi peso", "Fijar mi meta" and "Subir mi plan" each close the sheet; on the same destination, focus goes to the FAB.
  - On desktop, "Ver receta completa" keeps the panel open with focus in the page's main heading or content.
- [ ] T062 [US6] Navigation handling (src/components/shared/AssistantTurn.tsx, src/components/shared/AssistantChat.tsx, src/components/app/assistant.tsx)
  - A link click closes the sheet at ≤640 px; on the same destination it only closes and focuses the FAB.
  - On desktop, after the path change, focus `main h1` (fallback `main`, tabIndex -1).
- [ ] T057 [US6] Snapshot refresh 2 of 2 for `assistant-look` and `a-theme-visual` (same procedure as T071): reviewer lists confined diffs per test name; `--update-snapshots` only after the user's explicit yes (tests/e2e/*-snapshots)

**Checkpoint:** US6 complete (REQ-32 to REQ-35).

## Phase 9: Final verification

**Batch Final**, about 120 lines

- [ ] T063 [setup] Coverage audit and merge preconditions (tests/e2e/assistant-api.spec.ts)
  - Every REQ-1 to REQ-35 and chat-polish REQ-23 maps to a passing test that asserts answer text, kind or buttons; no REQ is covered by `resolved` alone (table below).
  - Final REQ-5 sweep: `resendSweep` over one answer of every reply kind and every button type.
  - Merge precondition 1: `grep -rn "Pronto podré" src` returns nothing (no D3 placeholder).
  - Merge precondition 2: `grep -n "headers" src/app/api/rag/chat/route.ts` shows header access only through `testHooks()`; `resolved` is set only under `trace`.
  - No `ScopeKey`/`scope` remains in chat code.
- [ ] T064 [setup] Synthetic smoke and NFR (tests/e2e/assistant-helpers.ts, tests/e2e/assistant-api.spec.ts)
  - Harness `seedVolume()`: 32 recipes, 69 meals, 365 daily_logs rows, goals, name, add-ons, on the chat user.
  - One question per topic: no 500 (no Proxy misses). After a warm-up request, each answer under a 5 s bound (spec v1.5 NFR); timings logged per topic.
  - Nothing committed depends on the real dataset or machine speed.
- [ ] T065 [setup] `npx tsc --noEmit` and one full `npm run test:e2e`. Report results to the orchestrator for the spec Progress and the chat-polish REQ-23 status.
  - Batch report note, merge precondition 3: the user runs the manual ≤1 s check on the real data (one question per topic on :3000) before merge and the result is recorded in the batch report. The agent does not run it.

## Coverage

Text column: the test that asserts answer text, kind or buttons (never `resolved` alone).

| Requirement | Tests (resolution) | Tests (text) | Code |
|---|---|---|---|
| chat-polish REQ-23 | — | T005 | T006, T007 |
| REQ-1 | T070, T021 | T070, T028, T042, T053 | T018–T020, T022 |
| REQ-2 | T070 | T017 (node-side), T070 | T018–T020 |
| REQ-3 | T026, T031 | T034, T048 | T024, T025, T027, T033 |
| REQ-4 | — | T072, T012 | T010, T011, T014–T016, T069 |
| REQ-5 | — | T072 (partial), T012, T021, T028, T031, T034, T046, T048, T050, T063 (final) | T010, T014 |
| REQ-6 | T021 | T021, T028, T042, T053 | T022, T023, T027 |
| REQ-7, REQ-8 | — | T028 | T029, T030 |
| REQ-9, REQ-10 | — | T031 | T032, T033 |
| REQ-11 | — | T028, T031, T034 | T029, T030, T032, T036 |
| REQ-12 | — | T034 | T035, T036 |
| REQ-13 | T039 | T005 (guard), T072 (clock), T042 (pin, future-day log) | T006, T011, T041 |
| REQ-14 | T039, T067 | T042, T044 | T040, T041, T068 |
| REQ-15 | — | T042, T044 | T043, T045 |
| REQ-17, REQ-18 | — | T042 | T043 |
| REQ-16 | — | T066 (dashboard), T042 (water, exercise), T044 (meals, weight), T046 (goals, weekly progress) | T037, T038, T043, T045, T047 |
| REQ-19, REQ-20 | — | T044 | T045 |
| REQ-21, REQ-22 | — | T046 | T047 |
| REQ-23, REQ-26, REQ-28, REQ-29 | — | T048 | T049 |
| REQ-24, REQ-25 | — | T050 | T051, T052 |
| REQ-27 | — | T042, T044, T046, T050, T053 | T043, T045, T047, T052, T054 |
| REQ-30, REQ-31 | — | T053 | T054 |
| REQ-32, REQ-34 | — | T055, T061 | T056, T062 |
| REQ-33 | — | T059 | T058, T060 |
| REQ-35 | — | T055, T061 | T056, T062 |
| NFR performance | — | T064 (synthetic dataset, 5 s bound, logged timings); manual ≤1 s check by the user on real data before merge (T065 note) | — |

Snapshots (not code): T071 (end of 1b2), T057 (end of 6c), each after the user's yes.

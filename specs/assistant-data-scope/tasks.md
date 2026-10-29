# Tasks: Assistant data scope

**Spec:** [spec.md](spec.md) (v1.6) · **Plan:** [plan.md](plan.md) (revision 6) · **Contract:** [contracts/chat-api.md](contracts/chat-api.md)

Format: `- [ ] T### [P] [US#] Description (path/to/file)`. `[P]` = parallel with other `[P]` tasks in the same batch (different files, no shared dependency). IDs T066–T068 were added in plan revision 2; T069–T070 in revision 3; T071 in revision 4 (removed in revision 6, ID kept); T072 in revision 5; T073–T077 in revision 6 (unit-first cadence, spec v1.6). They sit where they run.

**Batches:** each `Batch` is one implement/review cycle ending in a **Review checkpoint**. Sizes include tests. Batch table and worktree map: [plan.md Batches](plan.md#batches).

**Gate per batch (F1b to 6c):** `npx tsc --noEmit` and `npm run test:unit`, nothing else. The reviewer re-runs only these two. No e2e run before Batch E, with one exception: the targeted 3a2 merge run (Review checkpoint 3a2).

**Global rules:**
- **Unit first.** Every logic check (no browser, DB or server needed) is a unit test in `tests/unit/*.test.ts` (flat directory, plan D10), shown red before its code; that red unit run is the fail-first proof. Unit tests import only the pure modules listed in plan D10 and build data with `memDb()`.
- **e2e still written, not run.** Each task writes its e2e tests (UI, HTTP contract, a11y, focus, typing, navigation, chat-vs-dashboard parity, and one or two representative rows per logic REQ through `ask()`). They must type-check per the tsc rule below. They run first in Batch E (single exception: `npx playwright test assistant-parity.spec.ts -g "dashboard"` once at the 3a2 merge, user decision 2026-10-29; see Review checkpoint 3a2); UI-only and HTTP-only behavior gets its fail-first proof there (T077).
- **While iterating, run only what you touch:** `npx tsx --test tests/unit/<file>.test.ts` for the unit files of the code being changed. The full `npm run test:unit` runs once per batch, at the checkpoint.
- **Batch size ≤ ~300 changed lines** so review rounds stay short. Over and accepted by the user: 1a1 (~390, mostly deletions), 1a2 (~360), 1b1 (~390, ~45% deletions), 4b (~340), and at ~320: 2c, 3c, 3d, 6a (all accepted by the user 2026-10-29). A batch growing past its estimate by more than ~50 lines is split at a task boundary and reported.
- **Worktrees only where the plan marks batches independent:** F1b beside 1a1 (from the U0 tip), and 3a1–3a2 beside 1c1–3b2 (from the 1b2 tip, merged before 3c). Worktrees are created from the current feature-branch tip, only write code and run tsc and unit tests (never e2e), commit path-limited per task, need `node_modules` (a symlink is fine), and are merged back by the orchestrator by cherry-pick or `git merge --no-ff` (no fast-forward once the main line advanced), which reruns tsc and `npm run test:unit` on the merged tip (after `npm ci`, or at least tsc, when T025 changed package.json since the worktree was created; plan Worktree rules). If one side must edit a file the other owns, both run sequentially instead. Everything else is sequential: chat.ts, chat-intent.ts, chat-meals.ts and chat-metrics.ts are shared.
- **e2e runs** (Batch E and Final only) are sequential and in the foreground (one cloned DB, port 3200); never two at once, never in the background, nothing else running.
- **tsc rule:** `npx tsc --noEmit` must pass at each task's final commit and at every batch checkpoint. A red tests-only commit is exempt but is never left as the batch tip or a worktree's merge tip (plan Testing strategy).
- **Grep gates over old specs:** gates that look for removed names search `src` plus the old specs only: tests/e2e/assistant-{api,answers,next-step,a11y,composer,look}.spec.ts, tests/e2e/assistant-scope.spec.ts (until T013 deletes it), tests/e2e/theme-palette.spec.ts and tests/e2e/assistant-helpers.ts. The new negative-assertion files tests/e2e/assistant-noscope.spec.ts and tests/unit/chat-answer.test.ts are excluded explicitly; negative assertions on removed names live only there.
- Commits are path-limited and per task, tests first then code; messages cite US, T and REQ IDs. Commit a task before the next task touches the same file; never `git add -A`. No `specs/` in commits unless the user asks.
- Never run `next build` in place, never add packages other than T025, no migrations.
- Copy is verbatim from spec Copy (es-MX).
- `resolved` (test-only, plan D2) may be asserted while a builder is pending, but no REQ is covered by it alone; each REQ's text assertion is listed in the Coverage table.
- **Known failures on main** (not this feature): `dashboard.spec.ts:91`, `dashboard.spec.ts:213` (data-dependent), and the `a-theme-visual` cart snapshot. Listed in the Batch E and Final notes.
- **Snapshots:** one refresh only, T057 at the end of Batch E, after the user's explicit yes. Confinement to the assistant panel/FAB or the dashboard search bar (REQ-4) is judged by the reviewer from the diff image, per test name.
- **prompt-kit attribution** (copied or adapted files): `// Adapted from prompt-kit (https://github.com/ibelick/prompt-kit), MIT License` plus the verbatim copyright line.

## Phase 1: Setup

- [x] T001 [setup] Create `feature/assistant-data-scope` from `main` (local, no push).
- [x] T002 [setup] Baseline: `npx tsc --noEmit` and a full `npm run test:e2e`. Record the pass/fail list (expect only the known failures). Nothing is committed.

## Phase 2: Foundational (blocks all stories)

**Batch F1a: harness** (done: 46e8553, bf7108e)

- [x] T003 [P] [foundational] e2e server env and log (playwright.config.ts, .gitignore). Its first-run orphan check moves to T076 (the first e2e run).
- [x] T004 [P] [foundational] Harness (tests/e2e/assistant-helpers.ts)

**Batch U0: unit runner and in-memory fixture**, about 200 lines

- [x] T073 [setup] Unit runner (package.json `scripts` only, tests/unit/smoke.test.ts), about 50 lines
  - Add `"test:unit": "tsx --test tests/unit/*.test.ts"` (plan D10: flat directory; Node 20 `--test` does not expand globs and `sh` treats `**` like `*`). No dependency change: `git diff package-lock.json` is empty.
  - Smoke test with `node:test` and `node:assert/strict` that imports through `@/` with a transitive `@/` value import (e.g. `words` from `@/lib/assistant`, `emptyDb` from `@/lib/storage/db`, which imports `@/lib/domain/nutrition`). It also imports `@/lib/domain/chat` and `@/lib/domain/plans` (plans.ts → storage/db, node:fs, pdf-plan → unpdf; plan D10) and calls the current `ragAnswer` on `emptyDb()`, so that chain is proven in U0. Shown red with a deliberately wrong assertion, then green.
  - If `@/` does not resolve: switch the script to `tsx --tsconfig tsconfig.json --test tests/unit/*.test.ts`. If that fails too, stop and report; relative imports in tests are not a fix (the `src/` modules use `@/` internally) and tsconfig-paths must not be installed.
  - Confirm `npx tsc --noEmit` type-checks `tests/unit` (tsconfig `include`) and Playwright ignores it (`testDir: ./tests/e2e`).
- [x] T074 [foundational] Shared fixture and `memDb()` (tests/shared/assistant-fixture.ts, tests/e2e/assistant-helpers.ts, tests/unit/memdb.ts, tests/unit/memdb.test.ts)
  - Move `planFixture`, its recipe/ingredient/description data, the add-on specs, `DEFAULT_MEALS`, `TIME_WINDOWS` and `PLAN_NAME` into tests/shared/assistant-fixture.ts (no Playwright or SQL import). assistant-helpers.ts imports them; `seedPlan` inserts exactly what it did before (a pure move, reviewed as such).
  - Helper fixes (F1a review), separate commit: `seedRecipes` calls `clearPlan()` first (meal_options/plan_version_recipes FK to recipes; doc comment and the seeders comment at ~line 111 say "reseeding recipes clears the plan"), and its `ingredient_usages` delete is limited to recipe sources (add-on usages stay with their shared_add_ons). `SERVER_LOG` is built from `__dirname`, not cwd.
  - `memDb({ meals?, times?, fixture?, supplements?, objective?, logs?, goals?, name?, cart? })` returns `{ db, user }` built from `emptyDb()`: user, plan, current version with `structured_data`, meal types, recipes with ingredient usages, meal options, plan_version_recipes, shared add-ons with `add_on` usages, daily logs and cart, with the same ids and fields as the SQL seed.
  - memdb.test.ts: fixture counts (19 generic, 3 table recipes, 4 distractors), slot and option numbers, add-ons; each memDb collection's record key set equals the keys the seed's rows produce through `toRecord` (model columns plus `extra` keys), checked against a key list kept beside the seed (no Prisma import). Value formats (e.g. dates) stay e2e-only (plan Risks). Shown red by breaking a count.

**Review checkpoint U0:** `npx tsc --noEmit`; `npm run test:unit` green. Batch note: how `@/` resolved.

**Batch note U0 (done, reviewer PASS in round 2; 4+2 commits 1dbe044..1967ec9):** `@/` resolved directly under `tsx --test` (no `--tsconfig` fallback needed). memDb defaults: `fixture: true`, `times: "all"`, name "Asistente memdb", user id `chat-e2e-memdb` (the e2e `seedPlan` keeps `fixture` off by default). Round 1 caught `__dirname` being undefined under Playwright's ESM loader; `SERVER_LOG` now uses `fileURLToPath(import.meta.url)`, and that load path is first proven in the 3a2 targeted run or Batch E. Carry-over notes: T010 must update `tests/unit/smoke.test.ts` (its `kind === "unknown"` assertion and the `ragAnswer(db, userId, message)` call change with the new `(db, user, message, today)` signature; hola should become `greeting`). T008 must know `seedRecipes` now clears the plan, so `assistant-api.spec.ts` lines ~411, ~424 and ~516 lose the plan after `seedPlan`; by reading chat.ts those answers don't use the plan. Optional (LOW): pin the plan/version/add-on id formats in memdb.test.ts.

**Batch F1b: test hooks, 500 path (chat-polish REQ-23)**, about 250 lines. May run in a worktree beside 1a1 (plan Batches).

- [x] T005 [chat-polish REQ-23] Tests
  - Unit (tests/unit/test-hooks.test.ts): `testHooks()` with a non-test env (no `E2E_HOOKS`, or `NODE_ENV=production`) ignores `x-e2e-fail`, `x-e2e-today` and `x-e2e-trace`; with the test env it returns them (plan D4). Red first (module missing).
  - e2e, written (tests/e2e/assistant-errors.spec.ts): injected failure → 500, body has no internal text, the log has route, user id, message length and stack; 501 characters → 400 with issues and no log entry; malformed JSON (`{"message":`) → 400, no error-level log; panel: 500 shows "Algo salió mal al responder. Intenta de nuevo." with Reintentar (retry works), 400 keeps "No pude responder en este momento.". UI injection via `page.route` adding `x-e2e-fail: chat` (unroute before Reintentar) and `postData: '{"message":'`; the UI itself never sends `x-e2e-*`.
- [x] T006 [chat-polish REQ-23] Server (src/lib/server/test-hooks.ts, src/app/api/rag/chat/route.ts)
  - `testHooks(headers, env)` per plan D4; the route reads headers only through it.
  - Route: JSON parse or zod failure → `badRequest`. Anything after → inline 500 with `console.error` (plan Interfaces). The `fail` hook throws inside the builder call.
- [x] T007 [chat-polish REQ-23] Client (src/lib/client/api.ts, src/components/app/assistant.tsx, src/components/shared/AssistantTurn.tsx)
  - `ApiError` with `status` (message unchanged for other callers).
  - The error turn records `server: status === 500` and renders the 500 copy. Reintentar is unchanged.
  - If this batch must touch tests/e2e/assistant-helpers.ts, it is no longer parallel with 1a1.

**Review checkpoint F1b:** tsc + unit. Reviewer checklist: hooks inert without `E2E_HOOKS` or under production (unit); **the route reads headers only through `testHooks()`**; 400 paths log nothing at error level (by reading the code; proven in Batch E).

**Batch note F1b (done; T005–T007, commits bd537de, 10f9b28, 9536424 in worktree branch worktree-agent-a961a3030b18fbcc7):** `testHooks(headers, env)` is active only when `E2E_HOOKS === "1"` and `NODE_ENV !== "production"`; it parses `x-e2e-today` (strict YYYY-MM-DD, a real calendar day), `x-e2e-fail: chat` and `x-e2e-trace: 1`. Route: a JSON parse or zod failure → `badRequest` (no log); everything after → 500 `{ error: "Internal error" }` with `console.error("[api/rag/chat]", { userId, messageLength }, error)`. Client: `ApiError(message, status)`; the error turn records `server: status === 500`. Unproven until Batch E: assistant-errors.spec.ts (500 status and body, the log format `messageLength:\s*N`, the 2 s fixed waits for "no log entry", the `page.route` injections). Any e2e run before Batch 1b2 (e.g. the 3a2 targeted run if it touches these files) shows the old-copy failures listed in T013 (500 mocks in assistant-next-step, -a11y, -answers, -look).

**Batch note F1b review:** reviewer verdict PASS (HIGH none). Findings folded into T013 (500-mock list, MEDIUM), T072 first sub-bullet (assistant-errors.spec.ts retry proof MEDIUM, sentinel instead of sleep LOW, renamed no-header test LOW), T011 (`x-e2e-today` warning, LOW), T010 (typed `body` in route.ts, LOW) and the Coverage row for chat-polish REQ-23.

## Phase 3: US1 (P1) Understand me, about everything

**Batch 1a1: assistant-api pruning**, about 390 lines (about 80% deletions; no `src/` change). May run beside F1b.

- [x] T008 [US1] assistant-api pruning (tests/e2e/assistant-api.spec.ts, tests/e2e/assistant-helpers.ts)
  - Grep the whole `tests/e2e/` directory for `home-search-filter`, `home-scope`, `Alcance`, `Preguntar en Todo`, `follow_ups`, `out_of_scope`, `missing_recipe`, `overview`, `chipsFor`, `defaultScope` and the `scope` request field. Record each hit in the batch note as "edited in task X": theme-palette.spec.ts:82-91 (`sharedUi` "home scope menu") → T069; assistant-api.spec.ts `FOLLOW_UPS`, `expectTopic`, `expectFixedReply`, the `FollowUp`/`ScopeKey` imports and their tests → T008; assistant-helpers.ts `ask` scope/`recipeId` parameters → T008; `buildAnswer`, `mockChat`, `UNKNOWN_LEAD`, `UNKNOWN_ANSWER`, `CAPABILITY_LINE` and the old-shape imports → T013; the old-UI assertions in assistant-scope, -answers, -next-step, -a11y, -composer, -look → T013. Known false positives to note and ignore: `.user-chip` (theme-switch, theme-palette), the `scope` option of `auditNow` (theme-audit.ts, theme-login), and bare `scope`/`overview` hits in theme-* files that do not touch the assistant.
  - Delete every assistant-api.spec.ts test asserting scope, recipe_id, `unknown`/`out_of_scope`/`missing_recipe`/`overview` kinds, UNKNOWN_LEAD, context_used by scope, or the old FOLLOW_UPS lists. Supersession for the batch note (title → task): chat-polish REQ-19 winners table, unknown reply in Todo, whole-word rule → T070 (unit) and T017; chat-polish REQ-20 scope/overview/missing-recipe tests, `context_used` by scope, the "Carrito actual" alias → T072; old fallback texts, the unknown-reply test, chat-polish REQ-6 "unrecognized question" → T048; Plan activo overview and Recetario "hola" → T048 and T050; "Esta receta" builder tests → T034; chat-polish REQ-5 follow-ups and page suggestions → T072 and T012; the `sources` test drops its out-of-scope case. Builder tests on cart, recipe list, plan and meal times stay, minus their `expectTopic`/scope parts, asserting no `follow_ups` and no kind other than `answer`.
  - `ask(request, message, { today?, fail?, trace? })` loses the legacy string form and its `ScopeKey` use (T004). `seedPlan`'s `fixture` stays opt-in (old specs seed recipes before the plan); every new spec passes `fixture: true`. Replace the "T008/T013 flip the default" comment (~line 177) with that rule.
  - Path-limited sub-commits are allowed (the helper edit; one per pruned test group).

**Review checkpoint 1a1:** tsc + unit; `grep -En "ScopeKey|FollowUp|FOLLOW_UPS|follow_ups|UNKNOWN_LEAD|expectTopic|scope|recipe_id|overview|out_of_scope|missing_recipe" tests/e2e/assistant-api.spec.ts` returns nothing; no `test.skip`/`fixme`/`fail` added. Batch note: the "edited in task X" hits and each deleted title with its superseding task.

**Batch note 1a1 (done; T008, commit babeb85, worktree branch worktree-agent-ab226b2ae9a589034, +46/-390):** about 50 generated tests deleted, each mapped to its superseding task (supersession list in T008); a single commit because tsc must pass. `ask(request, message, { today, fail, trace })` has no legacy string form; `fixture` stays opt-in; an `answer()` helper replaces `expectTopic`. Edited in task X: theme-palette.spec.ts:82-91 → T069; assistant-helpers.ts `buildAnswer`/`mockChat`/cart literals → T013; old-UI assertions in assistant-scope, -answers, -next-step, -a11y, -look → T013. False positives: assistant-helpers.ts:64 "scoped to the user", the `auditNow` `scope` option (theme-login, theme-audit), `.user-chip`.

**Batch 1a2: wire model and scope-free server**, about 360 lines. After F1b (both touch route.ts).

- [ ] T072 [US1] Tests REQ-4 (API), REQ-5, REQ-13 clock
  - First commit of the batch (these hold on the current server; tests/e2e/assistant-api.spec.ts): two e2e tests: (1) empty recipe book: `seedRecipes([])`, then `answer(chatContext, "¿Qué recetas tengo?")` asserts the lead "Aún no tienes recetas.", sections `[]` and sources `[]`; (2) soft-deleted recipe: `softDeleteRecipe` on one seeded recipe, then it is missing from the "Recetas" list. 1a1 review cleanups (LOW) in the same commit: drop the redundant `expect(body.kind).toBe("answer")` in the two REQ-18 tests (`answer()` already checks it), the double blank line after the header comment (~19-20), and reword or drop the stale comment at ~104 ("They need the builders of Batch 2b, so this group stays red until then"). F1b review cleanups in tests/e2e/assistant-errors.spec.ts, same commit: (a, MEDIUM) "Reintentar works" (~94-97) also asserts the panel does not contain `REQUEST_ERROR_COPY`, the Reintentar button has count 0, and the live region is non-empty (or matches the known answer text once T048 fixes it); (b, LOW) `expectNoErrorLog` (~29-32) drops the 2 s sleep: after the 400, send `ask(request, "x", { fail: true })` as a sentinel, wait with `logWith(log, INJECTED)`, then assert `LOG_MARK` occurs exactly once in `log.since()`; (c, LOW) rename "without the hook header the question is answered" (~50) so it no longer claims REQ-23's outside-test-environment criterion (that guard is unit-covered; see Coverage).
  - Unit (tests/unit/chat-answer.test.ts, tests/unit/schemas.test.ts, tests/unit/chat-dates.test.ts): over `memDb()`, `ragAnswer(db, user, message, today)` returns a `kind` in the allowed `ReplyKind` set (plan Interfaces), asserted against that set rather than the removed names; `context_used` = "Todo el sistema"; `blocks` and `buttons` present; `answer` equals the concatenated blocks; `resolved` only with the trace option. The server repeat rule on follow-ups. Add `sweep(db, user, answers, today)` to tests/unit/memdb.ts (plan Testing strategy) and sweep the starters and follow-ups whose builders exist (cart, recipes, meal times, plan); it fails on placeholders or an empty set. `chatSchema.parse({ message, scope, recipe_id })` deep-equals `{ message }`. `serverToday(new Date("2026-10-29T03:00Z"))` = "2026-10-28". Red first.
  - e2e, written (tests/e2e/assistant-noscope.spec.ts): the same answer with and without `scope` and `recipe_id` (incl. "Receta" + a recipe id) via raw `request.post`; `resolved` absent without the trace header; `resendSweep` over the starters. First fix `resendSweep` against vacuous passes (assistant-helpers.ts): per message assert `again.status` is 200, `body.kind` is defined, `first.body.blocks` is a non-empty array before the equality, and run the placeholder check over each input's block text too. REQ-5 is claimed only after T063.
- [ ] T009 [US1] Wire types `Button`, `Block`, new `ReplyKind`, `Intent`, optional `resolved`. Keep old top-level fields so the old client compiles (src/lib/assistant.ts)
- [ ] T010 [US1] Server answer (src/lib/domain/chat.ts, src/lib/domain/chat-topics.ts)
  - `ragAnswer(db, user, message, today)` with no scope; `reply()` builds blocks, buttons and `answer`.
  - Follow-ups become question buttons per the Topics table; server repeat rule; the 4 Topics starters.
  - `resolved` filled only when the route passes `trace`; topics with no builder use the D3 placeholder.
  - Update tests/unit/smoke.test.ts in the same commit: the new `ragAnswer(db, user, message, today)` call, and "hola" → `greeting` instead of `kind === "unknown"`. Revisit the `sources` test in assistant-api.spec.ts: `sourcesOf("¿Qué hago ahora?")` stays `[]` once it becomes `no_match`, and the test also asserts that kind (finalized in T048).
  - F1b review (LOW): when the route's `ragAnswer` call changes, type `let body;` (src/app/api/rag/chat/route.ts:13) as `z.infer<typeof chatSchema>`.
- [ ] T011 [US1] Request, loading, today (src/lib/validation/schemas.ts, src/lib/domain/queries.ts, src/lib/domain/chat-dates.ts, src/app/api/rag/chat/route.ts)
  - `chatSchema` = `{ message }`; `needs.chat`; the route uses `loadFor(user, "chat")`.
  - `serverToday(now)` via `Intl` in America/Mexico_City; the route passes `serverToday(new Date())` and `trace` from `testHooks()`.
  - F1b review (LOW; src/lib/server/test-hooks.ts:24-25, tests/unit/test-hooks.test.ts): with hooks enabled, an `x-e2e-today` that is present but not a real day `console.warn`s once (or throws so the test fails loudly); still ignored in production. Unit test first.

**Review checkpoint 1a2:** tsc + unit. The old client still compiles (old top-level fields kept until T016).

**Batch 1b1: scope-free client state, button renderer and pages**, about 390 lines (about 45% deletions; code added ≤ ~220)

- [ ] T012 [US1] Tests REQ-4 UI, REQ-5 client, e2e only, written (tests/e2e/assistant-noscope.spec.ts)
  - On a recipe page, "¿Qué hay en mi carrito?" gives the cart answer.
  - The search bar opens the panel and sends "¿Cuál es mi peso?"; the request carries only `{ message }` (copy asserted in T044).
  - No "Alcance", scope menu or "Preguntar en Todo" on `/`, `/recipes/<id>`, `/groceries` or `/plans`.
  - The 4 starters on every page; the same question on `/recipes/<id>` and on `/groceries` (different subtitles) gives identical visible answer text and buttons.
  - 360 px header row 1: title, "Nueva conversación" and ×, each ≥44×44, no overlap.
  - Placeholder "Pregunta por tu plan, tu avance o tus compras" and aria name "Preguntar al asistente".
- [ ] T014 [US1] Client state (src/components/app/assistant.tsx, src/components/app/AppShell.tsx)
  - Remove scope state, `chipsFor`, page suggestions and `askInScope` scope; `send({ message })`, `askAssistant(message)`.
  - So every task commit type-checks: `askAssistant`/`askInScope` keep an optional, ignored `scope?: ScopeKey` and the page-context type keeps `defaultScope?`/`suggestions?` optional until T069 removes the call sites and then these parameters. `ScopeKey`, `SCOPE_LABEL` and the suggestion builders stay in src/lib/assistant.ts until T016.
  - The `AssistantChat`/`ScopeSwitcher` props stay optional or are still passed by AppShell until T015 removes them, or T014 and T015 land as one commit.
- [ ] T015 [US1] Renderer and header (src/components/shared/AssistantTurn.tsx, src/components/shared/AssistantChat.tsx, src/components/shared/assistant-chat.css; delete src/components/shared/ScopeSwitcher.tsx)
  - Render blocks (title, lead, sections, block buttons) and answer buttons; question buttons only under the latest answer; links (`next/link`) on every answer. Header row 2 removed.
- [ ] T069 [US1] Pages (src/components/dashboard/DashboardView.tsx, src/components/dashboard/home.css, src/components/recipes/RecipeDetail.tsx, src/components/groceries/GroceriesChat.tsx, src/components/app/assistant.tsx, src/components/app/AppShell.tsx, tests/e2e/theme-palette.spec.ts)
  - Search bar: scope menu, filter button and their CSS removed; fixed placeholder and aria name (spec Copy); `onAsk(message)`.
  - In the same commit as the CSS removal: delete the `sharedUi` entry "home scope menu" in tests/e2e/theme-palette.spec.ts (~82-91; it feeds the sweeps at ~336 and ~406). Named in the batch note.
  - RecipeDetail and GroceriesChat register a subtitle label only. Then drop the temporary optional parameters from T014.

**Review checkpoint 1b1:** tsc + unit; `grep -rEn "home-search-filter|home-scope" src tests/e2e --exclude=assistant-noscope.spec.ts` returns nothing (old-spec grep rule in Global rules).

**Batch 1b2: test churn and leftovers**, about 300 lines (mostly test rewrites and deletions)

- [ ] T013 [US1] Test churn (tests/e2e/*.spec.ts, tests/e2e/assistant-helpers.ts)
  - Delete tests/e2e/assistant-scope.spec.ts. Move `buildAnswer`/`mockChat` to the new shape; replace `UNKNOWN_LEAD`/`UNKNOWN_ANSWER`/`CAPABILITY_LINE` and every `follow_ups` use.
  - Old specs that mock a 500 and expect "No pude responder en este momento." now get "Algo salió mal al responder. Intenta de nuevo." (F1b, T007; F1b reviewer line numbers, where the copy is asserted): assistant-next-step.spec.ts 317-318, 372, 391 and 512 (the "REQ-5 with REQ-8" describe), assistant-a11y.spec.ts 385 and 715, assistant-answers.spec.ts:84, assistant-look.spec.ts:112 (a snapshot, refreshed in T057). Vacuous after the change: next-step 330 and 338 (`not.toContainText(ERROR_COPY)` after the retry) assert the copy actually shown. Unaffected: a11y 185 and 480, next-step 402 and 427 (abort/timeout keep the generic copy); mocks of a 400 or a network error keep the old copy. Rule: a test about REQ-23 behaviour asserts the server-error copy; a test meant to cover chat-polish REQ-8's generic copy switches its mock to a non-500 status, at least one of them to 503 (today only 400 and abort cover "any other non-2xx"); a vacuous `not.toContainText` asserts the copy actually shown.
  - Rewrite to the new behavior, or delete, every test in assistant-answers, -next-step, -a11y, -composer and -look that asserts chips, scope, "Alcance", "Preguntar en Todo", the old placeholder, `follow_ups`, or the kinds `out_of_scope`/`missing_recipe`/`overview` (found by grep). Batch note: each title rewritten or deleted, with its superseding task. No `test.skip`/`fixme`/`fail`.
- [ ] T016 [US1] Leftovers (tests/e2e/assistant-api.spec.ts, src/lib/assistant.ts, src/lib/domain/chat.ts)
  - First, as the tests-first commit: move every remaining top-level `lead`/`sections`/`body` assertion in tests/e2e/assistant-api.spec.ts to `blocks`.
  - Gate before removing anything: `grep -rEn "ScopeKey|SCOPE_LABEL|FollowUp|follow_ups|chipsFor" tests/e2e` returns nothing, `grep -En "\.lead|\.sections|\.body" tests/e2e/assistant-api.spec.ts | grep -v "blocks"` returns nothing, and tsc passes. A hit goes back to T013.
  - Remove `ScopeKey`, `SCOPE_LABEL`, the suggestion builders and the old top-level response fields.
- T071 removed in revision 6 (the mid-feature snapshot refresh; the only refresh is T057 in Batch E).

**Review checkpoint 1b2:** tsc + unit; `grep -rEn "ScopeKey|SCOPE_LABEL|FollowUp|follow_ups|chipsFor|out_of_scope|missing_recipe|Preguntar en Todo" src tests/e2e --exclude=assistant-noscope.spec.ts` returns nothing (src plus the old specs; tests/unit and the new negative-assertion files excluded per Global rules). The 3a worktree may start from this tip.

**Batch 1c1: normalizer and word matcher**, about 240 lines

- [ ] T017 [US1] Unit tests REQ-2 (tests/unit/chat-match.test.ts)
  - The full REQ-2 matcher table on `matchWord`, each ✓ and ✗ row (incl. "una planta" ≠ "plan"), plus multi-word phrase consumption and `normalizeText` per spec Terms (ñ→n, punctuation → space). Red first.
- [ ] T018 [US1] `normalizeText` per spec Terms and `words` (src/lib/assistant.ts)
- [ ] T019 [US1] Matcher (src/lib/domain/chat-match.ts)
  - OSA distance and length allowance (≤4 exact, 5–7 one edit, ≥8 two); singular/plural (s, es, z→ces); `*` stems exact prefix only.
  - First-letter rule, never-fuzzy words, no fuzzy when the word exactly equals any entry.
  - Multi-word phrases with per-word allowance; the longest phrase consumes its words.

**Review checkpoint 1c1:** tsc + unit (T017 green).

**Batch 1c2: vocabulary through the answer path**, about 220 lines

- [ ] T070 [US1] Tests REQ-1, REQ-2
  - Unit (tests/unit/chat-answer.test.ts): through `ragAnswer` on `memDb()`, the REQ-1 Givens whose topic list equals the matched topics in order of first appearance (`resolved` plus answer text for cart, recipes, meal times, plan); the REQ-2 table end to end (each ✓ row resolves to its topic, each ✗ row does not, incl. "una planta" not resolving to Plan); "¿Qué hago ahora?" and "¿Qué cosas tengo?" → `no_match` with the starters; the chat-polish REQ-19 winners table re-created in the new vocabulary. Red first.
  - e2e, written (tests/e2e/assistant-match.spec.ts): through `ask()`, one REQ-1 Given with answer text, one ✓ typo row and one ✗ row of REQ-2.
- [ ] T020 [US1] Vocabulary (src/lib/domain/chat-topics.ts, src/lib/domain/chat.ts)
  - Every Topics trigger, the frozen recipe-list filter words, the Button/Title/Follow-ups table, the starters.
  - Interim until T023: the intent list is the matched topics in order of first appearance, capped at 2 plus overflow, no REQ-6 rules.
  - chat.ts drops its `nutrition.normalize` import (plan D6).

**Review checkpoint 1c2:** tsc + unit.

**Batch 1d: resolution order**, about 310 lines

- [ ] T021 [US1] Tests REQ-6
  - Unit (tests/unit/chat-intent.test.ts): the REQ-1 Givens left out of T070; via `resolved` and answer text where a builder exists: ingredientes + desayuno, cuándo/hora + compro, ingredientes + comprar, meta de peso, recetas + plan, the button "¿Qué recetas hay en mi plan?", nombre de mi plan, cuántas comidas llevo, qué lleva la cena, cuánto llevo. Every Topics Button, Follow-up and starter of topics that exist at 1d resolves to exactly its topic; `sweep()` extended to them. "<Slot ref>" buttons move to T028, "¿Qué lleva <receta>?" to T026. Red first.
  - e2e, written (tests/e2e/assistant-match.spec.ts): two REQ-6 Givens with answer text through `ask()`.
- [ ] T022 [US1] Resolver (src/lib/domain/chat-intent.ts)
  - REQ-6 steps 1–8, with hooks for step 2 (US2) and step 4 (T027); phrase consumption.
  - Combinations: time + slot, goal + metric, "plan" possessor, Plan only when alone, ingredientes + cart, a time word without a slot ignored. At most 2 topics plus overflow.
- [ ] T023 [US1] Wire the resolver into `ragAnswer`, replacing T020's first-appearance list (src/lib/domain/chat.ts)

**Review checkpoint 1d:** tsc + unit.

**Batch 1e: dish matcher (fuse.js)**, about 190 lines

- [ ] T024 [US1] Spike, outside the repo
  - Copy the project to the session scratchpad as a real copy (excluding node_modules and .next*), then `npm ci` and `npm install fuse.js@7.5.0 --save-exact` inside the copy. **Never symlink node_modules** here.
  - `npx tsx` over the REQ-3 table with the real recipe names and with the shared fixture; pick threshold and options that pass both; record them in the batch note.
  - Real names are read read-only (GET /api/recipes on :3000 or a single `SELECT name`); nothing else on :3000, the real DB or the repo is touched; real names never enter the repo.
- [ ] T025 [US1] Install fuse.js exactly 7.5.0 in the repo. The orchestrator runs it, with the user's yes already given (package.json, package-lock.json)
- [ ] T026 [US1] Tests REQ-3
  - Unit (tests/unit/chat-dish.test.ts): every table row except "la comida opcion 1" on `memDb({ fixture: true })` (recipe id, candidates, or not found), incl. "la opcion 1" → not found and "la pizza" → not found; generic names and distractors are never candidates; a soft-deleted fixture recipe is never a candidate (also e2e below). The "¿Qué lleva <receta>?" message for each fixture recipe resolves to it. Red first.
  - e2e, written (tests/e2e/assistant-match.spec.ts): "pollo asado" found and "la pizza" not found through `ask()` (text in T034, T048); after `softDeleteRecipe`, that recipe's name is not found.
- [ ] T027 [US1] Dish matcher with the spike's threshold (constant with a comment) and REQ-6 step 4 (src/lib/domain/chat-dish.ts, src/lib/domain/chat-intent.ts)

**Checkpoint:** US1 resolution (REQ-1 to REQ-6) green in unit tests, except the REQ-3 row "la comida opcion 1" (T031); text coverage for REQ-3 and the slot/metric rows of REQ-1/REQ-6 completes in US2–US4.

## Phase 4: US2 (P1) Meal detail

**Batch 2a: slots and times**, about 310 lines

- [ ] T028 [US2] Tests REQ-7, REQ-8, REQ-11 (duplicates)
  - Unit (tests/unit/chat-meals.test.ts): REQ-7 almuerzo question and buttons (1 or 2), merienda/snack → colación, not in plan; REQ-8 one slot's time highlighted, a slot without a time, all slots; REQ-11 two colaciones → 2 buttons with "(<time>)", "colación 2" and "segunda colacion", 11 slots → "Colación 11", masculine ordinals; `sweep()` over every "<Slot ref>" and almuerzo-clarify button; answer text for the slot Givens of REQ-1 and REQ-6. Red first.
  - e2e, written (tests/e2e/assistant-meals.spec.ts): an almuerzo question and the duplicate-colación buttons through `ask()`; one REQ-8 slot-time row through `ask()` covering a single slot's time highlighted, a slot without a time, and all slots.
- [ ] T029 [US2] Slots (src/lib/domain/chat-meals.ts)
  - Slot list from `activeSchedule`, word-to-slot mapping, almuerzo/merienda/snack rules.
  - Slot refs and ordinals (feminine/masculine, >10), slot buttons (times vs options message); slot times builder and variants.
- [ ] T030 [US2] Resolver: slot words, typed ordinals and "<slot> <n>" for duplicated slots (src/lib/domain/chat-intent.ts)

**Review checkpoint 2a:** tsc + unit.

**Batch 2b: options, paging, selection**, about 300 lines

- [ ] T031 [US2] Tests REQ-9, REQ-10, REQ-11 (option buttons)
  - Unit (tests/unit/chat-meals.test.ts): 5 options → 3 + "Ver más opciones"; page 2 → 4–5 + "Opciones anteriores"; 7 options → page 3 shows option 7 with "Opciones anteriores" only; page 9 → last page. Labels: "Opción 2: Pollo, Arroz, Brócoli…" (4 ingredients), exactly 3 → no "…", 0 → "Opción <n>". "cena opción 2", "cena opcion 2", "la 2 de la cena" equal; "cena opción 7" → "Tu cena tiene 4 opciones." + first page. REQ-11: "Segunda colación" lists the second slot's options with buttons sending "Segunda colación, opción <n>". REQ-3 row "la comida opcion 1": option selection, comida, option 1, `kind` neither `did_you_mean` nor `no_match`. `sweep()` over option and paging buttons. Red first.
  - e2e, written (tests/e2e/assistant-meals.spec.ts): one UI flow tapping through the pages (the user turn shows the sent message); "cena opción 2" through `ask()`.
- [ ] T032 [US2] Options builder: lead variants, `layout: "option"` buttons in plan order, labels, paging messages, out-of-range (src/lib/domain/chat-meals.ts)
- [ ] T033 [US2] Resolver step 2: option selection and paging, incl. page 1 and no number = page 2 (src/lib/domain/chat-intent.ts)

**Review checkpoint 2b:** tsc + unit.

**Batch 2c: dish detail**, about 320 lines

- [ ] T034 [US2] Tests REQ-12, REQ-11 (single option), REQ-3 text
  - Unit (tests/unit/recipe-steps.test.ts): `recipeSteps` returns no steps for "Extraído de plan.pdf", "EXTRAÍDO DE plan.pdf" and "Extraido de plan.pdf"; "¿Listo? Ásalo. Él sirve." keeps its split. Red first.
  - Unit (tests/unit/chat-meals.test.ts): 12 ingredients all shown; steps 1–2 equal `recipeSteps(description)` 1–2, plus the "Ver receta completa" link to `/recipes/<id>`; "Extraído de plan.pdf" → the no-preparation item; complement "Agua natural · 1 vaso", none → no heading; by dish name, complements only if the recipe is in exactly one slot; ingredient formats with no unit and with neither; a generic-name lead; a single-option slot goes straight to the detail; a recipe with zero ingredients and zero steps still gets a detail answer (lead, no empty headings); every detail answer's `sources` equals `["Receta: <name>"]` (contract keeps `sources`); REQ-3 text: each found row shows the detail lead and "la comida opcion 1" shows comida option 1's detail; end-of-US2 `sweep()` over every existing Topics, slot, option, paging and "¿Qué lleva <receta>?" button.
  - e2e, written (tests/e2e/assistant-meals.spec.ts): the recipe page shows the empty-steps state for the three import notes and keeps the accented split (display unchanged by T035); "Ver receta completa" opens `/recipes/<id>`; one detail answer through `ask()`.
- [ ] T035 [US2] Shared `recipeSteps(description)` using `normalizeText`, used by the recipe page (no display change) (src/lib/recipe-steps.ts, src/components/recipes/RecipeDetail.tsx)
- [ ] T036 [US2] Detail builder: lead, uncapped "Ingredientes", "Preparación" (2 steps + link), "Acompaña con" from the slot's add-ons and `add_on` usages (src/lib/domain/chat-meals.ts)

**Checkpoint:** US2 code complete (REQ-7 to REQ-12), unit-green; e2e in Batch E.

## Phase 5: US3 (P2) Weekly goals and date-based data

**Batch 3a1: shared progress math**, about 200 lines. Worktree from the 1b2 tip, beside 1c1–3b2; touches only the files below.

- [ ] T075 [US3] Unit tests for progress.ts (tests/shared/progress-fixture.ts, tests/unit/progress.test.ts)
  - tests/shared/progress-fixture.ts: the parity log rows (both sides of Monday, a capped water day, none after today) and their hand-computed expected numbers for today 2026-10-28; T066 uses the same file.
  - `mondayOf`, `weekDays`, `waterGoalGlasses` (clamp 4–12, 2 L default), `weekWater` (capped), `mealsDoneOn` (filtered to slot ids, clamped), `weekMeals`, `weekExercise` with `endDay` = Sunday and = today (D9), `weightStats` (latest, before Monday, change, goal ratio) equal the expected numbers. Red first (module missing).
- [ ] T037 [US3] Pure module (src/lib/progress.ts)
  - UTC date-key helpers, `mondayOf`, `weekDays`, `waterGoalGlasses(liters)`.
  - `weekWater`, `mealsDoneOn`, `weekMeals`, `weekExercise`, each with `endDay`; `weightStats`.

**Review checkpoint 3a1:** tsc + unit.

**Batch 3a2: dashboard refactor**, about 170 lines. Same worktree; merged before 3c.

- [ ] T066 [US3] e2e, written: dashboard baseline for REQ-16 (tests/e2e/assistant-parity.spec.ts)
  - The chat user's dashboard with `timezoneId: "America/Mexico_City"` and `page.clock.setFixedTime` (2026-10-28), logs from tests/shared/progress-fixture.ts; tile numbers (exercise days, water liters with a capped day, meals D de N, weight change) equal its expected values. First spec run in Batch E.
- [ ] T038 [US3] DashboardView uses `progress.ts` with `endDay` = Sunday and identical output (src/components/dashboard/DashboardView.tsx)

**Review checkpoint 3a2:** tsc + unit. Reviewer reads the T038 diff for identical inputs, rounding and `endDay` = Sunday (plan Risks). At the merge into the feature branch, the orchestrator runs `npx playwright test assistant-parity.spec.ts -g "dashboard"` once (the only e2e run before Batch E; user decision 2026-10-29): needs the e2e config from T003 (already in) and a T066 test title containing "dashboard"; one server start, one DB clone, nothing else running, foreground; afterwards `lsof -i :3200` is empty and `psql -l` shows no `*-e2e` DB. A failure blocks this checkpoint and is fixed in 3a2. The result is recorded in the 3a2 batch note.

**Batch 3b1: date parser**, about 260 lines (3a may run beside it)

- [ ] T039 [US3] Tests REQ-13, REQ-14 periods
  - Unit (tests/unit/chat-dates.test.ts): every REQ-14 phrase → its period bounds with today passed in (cue and period-noun rules); no fallback for "Mi avance de la semana", "¿Cuántos días hice ejercicio?", "a la semana", "en la semana"; "en el mes" = this month. Red first.
  - e2e, written (tests/e2e/assistant-progress.spec.ts): the `x-e2e-today` pin moves the period bounds in `resolved`; a pin header without the trace header changes no field shape.
- [ ] T040 [US3] Date parser: cue and period-noun rules, the phrase table → `Period` (src/lib/domain/chat-dates.ts)
- [ ] T041 [US3] The route passes the pinned today from `testHooks()` (else `serverToday`); the resolver attaches the period to metric intents (src/app/api/rag/chat/route.ts, src/lib/domain/chat-intent.ts)

**Review checkpoint 3b1:** tsc + unit.

**Batch 3b2: period labels, clamp, fallback**, about 220 lines

- [ ] T067 [US3] Unit tests REQ-14 labels (tests/unit/chat-dates.test.ts)
  - Every REQ-14 row → its label (es-MX); year suffix; future-day cut; "últimos 400 días" → 366 days plus the clamp flag; fallback for "hace dos semanas", "31 de febrero", "el mes anterior". Red first. (e2e for REQ-14 text: T042.)
- [ ] T068 [US3] Labels (es-MX abbreviations in code), year suffix, future-day cut, clamp, fallback line (src/lib/domain/chat-dates.ts)

**Review checkpoint 3b2:** tsc + unit. The 3a worktree is merged before 3c starts.

**Batch 3c: water and exercise**, about 320 lines

- [ ] T042 [US3] Tests REQ-15, REQ-17, REQ-18, REQ-13/14 text, REQ-16
  - Unit (tests/unit/chat-metrics.test.ts, `memDb({ logs })`, today passed in): water today plus the week line; "hoy" only; "ayer" only; uncapped 10 glasses with the week line counting 2 litros; range totals, average and days met. Exercise: week remaining with singular "Te falta 1 día", the met line, today yes/no, another single day, full week vs other ranges. Every REQ-14 label row through water or exercise answers; the clamp line ("Solo puedo revisar hasta 366 días; te muestro los últimos 366.") and the fallback line ("No entendí la fecha; te muestro <periodo>."). REQ-13: a log dated after today leaves "Esta semana (…)" liters unchanged. REQ-27 empty ranges: 0 with the period label. Metric Givens of REQ-1 and REQ-6. Red first.
  - e2e, written: extend T066 (tests/e2e/assistant-parity.spec.ts) with the same pin header, chat water week liters and exercise days equal the tiles; through `ask()` with `today` pinned, "¿Cuánta agua tomé hoy?" changes with the pin and one exercise answer (tests/e2e/assistant-progress.spec.ts).
- [ ] T043 [US3] Water and exercise builders on `progress.ts`, `endDay` = today, incl. the 0-with-label empty range (src/lib/domain/chat-metrics.ts)

**Review checkpoint 3c:** tsc + unit.

**Batch 3d: weight and meals done**, about 320 lines

- [ ] T044 [US3] Tests REQ-19, REQ-20, REQ-14 text, REQ-16 (meals, weight), REQ-27 (weight)
  - Unit (tests/unit/chat-metrics.test.ts): REQ-19 exact sentence; no week line without a record this week; "sin cambio"; "meta alcanzada"; no goal → "Fijar mi meta"; last record over 7 days → the line + "Registrar mi peso"; range min/max. REQ-20: today 3 de 5, week ×7, a range with %. REQ-14 range labels and the fallback line in weight and meals answers. REQ-27: no weight logs → "Aún no registras tu peso." + "Registrar mi peso" (/); an empty weight range → "<Periodo>: no registraste tu peso."; an empty meals range → 0 with the label. Red first.
  - e2e, written: extend T066 (meals done D de N, weight change) (tests/e2e/assistant-parity.spec.ts); the T012 search-bar question shows the weight copy (tests/e2e/assistant-noscope.spec.ts); no weight logs through `ask()` (tests/e2e/assistant-progress.spec.ts).
- [ ] T045 [US3] Weight and meals-done builders, incl. the no-weight-logs reply and empty ranges; the no-active-plan reply for meals done is left to T052 (src/lib/domain/chat-metrics.ts)

**Review checkpoint 3d:** tsc + unit.

**Batch 3e: goals, weekly progress**, about 270 lines

- [ ] T046 [US3] Tests REQ-21, REQ-22, REQ-16
  - Unit (tests/unit/chat-metrics.test.ts): REQ-21 bare goals, narrowed water goal, no active plan; a plan of 1 L → "Tu meta de agua es **4 vasos** (1 litro) al día."; 4 L → "**12 vasos** (4 litros)". REQ-22: 4 items / 3 without a weight change / no plan. `sweep()` over metric follow-ups ("Fijar mi meta"/"Subir mi plan" are links, excluded). Red first.
  - e2e, written: parity of the goals answer's exercise and water goals and every weekly-progress item with the tiles under the T066 pin (tests/e2e/assistant-parity.spec.ts); one goals answer through `ask()` (tests/e2e/assistant-progress.spec.ts).
- [ ] T047 [US3] Goals and weekly-progress builders, incl. the no-plan line and "Subir mi plan" (src/lib/domain/chat-metrics.ts)

**Checkpoint:** US3 code complete (REQ-13 to REQ-22), unit-green; parity (REQ-16) proven in Batch E.

## Phase 6: US4 (P2) Chat-like edge cases

**Batch 4a: greeting, variants, no-match, did-you-mean**, about 290 lines

- [ ] T048 [US4] Tests REQ-23, REQ-26, REQ-28, REQ-29, REQ-3 text
  - Unit (tests/unit/chat-edges.test.ts): "hola" → greeting + 4 buttons; thanks; "Hola, ¿cuánto peso?" → weight. Pizza not-found quotes "pizza"; pollo → did-you-mean with 2 buttons (no distractor offered); "la opcion 1" → not found. The same question twice → the same variant; for each answer with variants, questions hitting different variants show identical numbers and units (REQ-28). Capital de Francia → no-match + 4 starters; a near recipe name → did-you-mean. No-match asserts the exact lead (one of the two spec Copy variants), exactly the 4 starter buttons, and no objective or meal name anywhere in the answer. Negative assertion (tests/unit/chat-answer.test.ts): the old fallback texts "No encontré esa información en tu plan activo." and "No encontré esa información en el sistema." never appear. `sweep()` over greeting, no-match and did-you-mean buttons. Red first.
  - e2e, written (tests/e2e/assistant-edges.spec.ts): through `ask()`, "hola", pollo did-you-mean, pizza not found, the same question twice. Finalize the `sources` test in assistant-api.spec.ts: "¿Qué hago ahora?" → kind `no_match` and `sources` `[]`.
- [ ] T049 [US4] Builders and variant picker; REQ-29 matching on the whole question minus stop words (src/lib/domain/chat.ts, src/lib/domain/chat-dish.ts)

**Review checkpoint 4a:** tsc + unit.

**Batch 4b: multi-topic, clarifications, missing data**, about 340 lines

- [ ] T050 [US4] Tests REQ-24, REQ-25, REQ-27
  - Unit (tests/unit/chat-edges.test.ts): "agua, ejercicio y peso" → 2 titled blocks + "Mi peso"; desayunar y cenar → options + "¿Cuál es mi cena?". Clarify answers stand alone; "¿Cuánto llevo?" → 3 buttons; a dish cue with no dish → 3 recipe buttons, or slot buttons when none. REQ-27 cases not tested earlier: no active plan for plan, slot and meals-done questions; "¿Qué puedo cenar?" without cena → "Tu plan no tiene cena." + one button per slot, starters when none; a slot with no options; an empty recipe book: "¿Qué recetas tengo?" → lead "Aún no tienes recetas.", no sections, `sources` `[]`. `sweep()` over clarify, did-you-mean and overflow buttons; none resolves to another question or no-match. Red first.
  - e2e, written (tests/e2e/assistant-edges.spec.ts): the multi-topic question and "¿Cuánto llevo?" through `ask()`; one no-active-plan slot question.
- [ ] T051 [US4] `reply()` 2-block rules: titles, one option block, follow-ups then overflow, a later clarify omitted (src/lib/domain/chat.ts)
- [ ] T052 [US4] Clarify replies and the missing-data replies tested in T050 only (src/lib/domain/chat-meals.ts, src/lib/domain/chat-metrics.ts)

**Checkpoint:** US4 code complete (REQ-23 to REQ-29), unit-green.

## Phase 7: US5 (P3) Identity

**Batch 5: identity**, about 150 lines

- [ ] T053 [US5] Tests REQ-30, REQ-31
  - Unit (tests/unit/chat-identity.test.ts): "Te llamas Rafael." highlighted; a blank name; "Plan octubre.PDF" → "Plan octubre"; the plan summary lead has the name; no plan → REQ-27; answer text for the identity Givens of REQ-6. Red first.
  - e2e, written (tests/e2e/assistant-identity.spec.ts): "¿Cómo me llamo?" and the plan name through `ask()`.
- [ ] T054 [US5] Identity builders and the plan-summary lead (src/lib/domain/chat.ts)

**Checkpoint:** US5 code complete (REQ-30, REQ-31), unit-green.

## Phase 8: US6 (P3) Conversation UI

UI-only: e2e tests are written here and proven in Batch E (T076 run, T077 breakage demo).

**Batch 6a: bubbles, avatar, button variants**, about 320 lines

- [ ] T055 [US6] e2e, written: REQ-32, REQ-34, REQ-35 visuals (tests/e2e/assistant-look.spec.ts, tests/e2e/assistant-a11y.spec.ts)
  - Sides and avatar (32 px `Bot`, aria-hidden, also on errors).
  - Contrast in both themes: text 4.5:1, boundary 3:1, for bubbles, avatar and the `ArrowUpRight` icon (3:1 against its button).
  - 360 px: a 500-character message and an 80-character token have no overflow.
  - Vertical option buttons stretch, wrap, ≥44 px; nav links ≥44×44 px at 360 px.
  - Visible focus ring on option buttons and nav links, both themes. Bubbles are not keyboard-focusable: no tabindex, skipped by Tab.
  - Only the last answer has question buttons; `aria-disabled` while pending (focusable, sends nothing); links work on old answers.
  - The arrow icon is aria-hidden; the accessible name equals the label.
- [ ] T056 [US6] Single button component with `option` and `link` variants (`ArrowUpRight`); bubbles and avatar with theme tokens only (src/components/shared/PromptSuggestion.tsx, src/components/shared/AssistantTurn.tsx, src/components/shared/assistant-chat.css)

**Review checkpoint 6a:** tsc + unit.

**Batch 6b: typing and live region**, about 300 lines

- [ ] T058 [US6] Fetch https://prompt-kit.com/c/response-stream.json into the scratchpad (no install); adapt it with attribution (src/components/shared/ResponseStream.tsx)
- [ ] T059 [US6] e2e, written: REQ-33 (tests/e2e/assistant-look.spec.ts, tests/e2e/assistant-a11y.spec.ts)
  - A long lead completes within 1 s; buttons appear only after it; tapping completes it; reduced motion → immediate.
  - The live region changes once and includes "3 opciones" and the labels.
  - No replay after close/reopen or navigation; the scroll uses the final height.
- [ ] T060 [US6] Type the first lead only (precomputed full-height layout); fades ≤200 ms; reduced motion; typed-once flag; hidden option count in the live region (src/components/shared/AssistantTurn.tsx, src/components/shared/assistant-chat.css)

**Review checkpoint 6b:** tsc + unit.

**Batch 6c: keyboard, focus, navigation**, about 220 lines

- [ ] T061 [US6] e2e, written: REQ-35, REQ-34 navigation close (tests/e2e/assistant-a11y.spec.ts)
  - Tab order, Enter/Space.
  - Focus after option, paging, slot, clarify and did-you-mean buttons (360 px: log while pending, then the new turn; desktop: input).
  - At 360 px, "Registrar mi peso", "Fijar mi meta" and "Subir mi plan" each close the sheet; on the same destination, focus goes to the FAB.
  - On desktop, "Ver receta completa" keeps the panel open with focus in the page's main heading or content.
- [ ] T062 [US6] Navigation handling (src/components/shared/AssistantTurn.tsx, src/components/shared/AssistantChat.tsx, src/components/app/assistant.tsx)
  - A link click closes the sheet at ≤640 px; on the same destination it only closes and focuses the FAB.
  - On desktop, after the path change, focus `main h1` (fallback `main`, tabIndex -1).

**Checkpoint:** US6 code complete (REQ-32 to REQ-35); proven in Batch E.

## Phase 9: e2e stabilization

**Batch E: e2e stabilization.** Up to 3 review rounds, each fix round ≤ ~300 lines.

- [ ] T076 [setup] Full run and fix rounds (tests/e2e/*, plus the src/ files a fix needs)
  - Preconditions: no other Playwright run, `lsof -i :3200` empty, nothing in the background; the user's :3000 is not touched.
  - Run 1: one full `npm run test:e2e`, in the foreground. Then the T003 first-run check: `lsof -i :3200` empty and `psql -l` shows no `<name>-e2e`; if either is left over, stop and report. Look at T066 (dashboard baseline) first.
  - Triage every failure in the batch note: (a) known failure on main; (b) the test contradicts spec v1.6 → fix the test; (c) code bug → fix it, with a unit test first (red, then green) when the cause is logic, otherwise the failing e2e is the proof; (d) snapshot-only diff → T057. In run 1 the `assistant-look` and `a-theme-visual` snapshots are expected red until T057.
  - Fix rounds (up to 3): path-limited commits citing the failing test and REQ; gate = tsc + `npm run test:unit` + a rerun of only the affected spec files, one at a time. Failures left after round 3 go to the user.
  - After T077 and T057: one final full `npm run test:e2e`. If it shows a new snapshot-only diff, the user is asked again for a refresh (same T057 procedure) before the checkpoint.
- [ ] T077 [setup] Red-by-breaking demo for e2e-only behavior (Constitution 1, spec v1.6). Nothing is committed.
  - For each item: make an uncommitted breaking edit, run only that test (`npx playwright test <file> -g "<title>"`), record red, restore with `git checkout -- <file>`, rerun green. One break may prove several tests. `git status` is clean at the end.
  - Items: chat-polish REQ-23 route (500 + log, 400 without log, malformed JSON; T005); REQ-4 UI (no scope menu, `{ message }` only, subtitle never changes the answer incl. the identical visible answer on `/recipes/<id>` and `/groceries`; T012); the T035 RecipeDetail.tsx change (the recipe page keeps its display: empty-steps state and accented split; T034 e2e); the REQ-9/10 UI paging flow (T031 e2e); REQ-13 pin header (T039); REQ-16 parity (T066, T042, T044, T046); bubbles, avatar, contrast, 360 px overflow, button sizes, focus ring, bubbles not focusable, question buttons only on the last answer, `aria-disabled` while pending (T055); typing within 1 s, buttons after typing, tap to complete, reduced motion, live region once, no replay (T059); Tab order, focus after buttons, nav closing at 360 px, FAB focus, desktop heading focus (T061); the `assistant-look` snapshot (e.g. a bubble color; trivially red before T057, so it is demonstrated after T057).
  - Batch note: a table of item, break, test title, red, green.
- [ ] T057 [US6] Snapshot refresh, the only one (tests/e2e/*-snapshots): the reviewer lists each snapshot-only diff per test name with the confinement judgment; only after the user's explicit yes, `--update-snapshots` for those tests only (assistant-look, a-theme-visual); commit the images alone. An unconfined diff is a regression and goes back to a T076 fix round.

**Review checkpoint E:** final full run green apart from the known failures; T077 table complete; T057 done (or waiting on the user's yes, which blocks the checkpoint).

## Phase 10: Final verification

**Batch Final**, about 140 lines

- [ ] T063 [setup] Coverage audit and merge preconditions (tests/unit/chat-answer.test.ts, tests/e2e/assistant-api.spec.ts)
  - Every REQ-1 to REQ-35 and chat-polish REQ-23 maps to a passing unit and/or e2e test that asserts answer text, kind or buttons; no REQ is covered by `resolved` alone (table below).
  - Final REQ-5 sweep over one answer of every reply kind and every button type: `sweep()` (unit) and `resendSweep` (e2e).
  - Merge precondition 1: `grep -rn "Pronto podré" src` returns nothing (no D3 placeholder).
  - Merge precondition 2: `grep -n "headers" src/app/api/rag/chat/route.ts` shows header access only through `testHooks()`; `resolved` is set only under `trace`.
  - No `ScopeKey`/`scope` remains in chat code: `grep -rEnw "ScopeKey|SCOPE_LABEL|scope" src/lib/assistant.ts src/lib/domain src/app/api/rag/chat src/components/app src/components/shared` returns nothing (src only; tests excluded, they hold the negative assertions per Global rules).
- [ ] T064 [setup] Synthetic smoke and NFR (tests/e2e/assistant-helpers.ts, tests/e2e/assistant-api.spec.ts)
  - Harness `seedVolume()`: 32 recipes, 69 meals, 365 daily_logs rows, goals, name, add-ons, on the chat user.
  - One question per topic: no 500 (no Proxy misses). A 500 here (e.g. a collection missing from `needs.chat`) triggers a `src/` fix after Batch E, and therefore the full rerun in T065. After a warm-up request, each answer under 5 s; timings logged per topic.
  - Nothing committed depends on the real dataset or machine speed.
- [ ] T065 [setup] `npx tsc --noEmit`, `npm run test:unit`, and one run of the spec files changed in this batch (assistant-api); a full `npm run test:e2e` only if this batch changed `src/` (e.g. a T064 500 fixed in `queries.ts` `needs.chat`). Report to the orchestrator for the spec Progress and the chat-polish REQ-23 status.
  - Merge precondition 3: the user runs the manual ≤1 s check on the real data (one question per topic on :3000) before merge; the result is recorded in the batch report. The agent does not run it.

## Coverage

Unit = fail-first proof for logic (run every batch). e2e = written with the task, run in Batch E; e2e-only rows get their red proof in T077. Never `resolved` alone.

| Requirement | Unit | e2e | Code |
|---|---|---|---|
| chat-polish REQ-23 | T005 (hook guard: the outside-test-environment criterion, shared with REQ-13, is unit-only in tests/unit/test-hooks.test.ts because the e2e server always runs with `E2E_HOOKS=1`) | T005 (route, log, panel), T013 (503 for the generic copy) | T006, T007 |
| REQ-1 | T070, T021, T028, T042, T053 | T070 | T018–T020, T022 |
| REQ-2 | T017, T070 | T070 | T018–T020 |
| REQ-3 | T026, T031, T034, T048 | T026, T034, T048 | T024, T025, T027, T033 |
| REQ-4 | T072 (schema, no scope) | T072, T012 | T010, T011, T014–T016, T069 |
| REQ-5 | T072, T021, T028, T031, T034, T046, T048, T050, T063 (sweeps) | T072, T012, T063 (final) | T010, T014 |
| REQ-6 | T021, T028, T042, T053 | T021 | T022, T023, T027 |
| REQ-7, REQ-8 | T028 | T028 | T029, T030 |
| REQ-9, REQ-10 | T031 | T031 | T032, T033 |
| REQ-11 | T028, T031, T034 | T028 | T029, T030, T032, T036 |
| REQ-12 | T034 | T034 | T035, T036 |
| REQ-13 | T005 (guard), T072 (clock), T042 (future-day log) | T039 (pin header), T042 (pin changes "hoy") | T006, T011, T041 |
| REQ-14 | T039, T067, T042, T044 | T042 | T040, T041, T068 |
| REQ-15 | T042, T044 | T042 | T043, T045 |
| REQ-16 | T075 (progress.ts numbers) | T066 (dashboard), T042, T044, T046 (parity; e2e only) | T037, T038, T043, T045, T047 |
| REQ-17, REQ-18 | T042 | T042 | T043 |
| REQ-19, REQ-20 | T044 | T044 | T045 |
| REQ-21, REQ-22 | T046 | T046 | T047 |
| REQ-23, REQ-26, REQ-28, REQ-29 | T048 | T048 | T049 |
| REQ-24, REQ-25 | T050 | T050 | T051, T052 |
| REQ-27 | T042, T044, T046, T050, T053 | T044, T050 | T043, T045, T047, T052, T054 |
| REQ-30, REQ-31 | T053 | T053 | T054 |
| REQ-32, REQ-34 | — (UI only) | T055, T061 | T056, T062 |
| REQ-33 | — (UI only) | T059 | T058, T060 |
| REQ-35 | — (UI only) | T055, T061 | T056, T062 |
| NFR performance | — | T064 (synthetic, 5 s, timings); manual ≤1 s by the user (T065) | — |

Snapshots (not code): one refresh, T057 (end of Batch E), after the user's yes. T071 removed.

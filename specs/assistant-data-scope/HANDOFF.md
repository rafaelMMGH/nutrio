# Handoff: assistant-data-scope (rewritten 2026-11-12, end of day; development paused, no batch running)

A fresh orchestrator session can continue from here without the earlier conversation. Read this file first, then `plan.md` (Batches), then `tasks.md` (Global rules at the top, then the **Batch notes**, which hold every decision and open item per batch). User-facing language is Spanish (Mexico); specs and this file are English.

## 1. State at the end of 2026-11-12

- Branch `feature/assistant-data-scope` (local, never pushed). Code tip **038ed62** (T048 e2e rows of 4a2); the orchestrator adds one docs commit on top (this file, tasks.md, plan.md), so `git log -1` tomorrow shows that docs commit with 038ed62 just below it.
- Gates at 038ed62: `npx tsc --noEmit` clean, `npm run test:unit` **743/743**, no dependency change (vs main, package.json differs only by the `test:unit` script line; package-lock.json is unchanged), no `specs/` in code commits.
- Spec `spec.md` **v1.7, status `planned`** (Gate 2 approved 2026-10-29); plan **revision 10** (4a split into 4a1/4a2, user decision 2026-11-12). `assistant-chat-polish` is `partial` (its REQ-23, HTTP 500, is delivered here, in F1b).
- **60 of 78 active tasks ticked** (80 ids: T071 removed, T025 dropped by spec v1.7). US1, US2, US3 code-complete; US4 half done (T048, T049 ticked; T050–T052 open).
- **Batches done (all reviewer PASS or orchestrator-verified):** F1a, U0, F1b, 1a1, 1a2, 1b1a, 1b1b, 1b2a, 1b2b, 1c1, 3a1, 1c2, 3a2, 1d1, 1d2, 1e1, 1e2, 2a1, 2a2, 2b1, 2b2, 2c1, 2c2, 2c3 (cleanup), 3b1, 3b2, 3b3 (cleanup), 3c1, 3c2, 3d1, 3d2, 3e, 4a1, **4a2** (today's last batch: dish did-you-mean/not-found, REQ-6 step 8; see Batch note 4a2).
- Placeholders still in chat.ts: `pending("dish")` for the empty-phrase dish clarify (T051) and `pending("mealsDone")` for no plan / zero slots (T052). T063 requires none left. Do not demo those two paths, nor 2-block answers (only the first block's buttons show until T051).
- The only e2e run since F1a is the targeted 3a2 run (`assistant-parity.spec.ts -g "dashboard"`, PASS). Every other e2e row is written and type-checked only.
- Working tree: only `docs/PRD de Gestión Nutricional.md` and `specs/bugs/e2e-run-guard.md` are untracked; neither belongs to this feature: never commit them.

## 2. Next steps for tomorrow, in this order

1. **Sanity check before any agent runs:** `git status --short` (only the two untracked files above), `git log -1` (the docs commit on top of 038ed62), `npx tsc --noEmit` (clean) and `npm run test:unit` once (expect 743/743). If anything differs, stop and investigate before launching agents.
2. **Batch 4b1 (~250 added lines): T050 part 1, then T051** (src/lib/domain/chat.ts `reply()`/merge, tests/unit/chat-edges.test.ts). Holds: the multi-topic rows and one literal 2-block plain `answer` (D7); the REQ-24 merge replacing "buttons from the first block that has them" (2a1 M1, 2b1 (b): slot options as the second block keep their option buttons); the 2c2 L5 follow-up "¿A qué hora es mi <slot>?" on option details and its merge with "Ver receta completa"; the 3e LOW-5 "Subir mi plan" de-duplication in a no-plan "meta y avance" answer; replacing the last dish placeholder `pending("dish")` (empty-phrase clarify: 3 recipe buttons, or slot buttons when none) and the 4a2 LOW-3 decision on the unreachable `&& recipes.length` guard and fall-through (chat.ts:117, :119). Red first, then code; own review checkpoint.
3. **Batch 4b2 (~290): T050 part 2, then T052** (chat-meals.ts, chat-metrics.ts, tests). Holds: clarify rows, REQ-27 missing-data rows, the sweep over clarify/did-you-mean/overflow buttons, the e2e rows (written); the 3e cleanup rows MEDIUM-1 (non-default water goal), MEDIUM-2 (other-user goals/weekly), LOW-1 ("sin cambio" 0.04 kg, narrowed exercise goal bold, plan without version); the 4a2 test cleanups LOW-1 (`assertNotFound("¿Qué lleva la Pizza?", "Pizza")`) and LOW-2 (drop the tautological assertion at chat-edges.test.ts ~145), optional LOW-4 (allowed-kind list, sweep test title); T052's spec Copy no-active-plan reply, the `mealsDoneAnswer` returns-`undefined` contract and deleting the redundant `?? pending("mealsDone")` (chat.ts:125), the zero-slots plan reply (user ruling, section 6), `objective?.trim()` (3e LOW-2), the shared weight-record helper (3e LOW-7, optional), the 1c2 M6 and 2a1 L2 old-copy rewrites, and the 4a1 LOW-3 test naming (`NO_MATCH_LEAD` regex vs string; import `GREETINGS`/`THANKS`), optional. US4 checkpoint after this batch.
4. **Batch 5** (T053, T054): identity builders and the plan-summary lead (also updates the stale assistant-api.spec.ts lead/`sources` assertions).
5. **Batches 6a1/6a2** (T055 e2e written; T056 button component), **6b1/6b2** (T058 response-stream adaptation, no install; T059, T060 typing), **6c** (T061, T062).
6. **Batch E:** T076 first full `npm run test:e2e` plus up to 3 fix rounds (check every Batch-note e2e assumption, listed in T076), T077 red-by-breaking demo for UI-only behavior (nothing committed), **T057 the ONE snapshot refresh, only after the user's explicit yes**.
7. **Final:** T063–T065 (coverage audit, synthetic-volume check, **the user's manual ≤1 s check on real data before merge**), then section 6's push/PR items.

Remember: **no e2e per batch** until Batch E.

## 3. Batch list (sizes are ADDED lines incl. tests; details in plan.md Batches)

- **Done:** see section 1 (through 4a2, tip 038ed62).
- **Next:** 4b1 (T050 pt 1, T051, ~250) · 4b2 (T050 pt 2, T052, ~290) · 5 (T053–T054, ~240) · 6a1/6a2 (T055 / T056, ~250 / ~260) · 6b1/6b2 (T058 / T059, T060, ~110 / ~370) · 6c (T061–T062, ~350) · **E** (T076, T077, T057) · Final (T063–T065, ~200).
- Open items per batch live in the batch notes and on the owning task in `tasks.md`.

## 4. Rules (recorded in tasks.md/plan.md Global rules) and process lessons

- **No e2e per batch.** Each batch gate = `npx tsc --noEmit` + `npm run test:unit` (`node:test` through `tsx`, flat `tests/unit/*.test.ts`). e2e specs are WRITTEN with each task and first run in Batch E. Never two e2e runs at once (shared cloned DB, port 3200), never in the background. Never `next build` in place.
- **Tests first**: red tests committed just before the code of each task; tsc must pass at each task's final commit and every batch tip (a red tests-only commit is exempt but never the tip).
- **Batch size**: cap ~450 ADDED lines (deleted lines tracked separately); a whole-file deletion/rewrite is its own batch; stop at a task boundary and report when the running count passes the estimate by > ~50.
- **Parallel rule (2026-10-29)**: the next code phase may start in parallel with a review of code it will not modify or use; planner/spec edits always run in parallel with code work. Remaining batches all share chat.ts/chat-meals.ts/chat-metrics.ts, so in practice they run sequentially.
- **Model/effort**: each agent takes them from `.claude/agents/<name>.md`; do NOT pass `model`/`effort` when launching agents.
- **Product rules**: closed-answer buttons for every clarification; stateless chat; no scopes; "today" from the server in America/Mexico_City; no new dependency (in-house dish matcher, spec v1.7); Copy verbatim from the spec (es-MX).
- **Commits**: path-limited (`git add <paths>`, never `-A`), per task, messages cite US/T/REQ ids; no `specs/` in agent commits (the orchestrator commits docs separately). Use the trailer lines from the current session's own reminder.
- **Always ask the user before**: push/PR, deleting branches or worktrees, adding dependencies (none planned), `--update-snapshots` (T057), touching env/CI files, migrations.
- **Process lessons (2026-11-12):**
  - A rate limit cut a code-writer mid-batch (3c1: the red commit was saved, the partial code was uncommitted). Recovery: save the uncommitted diff as a patch in the scratchpad, inspect it, then launch a fresh agent (or keep it after checking). Ask agents to commit as they go so a cut loses little.
  - The user resumed an already-finished agent from the transcript view (3b2, during 3b3). Afterwards the orchestrator checked `git log`, `git status`, tsc and unit (no stray commits or edits). **Finished agents must not be resumed**; start fresh ones, and re-check the tree if it happens.
  - Reviewer mutation testing must run the **FULL** unit suite (`npm run test:unit`), not one file: rows for one behavior live across several test files, so a single-file run reports false survivors.

## 5. Practices that worked (reuse them)

- Loop per batch: code-writer (tests first, commits as it goes) → reviewer (read-only, re-runs tsc/unit, probes independently, mutants on the full suite) → planner docs pass (ticks tasks, writes the Batch note, assigns every finding an owner) → orchestrator commits docs path-limited.
- Give each subagent a self-contained prompt: goal, files, task ids, carry-forwards it owns, hard rules, stop line, report format.
- Record any deviation from a batch header (e.g. 4a2 widened `Built.kind` in chat-meals.ts although the header said "chat.ts only") in the Batch note rather than reworking accepted code.

## 6. Open items that need the user (all non-blocking)

### 6a. Spec-change list (answers feed ONE spec-change; nothing changes before it)

**Period phrases, REQ-14 (Batch notes 3b2, 3b3):** session decisions already implemented but not yet in spec.md v1.7: trailing date-like tokens give `"unrecognized"` (da80a5e), the narrowed "desde" rule and the "del"/"año" year guard (3b3), the clamp wording "any N above 366 clamps" (N capped at 3660). Still open:
- LOW-1 wording: cross-year short-range labels (month on both ends, year on the foreign date) are the code-writer's choice; cross-month short ranges inside a year stay ambiguous ("lun 26 – dom 1").
- LOW-2: unruled silent shapes ("ayer y hoy", "el pasado lunes", "desde … hasta …", "este mes pasado"; full list in Batch note 3b2).
- LOW-3: guard false positives ("el lunes, pasada la comida"; "desde el 5 de noviembre, 1500 kcal" gives `"unrecognized"`): accept or fix.

**Copy additions to record (reviewer-accepted, no decision needed beyond "record"):**
- Exercise G = 1 wording (3c2 LOW-1): "0 de 1 día", "hiciste ejercicio 1 de 1 día", "meta de 1 día".
- Weight (3d1 choices 1-8): "sin cambio" when a change rounds to 0.0 (also in the range line); "(sin cambio; mínimo X kg, máximo Y kg)"; empty named period "<Periodo>: no registraste tu peso." vs "Aún no registras tu peso."; named periods show no goal/week/age lines and no buttons; "Registrar mi peso"/"Fijar mi meta" link to `/`; dates "26 oct" plus year when it differs; goal reached at ratio >= 1 incl. start === goal.
- Meals done (3d2 ruling 6): "esta semana" counts slots × 7; other ranges count slots × days elapsed up to today.
- The detail lead is picked from the dish, not the question (2c2 M2; REQ-28 says "from the normalized question").
- Not-found replies use kind `answer` (4a2 ruling 1; the contract lists only `did_you_mean` and `no_match`). Recommendation: keep; a dedicated not-found kind would be a contract change.

**Rulings by topic:**
- Weight (3d1): if the first weight equals the goal and later weights drift, the chat says "¡Ya alcanzaste tu meta…!" (gauge also full): accept, or change both? LOW-1 "Te faltan 0 kg…" under 0.05 kg: (a) leave (pinned by 9fdc847) or (b) treat as reached.
- Meals done (3d2): `Math.round` (1463 of 1464 shows 100%) or `Math.floor`; **the reply for an active plan with zero slots (needed at T052)**; "¿Cuántas comidas hoy?" without llevo/hice stays meal times unless the user wants meals done; backlog candidate: weight links opening the WeightTile popover.
- Goals/weekly (3e): choice 4 "No has fijado meta de peso." + "Fijar mi meta" for a narrowed goal with none set; choice 5 a blank objective omits the item; optional choice 2 (no-plan line last in Metas plus "Subir mi plan" → `/plans`) and choice 6 (no `sources`); "avance de la semana pasada"/"de ayer" silently show this week: keep or add a fallback line. Note only: the chat shows the plan's own liters while the water tile uses glasses × 0.25 × 7.
- Greeting/thanks (4a1): (1) widen the vocabulary beyond the literal forms ("muchas gracias", "ok gracias", "buenas" alone, "Buenas, ¿qué tal?", "buenas dias", "buenos tardes" now fall to no_match); (2) accept per-position gender strictness and "holas" as a greeting (reviewer recommends accepting).
- Dish answers (4a2): **MEDIUM-1** a dish cue swallows the rest of the question as the phrase ("¿Qué lleva la pizza y cuánta agua llevo?" → not-found for 'pizza y cuánta agua llevo', water lost; "¿Qué lleva el pollo? mi peso" → did-you-mean for 'pollo mi peso'; "¿Qué lleva el pollo asado de mi plan?" → did-you-mean because "plan" is unmatched): keep as written in REQ-3/REQ-6 step 4, or trim trailing topic clauses. LOW-6: a did-you-mean reply's plain `answer` is only "¿Quisiste decir…?" (no candidate names for plain-text clients; slot options behave the same): does the contract's "lists option labels one per line" mean to cover did-you-mean?
- Matcher (1e1, 1e2, 2a1, 2b2, 2c2): `isNotDishName` fuzzy date cues ("sasado" ~ "sábado"): exact-only or accept, add a test either way; `isPlural` tie rule ("comidaa" means all meal times): accept and record, or count a tie as plural only with an "s"; MEDIUM-3 "colación opción 2" on a duplicated slot drops the option: known limit, accept, or carry the option in the clarify buttons; L5 keep the all-meal-times section title "Comidas"?; L2 accepted-current `selectionAt` readings ("comí 2 de la cena", "cena 2.5", "cena opción -1", …; Batch note 2c2): accept and pin, or tighten; optional note: `Intent` gained `outcome` and `phrase` (test-only).
- Resolver (tasks.md "Open questions 1c2" items 1-6 and "Open questions 1d1" Q-a..Q-d): ask; the same spec-change records the 1d1 reviewer-accepted decisions and the 1d2 intended behavior changes and L6 candidate (Batch notes 1d1, 1d2).

### 6b. Repository and process items (need the user's yes or a one-time answer)

- **Worktree/branch cleanup:** six agent worktrees remain (`worktree-agent-a3363d28…`, `…a4fb1720…`, `…a959e211…`, `…a961a303…`, `…aa6dc7e5…`, `…ab226b2a…`), all merged or superseded. Their paths point at the project's old location (`/Users/rafael/Desktop/Nutritional Manager/.claude/worktrees/`), so `git worktree list` marks them prunable; cleanup = `git worktree prune` plus deleting the six branches, only after the user's yes.
- Push `feature/assistant-data-scope` and open the PR (the user opens it; draft the description: summary, spec link, per-requirement status, known issues, the unproven-until-Batch-E list).
- Wrong T ids in three 1c1 commit messages (`07b3cab` says T018, is T019; `3e441c1`, `488d61f` say T019, are T018): rewrite or leave (Batch note 1c1). 1b66c96 is tsc-red (two-commit red window in 1d2): note only.
- **Constitution reminder (explicit request):** when the feature finishes, remind the user that CONSTITUTION principle 1 says tests are "a Playwright e2e test" while this feature uses unit tests as the fail-first proof for logic (spec v1.6). The user decided not to amend it; ask once whether to leave it or propose a one-line amendment (team PR).
- Other BACKLOG items (E2E run guard stash, `src/server.js`, …) are unrelated; see `specs/BACKLOG.md`.

## 7. Traps

- `git stash@{0}` belongs to branch `fix/e2e-run-guard` (the user's WIP); never pop/drop it. `specs/bugs/e2e-run-guard.md` and `docs/PRD de Gestión Nutricional.md` are untracked and not this feature's: never commit them.
- The user's dev server may be running on :3000 against real data; do not touch it.
- Do not touch `nutrition.ts`/`food.ts` normalizers (persisted recipe fingerprints). `normalizeText` splits decimals ("1,5 L" → "1 5 l"): number parsing reads the raw message.
- Everything e2e is unproven until Batch E. Expect a wave of fixes there (up to 3 fix rounds, then escalate to the user). Batch E must check every e2e assumption listed in T076 (incl. 3c2-3e and 4a1/4a2).
- Never wait with `pgrep -f "playwright test"` loops (they match themselves); check `lsof -i :3200` and `psql -l` instead.

## 8. Where everything is

- Spec/plan/tasks/contract/UX checklist: `specs/assistant-data-scope/` (`spec.md`, `plan.md`, `tasks.md`, `contracts/chat-api.md`, `checklists/ux.md`). Older spec amended to v1.9: `specs/assistant-chat-polish/`.
- Code: `src/lib/domain/chat.ts`, `chat-intent.ts`, `chat-match.ts`, `chat-topics.ts`, `chat-dish.ts`, `chat-meals.ts`, `chat-metrics.ts`, `chat-dates.ts`; `src/lib/progress.ts`, `src/lib/recipe-steps.ts`, `src/lib/assistant.ts`, `src/lib/server/test-hooks.ts`, `src/lib/client/assistant-thread.ts`, `src/components/shared/Assistant*.tsx`.
- Tests: `tests/unit/*.test.ts` (chat-edges.test.ts holds the US4 rows), `tests/shared/*` (assistant-copy.ts: variant helpers), `tests/e2e/assistant-*.spec.ts`.
- The session-1 scratchpads (T024 fuse spike, probe scripts, baseline e2e logs) were under the project's old path and no longer exist; the spike result is recorded in spec.md's v1.7 change-log entry.

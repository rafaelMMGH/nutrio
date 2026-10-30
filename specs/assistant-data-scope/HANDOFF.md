# Handoff: assistant-data-scope (written 2026-10-29 16:40, end of orchestrator session 1)

A new orchestrator session can continue from here without the earlier conversation. Read this file first, then `plan.md`, then `tasks.md` (Global rules at the top, then the **Batch notes**, which hold every decision and open item per batch). User-facing language is Spanish (Mexico); specs and this file are English.

## 1. State in one paragraph

Feature branch `feature/assistant-data-scope` (local, never pushed), tip `a4c944d` before the 1d2 fix round (updated 2026-10-29 after the batch 1d2 review; the fix-round commits land on top). Spec `spec.md` v1.6, status `planned`; `assistant-chat-polish` is `partial` (its REQ-23, HTTP 500, is delivered by this feature and is already implemented in F1b). 32 of 76 tasks are ticked. **Done and reviewed (PASS):** F1a, U0, F1b, 1a1, 1a2, 1b1a, 1b1b, 1b2a, 1b2b, 1c1, 3a1, 1c2 (T070, T020; review round 2 PASS, fix commits 8102f7d..ecb2925), 3a2 (T066, T038; cherry-picked as 33aab9f..0ff4ea2), 1d1 (T021 part 1, T022; commits 4e6e12a, 3ba4332), 1d2 (T021 part 2, T022 cleanup, T023; commits 4c8771e, 1b66c96, 544ece5, a4c944d; a short fix round the user pre-authorized is in progress, see Batch note 1d2). The only e2e run since F1a is the targeted 3a2 run `npx playwright test assistant-parity.spec.ts -g "dashboard"`: PASSED (by design, see section 4). Unit suite: 437 tests green at a4c944d; `npx tsc --noEmit` clean.

## 2. Immediate next steps, in this order

1. **1d2 fix round** (code-writer, pre-authorized by the user, in progress): heading level at assistant-next-step.spec.ts:105, the "llevo agua y comidas" row, a second-block `sources` row, `sources` de-dup in `ragAnswer`, a comment fix. When it lands, **the orchestrator verifies the tip** (`npx tsc --noEmit` + `npm run test:unit`). T021 and T023 are already ticked.
2. Commit the docs (planner edits to `tasks.md`/`plan.md`/`HANDOFF.md` are committed path-limited by the orchestrator, never by agents).
3. **Batch 1e** (next): T024 fuse.js spike in a scratch copy (real copy, `npm ci`, never a symlinked node_modules), **T025 install of fuse.js 7.5.0 needs the user's explicit yes**, then T026 (tests, red first) and T027 (dish matcher + REQ-6 step 4, optional recipe argument to `resolve`, the optional "comidas" typo fix L3). See T024–T027 in `tasks.md`.
4. Continue with the remaining batches (section 3).
5. The 3a2 worktree branch `worktree-agent-a4fb1720775853511` is merged; deleting it (with the other agent worktrees, section 6) still awaits the user's yes.

## 3. Remaining batches (from plan.md "Batches", sizes are ADDED lines, tests included)

**next:** 1e (T024 fuse.js spike in a scratch copy, **T025 install needs the user's yes**, T026–T027) ~300 · 2a1/2a2 (T028–T030) · 2b1/2b2 (T031–T033) · 2c1/2c2 (T034–T036) · 3b1/3b2 (T039–T041, T067–T068) · 3c1/3c2 (T042–T043) · 3d1/3d2 (T044–T045) · 3e (T046–T047) · 4a (T048–T049) · 4b1/4b2 (T050–T052) · 5 (T053–T054) · 6a1/6a2 (T055–T056) · 6b1/6b2 (T058–T060) · 6c (T061–T062) · **E** (T076 first full e2e + fix rounds, T077 red-by-breaking demo for UI-only behavior, **T057 the ONE snapshot refresh needs the user's yes**) · Final (T063–T065: coverage audit, synthetic-volume check, **the user's manual ≤1 s check on real data before merge**). Open items per batch live in the batch notes in `tasks.md`.

## 4. Rules the user set (all recorded in tasks.md/plan.md Global rules)

- **No e2e per batch.** Each batch gate = `npx tsc --noEmit` + `npm run test:unit` (`node:test` through `tsx`, flat `tests/unit/*.test.ts`, no dependency). e2e specs are WRITTEN with each task but run for the first time in Batch E, with ONE exception: the targeted 3a2 run (done, PASS). Never two e2e runs at once (shared cloned DB, port 3200). Never `next build` in place.
- **Tests first**, red tests committed just before the code of each task; tsc must pass at each task's final commit and every batch tip (a red tests-only commit is exempt but never the tip).
- **Batch size**: cap on ADDED lines (~450), deleted lines counted in a separate column; a whole-file deletion/rewrite is its own batch; the running estimate applies to added lines; stop at a task boundary and report when over.
- **Parallel rule (2026-10-29)**: if the reviewer is reviewing code that the next code-writer phase will not modify or use, start the next phase in parallel (worktree if the reviewer's tsc/test runs could be disturbed, same branch if the file sets are disjoint). Planner/spec edits (`tasks.md`/`plan.md`) always run in parallel with code work. The orchestrator merges worktree commits (cherry-pick or `merge --no-ff`) and commits docs path-limited. Worktrees only write code and run tsc + unit tests (never e2e).
- **Model/effort**: each agent takes its model and effort from `.claude/agents/<name>.md` (code-writer sonnet/medium, reviewer sonnet/high, planner opus/medium, spec-writer sonnet/high, verifier-spec sonnet/low, investigator haiku). Do NOT pass `model`/`effort` when launching agents.
- **Closed-answer buttons** for every clarification; stateless chat (no conversation memory: planned for a later feature); no scopes anywhere; "today" comes from the server in America/Mexico_City; fuse.js 7.5.0 pinned exactly is the only new dependency (explicitly approved; the install itself is T025).
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01JKF92ezqPhiNanu7Q94bKd` (use the current session's trailer lines from its own reminder). Path-limited commits (`git add <paths>`, never `-A`); no `specs/` in agent commits.
- Always ask the user before: push/PR, deleting branches or worktrees, adding dependencies (T025), `--update-snapshots` (T057), touching env/CI files.

## 5. Practices that worked (reuse them)

- Loop per batch: code-writer (implement, tests first) → reviewer (read-only, re-runs tsc/unit, probes independently) → planner pass in parallel with the next code (folds findings, ticks tasks, writes the Batch note) → orchestrator commits docs.
- Give each subagent a self-contained prompt (goal, files, the task ids, hard rules, stop line, report format). Ask for commits as they go so a rate-limit cut loses nothing; the limit has cut agents three times (resume from the commits; a partial uncommitted edit was saved as a patch in the scratchpad before deciding).
- Do not resume finished agents; start fresh ones.

## 6. Open items that need the user

- **Resolver questions** (tasks.md "Open questions 1c2" items 1-6 and "Open questions 1d1" Q-a..Q-d, unchanged after 1d2): ask the user; answers feed one spec-change, which also records the 1d1 reviewer-accepted decisions (Batch note 1d1), the 1d2 intended behavior changes (time word beside another topic ignored; possessor rule; Recipes yields to slot/cart; goal + metric single block; "carrito y horario" → cart only) and the L6 candidate (2-block follow-ups can offer the topic already answered), all in Batch note 1d2.
- **fuse.js install (T025, batch 1e):** needs the user's explicit yes before the orchestrator runs `npm install fuse.js@7.5.0 --save-exact`.
- **1d2 L1 process note (no action unless the user asks):** 1b66c96 is tsc-red, so the red window spans two commits; history is not rewritten.

- **Constitution reminder (explicit request):** when the feature finishes, remind the user that CONSTITUTION principle 1 says tests are "today ... a Playwright e2e test" while this feature treats unit tests as the fail-first proof for logic (spec v1.6). The user decided NOT to amend it; ask once whether to leave it or propose a one-line amendment (needs a team PR).
- **Wrong T ids in three commit messages** of batch 1c1: `07b3cab` says T018 (is T019, matcher), `3e441c1` and `488d61f` say T019 (are T018, normalizer). History not rewritten; ask whether to rewrite or leave (recorded in the Batch note 1c1).
- **Branch/worktree cleanup (needs the user's yes):** after everything is merged, delete the agent worktrees and branches: `.claude/worktrees/agent-*` and `worktree-agent-*` (7 of them; 3a1's `…a3363d28…` is superseded by 3a2's copies; 3a2's `…a4fb1720…` is cherry-picked; F1a's `…a959e211…`/`…aa6dc7e5…`, F1b's `…a961a303…`, 1a1's `…ab226b2a…` are already cherry-picked/merged).
- Push `feature/assistant-data-scope` and open the PR (user opens it; draft the description: summary, spec link, per-requirement status, known issues, the unproven-until-Batch-E list).
- Other BACKLOG items (E2E run guard stash, `src/server.js`, etc.) are unrelated to this feature; see `specs/BACKLOG.md`.

## 7. Traps

- `git stash@{0}` belongs to branch `fix/e2e-run-guard` (the user's WIP); never pop/drop it. `specs/bugs/e2e-run-guard.md` is untracked and belongs to that other work: never commit it.
- The user's own dev server may be running on :3000 against real data. The chat server already changed while the UI was in transit: the UI is now scope-free, but many topics still answer with the D3 placeholder or `no_match` until their builders land (1d–US5). That is expected.
- Do not touch `nutrition.ts`/`food.ts` normalizers (persisted recipe fingerprints). `normalizeText` splits decimals ("1,5 L" → "1 5 l"): number parsing must read the raw message.
- Everything e2e is unproven until Batch E: every new/rewritten e2e spec was only type-checked. Expect a wave of fixes there (up to 3 review rounds, then escalate to the user).
- A rate-limit or orphan-process lesson: never wait with `pgrep -f "playwright test"` loops (they match themselves and never exit); check `lsof -i :3200` and `psql -l` instead.

## 8. Where everything is

- Spec/plan/tasks/contract/UX checklist: `specs/assistant-data-scope/` (`spec.md`, `plan.md`, `tasks.md`, `contracts/chat-api.md`, `checklists/ux.md`). Older spec amended to v1.9: `specs/assistant-chat-polish/`.
- Code written so far: `src/lib/domain/chat-match.ts`, `chat-topics.ts`, `chat.ts`, `src/lib/assistant.ts`, `src/lib/progress.ts`, `src/lib/server/test-hooks.ts`, `src/lib/client/assistant-thread.ts`, `src/components/shared/Assistant*.tsx`, `tests/unit/*`, `tests/shared/*`, `tests/e2e/assistant-*.spec.ts`.
- Research/briefs from session 1 (read-only, optional): scratchpad `/private/tmp/claude-501/-Users-rafael-Desktop-Nutritional-Manager/d083cc38-c0df-4832-8402-206edd174c9c/scratchpad/` (probe scripts, baseline e2e logs).

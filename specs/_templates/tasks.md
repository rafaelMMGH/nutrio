# Tasks: <Feature name>

**Spec:** [spec.md](spec.md) · **Decisions:** [decisions.md](decisions.md) · **Plan:** [plan.md](plan.md) (Full lane only)

Format: `- [ ] T### [P] [US#] Description, cites REQ-n (path/to/file)`
- Tag every task `[US#]`, or `[setup]` / `[found]` for setup and foundational work. Story tasks cite their REQ IDs.
- `[P]` = can run in parallel with other `[P]` tasks in the same phase; it must name its files, and no two `[P]` tasks in a phase share a file.
- Tests first: a requirement's test task precedes its code task. Tests cite `<feature>/REQ-n` in the title or a comment.
- Full lane: detail only the current story; later stories stay one outline line, e.g. `- US2 (P2) outline: REQ-n, REQ-m`.

## Approach

Lite lane only (no plan.md), at most 20 lines: the design, the files touched, and how each story is tested.

## Approvals

Actions that need the user's yes, one line each with a reason: new or upgraded dependencies, migrations, env or CI changes.
With `E2E full suite: ci`, always list "push the feature branch to run CI". Write "none" only if there is nothing at all.

- Push `feature/<feature>` to run the e2e workflow in CI

## Phase 1: Setup

- [ ] T001 [setup] ...

## Phase 2: Foundational (blocks all stories)

- [ ] T002 [found] ...

## Phase 3: US1 (P1) <title>

- [ ] T003 [US1] Write tests for REQ-1, cites REQ-1 (path/to/test)
- [ ] T004 [US1] Implement REQ-1, cites REQ-1 (path/to/file)
- [ ] T005 [P] [US1] ...

**Done when:** US1 reviewed and committed.

## Phase 4: US2 (P2) <title>

- [ ] T006 [US2] ...

**Done when:** US2 reviewed and committed.

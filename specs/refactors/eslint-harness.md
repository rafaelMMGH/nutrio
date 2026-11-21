# Refactor: ESLint + Codely agent-harness skills

**Status:** done · **Branch:** refactor/eslint-harness

> Budget: ~40 lines. No behavior change.

## Goal

Give the project a linter so conventions can become deterministic rules that fail in seconds
(CodelyTV/agent-harness approach), and install the harness skills that build on it:
`create-rule`, `deterministify`, `git-commit`, `create-pull-request`. The harness planning skills
(`create-plan*`, `implement-plan-phase*`) are intentionally not installed: they duplicate planner/code-writer.

## Scope

- In: `package.json` / `package-lock.json`: exact devDeps `eslint` 9.39.5 (not 10: eslint-config-next 15 peer-requires ^9),
  `eslint-config-next` 15.5.18 (matches `next`), `@eslint/eslintrc` 3.3.7 (FlatCompat, since eslint-config-next 15 ships
  legacy configs). All three approved by the user on 2026-11-20. Lockfile: +255 packages, transitive js-yaml 4.3.2 and
  side-channel 1.1.1. A nested eslint-visitor-keys needs Node >=20.19.
  `eslint.config.mjs`, `eslint-suppressions.json` (baseline: existing violations, only shrinks),
  `lint` and `check` scripts, `CLAUDE.md` commands, `skills-lock.json` for the four skills (copied into the gitignored `.claude/skills/`; separate commit).
- Out: fixing existing lint violations (baseline them), converting conventions into rules
  (later `/deterministify` runs), CI and git hooks, any `src/` behavior.

## Safety net

- Existing tests covering the scope: `npx tsc --noEmit`, `npm run test:unit` (no runtime code changes).
- Tests added first (if coverage was missing): none needed; `npm run lint` must exit 0 with the baseline.
- All tests pass before: [x] · after: [x]

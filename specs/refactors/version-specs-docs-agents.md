# Refactor: version specs, docs and agent setup

**Status:** done · **Branch:** refactor/version-specs-docs-agents

> No behavior change. Repository hygiene only.

## Goal

`.gitignore` excluded `specs/`, `docs/` and `.claude/` (since `c006995`). Files tracked before that kept being versioned, but new ones existed only on this machine: the cooking-mode, metric-dials and upload-wizard-stepper specs, a bug note, the PRD and the agent definitions. Constitution principle 2 (specs are the source of truth) needs them in Git.

## Scope

- In: `.gitignore`; newly tracked `specs/**`, `docs/PRD de Gestión Nutricional.md`, `.claude/agents/*.md`, `.claude/settings.json`, `.claude/skills/grilling/`, `.claude/skills/landing-page-design/`, `skills-lock.json`; wording in `docs/agent-workflow.md` and `specs/BACKLOG.md`.
- Stay local (still ignored): `.claude/settings.local.json`, `.claude/worktrees/`, third-party skills (symlinks into the ignored `.agents/`, reinstallable from `skills-lock.json`), `.DS_Store`.
- Out: any source, test or config change.

## Safety net

- The repo is public: new files were scanned for secrets, credentials, connection strings, local paths and personal data before committing; none found (weights in specs are illustrative examples).
- No code changed, so no tests apply. `git check-ignore` confirms the local-only paths stay ignored.

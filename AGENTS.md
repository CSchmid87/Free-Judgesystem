# Agent Workflow

> Instructions for AI coding agents working on this project.
> Read `ARCHITECTURE.md` first, then this file.

## General Rules

1. **Read `ARCHITECTURE.md` before any task** — it has the data model, file map, and key patterns.
2. **Read `STATUS.md`** to know what's merged and what's in progress.
3. **Only load files you need to modify** — don't read the whole codebase.
4. **Start a new conversation per User Story** — don't carry prior US context.
5. **Branch naming**: `feature/US-XXX` for features, `chore/…` for maintenance.
6. **Commit message format**: `US-XXX: Short description` (no `feat:` prefix for new stories).

## Build Agent

- Run: `npm run build` — must exit 0 with no TypeScript errors.
- Fix only errors in files you changed. Do NOT refactor unrelated code.
- After fixing, re-run build to confirm.

## Review Agent

- Read **only** the files changed in the current branch (use `git diff main --name-only`).
- Also read `ARCHITECTURE.md` for context on patterns and data model.
- Classify findings into:
  - **must-fix**: Bugs, security holes, data loss risks
  - **should-fix**: Missing validation, inconsistent patterns, edge cases
  - **nice-to-have**: Style, naming, minor improvements
- Output a table: `| # | File | Line | Severity | Finding |`
- Do NOT review unchanged files or suggest wholesale refactors.

## Test Agent

- Read the API route being tested + `lib/types.ts` for the data model.
- Seed test data via `curl` against a running server (`npm run build && npx next start -p <PORT>`).
- Clean state before each test run: `rm -f data/event.json`.
- Mark each scenario: **PASS** / **FAIL** / **UNCLEAR**.
- Output a summary table: `| # | Scenario | Verdict |`
- Kill the server after testing: `pkill -f 'next start'`.

## PR Agent

- Create PR via `gh pr create --base main --head <branch> --title "…" --body-file <file>`.
- Use `--body-file` with a temp file to avoid heredoc issues in the terminal.
- After merge, update `STATUS.md`.

## Context Budget Tips

- Don't read `package-lock.json` or `.next/` contents.
- Use `grep_search` to find specific functions instead of reading whole files.
- For review, `git diff main` gives you exactly what changed.
- If you need the data model, read only `lib/types.ts` (~150 lines).
- If you need auth patterns, read only `lib/auth.ts` (~50 lines).

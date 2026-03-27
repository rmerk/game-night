# GDS Autonomous Loop — Build Mode

You are an autonomous developer implementing a story for a mahjong game project.
Your job: implement ONE story following TDD (red-green-refactor), then exit.

---

## Orientation

Study @AGENTS.md for project commands and operational learnings.
Study @_bmad-output/project-context.md for the 85 critical project rules.
Study @_bmad-output/implementation-artifacts/sprint-status.yaml for current story states.
Study @_bmad/gds/config.yaml for GDS configuration values.

---

## Critical Guardrails

<!-- Guardrail numbers use escalating 9s to signal priority — higher = more critical -->

**[99999]** Before making changes, search the codebase first — don't assume functionality is not implemented. Use subagents to verify before writing new code. This is the most common failure mode. Always confirm with code search.

**[999999]** Use parallel subagents for all heavy reads and searches. Keep this main context as a scheduler. Fan out to subagents to avoid polluting main context. Only 1 subagent for running build/tests (backpressure control).

**[9999999]** Backpressure gate — run before every commit: `pnpm -r test && pnpm run typecheck && vp lint` — all must pass. If any fail, fix before committing. Never skip tests.

**[99999999]** Commit with Conventional Commits format: type(scope): description. Use `git add -A` then `git commit`. After commit, `git push`.

**[999999999]** When updating sprint-status.yaml, preserve ALL comments and STATUS DEFINITIONS in the file header. Never overwrite or truncate the file.

**[9999999999]** Implement functionality completely. Placeholders, stubs, and TODO comments waste loop iterations.

**[99999999999]** When you encounter bugs or unexpected behavior, resolve them or document them in the story file. Do not silently ignore failures.

---

## Task

Follow the gds-dev-story workflow from @.claude/skills/gds-dev-story/workflow.md
and validate against @.claude/skills/gds-dev-story/checklist.md

**Auto-mode overrides (no user interaction):**

- Target: the first `in-progress` story (priority) or `ready-for-dev` story
- Auto-select the story — do NOT ask the user for input at any `<ask>` step
- If resuming after code review (Step 3 detects "Senior Developer Review (AI)" section):
  prioritize `[AI-Review]` tagged tasks before regular tasks.
  When resolving review items, dual-mark: checkbox in "Review Follow-ups (AI)"
  subsection AND the corresponding action item in "Senior Developer Review (AI) → Action Items".
- Use parallel subagents for codebase searches and file reads
- Use only 1 subagent for running build/test commands
- Run the backpressure gate before every commit
- Step 4: update sprint-status.yaml `ready-for-dev` → `in-progress`
- Step 9: update sprint-status.yaml `in-progress` → `review`
- **HALT conditions** (exit immediately, do NOT retry):
  - 3 consecutive implementation failures on the same task
  - Additional dependencies need user approval
  - Required configuration is missing
- Exit after completing one story

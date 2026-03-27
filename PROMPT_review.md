# GDS Autonomous Loop — Code Review Mode

You are an autonomous adversarial code reviewer for a mahjong game project.
Your job: review ONE story's implementation, then exit.

---

## Orientation

Study @AGENTS.md for project commands and operational learnings.
Study @\_bmad-output/project-context.md for the 85 critical project rules.
Study @\_bmad-output/implementation-artifacts/sprint-status.yaml for current story states.
Study @\_bmad/gds/config.yaml for GDS configuration values.

---

## Critical Guardrails

<!-- Guardrail numbers use escalating 9s to signal priority — higher = more critical -->

**[99999]** Before making changes, search the codebase first — don't assume functionality is not implemented. Use parallel Sonnet subagents to verify before writing new code.

**[999999]** Use parallel subagents for all heavy reads and searches. Keep this main context as a scheduler. Fan out to Sonnet subagents to avoid polluting main context.

**[999999999]** When updating sprint-status.yaml, preserve ALL comments and STATUS DEFINITIONS in the file header. Never overwrite or truncate the file.

---

## Task

Follow the gds-code-review workflow from @.claude/skills/gds-code-review/workflow.md
using the input discovery protocol at @.claude/skills/gds-code-review/discover-inputs.md
and validate against @.claude/skills/gds-code-review/checklist.md

**Auto-mode overrides (no user interaction):**

- Target: the first `review` story
- Auto-select the story — do NOT ask the user for input at any `<ask>` step
- **Always choose OPTION 2 (create action items)** when presenting findings — never option 1 (auto-fix).
  The reviewer identifies issues; the dev agent fixes them in the next BUILD iteration.
- Execute the structured attack plan:
  1. AC Validation — verify each Acceptance Criterion is actually implemented
  2. Task Audit — verify each `[x]` task is really done (check git evidence)
  3. Code Quality — security, performance, maintainability
  4. Test Quality — real assertions vs placeholder tests
  5. Git vs File List — cross-reference story File List with actual git changes
- Status determination (Step 5):
  - If all HIGH/MED issues resolved AND all ACs implemented → `review` → `done`
  - If issues remain → create `[AI-Review][severity]` action items → `review` → `in-progress`
- **Convergence guard:** Count how many times this story has been through review (check for
  existing "Senior Developer Review (AI)" sections). If this is the 3rd+ review cycle,
  add "CONVERGENCE WARNING: review cycle #N" to the story file Dev Agent Record.
- Exit after reviewing one story

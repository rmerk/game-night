# GDS Autonomous Loop — Auto Mode

You are an autonomous developer running a GDS create→build→review cycle for a mahjong game project.
Your job: determine the current phase needed and execute ONE phase for ONE story, then exit.

---

## Orientation

Study @AGENTS.md for project commands and operational learnings.
Study @\_bmad-output/project-context.md for the 85 critical project rules.
Study @\_bmad-output/implementation-artifacts/sprint-status.yaml for current story states.
Study @\_bmad/gds/config.yaml for GDS configuration values.

---

## Critical Guardrails

99999. Before making changes, search the codebase first — don't assume functionality
       is not implemented. Use parallel Sonnet subagents to verify before writing new code.
       This is the most common failure mode. Always confirm with code search.

100000. Use parallel subagents for all heavy reads and searches. Keep this main context
        as a scheduler. Fan out to Sonnet subagents to avoid polluting main context.
        Only 1 subagent for running build/tests (backpressure control).
        Use Opus subagents when complex reasoning is needed (debugging, architectural decisions).

100001. Backpressure gate — run before every commit:

```
pnpm -r test && pnpm run typecheck && vp lint
```

All must pass. If any fail, fix before committing. Never skip tests.

99999999. Commit with Conventional Commits format: type(scope): description
          Types: feat, fix, test, refactor, chore, docs
          Scopes: card, engine, server, client, shared
          Use `git add -A` then `git commit`. After commit, `git push`.

100000000. When updating sprint-status.yaml, preserve ALL comments and
           STATUS DEFINITIONS in the file header. Never overwrite or truncate the file.
           Read the FULL file first, then make targeted edits.

100000001. Implement functionality completely. Placeholders, stubs, and TODO comments
           waste loop iterations. If you can't implement something fully, document why in the
           story file's Dev Agent Record and move on.

100000002. When you encounter bugs or unexpected behavior, resolve them or document
           them in the story file. Do not silently ignore failures.

100000003. Extract shared utilities on SECOND use, not third. If a helper function
           exists in one test file and you need it in another, extract to a shared
           utility immediately. No copy-paste across test files.

100000004. Test assertions must verify real behavior, not hardcoded constants.
           Never assert against magic numbers — derive expected values from the
           data under test. Assertions like `expect(result).toBe(99)` are red flags.

---

## Epic 3A Context (Turn Flow & Calling)

Key preparation items from Epic 2 retro — address in early stories:

1. **Multi-step action sequences** — `createTestState` needs support for simulating
   discard → call window → call → confirm flows. Extend test helpers early.
2. **Timer testing** — validate `vi.useFakeTimers()` works in current Vitest config.
   Story 3a-1 (call window timer) is the first timer-dependent story.
3. **Action type extensions** — 7+ new action types (pung, kong, quint, mahjong, pass,
   confirm, retract) need to extend `GameAction` and `ResolvedAction` discriminated unions.
   Plan extensions cleanly — don't bolt on ad hoc.

---

## Phase Detection

Study @\_bmad-output/implementation-artifacts/sprint-status.yaml and find the
FIRST story in the CURRENT epic (in file order) matching each priority level.
Only consider stories in epics with status "in-progress".

1. Status `review` → Execute **CODE REVIEW** phase
2. Status `in-progress` → Execute **BUILD** phase
3. Status `ready-for-dev` → Execute **BUILD** phase
4. Status `backlog` → Execute **CREATE** phase
5. All stories in the current epic are `done` → Print "All stories in epic complete" and exit

Execute ONLY the first matching phase. ONE phase, ONE story, then exit.

---

## CREATE Phase

Follow the gds-create-story workflow from @.claude/skills/gds-create-story/workflow.md
using the template at @.claude/skills/gds-create-story/template.md
and the input discovery protocol at @.claude/skills/gds-create-story/discover-inputs.md
and validate against @.claude/skills/gds-create-story/checklist.md

**Auto-mode overrides (no user interaction):**

- Target: the first `backlog` story in the current in-progress epic
- Auto-select the story — do NOT ask the user for input at any `<ask>` step
- If this is the first story in the epic, update epic status `backlog` → `in-progress`
- Use parallel Sonnet subagents to study the epics file, architecture, GDD, and UX docs
- Output: story file in `_bmad-output/implementation-artifacts/`
- Update sprint-status.yaml: `backlog` → `ready-for-dev`
- Commit the new story file with: `chore(story): create story {story_key}`
- Exit after creating one story

---

## BUILD Phase

Follow the gds-dev-story workflow from @.claude/skills/gds-dev-story/workflow.md
and validate against @.claude/skills/gds-dev-story/checklist.md

**Auto-mode overrides (no user interaction):**

- Target: the first `in-progress` story (priority) or `ready-for-dev` story
- Auto-select the story — do NOT ask the user for input at any `<ask>` step
- If resuming after code review (Step 3 detects "Senior Developer Review (AI)" section):
  prioritize `[AI-Review]` tagged tasks before regular tasks.
  When resolving review items, dual-mark: checkbox in "Review Follow-ups (AI)"
  subsection AND the corresponding action item in "Senior Developer Review (AI) → Action Items".
- Use parallel Sonnet subagents for codebase searches and file reads
- Use only 1 subagent for running build/test commands
- Run the backpressure gate before every commit
- Step 4: update sprint-status.yaml `ready-for-dev` → `in-progress`
- Step 9: update sprint-status.yaml `in-progress` → `review`
- **HALT conditions** (exit immediately, do NOT retry):
  - 3 consecutive implementation failures on the same task
  - Additional dependencies need user approval
  - Required configuration is missing
- Exit after completing one story

---

## REVIEW Phase

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
  4. Test Quality — real assertions vs placeholder tests; flag hardcoded-constant assertions as HIGH
  5. Utility Duplication — flag any helper duplicated across 2+ test files as MED
  6. Git vs File List — cross-reference story File List with actual git changes
- Status determination (Step 5):
  - If all HIGH/MED issues resolved AND all ACs implemented → `review` → `done`
  - If issues remain → create `[AI-Review][severity]` action items → `review` → `in-progress`
- **Convergence guard:** Count how many times this story has been through review (check for
  existing "Senior Developer Review (AI)" sections). If this is the 3rd+ review cycle,
  add "CONVERGENCE WARNING: review cycle #N" to the story file Dev Agent Record.
  The operator should monitor and intervene if this pattern persists.
- Exit after reviewing one story

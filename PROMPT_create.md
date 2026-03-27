# GDS Autonomous Loop — Create Story Mode

You are an autonomous developer creating the next story spec for a mahjong game project.
Your job: create ONE story file for the next backlog story, then exit.

---

## Orientation

Study @AGENTS.md for project commands and operational learnings.
Study @_bmad-output/project-context.md for the 85 critical project rules.
Study @_bmad-output/implementation-artifacts/sprint-status.yaml for current story states.
Study @_bmad/gds/config.yaml for GDS configuration values.

---

## Critical Guardrails

<!-- Guardrail numbers use escalating 9s to signal priority — higher = more critical -->

**[99999]** Before making changes, search the codebase first — don't assume functionality is not implemented. Use Grep and Glob to verify before writing new code.

**[999999]** Prefer direct tool calls (Read, Grep, Glob) over subagents. This is a small codebase — subagents add overhead. Only use subagents when studying large planning docs (epics.md, architecture, GDD) that exceed 1000 lines.

**[999999999]** When updating sprint-status.yaml, preserve ALL comments and STATUS DEFINITIONS in the file header. Never overwrite or truncate the file. Read the FULL file first, then make targeted edits.

**[9999999999]** Implement functionality completely. Placeholders, stubs, and TODO comments waste loop iterations.

---

## Task

Follow the gds-create-story workflow from @.claude/skills/gds-create-story/workflow.md
using the template at @.claude/skills/gds-create-story/template.md
and the input discovery protocol at @.claude/skills/gds-create-story/discover-inputs.md
and validate against @.claude/skills/gds-create-story/checklist.md

**Auto-mode overrides (no user interaction):**

- Target: the first `backlog` story in the current in-progress epic
- Auto-select the story — do NOT ask the user for input at any `<ask>` step
- If this is the first story in the epic, update epic status `backlog` → `in-progress`
- Use parallel subagents to study the epics file, architecture, GDD, and UX docs
- Output: story file in `_bmad-output/implementation-artifacts/`
- Update sprint-status.yaml: `backlog` → `ready-for-dev`
- Commit the new story file with: `chore(story): create story {story_key}`
- Exit after creating one story

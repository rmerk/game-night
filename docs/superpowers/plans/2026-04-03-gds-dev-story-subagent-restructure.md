# GDS Dev-Story Subagent Restructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure gds-dev-story from a monolithic single-agent workflow into a controller + subagent architecture, where the controller orchestrates fresh implementer subagents per task with two-stage review (spec compliance + code quality) and a final DoD reviewer subagent.

**Architecture:** The controller (workflow.md) owns story discovery, sprint status, context curation, story file updates, and task dispatching. Per task, it dispatches: (1) an implementer subagent with curated context, (2) a spec reviewer subagent, (3) a code quality reviewer subagent. After all tasks complete, a DoD reviewer subagent validates the full story. Prompt templates live as separate markdown files in the skill directory.

**Tech Stack:** Claude Code skills (markdown workflow + prompt templates), Agent tool dispatching, TodoWrite for controller-internal tracking

---

## File Structure

All files live in `.claude/skills/gds-dev-story/` (primary) with copies synced to `_bmad/gds/workflows/4-production/gds-dev-story/` and `.cursor/skills/gds-dev-story/`.

| File | Responsibility |
|------|---------------|
| `SKILL.md` | Entry point — unchanged |
| `workflow.md` | Controller orchestration — rewritten as dispatcher |
| `checklist.md` | DoD checklist — unchanged (consumed by dod-reviewer) |
| `implementer-prompt.md` | **NEW** — template for implementer subagents |
| `spec-reviewer-prompt.md` | **NEW** — template for spec compliance review |
| `code-quality-reviewer-prompt.md` | **NEW** — template for code quality review |
| `dod-reviewer-prompt.md` | **NEW** — template for final DoD validation |
| `context-curation.md` | **NEW** — guide for controller context extraction |
| `bmad-skill-manifest.yaml` | Manifest — unchanged |

---

### Task 1: Create the implementer prompt template

**Files:**
- Create: `.claude/skills/gds-dev-story/implementer-prompt.md`

This template is what the controller pastes into each implementer subagent dispatch. It adapts the superpowers implementer-prompt.md for GDS story context: task description from story file, curated dev notes subset, relevant ACs, relevant gotchas, testing standards, and project coding conventions.

- [ ] **Step 1: Write the implementer prompt template**

```markdown
# GDS Story Implementer Prompt Template

Use this template when dispatching an implementer subagent for a story task.

## Template

\`\`\`
Task tool (general-purpose):
  description: "Implement Task N: [task name]"
  prompt: |
    You are implementing a task from a game development story.

    ## Task Description

    [FULL TEXT of task + all subtasks from story file, including checkbox items,
     file paths, prop signatures, behavioral guards — paste verbatim]

    ## Acceptance Criteria This Task Addresses

    [ONLY the ACs mapped to this task, e.g. "AC: 2, 3" — paste the full AC text
     for each. Do NOT include ACs from other tasks]

    ## Architecture & Coding Standards

    [Curated subset from Dev Notes — only sections relevant to this task:
     - Architecture Patterns (always include)
     - Component File Placement (if task creates new files)
     - Existing Code To Reuse (if task integrates with existing components)
     - Testing Standards (always include)]

    ## Critical Gotchas

    [ONLY gotchas relevant to this task — do NOT dump all 10 gotchas.
     Example: if task creates useTileSelection, include gotcha about
     rackStore separation and DnD coexistence. Skip vote prompt gotchas.]

    ## Project Conventions

    - Vue components: `<script setup lang="ts">` — always Composition API
    - Imports from `vite-plus/test` (not `vitest`) for test utilities
    - No import aliases — use relative imports or `@mahjong-game/shared`
    - Co-located tests: `*.test.ts` next to `*.ts`
    - happy-dom for client tests (not jsdom)
    - UnoCSS for styling (utility-first)

    ## Before You Begin

    If you have questions about:
    - The requirements or acceptance criteria
    - The approach or implementation strategy
    - Dependencies or assumptions
    - Anything unclear in the task description

    **Ask them now.** Raise any concerns before starting work.

    ## Your Job

    Once you're clear on requirements:
    1. Write FAILING tests first (red phase)
    2. Confirm tests fail — this validates test correctness
    3. Implement MINIMAL code to make tests pass (green phase)
    4. Run tests to confirm they pass
    5. Refactor while keeping tests green
    6. Commit your work with a Conventional Commit message
    7. Self-review (see below)
    8. Report back

    Work from: [project root directory]

    **While you work:** If you encounter something unexpected or unclear, **ask questions**.
    It's always OK to pause and clarify. Don't guess or make assumptions.

    ## Code Organization

    - Follow the file paths specified in the task description exactly
    - Each file should have one clear responsibility
    - Follow established patterns in the codebase — use smart_outline on
      existing files to understand structure before modifying them
    - If a file is growing beyond what the task specifies, stop and report
      as DONE_WITH_CONCERNS

    ## When You're in Over Your Head

    It is always OK to stop and say "this is too hard for me." Bad work is
    worse than no work.

    **STOP and escalate when:**
    - The task requires architectural decisions not covered by the task spec
    - You need to understand code beyond what was provided
    - You feel uncertain about whether your approach is correct
    - The task involves restructuring existing code the spec didn't anticipate

    **How to escalate:** Report with status BLOCKED or NEEDS_CONTEXT.

    ## Before Reporting Back: Self-Review

    **Completeness:**
    - Did I fully implement everything in every subtask?
    - Did I miss any behavioral guards or edge cases specified?
    - Are all specified props, emits, methods, and computed properties present?

    **Quality:**
    - Is this my best work?
    - Do names match the task spec exactly (not renamed)?
    - Is the code clean and follows project conventions?

    **Discipline:**
    - Did I avoid overbuilding beyond the task spec?
    - Did I only build what was requested?
    - Did I follow TDD (red-green-refactor)?

    **Testing:**
    - Do tests verify behavior, not implementation details?
    - Do tests cover the scenarios listed in the task spec?
    - Do tests use `vite-plus/test` imports and happy-dom?

    If you find issues, fix them now before reporting.

    ## Report Format

    When done, report:
    - **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - What you implemented (list each subtask completed)
    - What you tested and test results (exact test names + pass/fail)
    - Files created or modified (relative paths from repo root)
    - Self-review findings (if any)
    - Any issues or concerns
\`\`\`

## Controller Guidance

**Context curation is your most important job.** For each task:

1. Extract the task + all subtasks verbatim from the story file
2. Find the AC numbers in parentheses (e.g., "AC: 2, 3") and paste only those full AC texts
3. From Dev Notes, select ONLY sections the implementer needs for THIS task
4. From Critical Gotchas, select ONLY gotchas that apply to THIS task's files/concerns
5. Include project conventions (always the same block)

**Do NOT:**
- Dump the entire Dev Notes section
- Include all gotchas
- Include ACs from other tasks
- Include previous task implementation details
- Summarize or paraphrase — paste verbatim from story file
```

- [ ] **Step 2: Verify template completeness**

Check that the template covers:
- Task text delivery (inline, not file reference)
- AC mapping (subset, not all)
- Dev Notes curation guidance
- Gotcha filtering guidance
- Project conventions (hardcoded)
- TDD workflow (red-green-refactor)
- Status protocol (DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT)
- Self-review checklist
- Report format
- Escalation criteria
- Controller curation guidance section

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/gds-dev-story/implementer-prompt.md
git commit -m "feat(gds-dev-story): add implementer subagent prompt template

Story-aware template with curated context delivery, TDD workflow,
4-state status protocol, and controller curation guidance."
```

---

### Task 2: Create the spec reviewer prompt template

**Files:**
- Create: `.claude/skills/gds-dev-story/spec-reviewer-prompt.md`

Adapts superpowers spec-reviewer-prompt.md for GDS story structure. The spec reviewer gets the full task text + ACs and the implementer's report, then independently reads code to verify.

- [ ] **Step 1: Write the spec reviewer prompt template**

```markdown
# GDS Story Spec Compliance Reviewer Prompt Template

Use this template after an implementer subagent reports DONE or DONE_WITH_CONCERNS.

## Template

\`\`\`
Task tool (general-purpose):
  description: "Review spec compliance for Task N: [task name]"
  prompt: |
    You are reviewing whether a story task implementation matches its specification.

    ## What Was Requested

    [FULL TEXT of task + all subtasks from story file — same text given to implementer]

    ## Acceptance Criteria This Task Must Satisfy

    [FULL TEXT of mapped ACs — same ACs given to implementer]

    ## What Implementer Claims They Built

    [Paste implementer's full report here — status, files, test results, everything]

    ## CRITICAL: Do Not Trust the Report

    The implementer may be incomplete, inaccurate, or optimistic. You MUST verify
    everything independently by reading actual code.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust their claims about test coverage
    - Accept their interpretation of subtask requirements

    **DO:**
    - Read the actual code files they listed as created/modified
    - Compare implementation to each subtask specification line by line
    - Check that every behavioral guard, prop, emit, and method exists as specified
    - Run `vp test run` to verify tests actually pass
    - Check that file paths match what the task specified

    ## Your Job

    **Missing requirements:**
    - Is every subtask fully implemented (all checkboxed items)?
    - Are all specified props, emits, methods, computed properties present?
    - Do behavioral guards work as described (e.g., "no-op when targetCount is 0")?
    - Are all AC scenarios actually handled?

    **Extra/unneeded work:**
    - Did they build things not in the task spec?
    - Did they add props, methods, or features beyond what was requested?
    - Did they over-engineer or add unnecessary abstractions?

    **Misunderstandings:**
    - Did they implement the right behavior but wrong interface?
    - Did they use wrong file paths or wrong component names?
    - Did they misinterpret an AC?

    **Testing gaps:**
    - Does each test scenario from the task spec have a corresponding test?
    - Do tests verify the specified behaviors (not just "it renders")?

    **Verify by reading code, not by trusting the report.**

    ## Report Format

    Report:
    - ✅ Spec compliant (if everything matches after code inspection)
    - ❌ Issues found: [list specifically what's missing, extra, or wrong — include
      file:line references and quote the subtask requirement that was violated]
\`\`\`

## Controller Guidance

- Paste the EXACT SAME task text and ACs you gave to the implementer
- Paste the implementer's FULL report (not a summary)
- If implementer reported DONE_WITH_CONCERNS, include the concerns text —
  the spec reviewer should evaluate whether the concerns indicate real gaps
- If spec reviewer returns ❌, send findings back to the SAME implementer
  subagent (via SendMessage) for fixes, then re-dispatch spec reviewer
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/gds-dev-story/spec-reviewer-prompt.md
git commit -m "feat(gds-dev-story): add spec compliance reviewer prompt template

Adversarial reviewer that independently verifies task implementation
against story spec, with story-aware checking for subtask completeness,
AC satisfaction, and behavioral guard verification."
```

---

### Task 3: Create the code quality reviewer prompt template

**Files:**
- Create: `.claude/skills/gds-dev-story/code-quality-reviewer-prompt.md`

Uses the superpowers code-reviewer subagent type with GDS-specific quality criteria from the story's testing standards and architecture patterns.

- [ ] **Step 1: Write the code quality reviewer prompt template**

```markdown
# GDS Story Code Quality Reviewer Prompt Template

Use this template ONLY after spec compliance review passes (✅).

## Template

\`\`\`
Task tool (superpowers:code-reviewer):
  description: "Code quality review for Task N: [task name]"
  prompt: |
    WHAT_WAS_IMPLEMENTED: [from implementer's report — what was built]
    PLAN_OR_REQUIREMENTS: [task text + ACs from story]
    BASE_SHA: [commit SHA before this task started]
    HEAD_SHA: [current commit SHA after implementer's work]
    DESCRIPTION: [one-line task summary]

    ## Additional GDS Quality Criteria

    Beyond standard code quality concerns, verify:

    **Story Architecture Compliance:**
    - Does the implementation follow the architecture patterns from the story's Dev Notes?
    - Are imports using the correct patterns (no aliases, relative or @mahjong-game/shared)?
    - Does it use the specified frameworks (Composition API, UnoCSS, vite-plus/test)?

    **Testing Quality:**
    - Are tests co-located (*.test.ts next to *.ts)?
    - Do tests use happy-dom (not jsdom)?
    - Do tests import from vite-plus/test (not vitest)?
    - Do tests use project fixtures (createPlayState, suitedTile, etc.) where applicable?
    - Are mocks appropriate (@vue-dnd-kit/core mocked, Pinia set up in beforeEach)?

    **File Organization:**
    - Does each file have one clear responsibility?
    - Are new files placed in the paths specified by the task?
    - Did this task create files that are already large?

    **Vue-Specific (if applicable):**
    - Is `<script setup lang="ts">` used?
    - Are props/emits properly typed with defineProps/defineEmits?
    - Are composables following Vue composition patterns?
\`\`\`

## Controller Guidance

- Only dispatch AFTER spec reviewer returns ✅
- Record BASE_SHA before dispatching implementer (git rev-parse HEAD)
- Record HEAD_SHA after implementer commits (git rev-parse HEAD)
- If reviewer returns issues, send back to implementer subagent for fixes,
  then re-dispatch code quality reviewer
- If reviewer approves, task is complete — update story file
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/gds-dev-story/code-quality-reviewer-prompt.md
git commit -m "feat(gds-dev-story): add code quality reviewer prompt template

Git-diff-based reviewer with GDS-specific quality criteria for Vue
conventions, test co-location, import patterns, and architecture compliance."
```

---

### Task 4: Create the DoD reviewer prompt template

**Files:**
- Create: `.claude/skills/gds-dev-story/dod-reviewer-prompt.md`

This reviewer runs after ALL tasks complete. It validates the full story implementation against the DoD checklist, ACs, and story file integrity. The controller does NOT self-validate — this subagent does.

- [ ] **Step 1: Write the DoD reviewer prompt template**

```markdown
# GDS Story Definition-of-Done Reviewer Prompt Template

Use this template after ALL story tasks have passed both spec and quality reviews.

## Template

\`\`\`
Task tool (general-purpose):
  description: "DoD validation for Story [story_key]"
  prompt: |
    You are performing final Definition-of-Done validation for a completed story.
    Your job is to independently verify the story is truly ready for code review.

    ## Story File

    [FULL story file content — the controller pastes the entire story markdown
     including all sections: Story, ACs, Tasks, Dev Notes, Dev Agent Record, etc.]

    ## DoD Checklist

    [FULL content of checklist.md — paste verbatim]

    ## CRITICAL: Independent Verification

    The controller claims all tasks passed spec and quality reviews. You MUST
    verify independently. The controller may have missed cross-task issues.

    **DO NOT:**
    - Trust that individual task reviews caught everything
    - Assume cross-cutting concerns were validated
    - Skip running the full test suite

    **DO:**
    - Run `pnpm test` to verify ALL tests pass (not just per-task tests)
    - Run `pnpm run typecheck` to verify type safety
    - Run `vp lint` to verify code quality
    - Read the actual code for each file in the File List
    - Verify every AC has a corresponding implementation AND test
    - Check that Dev Agent Record accurately reflects what was built
    - Verify Change Log entries are present and accurate

    ## Your Job

    Work through every item in the DoD checklist. For each item:
    1. Verify it independently (read code, run commands, check files)
    2. Mark it ✅ or ❌ with evidence

    **Cross-Task Validation (what per-task reviews miss):**
    - Do components integrate correctly across task boundaries?
    - Are there naming inconsistencies between files created by different tasks?
    - Do imports between new files resolve correctly?
    - Are there duplicate or conflicting implementations?
    - Does the full system work end-to-end (not just individual units)?

    **Story File Integrity:**
    - Are ALL tasks and subtasks marked [x]?
    - Does the File List include EVERY changed file? (cross-check with git)
    - Were only permitted story sections modified?
    - Is the Dev Agent Record populated with meaningful notes?

    ## Report Format

    Report:
    - **Overall:** ✅ PASS or ❌ FAIL
    - **Checklist Results:** Each DoD item with ✅/❌ and evidence
    - **Cross-Task Issues:** Any integration problems found
    - **Test Suite Results:** Full test run output summary
    - **Quality Gate Results:** Typecheck + lint results
    - **Blocking Issues:** (if FAIL) Specific items that must be fixed

    If FAIL, list the exact fixes needed. The controller will dispatch a
    fix subagent for each blocking issue.
\`\`\`

## Controller Guidance

- Paste the COMPLETE story file (all sections)
- Paste the COMPLETE checklist.md content
- If DoD reviewer returns ❌, dispatch a fix subagent per blocking issue,
  then re-run DoD review
- If DoD reviewer returns ✅, proceed to update story status to "review"
  and update sprint-status.yaml
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/gds-dev-story/dod-reviewer-prompt.md
git commit -m "feat(gds-dev-story): add definition-of-done reviewer prompt template

Independent final validation subagent that runs full DoD checklist,
cross-task integration checks, full test suite, and story file integrity
verification."
```

---

### Task 5: Create the context curation guide

**Files:**
- Create: `.claude/skills/gds-dev-story/context-curation.md`

This is reference documentation for the controller. It codifies how to extract and curate context from the story file for each subagent type. Not a prompt template — a guide the controller follows.

- [ ] **Step 1: Write the context curation guide**

```markdown
# Context Curation Guide

How the controller extracts and curates context from the story file for each
subagent type. The controller's primary job is ensuring each subagent gets
exactly what it needs — no more, no less.

## Principle: Curate, Don't Dump

Each subagent should receive the minimum context needed to do its job well.
Dumping the full story file into every subagent recreates the context bloat
problem that this architecture is designed to solve.

## Per-Task Context Extraction

For each task in the story's Tasks/Subtasks section:

### 1. Task Text (verbatim)
- Copy the full task line and ALL subtask lines (including checkboxes)
- Include file paths, prop signatures, behavioral guards — everything
- Do NOT summarize or paraphrase

### 2. Acceptance Criteria (subset)
- Read the AC numbers in parentheses after the task title (e.g., "AC: 2, 3")
- Copy ONLY those numbered ACs from the Acceptance Criteria section
- Include the full AC text with Given/When/Then and reference tags

### 3. Dev Notes (curated subset)
Select ONLY relevant sections from Dev Notes:

| Dev Notes Section | Include When |
|-------------------|-------------|
| Architecture Patterns | Always |
| Component File Placement | Task creates new files |
| Existing Code To Reuse | Task integrates with existing components |
| Key Protocol Types | Task consumes or produces protocol types |
| Relevant Resolved Actions | Task handles game actions/events |
| Testing Standards | Always |
| Previous Story Intelligence | Task touches area with known pitfalls |
| Scope Boundaries | Task is near a scope boundary |

**Never include for implementer:** Execution Gate, Git Intelligence, full
References section.

### 4. Gotchas (filtered)
- Read each gotcha and evaluate: does this gotcha relate to the files,
  components, or behaviors this task touches?
- Include only matching gotchas
- Example: Task creating `useTileSelection` needs gotchas about rackStore
  separation and DnD coexistence. It does NOT need gotchas about vote
  prompts or courtesy pass blind tiles.

### 5. Project Conventions (static)
Always include the same conventions block (from CLAUDE.md).

## Subagent Context Matrix

| Context Piece | Implementer | Spec Reviewer | Quality Reviewer | DoD Reviewer |
|---------------|:-----------:|:-------------:|:----------------:|:------------:|
| Task text (verbatim) | ✅ | ✅ | via diff | ✅ (all tasks) |
| Mapped ACs | ✅ | ✅ | via requirements | ✅ (all ACs) |
| Dev Notes (curated) | ✅ | ❌ | ❌ | ❌ |
| Gotchas (filtered) | ✅ | ❌ | ❌ | ❌ |
| Project conventions | ✅ | ❌ | ✅ (in criteria) | ❌ |
| Implementer's report | ❌ | ✅ | ✅ (summary) | ❌ |
| Git SHAs (base/head) | ❌ | ❌ | ✅ | ❌ |
| Full story file | ❌ | ❌ | ❌ | ✅ |
| DoD checklist | ❌ | ❌ | ❌ | ✅ |

## Review Continuation Context

When the story has a "Senior Developer Review (AI)" section (review continuation):
- Extract review findings as individual fix tasks
- Each finding becomes a task dispatched to a fix implementer subagent
- The finding text IS the task spec (what to fix and why)
- Include the relevant code file path and the original AC it relates to
- After fix, run normal two-stage review (spec then quality)

## Model Selection Guidance

| Task Characteristics | Recommended Model |
|---------------------|-------------------|
| Single file, clear spec, isolated logic | haiku |
| New composable/component with props/emits | sonnet |
| Multi-file integration, store wiring | sonnet |
| Cross-cutting concerns, architecture decisions | opus |
| Spec reviewer (any task) | sonnet |
| Code quality reviewer (any task) | sonnet |
| DoD reviewer | opus |
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/gds-dev-story/context-curation.md
git commit -m "docs(gds-dev-story): add context curation guide for controller

Reference documentation codifying how to extract story context per subagent
type, with context matrix, model selection, and review continuation handling."
```

---

### Task 6: Rewrite workflow.md as controller orchestrator

**Files:**
- Modify: `.claude/skills/gds-dev-story/workflow.md`

This is the core change. The workflow becomes a controller that:
1. Discovers and loads the story (Steps 1-4 — largely preserved)
2. Parses all tasks and creates TodoWrite tracking
3. Per task: curates context, dispatches implementer, runs two-stage review
4. After all tasks: dispatches DoD reviewer
5. Updates story file and sprint status

The controller NEVER reads implementation code directly. It NEVER validates its own work. Subagents do all implementation and validation.

- [ ] **Step 1: Read the current workflow.md in full**

```bash
cat .claude/skills/gds-dev-story/workflow.md
```

Already read — 483 lines of XML-style workflow definition.

- [ ] **Step 2: Write the rewritten workflow.md**

The new workflow.md preserves:
- Config loading and path resolution (INITIALIZATION section)
- Story discovery logic (Step 1 — sprint-status.yaml or file search)
- Story parsing (Step 2 — sections, tasks, ACs)
- Review continuation detection (Step 3)
- Sprint status updates (Steps 4, 9)
- Story file section restrictions
- claude-mem integration
- HALT conditions

The new workflow.md changes:
- Steps 5-8 collapse into a "Per Task Dispatch Loop"
- Step 5 (implement) → dispatch implementer subagent per template
- Step 6 (tests) → merged into implementer's TDD cycle
- Step 7 (validations) → dispatch spec reviewer, then quality reviewer
- Step 8 (mark complete) → controller updates story file only after both reviews pass
- Step 9 (completion) → dispatch DoD reviewer subagent
- Step 10 (communication) → preserved, runs after DoD passes
- Controller uses TodoWrite for internal tracking
- Controller follows context-curation.md for each dispatch
- Controller records BASE_SHA before each implementer dispatch

Key structural decisions:
- Keep the XML `<workflow>` / `<step>` / `<action>` format for consistency with other GDS skills
- Reference prompt templates by relative path (e.g., `./implementer-prompt.md`)
- Controller guidance is inline in the workflow steps
- Story file updates (checkboxes, File List, Change Log, Dev Agent Record) happen in the controller after both reviews pass — subagents never touch the story file

The full rewrite is ~300-400 lines. The key new sections are:

**New Step 5: Per-Task Dispatch Loop**
```
For each incomplete task in story order:
  1. Record BASE_SHA = git rev-parse HEAD
  2. Curate context per context-curation.md
  3. Dispatch implementer subagent per implementer-prompt.md
  4. Handle implementer status (DONE/CONCERNS/BLOCKED/NEEDS_CONTEXT)
  5. If DONE/DONE_WITH_CONCERNS: dispatch spec reviewer per spec-reviewer-prompt.md
  6. If spec ✅: dispatch code quality reviewer per code-quality-reviewer-prompt.md
  7. If quality approved: update story file (checkbox, File List, Change Log)
  8. If any reviewer ❌: send fixes back to implementer, re-review
  9. Mark task complete in TodoWrite
  10. Next task
```

**New Step 6: DoD Validation**
```
  1. Read updated story file
  2. Dispatch DoD reviewer per dod-reviewer-prompt.md
  3. If ❌: dispatch fix subagent per blocking issue, re-run DoD
  4. If ✅: proceed to sprint status update
```

- [ ] **Step 3: Write the actual workflow.md content**

Write the complete rewritten workflow.md with all steps, preserving the XML structure and GDS conventions. This is the largest single deliverable — expect ~350 lines.

- [ ] **Step 4: Verify structural consistency**

Check that:
- All prompt template references match actual file names
- Config variable references match config.yaml
- Sprint status transitions match expected flow (ready-for-dev → in-progress → review)
- Story file section restrictions are preserved
- HALT conditions are preserved
- Review continuation flow is preserved
- Step numbering is sequential and complete

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/gds-dev-story/workflow.md
git commit -m "refactor(gds-dev-story): rewrite workflow as controller + subagent orchestrator

Replace monolithic single-agent execution with controller that dispatches
fresh subagents per task. Two-stage review (spec + quality) per task,
DoD reviewer for final validation. Controller owns story file updates,
context curation, and sprint status management."
```

---

### Task 7: Sync files to secondary locations

**Files:**
- Modify: `_bmad/gds/workflows/4-production/gds-dev-story/` (all files)
- Modify: `.cursor/skills/gds-dev-story/` (all files)

Both directories must mirror `.claude/skills/gds-dev-story/`.

- [ ] **Step 1: Copy all new and modified files to _bmad location**

```bash
cp .claude/skills/gds-dev-story/implementer-prompt.md _bmad/gds/workflows/4-production/gds-dev-story/
cp .claude/skills/gds-dev-story/spec-reviewer-prompt.md _bmad/gds/workflows/4-production/gds-dev-story/
cp .claude/skills/gds-dev-story/code-quality-reviewer-prompt.md _bmad/gds/workflows/4-production/gds-dev-story/
cp .claude/skills/gds-dev-story/dod-reviewer-prompt.md _bmad/gds/workflows/4-production/gds-dev-story/
cp .claude/skills/gds-dev-story/context-curation.md _bmad/gds/workflows/4-production/gds-dev-story/
cp .claude/skills/gds-dev-story/workflow.md _bmad/gds/workflows/4-production/gds-dev-story/
```

- [ ] **Step 2: Copy all new and modified files to .cursor location**

```bash
cp .claude/skills/gds-dev-story/implementer-prompt.md .cursor/skills/gds-dev-story/
cp .claude/skills/gds-dev-story/spec-reviewer-prompt.md .cursor/skills/gds-dev-story/
cp .claude/skills/gds-dev-story/code-quality-reviewer-prompt.md .cursor/skills/gds-dev-story/
cp .claude/skills/gds-dev-story/dod-reviewer-prompt.md .cursor/skills/gds-dev-story/
cp .claude/skills/gds-dev-story/context-curation.md .cursor/skills/gds-dev-story/
cp .claude/skills/gds-dev-story/workflow.md .cursor/skills/gds-dev-story/
```

- [ ] **Step 3: Verify all three locations are identical**

```bash
diff -r .claude/skills/gds-dev-story/ _bmad/gds/workflows/4-production/gds-dev-story/
diff -r .claude/skills/gds-dev-story/ .cursor/skills/gds-dev-story/
```

Expected: Only `bmad-skill-manifest.yaml` may differ (it's minimal metadata). All other files should be identical.

- [ ] **Step 4: Commit**

```bash
git add _bmad/gds/workflows/4-production/gds-dev-story/ .cursor/skills/gds-dev-story/
git commit -m "chore(gds-dev-story): sync subagent templates to all skill locations

Mirror new prompt templates and rewritten workflow to _bmad and .cursor
skill directories."
```

---

## Verification

After all tasks are complete:

1. **Structural check:** All 8 files exist in `.claude/skills/gds-dev-story/`:
   ```bash
   ls -la .claude/skills/gds-dev-story/
   ```
   Expected: SKILL.md, workflow.md, checklist.md, bmad-skill-manifest.yaml, implementer-prompt.md, spec-reviewer-prompt.md, code-quality-reviewer-prompt.md, dod-reviewer-prompt.md, context-curation.md

2. **Cross-reference check:** All template filenames referenced in workflow.md exist as actual files

3. **Sync check:** All three locations have identical content (minus manifest)

4. **Dry run:** Mentally walk through Story 3B.4's Task 1 (useTileSelection composable):
   - Controller extracts Task 1 text + subtasks 1.1-1.4
   - Controller extracts AC 2 and AC 3
   - Controller curates: Architecture Patterns, Testing Standards, Component File Placement
   - Controller filters gotchas: rackStore separation (#1), DnD coexistence (#4)
   - Controller dispatches implementer with curated context (~2KB, not ~15KB)
   - Implementer builds, tests, commits, reports DONE
   - Controller dispatches spec reviewer with task text + ACs + report
   - Spec reviewer reads code, verifies subtasks 1.1-1.4, returns ✅
   - Controller dispatches quality reviewer with git SHAs
   - Quality reviewer checks conventions, returns approved
   - Controller marks Task 1 [x] in story file, updates File List
   - Controller moves to Task 2

5. **No regression:** Existing story files, sprint-status.yaml, checklist.md, SKILL.md, and config.yaml are unchanged

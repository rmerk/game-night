# Platform-Adaptive Dev Story Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split gds-dev-story workflow into shared core + platform strategy files so it works correctly in both Claude Code and Cursor.

**Architecture:** The workflow keeps shared Steps 1-4 and 8-9 in `workflow.md`. Steps 5-7 (implementation loop, regression, DoD) are extracted into `strategy-claude-code.md` and `strategy-cursor.md`. Platform selection is baked into each platform's `SKILL.md` entry point — no runtime detection.

**Tech Stack:** Markdown workflow files, XML-style workflow DSL, YAML config

**Source of truth:** `_bmad/gds/workflows/4-production/gds-dev-story/`
**Deployment locations:** `.claude/skills/gds-dev-story/`, `.cursor/skills/gds-dev-story/`

---

### Task 1: Create `strategy-claude-code.md`

Extract Steps 5-7 from the current `workflow.md` into a standalone strategy file. This is a pure extraction — no behavioral changes.

**Files:**
- Create: `_bmad/gds/workflows/4-production/gds-dev-story/strategy-claude-code.md`
- Reference: `_bmad/gds/workflows/4-production/gds-dev-story/workflow.md` (lines 306-475, Steps 5-7)

- [ ] **Step 1: Create strategy-claude-code.md with Steps 5-7 extracted verbatim**

Create the file at `_bmad/gds/workflows/4-production/gds-dev-story/strategy-claude-code.md` with this content:

```markdown
# Claude Code Strategy — Steps 5-7

This strategy is loaded by `workflow.md` when running in Claude Code.
The controller dispatches subagents via the `Agent` tool and communicates
with them via `SendMessage`.

<strategy>
  <critical>You are a CONTROLLER. You dispatch subagents — you do NOT write implementation code.</critical>
  <critical>FOLLOW THE STORY FILE TASKS/SUBTASKS SEQUENCE EXACTLY AS WRITTEN — NO DEVIATION</critical>
  <critical>Follow {{context_curation}} guide for every subagent dispatch</critical>
```

Then paste the FULL content of workflow.md lines 311-475 (the `<step n="5">`, `<step n="6">`, and `<step n="7">` elements) **as-is, unchanged**, below the opening `<strategy>` tag.

Close with:

```markdown
</strategy>
```

- [ ] **Step 2: Verify extraction is complete**

Compare the extracted steps against the original workflow.md:
- Step 5 (per-task dispatch loop): All `<check>` branches for NEEDS_CONTEXT, BLOCKED, DONE_WITH_CONCERNS, DONE present
- Step 5: Spec reviewer dispatch + SendMessage fix loop present
- Step 5: Code quality reviewer dispatch + SendMessage fix loop present
- Step 5: Task completion (checkboxes, File List, Dev Agent Record, Change Log, review follow-up handling) present
- Step 5: 3-failure HALT and loop-to-next-task present
- Step 6 (full regression): pnpm test, typecheck, lint + fix subagent loop present
- Step 7 (DoD validation): DoD reviewer dispatch, FAIL fix loop, 3-failure HALT present

- [ ] **Step 3: Commit**

```bash
git add _bmad/gds/workflows/4-production/gds-dev-story/strategy-claude-code.md
git commit -m "feat(gds-dev-story): extract Claude Code strategy from workflow Steps 5-7"
```

---

### Task 2: Create `strategy-cursor.md`

Write the Cursor strategy implementing the design spec: controller implements directly via TDD, attempts Task dispatch for reviewers with mechanical self-review fallback.

**Files:**
- Create: `_bmad/gds/workflows/4-production/gds-dev-story/strategy-cursor.md`
- Reference: `docs/superpowers/specs/2026-04-03-platform-adaptive-dev-story-design.md` (Strategy: Cursor section)
- Reference: `_bmad/gds/workflows/4-production/gds-dev-story/implementer-prompt.md` (TDD checklist)
- Reference: `_bmad/gds/workflows/4-production/gds-dev-story/spec-reviewer-prompt.md` (spec review criteria)
- Reference: `_bmad/gds/workflows/4-production/gds-dev-story/code-quality-reviewer-prompt.md` (quality criteria)
- Reference: `_bmad/gds/workflows/4-production/gds-dev-story/dod-reviewer-prompt.md` (DoD criteria)

- [ ] **Step 1: Create strategy-cursor.md**

Create the file at `_bmad/gds/workflows/4-production/gds-dev-story/strategy-cursor.md` with this content:

```markdown
# Cursor Strategy — Steps 5-7

This strategy is loaded by `workflow.md` when running in Cursor.
The controller implements code directly via TDD and attempts `Task` dispatch
for reviewers with mechanical self-review fallback.

<strategy>
  <critical>FOLLOW THE STORY FILE TASKS/SUBTASKS SEQUENCE EXACTLY AS WRITTEN — NO DEVIATION</critical>
  <critical>You ARE the implementer. Follow TDD discipline from {{implementer_template}}.</critical>
  <critical>Follow {{context_curation}} guide to focus your attention per-task — same discipline as subagent dispatch, applied to yourself.</critical>

  <!-- ============================================================ -->
  <!-- STEP 5: PER-TASK IMPLEMENTATION LOOP                          -->
  <!-- Controller implements directly with reviewer dispatch/fallback -->
  <!-- ============================================================ -->

  <step n="5" goal="Implement each task via TDD with review gates">
    <action>Get the current incomplete task from the story file task queue</action>

    <!-- PRE-IMPLEMENTATION: Record baseline and curate context -->
    <action>Record BASE_SHA = `git rev-parse HEAD` (before any implementation)</action>
    <action>Curate context for this task following {{context_curation}} guide:
      1. Extract task text + all subtasks VERBATIM from story file
      2. Find AC numbers in parentheses (e.g., "AC: 2, 3") — copy ONLY those full AC texts
      3. From Dev Notes, select ONLY sections relevant to THIS task (see curation guide matrix)
      4. From Critical Gotchas, select ONLY gotchas that apply to THIS task's files/concerns
      5. Include static project conventions block
    </action>
    <action>Focus ONLY on this task's context. Do not carry forward implementation details from previous tasks.</action>

    <!-- IMPLEMENT: Controller does TDD directly -->
    <action>Follow {{implementer_template}} as your own implementation checklist:
      1. Write FAILING tests first (red phase)
      2. Run tests — confirm they fail (validates test correctness)
      3. Implement MINIMAL code to make tests pass (green phase)
      4. Run tests — confirm they pass
      5. Refactor while keeping tests green
      6. Commit with Conventional Commit message
      7. Run self-review from {{implementer_template}} self-review section
    </action>

    <!-- REVIEW GATE 1: Spec compliance -->
    <action>Record HEAD_SHA = `git rev-parse HEAD` (after implementation commits)</action>

    <action>Attempt spec compliance review via Task dispatch:
      - Use Task tool with spec-reviewer-prompt.md template
      - Pass the EXACT SAME task text and ACs you curated above
      - Pass a summary of what you implemented and which files you created/modified
    </action>

    <check if="Task dispatch succeeded and reviewer returned results">
      <check if="spec reviewer returns issues">
        <action>Fix each issue identified by the reviewer</action>
        <action>Re-run tests to confirm fixes don't break anything</action>
        <action>Commit fixes</action>
        <action>Re-attempt spec reviewer Task dispatch to verify fixes</action>
      </check>
      <check if="spec reviewer returns compliant">
        <action>Proceed to quality review</action>
      </check>
    </check>

    <check if="Task dispatch failed (tool unavailable, error, or no result)">
      <action>Run mechanical spec self-review — this is NOT optional, every item must be checked:</action>
      <action>For each subtask in the task spec:
        1. Read the actual code file at the path specified
        2. Verify the exact prop/emit/method/guard exists as named in the spec
        3. Record: "[subtask text] → [file:line] — PASS/FAIL"
      </action>
      <action>For each mapped AC:
        1. Find the test that exercises this AC scenario
        2. Run `vp test run` and capture output
        3. Record: "[AC number] → [test name] — PASS/FAIL"
      </action>
      <action>If any item is FAIL → fix the issue, re-run affected tests, commit fix</action>
    </check>

    <!-- REVIEW GATE 2: Code quality -->
    <action>Attempt code quality review via Task dispatch:
      - Use Task tool with code-quality-reviewer-prompt.md template
      - Pass BASE_SHA, HEAD_SHA, task summary, requirements
    </action>

    <check if="Task dispatch succeeded and reviewer returned results">
      <check if="quality reviewer returns issues">
        <action>Fix each issue identified</action>
        <action>Re-run tests and lint to confirm fixes</action>
        <action>Commit fixes</action>
        <action>Re-attempt quality reviewer Task dispatch to verify</action>
      </check>
      <check if="quality reviewer approves">
        <action>Proceed to task completion</action>
      </check>
    </check>

    <check if="Task dispatch failed (tool unavailable, error, or no result)">
      <action>Run mechanical quality self-review — every item must be checked:</action>
      <action>For each file created or modified:
        1. Read file — verify `&lt;script setup lang="ts"&gt;` (Vue SFCs)
        2. Verify co-located test file exists (*.test.ts next to *.ts)
        3. Verify imports: no `@/` aliases, use relative or `@mahjong-game/shared`
        4. Verify test imports from `vite-plus/test` (not `vitest`)
        5. Verify test uses `happy-dom` (not `jsdom`)
        6. Verify test calls `setActivePinia(createPinia())` in `beforeEach` (if Vue component test)
        7. Check file length — flag if &gt;200 lines for a new file
      </action>
      <action>Run: `vp test run &amp;&amp; vp lint`</action>
      <action>Record results verbatim</action>
      <action>If any issue found → fix, re-run checks, commit fix</action>
    </check>

    <!-- TASK COMPLETE: Update story file -->
    <action>Mark the task (and all subtasks) checkbox with [x] in story file</action>
    <action>Update File List section with files created/modified (paths relative to repo root)</action>
    <action>Add completion notes to Dev Agent Record</action>

    <!-- Handle review follow-up tasks -->
    <check if="task is review follow-up (has [AI-Review] prefix)">
      <action>Mark task checkbox [x] in "Tasks/Subtasks → Review Follow-ups (AI)" section</action>
      <action>Find matching action item in "Senior Developer Review (AI) → Action Items" section</action>
      <action>Mark that action item checkbox [x] as resolved</action>
      <action>Add to Dev Agent Record: "Resolved review finding [{{severity}}]: {{description}}"</action>
    </check>

    <action>Update Change Log with summary of task completion</action>
    <action>Save the story file</action>
    <action>Mark task complete in TodoWrite</action>

    <action if="3 consecutive implementation failures on same task">HALT and request user guidance</action>

    <!-- LOOP: Next task -->
    <action>Determine if more incomplete tasks remain</action>
    <action if="more tasks remain">
      <goto step="5">Next task</goto>
    </action>
    <action if="no tasks remain">
      <goto step="6">Run full test suite</goto>
    </action>
  </step>

  <!-- ============================================================ -->
  <!-- STEP 6: FULL REGRESSION SUITE                                 -->
  <!-- Identical to Claude Code — run before DoD validation          -->
  <!-- ============================================================ -->

  <step n="6" goal="Run full test suite and quality gates">
    <action>Run `pnpm test` — full test suite across all packages</action>
    <action>Run `pnpm run typecheck` — TypeScript type checking</action>
    <action>Run `vp lint` — linting and code quality</action>

    <check if="any failures">
      <action>Fix the failure directly (read error, diagnose, fix code)</action>
      <action>After fix, re-run all checks</action>
      <action>Repeat until all pass</action>
    </check>

    <action if="all pass">Proceed to DoD validation</action>
  </step>

  <!-- ============================================================ -->
  <!-- STEP 7: DOD VALIDATION                                        -->
  <!-- Attempt Task dispatch with mechanical fallback                -->
  <!-- ============================================================ -->

  <step n="7" goal="Definition-of-Done validation">
    <action>Read the updated story file in full (it now has all tasks marked [x])</action>
    <action>Read {{validation}} checklist in full</action>

    <action>Attempt DoD reviewer dispatch via Task tool:
      - Use Task tool with dod-reviewer-prompt.md template
      - Pass the COMPLETE story file content (all sections)
      - Pass the COMPLETE checklist.md content
    </action>

    <check if="Task dispatch succeeded and reviewer returned results">
      <check if="DoD reviewer returns FAIL">
        <action>For each blocking issue: fix directly, re-run affected checks</action>
        <action>Re-attempt DoD reviewer Task dispatch</action>
        <action>Repeat until PASS</action>
      </check>
      <check if="DoD reviewer returns PASS">
        <action>Proceed to story completion</action>
      </check>
    </check>

    <check if="Task dispatch failed (tool unavailable, error, or no result)">
      <action>Run mechanical DoD self-review — every checklist item must be verified:</action>
      <action>For each item in {{validation}} checklist:
        1. Execute the verification action (run command, read file, check section)
        2. Record: "[checklist item] → [evidence] — PASS/FAIL"
      </action>
      <action>Cross-task integration checks:
        1. For each pair of files in File List that import each other:
           - Verify import paths resolve
           - Verify type compatibility at boundaries
        2. Run `pnpm test` — record full summary
        3. Run `pnpm run typecheck` — record summary
        4. Run `vp lint` — record summary
      </action>
      <action>Story file integrity:
        1. Verify ALL tasks and subtasks marked [x]
        2. Cross-check File List against `git diff --name-only {{BASE_SHA_first_task}}..HEAD`
        3. Verify Dev Agent Record has meaningful completion notes
        4. Verify Change Log has entries for each task
      </action>
      <action>If any FAIL → fix issue, re-run failed checks, repeat until clean</action>
    </check>

    <action if="DoD validation fails 3 consecutive times">HALT - Escalate to user</action>
  </step>

</strategy>
```

- [ ] **Step 2: Verify strategy covers all spec requirements**

Check against the design spec's "Strategy: Cursor" section:
- Context curation discipline preserved (Step 5, pre-implementation)
- TDD implementation following implementer-prompt.md (Step 5, implement)
- Spec review with Task dispatch + mechanical fallback (Step 5, review gate 1)
- Quality review with Task dispatch + mechanical fallback (Step 5, review gate 2)
- Task completion updates to story file (Step 5, task complete)
- Review follow-up handling (Step 5, review follow-up)
- Full regression identical to CC (Step 6)
- DoD with Task dispatch + mechanical fallback (Step 7)
- Mechanical self-reviews have specific verification actions, not vague "check" instructions

- [ ] **Step 3: Commit**

```bash
git add _bmad/gds/workflows/4-production/gds-dev-story/strategy-cursor.md
git commit -m "feat(gds-dev-story): create Cursor strategy with TDD + reviewer fallback"
```

---

### Task 3: Modify `workflow.md` to reference strategy files

Remove inline Steps 5-7 and replace with a strategy file load point. Add `strategy_file` to initialization paths.

**Files:**
- Modify: `_bmad/gds/workflows/4-production/gds-dev-story/workflow.md`

- [ ] **Step 1: Add `strategy_file` to the Paths section**

In the `### Paths` section (after `context_curation` line), add:

```markdown
- `strategy_file` = `` (set by SKILL.md — `strategy-claude-code.md` or `strategy-cursor.md`)
```

This goes after the line `- `context_curation` = `./context-curation.md`` and before the `### Context` section.

- [ ] **Step 2: Replace Steps 5-7 with strategy file reference**

Replace the entire block from:
```
  <!-- ============================================================ -->
  <!-- STEP 5: PER-TASK DISPATCH LOOP                                -->
```

Through the end of:
```
  </step>
```
(the closing tag of Step 7, DoD validation)

With this:

```xml
  <!-- ============================================================ -->
  <!-- STEPS 5-7: PLATFORM-SPECIFIC STRATEGY                         -->
  <!-- Loaded from strategy file set by SKILL.md entry point         -->
  <!-- ============================================================ -->

  <step n="5-7" goal="Execute platform strategy for implementation, review, and validation">
    <critical>Load and execute {{strategy_file}} now.</critical>
    <critical>The strategy file contains Steps 5, 6, and 7. Follow them exactly.</critical>
    <action>Read {{strategy_file}} in full</action>
    <action>Execute all steps defined in the strategy file sequentially</action>
    <action>When the strategy completes (all tasks done, regression passed, DoD validated), return here for Step 8</action>
  </step>
```

- [ ] **Step 3: Update the critical directives in the `<workflow>` opening tag**

The current workflow has this critical directive inside the `<workflow>` tag:

```xml
<critical>You are a CONTROLLER. You dispatch subagents — you do NOT write implementation code.</critical>
```

Replace it with:

```xml
<critical>You are a CONTROLLER. Your behavior in Steps 5-7 is defined by {{strategy_file}} — follow it exactly.</critical>
```

This is necessary because the Cursor strategy has the controller implementing directly, so "you do NOT write implementation code" would conflict.

- [ ] **Step 4: Verify the workflow structure is correct**

Read through the modified workflow.md and verify:
- Steps 1-4 are unchanged
- Step 5-7 placeholder loads the strategy file
- Steps 8-9 are unchanged
- The `strategy_file` path variable is declared in Paths
- No dangling references to Agent/SendMessage in the shared steps (1-4, 8-9)

- [ ] **Step 5: Commit**

```bash
git add _bmad/gds/workflows/4-production/gds-dev-story/workflow.md
git commit -m "refactor(gds-dev-story): replace inline Steps 5-7 with strategy file reference"
```

---

### Task 4: Update `SKILL.md` for both platforms

Create platform-specific entry points that tell the workflow which strategy to use.

**Files:**
- Modify: `_bmad/gds/workflows/4-production/gds-dev-story/SKILL.md`
- Create: `_bmad/gds/workflows/4-production/gds-dev-story/SKILL-cursor.md`

- [ ] **Step 1: Update the existing SKILL.md for Claude Code**

The current SKILL.md at `_bmad/gds/workflows/4-production/gds-dev-story/SKILL.md` contains:

```markdown
---
name: gds-dev-story
description: 'Execute story implementation following a context filled story spec file. Use when the user says "dev this story [story file]" or "implement the next story in the sprint plan"'
---

Follow the instructions in [workflow.md](workflow.md).
```

Replace the body (after the frontmatter closing `---`) with:

```markdown
Follow the instructions in [workflow.md](workflow.md). Use `strategy-claude-code.md` as the `strategy_file`.
```

- [ ] **Step 2: Create SKILL-cursor.md for Cursor**

Create `_bmad/gds/workflows/4-production/gds-dev-story/SKILL-cursor.md`:

```markdown
---
name: gds-dev-story
description: 'Execute story implementation following a context filled story spec file. Use when the user says "dev this story [story file]" or "implement the next story in the sprint plan"'
---

Follow the instructions in [workflow.md](workflow.md). Use `strategy-cursor.md` as the `strategy_file`.
```

- [ ] **Step 3: Commit**

```bash
git add _bmad/gds/workflows/4-production/gds-dev-story/SKILL.md
git add _bmad/gds/workflows/4-production/gds-dev-story/SKILL-cursor.md
git commit -m "feat(gds-dev-story): platform-specific SKILL.md entry points"
```

---

### Task 5: Add implementer-prompt.md note for Cursor usage

Add a brief note to the implementer prompt template clarifying its dual role.

**Files:**
- Modify: `_bmad/gds/workflows/4-production/gds-dev-story/implementer-prompt.md`

- [ ] **Step 1: Add Cursor usage note**

At the very end of `implementer-prompt.md`, after the `**Do NOT:**` list in the Controller Guidance section, add:

```markdown

## Platform Note

In the **Cursor strategy**, the controller uses this template as its own TDD implementation
checklist rather than passing it to a subagent. The template content, TDD discipline, and
self-review section apply identically — the only difference is who executes them.
```

- [ ] **Step 2: Commit**

```bash
git add _bmad/gds/workflows/4-production/gds-dev-story/implementer-prompt.md
git commit -m "docs(gds-dev-story): add Cursor platform usage note to implementer prompt"
```

---

### Task 6: Sync files to deployment locations

Copy all files from source of truth to both platform deployment directories, using the correct SKILL.md for each.

**Files:**
- Sync target: `.claude/skills/gds-dev-story/`
- Sync target: `.cursor/skills/gds-dev-story/`
- Source: `_bmad/gds/workflows/4-production/gds-dev-story/`

- [ ] **Step 1: Sync shared files to both locations**

These files are identical across both platforms:

```bash
# Shared files — copy to both .claude and .cursor
for file in workflow.md context-curation.md implementer-prompt.md spec-reviewer-prompt.md code-quality-reviewer-prompt.md dod-reviewer-prompt.md checklist.md bmad-skill-manifest.yaml strategy-claude-code.md strategy-cursor.md; do
  cp "_bmad/gds/workflows/4-production/gds-dev-story/$file" ".claude/skills/gds-dev-story/$file"
  cp "_bmad/gds/workflows/4-production/gds-dev-story/$file" ".cursor/skills/gds-dev-story/$file"
done
```

- [ ] **Step 2: Copy platform-specific SKILL.md files**

```bash
# Claude Code gets the default SKILL.md
cp _bmad/gds/workflows/4-production/gds-dev-story/SKILL.md .claude/skills/gds-dev-story/SKILL.md

# Cursor gets the Cursor-specific SKILL.md
cp _bmad/gds/workflows/4-production/gds-dev-story/SKILL-cursor.md .cursor/skills/gds-dev-story/SKILL.md
```

Note: The Cursor directory gets `SKILL-cursor.md` renamed to `SKILL.md` — the platform reads `SKILL.md` as the entry point.

- [ ] **Step 3: Verify sync with diff**

```bash
# Verify all shared files are identical
for file in workflow.md context-curation.md implementer-prompt.md spec-reviewer-prompt.md code-quality-reviewer-prompt.md dod-reviewer-prompt.md checklist.md strategy-claude-code.md strategy-cursor.md; do
  diff "_bmad/gds/workflows/4-production/gds-dev-story/$file" ".claude/skills/gds-dev-story/$file"
  diff "_bmad/gds/workflows/4-production/gds-dev-story/$file" ".cursor/skills/gds-dev-story/$file"
done

# Verify platform-specific SKILL.md files
diff _bmad/gds/workflows/4-production/gds-dev-story/SKILL.md .claude/skills/gds-dev-story/SKILL.md
diff _bmad/gds/workflows/4-production/gds-dev-story/SKILL-cursor.md .cursor/skills/gds-dev-story/SKILL.md
```

All diffs should produce no output (identical files).

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-dev-story/ .cursor/skills/gds-dev-story/
git commit -m "chore(gds-dev-story): sync platform-adaptive workflow to deployment locations"
```

---

### Task 7: Verify end-to-end correctness

Final validation that the refactored workflow is complete and internally consistent.

**Files:**
- Read: All files in `.claude/skills/gds-dev-story/`
- Read: All files in `.cursor/skills/gds-dev-story/`

- [ ] **Step 1: Verify Claude Code path**

Read `.claude/skills/gds-dev-story/SKILL.md` — confirm it references `strategy-claude-code.md`.
Read `.claude/skills/gds-dev-story/workflow.md` — confirm `strategy_file` is in Paths, Steps 5-7 load strategy.
Read `.claude/skills/gds-dev-story/strategy-claude-code.md` — confirm Steps 5-7 with Agent/SendMessage dispatch.

- [ ] **Step 2: Verify Cursor path**

Read `.cursor/skills/gds-dev-story/SKILL.md` — confirm it references `strategy-cursor.md`.
Read `.cursor/skills/gds-dev-story/workflow.md` — confirm same shared workflow as Claude Code.
Read `.cursor/skills/gds-dev-story/strategy-cursor.md` — confirm controller-implements-directly with Task dispatch + fallback.

- [ ] **Step 3: Verify no Claude Code assumptions leaked into shared workflow**

Search `workflow.md` (the shared file) for:
- `Agent tool` — should NOT appear (moved to strategy)
- `SendMessage` — should NOT appear (moved to strategy)
- `subagent` in action directives — should NOT appear in Steps 1-4 or 8-9 (informational mentions in comments are OK)
- `dispatch` as an action verb — should NOT appear in shared steps

- [ ] **Step 4: Verify no broken cross-references**

Check that all template path variables in workflow.md Paths section have corresponding files:
- `checklist.md` exists
- `context-curation.md` exists
- `implementer-prompt.md` exists
- `spec-reviewer-prompt.md` exists
- `code-quality-reviewer-prompt.md` exists
- `dod-reviewer-prompt.md` exists
- `strategy-claude-code.md` exists
- `strategy-cursor.md` exists

- [ ] **Step 5: Verify SKILL.md differentiation**

```bash
diff .claude/skills/gds-dev-story/SKILL.md .cursor/skills/gds-dev-story/SKILL.md
```

Should show exactly one line different: `strategy-claude-code.md` vs `strategy-cursor.md`.

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

    <!-- Vue skills before TDD when task touches packages/client -->
    <action>If the curated task scope includes `packages/client` (`.vue` SFCs, client composables, Pinia stores, Vue Router, or client tests), load the applicable skills per workflow.md **Vue / client frontend prerequisite** BEFORE following {{implementer_template}} for TDD: `vue-best-practices` and `vue` for UI/composables; `vue-testing-best-practices` for client tests; `vue-router-best-practices` for routes/navigation; `pinia` for store changes. Invoke via your environment's Skill mechanism or read the skill file.</action>

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
        1. Read file — verify `<script setup lang="ts">` (Vue SFCs)
        2. Verify co-located test file exists (*.test.ts next to *.ts)
        3. Verify imports: no `@/` aliases, use relative or `@mahjong-game/shared`
        4. Verify test imports from `vite-plus/test` (not `vitest`)
        5. Verify test uses `happy-dom` (not `jsdom`)
        6. Verify test calls `setActivePinia(createPinia())` in `beforeEach` (if Vue component test)
        7. Check file length — flag if >200 lines for a new file
      </action>
      <action>Run: `vp test run && vp lint`</action>
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

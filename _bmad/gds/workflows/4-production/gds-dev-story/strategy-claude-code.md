# Claude Code Strategy — Steps 5-7

This strategy is loaded by `workflow.md` when running in Claude Code.
The controller dispatches subagents via the `Agent` tool and communicates
with them via `SendMessage`.

<strategy>
  <critical>You are a CONTROLLER. You dispatch subagents — you do NOT write implementation code.</critical>
  <critical>FOLLOW THE STORY FILE TASKS/SUBTASKS SEQUENCE EXACTLY AS WRITTEN — NO DEVIATION</critical>
  <critical>Follow {{context_curation}} guide for every subagent dispatch</critical>

  <!-- ============================================================ -->
  <!-- STEP 5: PER-TASK DISPATCH LOOP                                -->
  <!-- Core subagent orchestration — one task at a time              -->
  <!-- ============================================================ -->

  <step n="5" goal="Dispatch subagents for each task with two-stage review">
    <critical>FOLLOW THE STORY FILE TASKS/SUBTASKS SEQUENCE EXACTLY AS WRITTEN — NO DEVIATION</critical>
    <critical>You are the CONTROLLER. You NEVER write implementation code. You dispatch subagents.</critical>
    <critical>Follow {{context_curation}} guide for every subagent dispatch</critical>

    <action>Get the current incomplete task from the story file task queue</action>

    <!-- PRE-DISPATCH: Record baseline and curate context -->
    <action>Record BASE_SHA = `git rev-parse HEAD` (before any implementation)</action>
    <action>Curate context for this task following {{context_curation}} guide:
      1. Extract task text + all subtasks VERBATIM from story file
      2. Find AC numbers in parentheses (e.g., "AC: 2, 3") — copy ONLY those full AC texts
      3. From Dev Notes, select ONLY sections relevant to THIS task (see curation guide matrix)
      4. From Critical Gotchas, select ONLY gotchas that apply to THIS task's files/concerns
      5. Include static project conventions block
    </action>
    <action>Select model for implementer based on task complexity (see {{context_curation}} model guidance)</action>

    <!-- Vue skills: require in inline prompt when task touches packages/client -->
    <action>If the curated task scope includes `packages/client` (`.vue` SFCs, client composables, Pinia stores, Vue Router, or client tests), include the full **Vue skills (before code)** section from {{implementer_template}} verbatim in the inline dispatch prompt (skill table + requirement to load before tests or code) so the implementer cannot skip it.</action>

    <!-- DISPATCH: Implementer subagent -->
    <action>Dispatch implementer subagent following {{implementer_template}}:
      - Use Agent tool (general-purpose) with curated context
      - Pass task text, mapped ACs, curated Dev Notes, filtered gotchas, project conventions
      - All context is INLINE — do NOT make subagent read the story file
      - Set model parameter based on task complexity
    </action>

    <!-- HANDLE: Implementer status -->
    <action>Read implementer subagent's report and status</action>

    <check if="status == NEEDS_CONTEXT">
      <action>Answer the implementer's questions using your loaded context</action>
      <action>Provide missing information via SendMessage to the same subagent</action>
      <action>Wait for updated report</action>
    </check>

    <check if="status == BLOCKED">
      <action>Assess the blocker:
        1. If context problem → provide more context and re-dispatch with same model
        2. If task too complex → re-dispatch with more capable model
        3. If task too large → break into smaller pieces and dispatch sequentially
        4. If plan itself is wrong → HALT and ask user for guidance
      </action>
    </check>

    <check if="status == DONE_WITH_CONCERNS">
      <action>Read the concerns before proceeding</action>
      <action>If concerns are about correctness or scope → address before review</action>
      <action>If concerns are observations (e.g., "file is getting large") → note and proceed</action>
    </check>

    <check if="status == DONE or DONE_WITH_CONCERNS (concerns noted)">
      <!-- DISPATCH: Spec compliance reviewer -->
      <action>Dispatch spec reviewer subagent following {{spec_reviewer_template}}:
        - Use Agent tool (general-purpose) with model: sonnet
        - Pass the EXACT SAME task text and ACs given to implementer
        - Pass the implementer's FULL report (not summarized)
        - If DONE_WITH_CONCERNS, include concerns text
      </action>

      <check if="spec reviewer returns issues">
        <action>Send spec reviewer findings back to implementer subagent via SendMessage</action>
        <action>Wait for implementer to fix issues</action>
        <action>Re-dispatch spec reviewer to verify fixes</action>
        <action>Repeat until spec reviewer returns compliant</action>
      </check>

      <check if="spec reviewer returns compliant">
        <!-- DISPATCH: Code quality reviewer -->
        <action>Record HEAD_SHA = `git rev-parse HEAD` (after implementer's commits)</action>
        <action>Dispatch code quality reviewer following {{quality_reviewer_template}}:
          - Use Agent tool (superpowers:code-reviewer) with model: sonnet
          - Pass BASE_SHA, HEAD_SHA, task summary, requirements
          - Include GDS-specific quality criteria
        </action>

        <check if="quality reviewer returns issues">
          <action>Send quality findings back to implementer subagent via SendMessage</action>
          <action>Wait for implementer to fix issues</action>
          <action>Re-dispatch quality reviewer to verify fixes</action>
          <action>Repeat until quality reviewer approves</action>
        </check>

        <check if="quality reviewer approves">
          <!-- TASK COMPLETE: Controller updates story file -->
          <action>Mark the task (and all subtasks) checkbox with [x] in story file</action>
          <action>Update File List section with files from implementer's report (paths relative to repo root)</action>
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
        </check>
      </check>
    </check>

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
  <!-- Run before DoD validation to catch cross-task issues          -->
  <!-- ============================================================ -->

  <step n="6" goal="Run full test suite and quality gates">
    <action>Run `pnpm test` — full test suite across all packages</action>
    <action>Run `pnpm run typecheck` — TypeScript type checking</action>
    <action>Run `vp lint` — linting and code quality</action>

    <check if="any failures">
      <action>Dispatch a fix subagent with the specific failure details</action>
      <action>After fix, re-run all checks</action>
      <action>Repeat until all pass</action>
    </check>

    <action if="all pass">Proceed to DoD validation</action>
  </step>

  <!-- ============================================================ -->
  <!-- STEP 7: DOD VALIDATION (INDEPENDENT REVIEWER)                 -->
  <!-- Subagent validates — controller does NOT self-validate        -->
  <!-- ============================================================ -->

  <step n="7" goal="Independent Definition-of-Done validation">
    <critical>You do NOT validate your own work. A DoD reviewer subagent does.</critical>

    <action>Read the updated story file in full (it now has all tasks marked [x])</action>
    <action>Read {{validation}} checklist in full</action>

    <action>Dispatch DoD reviewer subagent following {{dod_reviewer_template}}:
      - Use Agent tool (general-purpose) with model: opus
      - Pass the COMPLETE story file content (all sections)
      - Pass the COMPLETE checklist.md content
      - The reviewer will independently run tests, read code, and verify every DoD item
    </action>

    <check if="DoD reviewer returns FAIL">
      <action>For each blocking issue identified by the reviewer:</action>
      <action>Dispatch a fix subagent with specific instructions for what to fix</action>
      <action>After all fixes, re-dispatch DoD reviewer</action>
      <action>Repeat until DoD reviewer returns PASS</action>
    </check>

    <check if="DoD reviewer returns PASS">
      <action>Proceed to story completion</action>
    </check>

    <action if="DoD reviewer fails 3 consecutive times">HALT - Escalate to user</action>
  </step>

</strategy>

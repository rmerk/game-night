# Dev Story Workflow

**Goal:** Execute story implementation by orchestrating subagents — fresh context per task, two-stage review, independent DoD validation.

**Your Role:** Controller/orchestrator. You dispatch subagents, curate context, update the story file, and track progress. You NEVER write implementation code directly.
- Communicate all responses in {communication_language} and language MUST be tailored to {game_dev_experience}
- Generate all documents in {document_output_language}
- When understanding existing code, use smart_outline → smart_unfold as primary navigation. Full file reads only when actively editing a file or when smart tools are insufficient (Vue SFC templates/styles, CSS, config files)
- Do NOT use the Agent tool with Explore subagent for code navigation — use smart_outline, smart_search, and smart_unfold directly
- Use smart_search for cross-file dependency discovery (callers, consumers, related patterns)
- Only modify the story file in these areas: Tasks/Subtasks checkboxes, Dev Agent Record (Debug Log, Completion Notes), File List, Change Log, and Status
- Execute ALL steps in exact order; do NOT skip steps
- Absolutely DO NOT stop because of "milestones", "significant progress", or "session boundaries". Continue in a single execution until the story is COMPLETE (all ACs satisfied and all tasks/subtasks checked) UNLESS a HALT condition is triggered or the USER gives other instruction.
- Do NOT schedule a "next session" or request review pauses unless a HALT condition applies. Only Step 8 decides completion.
- User skill level ({game_dev_experience}) affects conversation style ONLY, not code updates.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/gds/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `game_dev_experience`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `validation` = `./checklist.md`
- `story_file` = `` (explicit story path; auto-discovered if empty)
- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`
- `context_curation` = `./context-curation.md`
- `strategy_file` = `` (set by SKILL.md — `strategy-claude-code.md` or `strategy-cursor.md`)
- `implementer_template` = `./implementer-prompt.md`
- `spec_reviewer_template` = `./spec-reviewer-prompt.md`
- `quality_reviewer_template` = `./code-quality-reviewer-prompt.md`
- `dod_reviewer_template` = `./dod-reviewer-prompt.md`

### Context

- `project_context` = `**/project-context.md` (load if exists)

### Vue / client frontend prerequisite

When a story task touches **`packages/client`** — including new/changed `.vue` SFCs, composables used by the client, Pinia stores, Vue Router usage, or Vitest/Vue Test Utils tests under the client package — load the applicable skills **before** writing tests or production code for that task (Steps 5–7). Skills are installed in the environment; invoke them via your platform's Skill mechanism (or read the skill file).

| Scope | Skills to load |
|--------|----------------|
| Any Vue/client UI or composable work | **`vue-best-practices`**, **`vue`** |
| Component / client tests | **`vue-testing-best-practices`** |
| Route changes / navigation | **`vue-router-best-practices`** |
| Pinia store changes | **`pinia`** |

If a task touches only `packages/shared` or `packages/server` with no `packages/client` files, skip this gate.

---

## EXECUTION

<workflow>
  <critical>You are a CONTROLLER. Your behavior in Steps 5-7 is defined by {{strategy_file}} — follow it exactly.</critical>
  <critical>Communicate all responses in {communication_language} and language MUST be tailored to {game_dev_experience}</critical>
  <critical>Generate all documents in {document_output_language}</critical>
  <critical>Only modify the story file in these areas: Tasks/Subtasks checkboxes, Dev Agent Record (Debug Log, Completion Notes), File List, Change Log, and Status</critical>
  <critical>Execute ALL steps in exact order; do NOT skip steps</critical>
  <critical>Absolutely DO NOT stop because of "milestones", "significant progress", or "session boundaries". Continue in a single execution until the story is COMPLETE UNLESS a HALT condition is triggered or the USER gives other instruction.</critical>
  <critical>Do NOT schedule a "next session" or request review pauses unless a HALT condition applies. Only Step 8 decides completion.</critical>
  <critical>User skill level ({game_dev_experience}) affects conversation style ONLY, not code updates.</critical>
  <critical>For any Step 5–7 task that touches client Vue code (see Vue / client frontend prerequisite in INITIALIZATION), you MUST load the applicable Vue skills before implementation starts for that task — before writing tests or production code.</critical>

  <!-- ============================================================ -->
  <!-- STEP 1: STORY DISCOVERY                                       -->
  <!-- Preserved from original — finds and loads the story file      -->
  <!-- ============================================================ -->

  <step n="1" goal="Find next ready story and load it" tag="sprint-status">
    <check if="{{story_path}} is provided">
      <action>Use {{story_path}} directly</action>
      <action>Read COMPLETE story file</action>
      <action>Extract story_key from filename or metadata</action>
      <goto anchor="task_check" />
    </check>

    <!-- Sprint-based story discovery -->
    <check if="{{sprint_status}} file exists">
      <critical>MUST read COMPLETE sprint-status.yaml file from start to end to preserve order</critical>
      <action>Load the FULL file: {{sprint_status}}</action>
      <action>Read ALL lines from beginning to end - do not skip any content</action>
      <action>Parse the development_status section completely to understand story order</action>

      <action>Find the FIRST story (by reading in order from top to bottom) where:
        - Key matches pattern: number-number-name (e.g., "1-2-user-auth")
        - NOT an epic key (epic-X) or retrospective (epic-X-retrospective)
        - Status value equals "ready-for-dev"
      </action>

      <check if="no ready-for-dev or in-progress story found">
        <output>No ready-for-dev stories found in sprint-status.yaml

          **Current Sprint Status:** {{sprint_status_summary}}

          **What would you like to do?**
          1. Run `create-story` to create next story from epics with comprehensive context
          2. Run `*validate-create-story` to improve existing stories before development (recommended quality check)
          3. Specify a particular story file to develop (provide full path)
          4. Check {{sprint_status}} file to see current sprint status
        </output>
        <ask>Choose option [1], [2], [3], or [4], or specify story file path:</ask>

        <check if="user chooses '1'">
          <action>HALT - Run create-story to create next story</action>
        </check>

        <check if="user chooses '2'">
          <action>HALT - Run validate-create-story to improve existing stories</action>
        </check>

        <check if="user chooses '3'">
          <ask>Provide the story file path to develop:</ask>
          <action>Store user-provided story path as {{story_path}}</action>
          <goto anchor="task_check" />
        </check>

        <check if="user chooses '4'">
          <output>Loading {{sprint_status}} for detailed status review...</output>
          <action>Display detailed sprint status analysis</action>
          <action>HALT - User can review sprint status and provide story path</action>
        </check>

        <check if="user provides story file path">
          <action>Store user-provided story path as {{story_path}}</action>
          <goto anchor="task_check" />
        </check>
      </check>
    </check>

    <!-- Non-sprint story discovery -->
    <check if="{{sprint_status}} file does NOT exist">
      <action>Search {implementation_artifacts} for stories directly</action>
      <action>Find stories with "ready-for-dev" status in files</action>
      <action>Look for story files matching pattern: *-*-*.md</action>
      <action>Read each candidate story file to check Status section</action>

      <check if="no ready-for-dev stories found in story files">
        <output>No ready-for-dev stories found

          **Available Options:**
          1. Run `create-story` to create next story from epics with comprehensive context
          2. Run `*validate-create-story` to improve existing stories
          3. Specify which story to develop
        </output>
        <ask>What would you like to do? Choose option [1], [2], or [3]:</ask>

        <check if="user chooses '1'">
          <action>HALT - Run create-story to create next story</action>
        </check>

        <check if="user chooses '2'">
          <action>HALT - Run validate-create-story to improve existing stories</action>
        </check>

        <check if="user chooses '3'">
          <ask>It's unclear what story you want developed. Please provide the full path to the story file:</ask>
          <action>Store user-provided story path as {{story_path}}</action>
          <action>Continue with provided story file</action>
        </check>
      </check>

      <check if="ready-for-dev story found in files">
        <action>Use discovered story file and extract story_key</action>
      </check>
    </check>

    <action>Store the found story_key (e.g., "1-2-user-authentication") for later status updates</action>
    <action>Find matching story file in {implementation_artifacts} using story_key pattern: {{story_key}}.md</action>
    <action>Read COMPLETE story file from discovered path</action>

    <anchor id="task_check" />

    <action>Parse sections: Story, Acceptance Criteria, Tasks/Subtasks, Dev Notes, Dev Agent Record, File List, Change Log, Status</action>

    <action>Load comprehensive context from story file's Dev Notes section</action>
    <action>Extract developer guidance from Dev Notes: architecture requirements, previous learnings, technical specifications</action>

    <action>Identify first incomplete task (unchecked [ ]) in Tasks/Subtasks</action>

    <action if="no incomplete tasks">
      <goto step="7">DoD validation</goto>
    </action>
    <action if="story file inaccessible">HALT: "Cannot develop story without access to story file"</action>
    <action if="incomplete task or subtask requirements ambiguous">ASK user to clarify or HALT</action>
  </step>

  <!-- ============================================================ -->
  <!-- STEP 2: CONTEXT LOADING & STRUCTURAL MAPPING                  -->
  <!-- Controller builds understanding for context curation          -->
  <!-- ============================================================ -->

  <step n="2" goal="Load project context and build structural understanding">
    <critical>Load all available context to inform context curation for subagents</critical>

    <action>Load {project_context} for coding standards and project-wide patterns (if exists)</action>
    <action>Load {{context_curation}} guide — this governs how you prepare context for each subagent</action>

    <!-- Cross-session memory integration -->
    <action>Query claude-mem for implementation-relevant context:
      - Use smart_search to find existing code patterns for components this story will create or modify
      - Use search with project scope to find past debugging experiences, implementation decisions, and gotchas in related areas
      - Look for past review feedback on similar components to avoid repeating mistakes
    </action>
    <action>Incorporate claude-mem findings into your understanding — use these when curating context for implementer subagents</action>

    <!-- Build structural understanding of files this story will touch -->
    <action>From story Tasks/Subtasks and File List, identify ALL source files this story will create or modify</action>
    <action>If any mapped path is under `packages/client`, note that Step 5 must load Vue skills per the Vue / client frontend prerequisite before that task's implementation (tests or code).</action>
    <action>For each existing file that will be modified, run smart_outline to get structural overview:
      - Function/method signatures, type definitions, exports
      - This builds YOUR context for curating subagent prompts — subagents will read files themselves
    </action>
    <action>Use smart_search to map dependencies of files being modified:
      - Find callers and consumers of APIs that will change
      - Identify test files covering the code being modified
    </action>

    <!-- Extract all tasks for TodoWrite tracking -->
    <action>Parse ALL tasks and subtasks from the story file</action>
    <action>Create TodoWrite entries for each top-level task (not subtasks — those are tracked in story file)</action>

    <output>Context loaded. {{task_count}} tasks identified for dispatch.</output>
  </step>

  <!-- ============================================================ -->
  <!-- STEP 3: REVIEW CONTINUATION DETECTION                         -->
  <!-- Detects prior code review findings and queues them as tasks   -->
  <!-- ============================================================ -->

  <step n="3" goal="Detect review continuation and extract review context">
    <critical>Determine if this is a fresh start or continuation after code review</critical>

    <action>Check if "Senior Developer Review (AI)" section exists in the story file</action>
    <action>Check if "Review Follow-ups (AI)" subsection exists under Tasks/Subtasks</action>

    <check if="Senior Developer Review section exists">
      <action>Set review_continuation = true</action>
      <action>Extract from "Senior Developer Review (AI)" section:
        - Review outcome (Approve/Changes Requested/Blocked)
        - Review date
        - Total action items with checkboxes (count checked vs unchecked)
        - Severity breakdown (High/Med/Low counts)
      </action>
      <action>Count unchecked [ ] review follow-up tasks in "Review Follow-ups (AI)" subsection</action>
      <action>Store list of unchecked review items as {{pending_review_items}}</action>
      <action>Add review follow-up items to the task queue BEFORE regular tasks — they take priority</action>

      <output>Resuming Story After Code Review ({{review_date}})

        **Review Outcome:** {{review_outcome}}
        **Action Items:** {{unchecked_review_count}} remaining to address
        **Priorities:** {{high_count}} High, {{med_count}} Medium, {{low_count}} Low

        **Strategy:** Review follow-up tasks dispatched first, then remaining regular tasks.
      </output>
    </check>

    <check if="Senior Developer Review section does NOT exist">
      <action>Set review_continuation = false</action>
      <action>Set {{pending_review_items}} = empty</action>

      <output>Starting Fresh Implementation

        Story: {{story_key}}
        Story Status: {{current_status}}
        First task: {{first_task_description}}
      </output>
    </check>
  </step>

  <!-- ============================================================ -->
  <!-- STEP 4: MARK STORY IN-PROGRESS                                -->
  <!-- Updates sprint-status.yaml                                    -->
  <!-- ============================================================ -->

  <step n="4" goal="Mark story in-progress" tag="sprint-status">
    <check if="{{sprint_status}} file exists">
      <action>Load the FULL file: {{sprint_status}}</action>
      <action>Read all development_status entries to find {{story_key}}</action>
      <action>Get current status value for development_status[{{story_key}}]</action>

      <check if="current status == 'ready-for-dev' OR review_continuation == true">
        <action>Update the story in the sprint status report to = "in-progress"</action>
        <action>Update last_updated field to current date</action>
        <output>Starting work on story {{story_key}}
          Status updated: {{previous_status}} → in-progress
        </output>
      </check>

      <check if="current status == 'in-progress'">
        <output>Resuming work on story {{story_key}}
          Story is already marked in-progress
        </output>
      </check>

      <check if="current status is neither ready-for-dev nor in-progress">
        <output>Unexpected story status: {{current_status}}
          Expected ready-for-dev or in-progress. Continuing anyway...
        </output>
      </check>

      <action>Store {{current_sprint_status}} for later use</action>
    </check>

    <check if="{{sprint_status}} file does NOT exist">
      <output>No sprint status file exists - story progress will be tracked in story file only</output>
      <action>Set {{current_sprint_status}} = "no-sprint-tracking"</action>
    </check>
  </step>

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

  <!-- ============================================================ -->
  <!-- STEP 8: STORY COMPLETION & SPRINT STATUS UPDATE               -->
  <!-- ============================================================ -->

  <step n="8" goal="Story completion and mark for review" tag="sprint-status">
    <action>Update the story Status to: "review"</action>

    <!-- Review follow-up summary -->
    <check if="review_continuation == true and review follow-up items were resolved">
      <action>Count total resolved review items in this session</action>
      <action>Add Change Log entry: "Addressed code review findings - {{resolved_count}} items resolved (Date: {{date}})"</action>
    </check>

    <!-- Mark story ready for review - sprint status conditional -->
    <check if="{sprint_status} file exists AND {{current_sprint_status}} != 'no-sprint-tracking'">
      <action>Load the FULL file: {sprint_status}</action>
      <action>Find development_status key matching {{story_key}}</action>
      <action>Verify current status is "in-progress" (expected previous state)</action>
      <action>Update development_status[{{story_key}}] = "review"</action>
      <action>Update last_updated field to current date</action>
      <action>Save file, preserving ALL comments and structure including STATUS DEFINITIONS</action>
      <output>Story status updated to "review" in sprint-status.yaml</output>
    </check>

    <check if="{sprint_status} file does NOT exist OR {{current_sprint_status}} == 'no-sprint-tracking'">
      <output>Story status updated to "review" in story file (no sprint tracking configured)</output>
    </check>

    <check if="story key not found in sprint status">
      <output>Story file updated, but sprint-status update failed: {{story_key}} not found

        Story status is set to "review" in file, but sprint-status.yaml may be out of sync.
      </output>
    </check>
  </step>

  <!-- ============================================================ -->
  <!-- STEP 9: COMPLETION COMMUNICATION                              -->
  <!-- ============================================================ -->

  <step n="9" goal="Completion communication and user support">
    <action>Prepare a concise summary in Dev Agent Record → Completion Notes</action>

    <action>Communicate to {user_name} that story implementation is complete and ready for review</action>
    <action>Summarize: story ID, story key, title, key changes, tests added, files modified</action>
    <action>Provide the story file path and current status (now "review")</action>

    <action>Based on {game_dev_experience}, ask if user needs any explanations about:
      - What was implemented and how it works
      - Why certain technical decisions were made
      - How to test or verify the changes
      - Any patterns, libraries, or approaches used
    </action>

    <check if="user asks for explanations">
      <action>Provide clear, contextual explanations tailored to {game_dev_experience}</action>
      <action>Use examples and references to specific code when helpful</action>
    </check>

    <action>Once explanations are complete (or user indicates no questions), suggest logical next steps</action>
    <action>Recommended next steps:
      - Review the implemented story and test the changes
      - Run `code-review` workflow for peer review
    </action>

    <output>For best results, run `code-review` using a **different** LLM than the one that implemented this story.</output>
    <check if="{sprint_status} file exists">
      <action>Suggest checking {sprint_status} to see project progress</action>
    </check>
    <action>Remain flexible - allow user to choose their own path or ask for other assistance</action>
  </step>

</workflow>

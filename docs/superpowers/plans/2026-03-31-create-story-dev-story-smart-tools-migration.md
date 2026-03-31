# Create-Story & Dev-Story Smart Tools Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `gds-create-story` and `gds-dev-story` workflows to mandate claude-mem smart tools (`smart_outline`, `smart_search`, `smart_unfold`) instead of treating them as optional.

**Architecture:** Direct edits to two workflow XML files. Create-story gets one edit (remove conditional wrapper). Dev-story gets four edits (role directive, conditional wrapper removal, red-green-refactor smart tool guidance, test authoring guidance).

**Tech Stack:** Markdown/XML workflow files in `.claude/skills/`

**Spec:** `docs/superpowers/specs/2026-03-31-create-story-dev-story-smart-tools-migration.md`

---

### Task 1: Remove conditional wrapper in gds-create-story Step 2

**Files:**
- Modify: `.claude/skills/gds-create-story/workflow.md:243-257`

- [ ] **Step 1: Read the current conditional block**

Verify lines 243-257 of `.claude/skills/gds-create-story/workflow.md` contain:

```xml
  <!-- Cross-session memory integration -->
  <check if="claude-mem tools available (smart_search, search, timeline)">
    <action>Query claude-mem for cross-session context relevant to this story:
      - Use smart_search to find past implementation patterns for components/systems this story touches
      - Use search with project scope to find past decisions, debugging experiences, and lessons learned related to this story's technical domain
      - Use timeline to identify recent work context that may inform story creation
    </action>
    <action>Extract actionable intelligence from claude-mem results:
      - Past design decisions and their rationale that affect this story
      - Known pitfalls or gotchas discovered in previous sessions
      - Patterns established in earlier stories that this story should follow
      - Debugging solutions that may be relevant
    </action>
    <action>Store claude-mem findings as {{cross_session_intelligence}} for inclusion in story file</action>
  </check>
```

- [ ] **Step 2: Replace with unwrapped mandatory version**

Replace the entire block (lines 243-257) with:

```xml
  <!-- Cross-session memory integration -->
  <action>Query claude-mem for cross-session context relevant to this story:
    - Use smart_search to find past implementation patterns for components/systems this story touches
    - Use search with project scope to find past decisions, debugging experiences, and lessons learned related to this story's technical domain
    - Use timeline to identify recent work context that may inform story creation
  </action>
  <action>Extract actionable intelligence from claude-mem results:
    - Past design decisions and their rationale that affect this story
    - Known pitfalls or gotchas discovered in previous sessions
    - Patterns established in earlier stories that this story should follow
    - Debugging solutions that may be relevant
  </action>
  <action>Store claude-mem findings as {{cross_session_intelligence}} for inclusion in story file</action>
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/gds-create-story/workflow.md` and confirm:
- No `<check if="claude-mem tools available` remains in the file
- The three `<action>` blocks are preserved with identical content
- The `<!-- Cross-session memory integration -->` comment is preserved
- The surrounding context (previous story intelligence block above, git intelligence block below) is unchanged

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-create-story/workflow.md
git commit -m "refactor(skills): remove conditional wrapper in gds-create-story cross-session memory"
```

---

### Task 2: Add smart tools mandate to gds-dev-story role directive

**Files:**
- Modify: `.claude/skills/gds-dev-story/workflow.md:5-12`

- [ ] **Step 1: Read the current role directive**

Verify lines 5-12 of `.claude/skills/gds-dev-story/workflow.md` contain:

```markdown
**Your Role:** Developer implementing the story.
- Communicate all responses in {communication_language} and language MUST be tailored to {game_dev_experience}
- Generate all documents in {document_output_language}
- Only modify the story file in these areas: Tasks/Subtasks checkboxes, Dev Agent Record (Debug Log, Completion Notes), File List, Change Log, and Status
- Execute ALL steps in exact order; do NOT skip steps
- Absolutely DO NOT stop because of "milestones", "significant progress", or "session boundaries". Continue in a single execution until the story is COMPLETE (all ACs satisfied and all tasks/subtasks checked) UNLESS a HALT condition is triggered or the USER gives other instruction.
- Do NOT schedule a "next session" or request review pauses unless a HALT condition applies. Only Step 6 decides completion.
- User skill level ({game_dev_experience}) affects conversation style ONLY, not code updates.
```

- [ ] **Step 2: Add smart tools lines after the document_output_language line**

Insert three new lines after `- Generate all documents in {document_output_language}` (line 7), before `- Only modify the story file` (line 8):

```markdown
- When understanding existing code, use smart_outline → smart_unfold as primary navigation. Full file reads only when actively editing a file or when smart tools are insufficient (Vue SFC templates/styles, CSS, config files)
- Do NOT use the Agent tool with Explore subagent for code navigation — use smart_outline, smart_search, and smart_unfold directly
- Use smart_search for cross-file dependency discovery (callers, consumers, related patterns)
```

The resulting role directive should be:

```markdown
**Your Role:** Developer implementing the story.
- Communicate all responses in {communication_language} and language MUST be tailored to {game_dev_experience}
- Generate all documents in {document_output_language}
- When understanding existing code, use smart_outline → smart_unfold as primary navigation. Full file reads only when actively editing a file or when smart tools are insufficient (Vue SFC templates/styles, CSS, config files)
- Do NOT use the Agent tool with Explore subagent for code navigation — use smart_outline, smart_search, and smart_unfold directly
- Use smart_search for cross-file dependency discovery (callers, consumers, related patterns)
- Only modify the story file in these areas: Tasks/Subtasks checkboxes, Dev Agent Record (Debug Log, Completion Notes), File List, Change Log, and Status
- Execute ALL steps in exact order; do NOT skip steps
- Absolutely DO NOT stop because of "milestones", "significant progress", or "session boundaries". Continue in a single execution until the story is COMPLETE (all ACs satisfied and all tasks/subtasks checked) UNLESS a HALT condition is triggered or the USER gives other instruction.
- Do NOT schedule a "next session" or request review pauses unless a HALT condition applies. Only Step 6 decides completion.
- User skill level ({game_dev_experience}) affects conversation style ONLY, not code updates.
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/gds-dev-story/workflow.md` lines 5-15 and confirm:
- Three new bullet points are present after `document_output_language` line
- All original bullet points are preserved and unchanged
- Smart tools mandate matches the code-review workflow's phrasing

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-dev-story/workflow.md
git commit -m "refactor(skills): add smart tools mandate to gds-dev-story role directive"
```

---

### Task 3: Remove conditional wrapper in gds-dev-story Step 2

**Files:**
- Modify: `.claude/skills/gds-dev-story/workflow.md` (Step 2, cross-session memory block)

- [ ] **Step 1: Read the current conditional block**

Verify the file contains this block (around lines 185-193, may have shifted from Task 2 edits):

```xml
    <!-- Cross-session memory integration -->
    <check if="claude-mem tools available (smart_search, search, timeline)">
      <action>Query claude-mem for implementation-relevant context:
        - Use smart_search to find existing code patterns for components this story will create or modify
        - Use search with project scope to find past debugging experiences, implementation decisions, and gotchas in related areas
        - Look for past review feedback on similar components to avoid repeating mistakes
      </action>
      <action>Incorporate claude-mem findings into implementation approach — treat as supplementary context alongside Dev Notes</action>
    </check>
```

- [ ] **Step 2: Replace with unwrapped mandatory version plus smart_outline**

Replace the entire block with:

```xml
    <!-- Cross-session memory integration -->
    <action>Query claude-mem for implementation-relevant context:
      - Use smart_search to find existing code patterns for components this story will create or modify
      - Use search with project scope to find past debugging experiences, implementation decisions, and gotchas in related areas
      - Look for past review feedback on similar components to avoid repeating mistakes
    </action>
    <action>Incorporate claude-mem findings into implementation approach — treat as supplementary context alongside Dev Notes</action>

    <!-- Build structural understanding of files this story will touch -->
    <action>From story Tasks/Subtasks and File List, identify source files this story will create or modify</action>
    <action>For each existing file that will be modified, run smart_outline to get structural overview:
      - Function/method signatures, type definitions, exports
      - This builds context for implementation without reading full files
    </action>
    <action>Use smart_search to map dependencies of files being modified:
      - Find callers and consumers of APIs that will change
      - Identify test files covering the code being modified
    </action>
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/gds-dev-story/workflow.md` Step 2 and confirm:
- No `<check if="claude-mem tools available` remains in the file
- Original claude-mem actions are preserved with identical content
- New `smart_outline` and `smart_search` actions are present after the claude-mem block
- The `<!-- Build structural understanding -->` comment block is present
- The `<output>` block following this section is unchanged

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-dev-story/workflow.md
git commit -m "refactor(skills): remove conditional wrapper and add smart_outline to gds-dev-story Step 2"
```

---

### Task 4: Add smart tool guidance to gds-dev-story Step 5 (red-green-refactor)

**Files:**
- Modify: `.claude/skills/gds-dev-story/workflow.md` (Step 5)

- [ ] **Step 1: Read the current Step 5**

Verify Step 5 contains (lines may have shifted from previous edits):

```xml
  <step n="5" goal="Implement task following red-green-refactor cycle">
    <critical>FOLLOW THE STORY FILE TASKS/SUBTASKS SEQUENCE EXACTLY AS WRITTEN - NO DEVIATION</critical>

    <action>Review the current task/subtask from the story file - this is your authoritative implementation guide</action>
    <action>Plan implementation following red-green-refactor cycle</action>

    <!-- RED PHASE -->
    <action>Write FAILING tests first for the task/subtask functionality</action>
    <action>Confirm tests fail before implementation - this validates test correctness</action>

    <!-- GREEN PHASE -->
    <action>Implement MINIMAL code to make tests pass</action>
    <action>Run tests to confirm they now pass</action>
    <action>Handle error conditions and edge cases as specified in task/subtask</action>

    <!-- REFACTOR PHASE -->
    <action>Improve code structure while keeping tests green</action>
    <action>Ensure code follows architecture patterns and coding standards from Dev Notes</action>
```

- [ ] **Step 2: Replace the task review and plan actions with smart-tool-enhanced version**

Replace:

```xml
    <action>Review the current task/subtask from the story file - this is your authoritative implementation guide</action>
    <action>Plan implementation following red-green-refactor cycle</action>

    <!-- RED PHASE -->
```

With:

```xml
    <action>Review the current task/subtask from the story file - this is your authoritative implementation guide</action>
    <action>Before coding, use smart tools to understand the code you will touch:
      - smart_outline on each file you will modify — understand its structure before changing it
      - smart_search to find similar patterns and existing tests in the codebase
      - Reference Step 2 outlines already in context — don't re-read files you already outlined
    </action>
    <action>Plan implementation following red-green-refactor cycle</action>

    <!-- RED PHASE -->
```

- [ ] **Step 3: Add smart tool guidance to RED phase**

Replace:

```xml
    <!-- RED PHASE -->
    <action>Write FAILING tests first for the task/subtask functionality</action>
    <action>Confirm tests fail before implementation - this validates test correctness</action>
```

With:

```xml
    <!-- RED PHASE -->
    <action>Use smart_search to find existing test patterns for similar functionality. Use smart_outline on related test files to understand test structure before writing new tests</action>
    <action>Write FAILING tests first for the task/subtask functionality</action>
    <action>Confirm tests fail before implementation - this validates test correctness</action>
```

- [ ] **Step 4: Add smart tool guidance to GREEN phase**

Replace:

```xml
    <!-- GREEN PHASE -->
    <action>Implement MINIMAL code to make tests pass</action>
```

With:

```xml
    <!-- GREEN PHASE -->
    <action>Use smart_outline to understand modules being modified. Use smart_unfold on specific functions you need to integrate with. Full file reads only for files being actively edited</action>
    <action>Implement MINIMAL code to make tests pass</action>
```

- [ ] **Step 5: Add smart tool guidance to REFACTOR phase**

Replace:

```xml
    <!-- REFACTOR PHASE -->
    <action>Improve code structure while keeping tests green</action>
    <action>Ensure code follows architecture patterns and coding standards from Dev Notes</action>
```

With:

```xml
    <!-- REFACTOR PHASE -->
    <action>Improve code structure while keeping tests green</action>
    <action>Ensure code follows architecture patterns and coding standards from Dev Notes</action>
    <action>Use smart_outline to verify structural result of changes. Use smart_search to confirm no callers or consumers were missed</action>
```

- [ ] **Step 6: Verify the edit**

Read `.claude/skills/gds-dev-story/workflow.md` Step 5 and confirm:
- Pre-implementation smart tool action is present before the RGR cycle
- RED phase has smart_search/smart_outline action before writing tests
- GREEN phase has smart_outline/smart_unfold action before implementation
- REFACTOR phase has smart_outline/smart_search verification action after refactoring
- All original actions and `<critical>` blocks are preserved
- HALT conditions at the bottom of Step 5 are unchanged

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/gds-dev-story/workflow.md
git commit -m "refactor(skills): add smart tool guidance to gds-dev-story red-green-refactor cycle"
```

---

### Task 5: Add smart tool guidance to gds-dev-story Step 6 (test authoring)

**Files:**
- Modify: `.claude/skills/gds-dev-story/workflow.md` (Step 6)

- [ ] **Step 1: Read the current Step 6**

Verify Step 6 contains:

```xml
  <step n="6" goal="Author comprehensive tests">
    <action>Create unit tests for business logic and core functionality introduced/changed by the task</action>
    <action>Add integration tests for component interactions specified in story requirements</action>
    <action>Include end-to-end tests for critical user flows when story requirements demand them</action>
    <action>Cover edge cases and error handling scenarios identified in story Dev Notes</action>
  </step>
```

- [ ] **Step 2: Add smart tool actions at the start of Step 6**

Replace:

```xml
  <step n="6" goal="Author comprehensive tests">
    <action>Create unit tests for business logic and core functionality introduced/changed by the task</action>
```

With:

```xml
  <step n="6" goal="Author comprehensive tests">
    <action>Use smart_search to find existing test coverage for related code. Use smart_outline on existing test files to understand test structure and patterns before adding new tests</action>
    <action>Create unit tests for business logic and core functionality introduced/changed by the task</action>
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/gds-dev-story/workflow.md` Step 6 and confirm:
- New smart_search/smart_outline action is the first action in Step 6
- All four original actions are preserved unchanged
- Step 7 (validations) following this step is unchanged

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-dev-story/workflow.md
git commit -m "refactor(skills): add smart tool guidance to gds-dev-story test authoring step"
```

---

### Task 6: Final verification

**Files:**
- Read: `.claude/skills/gds-create-story/workflow.md`
- Read: `.claude/skills/gds-dev-story/workflow.md`

- [ ] **Step 1: Verify no conditional wrappers remain**

Search both files for `claude-mem tools available`:

```bash
grep -n "claude-mem tools available" .claude/skills/gds-create-story/workflow.md .claude/skills/gds-dev-story/workflow.md
```

Expected: No matches.

- [ ] **Step 2: Verify gds-create-story structure**

Read `.claude/skills/gds-create-story/workflow.md` and confirm:
- Step 2 has three unwrapped `<action>` blocks for cross-session memory
- No other steps were modified
- Role directive is unchanged

- [ ] **Step 3: Verify gds-dev-story structure**

Read `.claude/skills/gds-dev-story/workflow.md` and confirm:
- Role directive has three smart tools bullet points after `document_output_language`
- Step 2 has unwrapped claude-mem actions plus new `smart_outline`/`smart_search` structural understanding block
- Step 5 has smart tool guidance in pre-implementation, RED, GREEN, and REFACTOR phases
- Step 6 has smart tool guidance before test creation
- Steps 1, 3, 4, 7-10 are unchanged

- [ ] **Step 4: Verify git state is clean**

```bash
git status
git log --oneline -6
```

Expected: Clean working tree, 5 new commits matching the tasks above.

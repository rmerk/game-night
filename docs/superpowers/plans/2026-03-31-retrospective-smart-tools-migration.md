# Retrospective Smart Tools Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `gds-retrospective` workflow to mandate claude-mem smart tools instead of treating them as optional, and add `smart_search` at two additional workflow steps.

**Architecture:** Direct edits to one workflow XML file. Remove one conditional wrapper, add two new action blocks, and update the role directive. Four edits total.

**Tech Stack:** Markdown/XML workflow file in `.claude/skills/`

**Spec:** `docs/superpowers/specs/2026-03-31-retrospective-smart-tools-migration.md`

---

### Task 1: Add smart tools mandate to role directive

**Files:**
- Modify: `.claude/skills/gds-retrospective/workflow.md:13-14`

- [ ] **Step 1: Read the current role directive**

Verify lines 10-14 of `.claude/skills/gds-retrospective/workflow.md` contain:

```markdown
**Your Role:** Scrum Master facilitating retrospective.
- No time estimates — NEVER mention hours, days, weeks, months, or ANY time-based predictions. AI has fundamentally changed development speed.
- Communicate all responses in {communication_language} and language MUST be tailored to {game_dev_experience}
- Generate all documents in {document_output_language}
- Document output: Retrospective analysis. Concise insights, lessons learned, action items. Game dev experience ({game_dev_experience}) affects conversation style ONLY, not retrospective content.
```

- [ ] **Step 2: Insert two new bullet points after the document_output_language line**

Insert two new lines after `- Generate all documents in {document_output_language}` (line 13), before `- Document output:` (line 14):

```markdown
- Use smart_search for cross-session memory queries (finding past decisions, patterns, debugging context) — prefer over raw search for structural results
- Do NOT use the Agent tool with Explore subagent for code or memory navigation — use smart_search and search directly
```

The resulting role directive should be:

```markdown
**Your Role:** Scrum Master facilitating retrospective.
- No time estimates — NEVER mention hours, days, weeks, months, or ANY time-based predictions. AI has fundamentally changed development speed.
- Communicate all responses in {communication_language} and language MUST be tailored to {game_dev_experience}
- Generate all documents in {document_output_language}
- Use smart_search for cross-session memory queries (finding past decisions, patterns, debugging context) — prefer over raw search for structural results
- Do NOT use the Agent tool with Explore subagent for code or memory navigation — use smart_search and search directly
- Document output: Retrospective analysis. Concise insights, lessons learned, action items. Game dev experience ({game_dev_experience}) affects conversation style ONLY, not retrospective content.
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/gds-retrospective/workflow.md` lines 10-18 and confirm:
- Two new bullet points are present after `document_output_language` line
- All original bullet points are preserved and unchanged
- Facilitation notes block follows unchanged

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-retrospective/workflow.md
git commit -m "refactor(skills): add smart tools mandate to gds-retrospective role directive"
```

---

### Task 2: Remove conditional wrapper in Step 2

**Files:**
- Modify: `.claude/skills/gds-retrospective/workflow.md:215-228` (line numbers shifted +2 from Task 1)

- [ ] **Step 1: Read the current conditional block**

Verify the file contains this block (around lines 217-230 after Task 1 shift):

```xml
<!-- Cross-session memory integration -->
<check if="claude-mem tools available (timeline, search, get_observations)">
  <action>Use claude-mem timeline to generate the full development history for Epic {{epic_number}}:
    - Query timeline scoped to project for the epic's development period
    - Pull observations covering decisions, discoveries, debugging sessions, and design changes
    - Use get_observations on high-value entries for detailed context
  </action>
  <action>Store timeline findings as {{cross_session_timeline}} — this provides richer context than story files alone:
    - Decisions and their rationale that may not be captured in story docs
    - Debugging struggles and breakthroughs across sessions
    - Design pivots and course corrections with original reasoning
    - Cross-session patterns invisible from reading story files in isolation
  </action>
</check>
```

- [ ] **Step 2: Replace with unwrapped mandatory version**

Replace the entire block with:

```xml
<!-- Cross-session memory integration -->
<action>Use claude-mem timeline to generate the full development history for Epic {{epic_number}}:
  - Query timeline scoped to project for the epic's development period
  - Pull observations covering decisions, discoveries, debugging sessions, and design changes
  - Use get_observations on high-value entries for detailed context
</action>
<action>Store timeline findings as {{cross_session_timeline}} — this provides richer context than story files alone:
  - Decisions and their rationale that may not be captured in story docs
  - Debugging struggles and breakthroughs across sessions
  - Design pivots and course corrections with original reasoning
  - Cross-session patterns invisible from reading story files in isolation
</action>
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/gds-retrospective/workflow.md` Step 2 and confirm:
- No `<check if="claude-mem tools available` remains in the file
- The two `<action>` blocks are preserved with identical content
- The `<!-- Cross-session memory integration -->` comment is preserved
- The following `<action>For each story in epic` line is unchanged

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-retrospective/workflow.md
git commit -m "refactor(skills): remove conditional wrapper in gds-retrospective cross-session memory"
```

---

### Task 3: Add smart_search to Step 3 (Previous Retro Integration)

**Files:**
- Modify: `.claude/skills/gds-retrospective/workflow.md` (Step 3, after cross-reference action)

- [ ] **Step 1: Read the current cross-reference block**

Verify Step 3 contains this sequence (line numbers may have shifted from previous tasks):

```xml
    <action>Cross-reference with current epic execution:</action>

    **Action Item Follow-Through:**
    - For each action item from Epic {{prev_epic_num}} retro, check if it was completed
    - Look for evidence in current epic's story records
    - Mark each action item: ✅ Completed, ⏳ In Progress, ❌ Not Addressed
```

- [ ] **Step 2: Insert smart_search action after the cross-reference action**

Insert a new action block between `<action>Cross-reference with current epic execution:</action>` and `**Action Item Follow-Through:**`:

```xml
    <action>Cross-reference with current epic execution:</action>

    <action>Use smart_search to find evidence of action item follow-through beyond story files:
      - Search for observations about process changes, technical debt resolution, and team agreements
      - Look for debugging sessions or decisions that relate to previous retro commitments
    </action>

    **Action Item Follow-Through:**
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/gds-retrospective/workflow.md` Step 3 and confirm:
- New `smart_search` action is present between the cross-reference action and Action Item Follow-Through
- All original content in Step 3 is preserved unchanged
- The `<check if="previous retrospectives found">` wrapper around this section is unchanged

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-retrospective/workflow.md
git commit -m "refactor(skills): add smart_search to gds-retrospective previous retro integration"
```

---

### Task 4: Add smart_search to Step 9 (Critical Readiness Exploration)

**Files:**
- Modify: `.claude/skills/gds-retrospective/workflow.md` (Step 9, after opening output block)

- [ ] **Step 1: Read the current Step 9 opening**

Verify Step 9 contains this sequence (line numbers may have shifted from previous tasks):

```xml
Bob (Scrum Master): "{user_name}, let's walk through this together."
</output>

<action>Explore testing and quality state through natural conversation</action>
```

- [ ] **Step 2: Insert smart_search action between the output and existing action**

Insert a new action block between `</output>` and `<action>Explore testing and quality state`:

```xml
Bob (Scrum Master): "{user_name}, let's walk through this together."
</output>

<action>Use smart_search to surface cross-session observations about codebase stability, unresolved issues, and technical concerns from Epic {{epic_number}} development:
  - Search for debugging struggles, workarounds, or fragility observations
  - Look for technical debt observations that weren't captured in story files
</action>

<action>Explore testing and quality state through natural conversation</action>
```

- [ ] **Step 3: Verify the edit**

Read `.claude/skills/gds-retrospective/workflow.md` Step 9 and confirm:
- New `smart_search` action is present after the opening output block
- The `<action>Explore testing and quality state` line follows unchanged
- Rest of Step 9 (testing questions, deployment status, stakeholder acceptance, etc.) is unchanged

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/gds-retrospective/workflow.md
git commit -m "refactor(skills): add smart_search to gds-retrospective critical readiness exploration"
```

---

### Task 5: Final verification

**Files:**
- Read: `.claude/skills/gds-retrospective/workflow.md`

- [ ] **Step 1: Verify no conditional wrappers remain**

Search the file for `claude-mem tools available`:

```bash
grep -n "claude-mem tools available" .claude/skills/gds-retrospective/workflow.md
```

Expected: No matches.

- [ ] **Step 2: Verify all four edits are present**

Read `.claude/skills/gds-retrospective/workflow.md` and confirm:
- Role directive has two smart tools bullet points after `document_output_language`
- Step 2 has unwrapped claude-mem actions (no `<check if=` wrapper)
- Step 3 has `smart_search` action after `Cross-reference with current epic execution:`
- Step 9 has `smart_search` action after the opening output block
- All other steps are unchanged

- [ ] **Step 3: Verify git state is clean**

```bash
git status
git log --oneline -5
```

Expected: Clean working tree, 4 new commits matching the tasks above.

# Retrospective Smart Tools Migration

**Goal:** Migrate `gds-retrospective` workflow to mandate claude-mem smart tools (`smart_search`, `search`, `timeline`, `get_observations`) instead of treating them as optional behind a conditional wrapper. Add `smart_search` at two additional workflow steps where cross-session memory context improves analysis quality.

**Scope:** 4 edits to `.claude/skills/gds-retrospective/workflow.md`. No new files. No code navigation tools (smart_outline/smart_unfold) — the retrospective works with documents and cross-session memory, not source code.

**Prior art:** Follows the same migration pattern established in `2026-03-31-create-story-dev-story-smart-tools-migration.md` and `2026-03-31-code-review-smart-tools-migration.md`.

---

## Edit 1: Add smart tools mandate to role directive

**Location:** Lines 11-14, after `- Generate all documents in {document_output_language}`

**Change:** Insert two new bullet points:

```markdown
- Use smart_search for cross-session memory queries (finding past decisions, patterns, debugging context) — prefer over raw search for structural results
- Do NOT use the Agent tool with Explore subagent for code or memory navigation — use smart_search and search directly
```

**Rationale:** Matches the pattern established in gds-code-review and gds-dev-story role directives. The retrospective doesn't navigate code, so smart_outline/smart_unfold are omitted — only smart_search is mandated for cross-session memory queries.

---

## Edit 2: Remove conditional wrapper in Step 2

**Location:** Step 2 (Deep Story Analysis), lines 216-228

**Current state:**

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

**Target state:**

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

**Rationale:** The conditional wrapper is unnecessary — claude-mem tools are always available in this project. Removing it makes the cross-session memory integration mandatory, matching the pattern applied to gds-create-story and gds-dev-story.

---

## Edit 3: Add smart_search to Step 3 (Previous Retro Integration)

**Location:** Step 3, after `<action>Cross-reference with current epic execution:</action>` (line 338)

**Change:** Insert new action block:

```xml
<action>Use smart_search to find evidence of action item follow-through beyond story files:
  - Search for observations about process changes, technical debt resolution, and team agreements
  - Look for debugging sessions or decisions that relate to previous retro commitments
</action>
```

**Rationale:** When checking whether previous retro action items were followed through, story files may not capture the full picture. smart_search can surface cross-session observations about process changes, debt resolution, and decisions that happened between story boundaries.

---

## Edit 4: Add smart_search to Step 9 (Critical Readiness Exploration)

**Location:** Step 9, between the opening `</output>` (line 1113) and `<action>Explore testing and quality state through natural conversation</action>` (line 1115)

**Change:** Insert new action block:

```xml
<action>Use smart_search to surface cross-session observations about codebase stability, unresolved issues, and technical concerns from Epic {{epic_number}} development:
  - Search for debugging struggles, workarounds, or fragility observations
  - Look for technical debt observations that weren't captured in story files
</action>
```

**Rationale:** The readiness assessment asks the user about codebase health, but the facilitator should come prepared with data. smart_search can surface observations about stability concerns, workarounds, and technical debt from development sessions that didn't make it into story files.

---

## What is NOT changing

- No smart_outline or smart_unfold usage — the retrospective doesn't navigate source code
- Steps 1, 0.5, 4, 5, 6, 7, 8, 10, 11, 12 are unchanged
- The facilitation guidelines are unchanged
- The party mode protocol is unchanged
- The SKILL.md and bmad-skill-manifest.yaml are unchanged

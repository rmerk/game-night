# Code Review Smart Tools Migration

**Date:** 2026-03-31
**Scope:** `gds-code-review` skill workflow (`/.claude/skills/gds-code-review/workflow.md`)

## Goal

Replace full-file reads and Explore agent usage in `gds-code-review` with claude-mem smart tools (`smart_outline`, `smart_search`, `smart_unfold`) for token-efficient code navigation during reviews.

## Changes Made

### 1. Role Directive (top of workflow)

**Before:** "Read EVERY file in the File List"

**After:**
- Use `smart_outline` → `smart_unfold` as primary code navigation
- Full file reads only for Vue SFC templates/styles or when smart tools are unavailable
- Explicit ban: "Do NOT use Agent tool with Explore subagent"

### 2. Step 1 — Cross-session memory integration

**Before:** Conditional `<check if="claude-mem tools available">` wrapper with only `search` for past review patterns.

**After:** Removed conditional wrapper — smart tools are the default. Added:
- `smart_outline` on every review file for structural overview during discovery
- `smart_search` for cross-file dependency mapping (callers, consumers of modified APIs)
- `search` for past review feedback (unchanged)

### 3. Step 3 — Execute adversarial review

**Before:** Generic "search implementation files" and "read each file" with no tool preference.

**After:** Added `<critical>` block at top of step with explicit rules:
- Do NOT use Agent/Explore for code navigation
- Do NOT read entire files when `smart_outline` + `smart_unfold` suffice
- Reference Step 1 outlines already in context — don't re-read

Updated all three review sub-phases:
- **AC Validation:** `smart_search` to find implementations → `smart_unfold` to verify specific functions
- **Task Audit:** `smart_search` + `smart_unfold` for evidence gathering
- **Code Quality Deep Dive:** Reference Step 1 outlines, `smart_unfold` only suspicious functions, full reads only for non-AST content (templates, CSS)

### 4. Discover-inputs protocol — No changes

Reviewed `discover-inputs.md` — it loads planning artifacts (GDD, architecture, epics, UX docs) as full markdown reads, not source code. Smart tools don't apply here.

## Not Changed

- Steps 2, 4, 5 (attack plan, findings presentation, sprint sync) — no code reading involved
- `discover-inputs.md` — loads planning docs, not source code
- `checklist.md`, `backlog-template.md` — unrelated to code navigation

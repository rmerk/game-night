# Create-Story & Dev-Story Smart Tools Migration

**Date:** 2026-03-31
**Scope:** `gds-create-story` and `gds-dev-story` skill workflows
**Predecessor:** `2026-03-31-code-review-smart-tools-migration.md` (same pattern applied to `gds-code-review`)

## Goal

Extend the smart tools migration from `gds-code-review` to `gds-create-story` and `gds-dev-story`. Remove conditional availability checks that treat `smart_outline`, `smart_search`, `smart_unfold`, `search`, and `timeline` as optional optimizations, and instead mandate them as the default code navigation and cross-session memory tools.

## Shared Rationale

All three GDS workflows had the same architectural inconsistency: `<check if="claude-mem tools available">` wrappers that made smart tools optional. This conflicts with the project's claude-mem integration design, where these tools are always available via the UserPromptSubmit hook. The conditional wrappers cause the agent to fall back to token-expensive full file reads and Explore subagent usage unnecessarily.

---

## gds-create-story Changes

### Scope

Minimal. Create-story works primarily with planning artifacts (epics, GDD, architecture docs), not source code. Only one area needs updating.

### 1. Step 2 — Remove conditional wrapper (lines 244-257)

**Before:** Conditional `<check if="claude-mem tools available (smart_search, search, timeline)">` wrapper around cross-session memory queries.

**After:** Remove the conditional wrapper. Keep the same tool usage (`smart_search`, `search`, `timeline`) but as mandatory operations, not gated behind availability checks.

### Not Changed

- **Role directive** — Create-story's role is artifact analysis, not source code navigation. No Explore ban needed; the existing "UTILIZE SUBPROCESSES AND SUBAGENTS" directive stays.
- **Steps 1, 3, 4, 5, 6** — Deal with sprint status, planning doc reads, web research, story file generation, and finalization. No source code navigation involved.

---

## gds-dev-story Changes

### Scope

Heavier. Dev-story actively navigates and modifies source code throughout implementation. Four areas of change.

### 1. Role directive (lines 6-12)

**Before:** No mention of smart tools or code navigation approach.

**After:** Add smart tools mandate:
- Use `smart_outline` → `smart_unfold` as primary code navigation when understanding existing code
- Full file reads appropriate when actively editing a file or when smart tools are insufficient (Vue SFC templates/styles, CSS, config files)
- Ban Explore subagent for code navigation: "Do NOT use Agent tool with Explore subagent for code navigation — use smart_outline, smart_search, and smart_unfold directly"
- `smart_search` for cross-file dependency discovery

### 2. Step 2 — Remove conditional wrapper (lines 186-193)

**Before:** Conditional `<check if="claude-mem tools available (smart_search, search, timeline)">` wrapper around cross-session memory queries.

**After:** Remove the conditional wrapper. Make `smart_search` and `search` mandatory operations. Add `smart_outline` on files the story will modify (from the story's File List or task descriptions) to build structural understanding before implementation begins.

### 3. Step 5 — Red-green-refactor cycle (lines 275-303)

**Before:** No guidance on how to understand existing code. Implicit full file reads.

**After:** Add smart tool guidance integrated into the existing cycle:

- **Before each task** (added to the existing "Review the current task/subtask" action): `smart_outline` on files you'll modify to understand structure. `smart_search` to find similar patterns and tests in the codebase.
- **RED phase**: `smart_search` to find existing test patterns to follow. `smart_outline` on related test files to understand structure before writing new tests.
- **GREEN phase**: `smart_outline` to understand modules being modified. `smart_unfold` specific functions to integrate with. Full reads only for files being actively edited.
- **REFACTOR phase**: `smart_outline` to verify structural result of changes. `smart_search` to confirm no callers or consumers were missed.

### 4. Step 6 — Test authoring (lines 306-311)

**Before:** Generic "create unit tests" / "add integration tests" with no guidance on understanding existing test structure.

**After:** Add:
- `smart_search` to find existing test patterns and coverage for related code
- `smart_outline` on existing test files to understand structure before adding new tests

### Not Changed

- **Steps 1, 3, 4** — Story discovery, review continuation detection, sprint status marking. No code navigation.
- **Steps 7-10** — Running validation commands, marking task completion, story completion, user communication. These run commands and update markdown files, not navigate source code.

# Claude-Mem Integration Design

## Goal

Integrate claude-mem as a passive memory layer underneath the existing GDS development workflow (`create-story` -> `dev-story` -> `code-review` -> `retrospective`). No workflow changes — just better context persistence across sessions and `/clear` boundaries.

## Pain Points Addressed

1. **Session continuity** — Context lost between sessions and after `/clear` between stories
2. **Decision archaeology** — Recalling why design decisions were made weeks/epics ago
3. **Cross-session search** — Finding how something was implemented or debugged in past sessions

## Design

### Assumption: Passive Observation Recording

Claude-mem automatically records structured observations from every tool execution (file reads, edits, bash commands, searches) during sessions. No explicit write actions are needed — the database populates itself as the assistant works (`~/.claude-mem/claude-mem.db`). This spec focuses on when to *read* from that database.

### Hook: UserPromptSubmit (fires before GDS skills)

Detects when the user is about to invoke a GDS workflow skill (`create-story`, `dev-story`, `code-review`, `retrospective`) and injects recent claude-mem observations plus a reminder to use `mem-search` for deeper context.

**Event:** `UserPromptSubmit`
**Type:** `command`
**Matcher pattern:** Regex on user prompt for GDS skill keywords
**Output:** JSON with `hookSpecificOutput.additionalContext` when matched, silent otherwise.

### CLAUDE.md: Behavioral Guidance (not triggers)

Hooks handle *when* memory is injected. CLAUDE.md handles *how* to use it:

- **mem-search usage:** The `mem-search` skill wraps a 3-layer workflow (`search` -> `timeline` -> `get_observations`). Use the `project` parameter to scope results. The assistant should follow this progressive disclosure pattern to avoid wasting tokens.
- **Code review nuance:** A past reference provides *context*, not automatic justification — still flag issues if warranted.
- **Timeline reports:** At end of epic, use `claude-mem:timeline-report` to generate a narrative. Save to `_bmad-output/implementation-artifacts/epic-{N}-timeline.md` and reference during `gds-retrospective`.

### CLAUDE.md: Code Navigation (claude-mem tools)

Separate from memory, the claude-mem plugin provides AST-based code exploration tools:

- **Prefer `smart_outline` over reading full files** when understanding code structure (function signatures, type definitions, exports). Use full file reads only when editing or when the structural view is insufficient.
- **Use `smart_search`** to find symbols, functions, and classes across the codebase with folded structural views. More token-efficient than grep for understanding how code fits together.

### What Does NOT Change

- The `create-story` -> `dev-story` -> `code-review` -> `retrospective` flow stays the same
- GDS skills are not replaced by `make-plan` / `do`
- No new slash commands for the user to learn
- No changes to existing CLAUDE.md sections (beyond the additions above)

## Implementation

1. Add UserPromptSubmit hook to `.claude/settings.json` (Stop hook not needed — claude-mem's built-in SessionStart handles session context injection, and Stop fires during `/clear` when context would be immediately wiped)
2. Update CLAUDE.md with behavioral guidance (not triggers) and code navigation section

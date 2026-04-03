# Platform-Adaptive Dev Story Workflow

**Date:** 2026-04-03
**Status:** Design
**Platforms:** Claude Code, Cursor

## Problem

The gds-dev-story workflow was restructured (commit 6a4a473) from a monolithic implementer to a controller + subagent orchestrator. The architecture relies on Claude Code's `Agent` tool for subagent dispatch and `SendMessage` for persistent session communication. Cursor's subagent system (`Task` tool) is fundamentally different:

- **Stateless:** Each `Task` dispatch creates a fresh agent with zero memory. No `SendMessage` equivalent.
- **No dynamic model selection:** The parent cannot choose the model per-dispatch. Model is fixed in agent frontmatter.
- **Unreliable dispatch:** The `Task` tool has been buggy since its 2.4 launch — it doesn't always bind to custom agents.

When invoked in Cursor, the workflow's controller correctly refused to write code (as instructed), then had no working mechanism to dispatch subagents, resulting in a stall.

## Design

### Architecture: Shared Core + Platform Strategies

```
SKILL.md (per-platform entry point)
  → workflow.md (shared steps 1-4, 8-9)
    → strategy-{platform}.md (steps 5-7)
      → prompt templates (existing, unchanged)
```

**Shared steps** (platform-independent, stay in `workflow.md`):
- Steps 1-4: Story discovery, context loading, review continuation, mark in-progress
- Steps 8-9: Story completion, sprint status update, completion communication

**Platform-specific steps** (extracted into strategy files):
- Steps 5-7: Per-task implementation loop, full regression, DoD validation

### Platform Detection: Entry Point, Not Runtime

No runtime tool probing or config fields. Each platform's deployment directory gets a `SKILL.md` that tells the workflow which strategy to use:

- `.claude/skills/gds-dev-story/SKILL.md` → "Follow workflow.md. Use `strategy-claude-code.md` as the strategy file."
- `.cursor/skills/gds-dev-story/SKILL.md` → "Follow workflow.md. Use `strategy-cursor.md` as the strategy file."

The workflow's initialization section declares `strategy_file` as a path variable (like `implementer_template`). The SKILL.md instruction tells the agent which value to use. At the boundary between Step 4 and Step 5, the workflow says: "Load and execute `{strategy_file}` for Steps 5-7."

### File Changes

**New files:**
| File | Purpose |
|------|---------|
| `strategy-claude-code.md` | Steps 5-7 for Claude Code — extracted from current workflow, essentially unchanged |
| `strategy-cursor.md` | Steps 5-7 for Cursor — controller implements directly, reviewer dispatch with fallback |

**Modified files:**
| File | Change |
|------|--------|
| `workflow.md` | Remove inline Steps 5-7, replace with strategy file reference |
| `SKILL.md` (both platforms) | Each sets `strategy_file` to correct strategy |
| `implementer-prompt.md` | Add note: in Cursor strategy, serves as controller's own TDD checklist |

**Unchanged files:**
| File | Why |
|------|-----|
| `context-curation.md` | Used by both strategies identically |
| `spec-reviewer-prompt.md` | Works for both dispatch and self-review reference |
| `code-quality-reviewer-prompt.md` | Same |
| `dod-reviewer-prompt.md` | Same |
| `checklist.md` | Same |

## Strategy: Claude Code

Extracted directly from current workflow Steps 5-7. No behavioral changes.

- Controller dispatches implementer via `Agent` tool with curated context
- Handles NEEDS_CONTEXT/BLOCKED/DONE_WITH_CONCERNS via `SendMessage` to same subagent
- Dispatches spec reviewer via `Agent` tool after implementer reports DONE
- Sends findings back to implementer via `SendMessage` for fixes
- Dispatches code quality reviewer via `Agent` tool (superpowers:code-reviewer)
- Same fix loop via `SendMessage`
- Model selection per task complexity (haiku/sonnet/opus per context-curation.md matrix)
- DoD reviewer via `Agent` tool with model: opus

## Strategy: Cursor

### Step 5 — Per-Task Implementation Loop

The controller implements directly. This is the key behavioral difference from Claude Code.

**Per task:**

1. **Context curation** — Same discipline as CC. Follow `context-curation.md` to extract task text, mapped ACs, relevant Dev Notes, filtered gotchas, project conventions. This focuses the controller's own attention, not a subagent's.

2. **Record baseline** — `git rev-parse HEAD` → BASE_SHA

3. **Implement via TDD** — Controller follows `implementer-prompt.md` as its own checklist:
   - Write failing tests first (red)
   - Confirm tests fail
   - Implement minimal code to pass (green)
   - Run tests to confirm pass
   - Refactor while green
   - Commit with Conventional Commit message
   - Self-review per implementer-prompt.md self-review section

4. **Spec compliance review** — Attempt `Task` dispatch using spec-reviewer-prompt.md template:
   - If `Task` succeeds and reviewer returns results → use findings
   - If `Task` fails (tool not available, dispatch error) → **run mechanical self-review:**

   **Mechanical spec self-review (fallback):**
   ```
   For each subtask in task spec:
     1. Read the actual code file at the path specified
     2. Verify the exact prop/emit/method/guard exists as named
     3. Record: "[subtask text] → [file:line] — PASS/FAIL"
   For each mapped AC:
     1. Find the test that exercises this AC scenario
     2. Run `vp test run` and capture output
     3. Record: "[AC number] → [test name] — PASS/FAIL"
   If any FAIL → fix before proceeding
   ```

5. **Code quality review** — Record HEAD_SHA. Attempt `Task` dispatch using code-quality-reviewer-prompt.md:
   - If `Task` succeeds → use findings
   - If `Task` fails → **run mechanical quality self-review:**

   **Mechanical quality self-review (fallback):**
   ```
   For each file created/modified:
     1. Read file — check <script setup lang="ts"> (Vue), co-located test exists
     2. Verify imports: no aliases, vite-plus/test not vitest, relative or @mahjong-game/shared
     3. Verify test uses happy-dom, setActivePinia in beforeEach (if Vue component)
     4. Check file length — flag if >200 lines for a new file
   Run: vp test run && vp lint
   Record results verbatim
   ```

6. **Mark task complete** — Update story file (checkboxes, File List, Dev Agent Record, Change Log)

7. **Loop** — Next incomplete task, repeat from step 1

### Step 6 — Full Regression Suite

Identical to Claude Code:
```
pnpm test && pnpm run typecheck && vp lint
```
If failures: controller fixes directly (no subagent dispatch for fixes), re-runs until clean.

### Step 7 — DoD Validation

Attempt `Task` dispatch using dod-reviewer-prompt.md (best candidate for dispatch — fully stateless, one-shot, reads everything independently).

**If Task succeeds:** Use DoD reviewer findings. If FAIL, controller fixes issues and re-dispatches.

**If Task fails (fallback):** Controller runs DoD checklist mechanically:

```
For each item in checklist.md:
  1. Execute the verification action (run command, read file, check section)
  2. Record: "[checklist item] → [evidence] — PASS/FAIL"
Cross-task checks:
  1. For each pair of files in File List that import each other:
     - Verify import paths resolve
     - Verify type compatibility
  2. Run full test suite: pnpm test — paste summary
  3. Run typecheck: pnpm run typecheck — paste summary
  4. Run lint: vp lint — paste summary
If any FAIL → fix and re-run failed checks
```

## What This Preserves

| Concern | Claude Code | Cursor |
|---------|-------------|--------|
| Context curation | Full (subagent isolation) | Full (self-focus discipline) |
| Adversarial review | Guaranteed (separate subagent) | Best-effort (Task dispatch with self-review fallback) |
| TDD discipline | Enforced by implementer prompt | Enforced by same prompt used as self-checklist |
| Model selection | Dynamic per task | Fixed (platform limitation) |
| Implementer isolation | Yes | No (controller implements directly) |
| Uninterrupted execution | Yes | Yes (fallback prevents stalls) |

## What This Sacrifices in Cursor

1. **Implementer isolation** — Controller writes code directly. Cross-task context pollution is possible but mitigated by the curation discipline focusing attention per-task.
2. **Guaranteed adversarial review** — Self-review is inherently weaker. The mechanical checklists enforce rigor but lack the independent perspective of a separate agent.
3. **Dynamic model selection** — All work happens at whatever model the Cursor session is using.

## Sync Strategy

Source of truth remains `_bmad/gds/workflows/4-production/`. All files (shared + both strategies) live there. The sync step copies:
- Shared files + `strategy-claude-code.md` → `.claude/skills/gds-dev-story/`
- Shared files + `strategy-cursor.md` → `.cursor/skills/gds-dev-story/`
- Platform-specific `SKILL.md` to each location

Both platform directories get all prompt templates and the context curation guide (they're referenced by both strategies).

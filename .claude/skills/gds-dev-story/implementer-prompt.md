# GDS Story Implementer Prompt Template

Use this template when dispatching an implementer subagent for a story task.

## Template

```
Task tool (general-purpose):
  description: "Implement Task N: [task name]"
  prompt: |
    You are implementing a task from a game development story.

    ## Task Description

    [FULL TEXT of task + all subtasks from story file, including checkbox items,
     file paths, prop signatures, behavioral guards — paste verbatim]

    ## Acceptance Criteria This Task Addresses

    [ONLY the ACs mapped to this task, e.g. "AC: 2, 3" — paste the full AC text
     for each. Do NOT include ACs from other tasks]

    ## Architecture & Coding Standards

    [Curated subset from Dev Notes — only sections relevant to this task:
     - Architecture Patterns (always include)
     - Component File Placement (if task creates new files)
     - Existing Code To Reuse (if task integrates with existing components)
     - Testing Standards (always include)]

    ## Critical Gotchas

    [ONLY gotchas relevant to this task — do NOT dump all gotchas.
     Example: if task creates useTileSelection, include gotcha about
     rackStore separation and DnD coexistence. Skip vote prompt gotchas.]

    ## Project Conventions

    - Vue components: `<script setup lang="ts">` — always Composition API
    - Imports from `vite-plus/test` (not `vitest`) for test utilities
    - No import aliases — use relative imports or `@mahjong-game/shared`
    - Co-located tests: `*.test.ts` next to `*.ts`
    - happy-dom for client tests (not jsdom)
    - UnoCSS for styling (utility-first)
    - Conventional Commits for git messages

    ## Vue skills (before code)

    If this task touches **`packages/client`** (`.vue` SFCs, client composables, Pinia stores, Vue Router, or client `*.test.ts`), you MUST load the applicable skills **before** writing tests or production code. Invoke them via your environment's Skill mechanism, or read the skill file. Skip this section if the task only touches `packages/shared` or `packages/server`.

    | Scope | Skills |
    |--------|--------|
    | Any Vue/client UI or composable work | `vue-best-practices`, `vue` |
    | Component / client tests | `vue-testing-best-practices` |
    | Route changes / navigation | `vue-router-best-practices` |
    | Pinia store changes | `pinia` |

    ## Before You Begin

    If you have questions about:
    - The requirements or acceptance criteria
    - The approach or implementation strategy
    - Dependencies or assumptions
    - Anything unclear in the task description

    **Ask them now.** Raise any concerns before starting work.

    ## Your Job

    Once you're clear on requirements:
    1. Write FAILING tests first (red phase)
    2. Confirm tests fail — this validates test correctness
    3. Implement MINIMAL code to make tests pass (green phase)
    4. Run tests to confirm they pass
    5. Refactor while keeping tests green
    6. Commit your work with a Conventional Commit message
    7. Self-review (see below)
    8. Report back

    Work from: [project root directory]

    **While you work:** If you encounter something unexpected or unclear, **ask questions**.
    It's always OK to pause and clarify. Don't guess or make assumptions.

    ## Code Organization

    - Follow the file paths specified in the task description exactly
    - Each file should have one clear responsibility
    - Follow established patterns in the codebase — use smart_outline on
      existing files to understand structure before modifying them
    - If a file is growing beyond what the task specifies, stop and report
      as DONE_WITH_CONCERNS

    ## When You're in Over Your Head

    It is always OK to stop and say "this is too hard for me." Bad work is
    worse than no work.

    **STOP and escalate when:**
    - The task requires architectural decisions not covered by the task spec
    - You need to understand code beyond what was provided
    - You feel uncertain about whether your approach is correct
    - The task involves restructuring existing code the spec didn't anticipate

    **How to escalate:** Report with status BLOCKED or NEEDS_CONTEXT.

    ## Before Reporting Back: Self-Review

    **Completeness:**
    - Did I fully implement everything in every subtask?
    - Did I miss any behavioral guards or edge cases specified?
    - Are all specified props, emits, methods, and computed properties present?

    **Quality:**
    - Is this my best work?
    - Do names match the task spec exactly (not renamed)?
    - Is the code clean and follows project conventions?

    **Discipline:**
    - Did I avoid overbuilding beyond the task spec?
    - Did I only build what was requested?
    - Did I follow TDD (red-green-refactor)?

    **Testing:**
    - Do tests verify behavior, not implementation details?
    - Do tests cover the scenarios listed in the task spec?
    - Do tests use `vite-plus/test` imports and happy-dom?

    If you find issues, fix them now before reporting.

    ## Report Format

    When done, report:
    - **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - What you implemented (list each subtask completed)
    - What you tested and test results (exact test names + pass/fail)
    - Files created or modified (relative paths from repo root)
    - Self-review findings (if any)
    - Any issues or concerns
```

## Controller Guidance

**Context curation is your most important job.** For each task:

1. Extract the task + all subtasks verbatim from the story file
2. Find the AC numbers in parentheses (e.g., "AC: 2, 3") and paste only those full AC texts
3. From Dev Notes, select ONLY sections the implementer needs for THIS task
4. From Critical Gotchas, select ONLY gotchas that apply to THIS task's files/concerns
5. Include project conventions (always the same block)

**Do NOT:**
- Dump the entire Dev Notes section
- Include all gotchas
- Include ACs from other tasks
- Include previous task implementation details
- Summarize or paraphrase — paste verbatim from story file

## Platform Note

In the **Cursor strategy**, the controller uses this template as its own TDD implementation
checklist rather than passing it to a subagent. The template content, TDD discipline, and
self-review section apply identically — the only difference is who executes them.

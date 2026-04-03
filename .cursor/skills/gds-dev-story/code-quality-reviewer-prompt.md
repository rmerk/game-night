# GDS Story Code Quality Reviewer Prompt Template

Use this template ONLY after spec compliance review passes.

## Template

```
Task tool (superpowers:code-reviewer):
  description: "Code quality review for Task N: [task name]"
  prompt: |
    WHAT_WAS_IMPLEMENTED: [from implementer's report — what was built]
    PLAN_OR_REQUIREMENTS: [task text + ACs from story]
    BASE_SHA: [commit SHA before this task started]
    HEAD_SHA: [current commit SHA after implementer's work]
    DESCRIPTION: [one-line task summary]

    ## Additional GDS Quality Criteria

    Beyond standard code quality concerns, verify:

    **Story Architecture Compliance:**
    - Does the implementation follow the architecture patterns from the story's Dev Notes?
    - Are imports using the correct patterns (no aliases, relative or @mahjong-game/shared)?
    - Does it use the specified frameworks (Composition API, UnoCSS, vite-plus/test)?

    **Testing Quality:**
    - Are tests co-located (*.test.ts next to *.ts)?
    - Do tests use happy-dom (not jsdom)?
    - Do tests import from vite-plus/test (not vitest)?
    - Do tests use project fixtures (createPlayState, suitedTile, etc.) where applicable?
    - Are mocks appropriate (@vue-dnd-kit/core mocked, Pinia set up in beforeEach)?

    **File Organization:**
    - Does each file have one clear responsibility?
    - Are new files placed in the paths specified by the task?
    - Did this task create files that are already large?

    **Vue-Specific (if applicable):**
    - Is `<script setup lang="ts">` used?
    - Are props/emits properly typed with defineProps/defineEmits?
    - Are composables following Vue composition patterns?
```

## Controller Guidance

- Only dispatch AFTER spec reviewer returns ✅
- Record BASE_SHA before dispatching implementer (git rev-parse HEAD)
- Record HEAD_SHA after implementer commits (git rev-parse HEAD)
- If reviewer returns issues, send back to implementer subagent for fixes,
  then re-dispatch code quality reviewer
- If reviewer approves, task is complete — update story file

# GDS Story Definition-of-Done Reviewer Prompt Template

Use this template after ALL story tasks have passed both spec and quality reviews.

## Template

```
Task tool (general-purpose):
  description: "DoD validation for Story [story_key]"
  prompt: |
    You are performing final Definition-of-Done validation for a completed story.
    Your job is to independently verify the story is truly ready for code review.

    ## Story File

    [FULL story file content — the controller pastes the entire story markdown
     including all sections: Story, ACs, Tasks, Dev Notes, Dev Agent Record, etc.]

    ## DoD Checklist

    [FULL content of checklist.md — paste verbatim]

    ## CRITICAL: Independent Verification

    The controller claims all tasks passed spec and quality reviews. You MUST
    verify independently. The controller may have missed cross-task issues.

    **DO NOT:**
    - Trust that individual task reviews caught everything
    - Assume cross-cutting concerns were validated
    - Skip running the full test suite

    **DO:**
    - Run `pnpm test` to verify ALL tests pass (not just per-task tests)
    - Run `pnpm run typecheck` to verify type safety
    - Run `vp lint` to verify code quality
    - Read the actual code for each file in the File List
    - Verify every AC has a corresponding implementation AND test
    - Check that Dev Agent Record accurately reflects what was built
    - Verify Change Log entries are present and accurate

    ## Your Job

    Work through every item in the DoD checklist. For each item:
    1. Verify it independently (read code, run commands, check files)
    2. Mark it pass or fail with evidence

    **Cross-Task Validation (what per-task reviews miss):**
    - Do components integrate correctly across task boundaries?
    - Are there naming inconsistencies between files created by different tasks?
    - Do imports between new files resolve correctly?
    - Are there duplicate or conflicting implementations?
    - Does the full system work end-to-end (not just individual units)?

    **Story File Integrity:**
    - Are ALL tasks and subtasks marked [x]?
    - Does the File List include EVERY changed file? (cross-check with git)
    - Were only permitted story sections modified?
    - Is the Dev Agent Record populated with meaningful notes?

    ## Report Format

    Report:
    - **Overall:** PASS or FAIL
    - **Checklist Results:** Each DoD item with pass/fail and evidence
    - **Cross-Task Issues:** Any integration problems found
    - **Test Suite Results:** Full test run output summary
    - **Quality Gate Results:** Typecheck + lint results
    - **Blocking Issues:** (if FAIL) Specific items that must be fixed

    If FAIL, list the exact fixes needed. The controller will dispatch a
    fix subagent for each blocking issue.
```

## Controller Guidance

- Paste the COMPLETE story file (all sections)
- Paste the COMPLETE checklist.md content
- If DoD reviewer returns FAIL, dispatch a fix subagent per blocking issue,
  then re-run DoD review
- If DoD reviewer returns PASS, proceed to update story status to "review"
  and update sprint-status.yaml

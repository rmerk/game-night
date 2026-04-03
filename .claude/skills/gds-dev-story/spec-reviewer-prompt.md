# GDS Story Spec Compliance Reviewer Prompt Template

Use this template after an implementer subagent reports DONE or DONE_WITH_CONCERNS.

## Template

```
Task tool (general-purpose):
  description: "Review spec compliance for Task N: [task name]"
  prompt: |
    You are reviewing whether a story task implementation matches its specification.

    ## What Was Requested

    [FULL TEXT of task + all subtasks from story file — same text given to implementer]

    ## Acceptance Criteria This Task Must Satisfy

    [FULL TEXT of mapped ACs — same ACs given to implementer]

    ## What Implementer Claims They Built

    [Paste implementer's full report here — status, files, test results, everything]

    ## CRITICAL: Do Not Trust the Report

    The implementer may be incomplete, inaccurate, or optimistic. You MUST verify
    everything independently by reading actual code.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust their claims about test coverage
    - Accept their interpretation of subtask requirements

    **DO:**
    - Read the actual code files they listed as created/modified
    - Compare implementation to each subtask specification line by line
    - Check that every behavioral guard, prop, emit, and method exists as specified
    - Run `vp test run` to verify tests actually pass
    - Check that file paths match what the task specified

    ## Your Job

    **Missing requirements:**
    - Is every subtask fully implemented (all checkboxed items)?
    - Are all specified props, emits, methods, computed properties present?
    - Do behavioral guards work as described (e.g., "no-op when targetCount is 0")?
    - Are all AC scenarios actually handled?

    **Extra/unneeded work:**
    - Did they build things not in the task spec?
    - Did they add props, methods, or features beyond what was requested?
    - Did they over-engineer or add unnecessary abstractions?

    **Misunderstandings:**
    - Did they implement the right behavior but wrong interface?
    - Did they use wrong file paths or wrong component names?
    - Did they misinterpret an AC?

    **Testing gaps:**
    - Does each test scenario from the task spec have a corresponding test?
    - Do tests verify the specified behaviors (not just "it renders")?

    **Verify by reading code, not by trusting the report.**

    ## Report Format

    Report:
    - ✅ Spec compliant (if everything matches after code inspection)
    - ❌ Issues found: [list specifically what's missing, extra, or wrong — include
      file:line references and quote the subtask requirement that was violated]
```

## Controller Guidance

- Paste the EXACT SAME task text and ACs you gave to the implementer
- Paste the implementer's FULL report (not a summary)
- If implementer reported DONE_WITH_CONCERNS, include the concerns text —
  the spec reviewer should evaluate whether the concerns indicate real gaps
- If spec reviewer returns ❌, send findings back to the SAME implementer
  subagent (via SendMessage) for fixes, then re-dispatch spec reviewer

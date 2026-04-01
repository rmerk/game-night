# Sprint Change Proposal: Epic 5A Retrospective Reconciliation

**Date:** 2026-04-01
**Change Trigger:** Epic 5A retrospective identified that delivered scope, epic-plan language, and sprint tracking are no longer aligned.
**Recommended Path:** Direct Adjustment
**Scope Classification:** Moderate

## 1. Issue Summary

Epic 5A completed its planned ten UI stories and delivered a strong, reusable browser UI surface. However, the retrospective concluded that the delivered result was a UI vertical slice rather than the fully integrated first 4-player playtest milestone currently described in `epics.md`.

This created two concrete planning conflicts:

- `epics.md` still describes Epic 5A as the first real 4-player playtest and includes basic audio in the delivered milestone.
- `sprint-status.yaml` still shows `epic-5a` as `in-progress` even though all Epic 5A stories and the retrospective are marked complete.

The retrospective also identified a real prerequisite for Epic 3B: live client-state integration plus an Epic 3B planning review before Charleston story execution begins.

## 2. Impact Analysis

### Epic Impact

- **Epic 5A:** Reframe as a completed core UI milestone, not a fully integrated playtest milestone.
- **Epic 3B:** Keep in backlog, but explicitly gate story execution on missing client integration and planning review follow-through.

### Story Impact

- No completed Epic 5A stories need to be reopened.
- No Epic 3B stories should move forward until the prerequisite follow-through items are complete.
- Future story creation should incorporate the deferred validation-checklist process improvement called out by both Epic 4A and Epic 5A retrospectives.

### Artifact Conflicts

- `epics.md` needs milestone and dependency language corrected.
- `sprint-status.yaml` needs Epic 5A status corrected and retro follow-through items tracked visibly.
- No GDD or architecture rollback is required; this is a sequencing and planning-alignment correction.

### Technical Impact

- No immediate code rollback.
- Client integration work (`useWebSocket`, `useGameState`, room/table orchestration) becomes a tracked prerequisite rather than an implicit assumption.
- Epic 3B planning must explicitly address `TileSelectionAction` reuse and Charleston reconnect / auto-pass behavior before implementation.

## 3. Recommended Approach

Choose **Direct Adjustment** rather than rollback or MVP reduction.

**Rationale:**

- Delivered UI work is still valid and high-value.
- The mismatch is primarily in milestone framing, prerequisite tracking, and next-epic readiness.
- Updating planning artifacts now is lower risk than allowing Epic 3B to start from stale assumptions.

**Effort / Risk / Timeline Impact:**

- Effort: Low to Medium
- Risk: Low
- Timeline Impact: Small short-term planning delay for Epic 3B, meaningful reduction in downstream rework risk

## 4. Detailed Change Proposals

### A. `epics.md` - Epic 5A milestone language

**OLD**

- "First real 4-player playtest with humans."
- "Includes basic audio (tile clack + Mahjong motif) for playtest personality."
- `>>> MILESTONE: First 4-player playtest <<<`

**NEW**

- Reframe Epic 5A as a completed core game UI milestone.
- State explicitly that live client-state integration and basic audio were deferred and should not be implied as delivered.
- Rename the milestone to reflect UI readiness rather than playtest readiness.

**Rationale:** Matches the retrospective's conclusion and removes overstatement from the epic plan.

### B. `epics.md` - Epic 3B readiness gate

**OLD**

- Epic 3B depends on Epic 3A and Epic 5A, with no explicit note about missing integration prerequisites.

**NEW**

- Add implementation guidance that Epic 3B story execution must not begin until:
  - live client-state integration exists for the table UI
  - the Epic 3B plan is reviewed for `TileSelectionAction` reuse
  - Charleston reconnect / auto-pass behavior is incorporated up front

**Rationale:** Converts the retrospective's "Epic update required: YES" finding into an actionable gate.

### C. `sprint-status.yaml` - Epic 5A status reconciliation

**OLD**

- `epic-5a: in-progress`

**NEW**

- `epic-5a: done`

**Rationale:** All Epic 5A stories and the retrospective are complete; the tracker should say so.

### D. `sprint-status.yaml` - Visible retro follow-through tracking

**OLD**

- Retro action items exist only in retrospective prose.

**NEW**

- Add a dedicated retro follow-through section tracking:
  - validation checklist adoption
  - milestone-language clarification
  - client integration prerequisite
  - Epic 3B planning review

**Rationale:** Addresses the repeated retro lesson that prose-only action items are not followed through reliably.

## 5. Implementation Handoff

**Scope:** Moderate

**Handoff Recipients and Responsibilities**

- **Scrum Master / Product Owner:** Maintain corrected epic sequencing and ensure future story creation reflects the updated milestone framing.
- **Game Developer:** Complete the client integration prerequisite before Epic 3B execution.
- **Architect / Project Lead:** Run the Epic 3B planning review and confirm Charleston assumptions are updated before implementation starts.

**Success Criteria**

- `epics.md` no longer overstates Epic 5A as a delivered integrated playtest milestone.
- `sprint-status.yaml` marks Epic 5A complete.
- Retro follow-through items are visible in sprint tracking.
- Epic 3B remains blocked in practice until the integration and planning prerequisites are complete.

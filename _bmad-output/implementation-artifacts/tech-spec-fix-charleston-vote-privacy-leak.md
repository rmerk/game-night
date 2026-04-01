---
title: 'Fix Charleston vote privacy leak'
type: 'bugfix'
created: '2026-04-01'
status: 'done'
baseline_commit: 'be829fb8659632759262646aa9ba0c56510d0307'
context:
  - '_bmad-output/planning-artifacts/gdd.md'
  - '_bmad-output/planning-artifacts/game-architecture.md'
  - '_bmad-output/project-context.md'
---

# Fix Charleston vote privacy leak

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story `3B.2` requires vote-ready Charleston broadcasts to expose only safe aggregate progress and each recipient's own vote state. The current implementation leaks peer vote values because `CHARLESTON_VOTE_CAST` includes `playerId` and `accept`, and the same `resolvedAction` is broadcast to every client.

**Approach:** Keep the filtered per-player Charleston state as the source of truth for self-only vote restore, but narrow the vote-cast event contract so non-final vote progress is safe to broadcast unchanged to all recipients. Update tests at the shared and server layers so they lock the privacy boundary in place.

## Boundaries & Constraints

**Always:** Preserve existing Charleston engine behavior for vote collection, early rejection on the first `no`, unanimous `yes` entry into reversed passing, and reconnect-safe `myVote` state in filtered views. Keep the server authoritative and continue broadcasting a single `STATE_UPDATE` per action through the existing pipeline.

**Ask First:** Any change that requires per-recipient `resolvedAction` shaping, protocol versioning, or a broader redesign of how all resolved actions are serialized.

**Never:** Expose peer `accept` / `reject` values through `resolvedAction`, filtered game state, reconnect payloads, or tests. Do not change courtesy-ready behavior, pass sequencing, or unrelated Charleston UX/state shapes in this fix.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Non-final yes vote | Second Charleston is `vote-ready`; one player submits `CHARLESTON_VOTE { accept: true }`; fewer than 4 votes total | All recipients get safe aggregate progress only, while each recipient still sees their own `charleston.myVote` value in filtered state | No peer vote values appear anywhere in serialized `STATE_UPDATE` payloads |
| Final unanimous yes vote | Fourth explicit `accept: true` arrives | Broadcast transitions to second Charleston `passing` with `currentDirection: "left"` and no peer vote values leaked | Existing accepted-path behavior remains intact |
| Early no vote | Any player submits `CHARLESTON_VOTE { accept: false }` | Broadcast transitions immediately to `courtesy-ready` without waiting for remaining votes and without exposing vote internals | Existing rejection-path behavior remains intact |
| Reconnect during vote-ready | Reconnecting player had already voted or not voted | Reconnect payload restores aggregate vote progress and only that player's own `myVote` field | No `votesByPlayerId` or peer vote values appear in the payload |

</frozen-after-approval>

## Code Map

- `packages/shared/src/types/game-state.ts` -- Defines the broadcasted `ResolvedAction` contract that currently leaks vote details.
- `packages/shared/src/engine/actions/charleston.ts` -- Emits `CHARLESTON_VOTE_CAST` for non-final yes votes.
- `packages/shared/src/engine/actions/charleston.test.ts` -- Shared engine coverage for vote progression and resolved action shape.
- `packages/server/src/websocket/state-broadcaster.ts` -- Broadcasts the same `resolvedAction` to every connected session.
- `packages/server/src/integration/full-game-flow.test.ts` -- End-to-end websocket assertions for vote-ready, vote progress, and privacy guarantees.
- `packages/server/src/websocket/state-broadcaster.test.ts` -- Filtering boundary tests for Charleston state serialization.

## Tasks & Acceptance

**Execution:**
- [x] `packages/server/src/integration/full-game-flow.test.ts` -- Update the vote-ready integration assertion to require aggregate-only vote progress and verify serialized payloads omit peer vote values -- reproduces the bug at the broadcast boundary before production changes.
- [x] `packages/shared/src/engine/actions/charleston.test.ts` -- Update the shared engine expectation for non-final vote progress to the narrowed safe event shape -- keeps the engine contract aligned with AC8.
- [x] `packages/shared/src/types/game-state.ts` -- Narrow `CHARLESTON_VOTE_CAST` to aggregate-safe fields only -- removes the leaky contract from the shared type system.
- [x] `packages/shared/src/engine/actions/charleston.ts` -- Emit the narrowed vote-cast payload while preserving vote counting and state transitions -- fixes the leak without changing Charleston flow behavior.
- [x] `packages/server/src/websocket/state-broadcaster.test.ts` -- Add or tighten assertions that Charleston serialization never reintroduces peer vote values -- protects the filtering boundary against regression.

**Acceptance Criteria:**
- Given second Charleston is `vote-ready`, when any non-final `accept: true` vote is broadcast, then every recipient receives only aggregate vote progress and not the voting player's identity or vote value.
- Given a player reconnects during vote-ready, when the server sends the restore payload, then the payload includes aggregate vote progress plus only that player's own `myVote` value.
- Given the fourth unanimous `accept: true` arrives or the first `accept: false` arrives, when the server broadcasts the resulting transition, then existing Charleston progression behavior remains unchanged.

## Spec Change Log

## Verification

**Commands:**
- `cd packages/server && vp test run src/integration/full-game-flow.test.ts` -- expected: updated vote-ready integration coverage fails first, then passes after the fix
- `cd packages/shared && vp test run src/engine/actions/charleston.test.ts` -- expected: shared Charleston vote tests reflect the narrowed resolved-action contract
- `cd packages/server && vp test run src/websocket/state-broadcaster.test.ts` -- expected: Charleston privacy boundary remains green

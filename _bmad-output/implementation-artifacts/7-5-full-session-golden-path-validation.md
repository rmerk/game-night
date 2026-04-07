# Story 7.5: Full-Session Golden Path Validation

Status: ready-for-dev

## Story

As a **team shipping Mahjong Night**,
I want **a documented four-player run through lobby → Charleston → play → hand resolution → scoreboard → rematch (or session end)**,
So that **we prove the integrated product works as one flow—not only isolated epics—and we have a repeatable gate before wider release.**

## Context

Core wiring already exists (`RoomView`, `GameTable`, WebSocket actions, `gamePhase` transitions including `scoreboard` and `rematch`, server `handleRematch`, etc.). This story is **validation + gap closure**: run the golden path, record outcomes, and fix **P0/P1** blockers discovered (file follow-up stories if work exceeds this scope).

**Canonical procedure:** [`_bmad-output/playtest-plan.md`](../playtest-plan.md) — rows **G1–G10** and note-taking templates.

## Acceptance Criteria

1. **Golden path G1–G8 executed** — At least one internal session with **four real clients** (four browsers or four devices) completes the checklist rows **G1** (room) through **G8** (rematch or intentional session end), with pass/fail recorded per row in the playtest plan or an attached **playtest report** section.

2. **Written record** — The same doc (or `_bmad-output/playtest-report-YYYY-MM-DD.md`) includes: build/commit identifier, participant count, device mix (at least one mobile if available), timestamped **P0/P1/P2** findings with repro hints.

3. **P0/P1 disposition** — Every **P0** (blocks progression) and **P1** (major loop break) from that run is either **fixed in-repo** in this story’s PR, or **tracked** as a new implementation story with ID + sprint-status entry (no orphaned “we saw it once” bugs).

4. **G9–G10 coverage decision** — Explicit note in the report: **G9** (refresh mid-play / mid–call window) and **G10** (mid-game rotation) were run **or** deferred with reason (e.g. time-box, known issue link).

5. **Automation unchanged** — No requirement to add E2E in this story; `pnpm test && pnpm run typecheck && vp lint` remain green after any code fixes.

## Tasks / Subtasks

- [ ] Task 1: Schedule and environment — Record server URL, client build, env (LiveKit on/off) in playtest notes (AC: 1, 2).
- [ ] Task 2: Run G1–G8 with four players — Facilitator + note-taker per `playtest-plan.md` (AC: 1, 2).
- [ ] Task 3: Run or defer G9–G10 — Document outcome per AC4 (AC: 4).
- [ ] Task 4: Triage and fix or file — Address P0/P1 in code or create linked stories; update sprint-status for new items (AC: 3).
- [ ] Task 5: Gate — `pnpm test && pnpm run typecheck && vp lint` after any code changes (AC: 5).

## Dev Notes

### Existing touchpoints (non-exhaustive)

- Lobby / start: `RoomView.vue` (`sendStartGame`), `useRoomConnection.ts`
- Table + phases: `GameTable.vue`, `PlayerGameView.gamePhase`
- Rematch: `conn.sendRematch()`, server `handleRematch` (`packages/server/src/websocket/action-handler.ts`), tests in `rematch-handler.test.ts`
- Session end: `SESSION_ENDED` resolved action → `sessionEndedSnapshot` in `RoomView.vue`

### Out of scope (unless P0)

- New tutorial/onboarding content
- Full E2E suite
- External playtest / NDA cohort

### References

- [`_bmad-output/playtest-plan.md`](../playtest-plan.md)
- [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) — `GamePhase`
- [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts) — `PlayerGameView`

## Dev Agent Record

### Agent Model Used

_(fill on completion)_

### Debug Log References

### Completion Notes List

### File List

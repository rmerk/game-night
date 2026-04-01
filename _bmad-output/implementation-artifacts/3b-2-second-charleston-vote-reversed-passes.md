# Story 3B.2: Second Charleston Vote & Reversed Passes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **player**,
I want **the group to vote on an optional second Charleston (reversed direction: Left, Across, Right) that requires unanimous agreement**,
so that **the group controls the pacing and the second Charleston follows correct NMJL rules (FR33)**.

## Acceptance Criteria

1. **AC1 - Vote prompt and action contract:** Given the first Charleston completes and Story `3B.1` leaves the shared state at `stage: "second"`, `status: "vote-ready"`, and `currentDirection: null`, when each player responds to the prompt, then the engine accepts a new `CHARLESTON_VOTE` action with `{ accept: true | false }` only during that vote-ready window.
2. **AC2 - Unanimous "yes" starts reversed passing:** Given all 4 players vote `accept: true`, when the final required vote is received, then the second Charleston begins immediately with reversed direction order `Left -> Across -> Right`, `status` returns to `"passing"`, and the filtered player view exposes only safe metadata needed to render that state.
3. **AC3 - Any "no" skips immediately to courtesy-ready handoff:** Given any player votes `accept: false`, when that vote is received, then the second Charleston is skipped immediately, the game remains in `gamePhase: "charleston"`, and the shared state advances to the courtesy-pass handoff required by Story `3B.3` rather than falling through to `play`.
4. **AC4 - Reversed pass sequencing stays simultaneous and deterministic:** Given the second Charleston is active, when all 4 players submit valid `CHARLESTON_PASS` actions for the active direction, then the exchange resolves simultaneously using the documented seat order, first `left`, then `across`, then `right`, without duplicating the first-Charleston implementation.
5. **AC5 - Blind-pass gating moves to the second-Charleston Right pass:** Given the second Charleston reaches its third pass (`right`), when a player has not yet locked their `right` pass selection, then the tiles they received from the preceding `across` pass remain hidden from that player's visible rack, are unavailable for selection, and are not leaked through filtered player views or resolved payloads until that player locks their submission.
6. **AC6 - Second-Charleston completion hands off cleanly to Story 3B.3:** Given all 3 reversed passes resolve, when the final `right` pass completes, then the engine emits a resolved action and Charleston state transition that clearly hands off to the courtesy-pass phase expected by Story `3B.3`, without also implementing the courtesy negotiation itself in this story.
7. **AC7 - Vote and pass validation reject invalid inputs with zero mutation:** Given a player votes or passes in the wrong Charleston sub-phase, votes twice, passes twice, submits duplicate tile IDs, or submits tiles not available in their currently visible rack, when validating, then the action is rejected with an appropriate reason and the game state is unchanged.
8. **AC8 - No-leak broadcasting and reconnect safety:** Given Charleston is in vote-ready, reversed-pass, blind-pass, or courtesy-ready handoff state, when state is broadcast or a player reconnects, then filtered views reveal only safe Charleston metadata: stage / status / currentDirection, progress fields such as `submittedPlayerIds` or `votesReceivedCount`, and the local player's own vote / lock state if needed for restore. They must never reveal hidden across-received tile IDs, other players' locked pass tile IDs, or per-player accept / reject vote values for peers.

## Tasks / Subtasks

- [x] Task 1: Extend shared Charleston contracts for second-Charleston voting and courtesy handoff (AC: 1, 2, 3, 6, 7, 8)
  - [x] 1.1 Add `CHARLESTON_VOTE` to `packages/shared/src/types/actions.ts` with `playerId` and `accept: boolean`.
  - [x] 1.2 Extend `packages/shared/src/types/game-state.ts` so the internal `CharlestonState` can represent vote collection and the post-vote courtesy handoff cleanly, without forcing Story `3B.3` to redesign the shape again.
  - [x] 1.3 Update `ResolvedAction` to cover vote resolution and second-Charleston / courtesy transitions in a way that stays consistent with the existing `CHARLESTON_PHASE_COMPLETE` pattern and client animation expectations.
  - [x] 1.4 Extend `packages/shared/src/types/protocol.ts` only with safe Charleston metadata needed for the vote-ready and courtesy-ready views; do not expose raw internal vote maps or hidden tile identities unless a field is truly required by downstream UI.
  - [x] 1.5 Update any exhaustiveness tests affected by the new action / state / resolved-action unions.

- [x] Task 2: Implement `CHARLESTON_VOTE` handling in shared engine code (AC: 1, 2, 3, 7)
  - [x] 2.1 Add vote validation to reject wrong-phase submissions, duplicate votes, and unknown players with zero mutation.
  - [x] 2.2 Resolve `accept: false` immediately on the first "no" vote and hand off to the courtesy-ready state required by Story `3B.3`.
  - [x] 2.3 Resolve unanimous "yes" only after all 4 required votes are present, then begin second-Charleston passing at direction `left`.
  - [x] 2.4 Keep the shared engine pure: no timers, no grace-period fallbacks, and no server-only behavior in `shared/`.

- [x] Task 3: Generalize the current Charleston pass engine for stage-aware ordering and blind-pass behavior (AC: 2, 4, 5, 6, 7)
  - [x] 3.1 Refactor `packages/shared/src/engine/actions/charleston.ts` so pass order is derived from Charleston stage instead of hardcoding only `right -> across -> left`.
  - [x] 3.2 Reuse existing simultaneous exchange helpers (`captureLockedTiles`, `removeLockedTiles`, reset helpers, seat math) instead of creating a second parallel pass engine for Story `3B.2`.
  - [x] 3.3 Generalize blind-pass handling so the hidden-across reveal rule applies to `left` during the first Charleston and `right` during the second Charleston from one stage-aware source of truth.
  - [x] 3.4 Ensure the final reversed-pass resolution transitions to a courtesy-ready Charleston state, not directly to `play`.

- [x] Task 4: Wire vote / second-Charleston state through engine dispatch and filtered WebSocket views (AC: 1, 2, 3, 6, 8)
  - [x] 4.1 Register `CHARLESTON_VOTE` in `packages/shared/src/engine/game-engine.ts` and export any new helpers from `packages/shared/src/index.ts`.
  - [x] 4.2 Update `packages/server/src/websocket/state-broadcaster.ts` so vote-ready, second-pass, blind-pass, and courtesy-ready states are serializable and filtered safely for each player.
  - [x] 4.3 Preserve the reconnect guarantees added in Story `3B.1`: the first reconnect payload during Charleston must restore the active filtered game view, not regress to lobby-like snapshots.
  - [x] 4.4 Keep transport behavior generic through the existing action-handler / broadcaster pipeline; do not invent Charleston-specific socket flows.

- [x] Task 5: Add focused shared and server coverage for vote resolution, reversed passes, and no-leak rules (AC: 1-8)
  - [x] 5.1 Extend `packages/shared/src/engine/actions/charleston.test.ts` with blackbox vote tests covering unanimous "yes", early "no", wrong phase, duplicate vote, and zero-mutation failures.
  - [x] 5.2 Add a full reversed-pass happy-path test (`left -> across -> right`) that proves the final handoff is courtesy-ready rather than `play`.
  - [x] 5.3 Add blind-pass tests proving second-Charleston `right` keeps across-received tiles hidden until that player locks their right-pass selection.
  - [x] 5.4 Extend `packages/server/src/websocket/state-broadcaster.test.ts` and `packages/server/src/integration/full-game-flow.test.ts` so JSON-stringified `STATE_UPDATE` payloads never leak hidden tiles, locked pass tile IDs, or unsafe vote internals.
  - [x] 5.5 Update reconnect / join-handler coverage if Charleston view shape changes, so vote-ready and second-pass states survive reconnect with the same filtering guarantees introduced by Story `3B.1`.

- [x] Task 6: Preserve scope boundaries and keep future stories unblocked (AC: 3, 6, 8)
  - [x] 6.1 Hand off into courtesy-ready state only; Story `3B.3` still owns `COURTESY_PASS` count negotiation, lower-count resolution, and the actual `charleston -> play` transition.
  - [x] 6.2 Do **not** build the inline Yes/No UI, `CharlestonZone`, or `TileSelectionAction` in this story; Story `3B.4` owns that work even though this story must expose the state shape it will consume.
  - [x] 6.3 Do **not** implement disconnect default-"No" logic or auto-pass timers here; Story `3B.5` owns grace-period and fallback behavior.

- [x] Task 7: Validation and backpressure gate (AC: all)
  - [x] 7.1 Run targeted shared Charleston tests plus touched server Charleston / reconnect integration tests.
  - [x] 7.2 Run `pnpm test`.
  - [x] 7.3 Run `pnpm run typecheck`.
  - [x] 7.4 Run `vp lint`.
  - [x] 7.5 Verify each acceptance criterion is covered by at least one automated test, especially early "no" resolution, second-Charleston blind pass privacy, and courtesy-ready handoff.

## Dev Notes

### Execution Gate

- **Do not treat Epic 3B as fully UI-ready.** Epic `5A` retro follow-through still lists the live client integration layer and Epic `3B` planning review as active prerequisites.
- **Execution policy for this story:** proceed only as a shared / server Charleston slice unless those retro items are explicitly closed first. This matches Story `3B.1`'s engine-first constraint and keeps Epic `3B` moving without pretending the client integration gate is finished.
- Avoid mock-only client UI work while the retro gates remain open.

### Current Implementation State

- Story `3B.1` already created a real Charleston engine path in `packages/shared/src/engine/actions/charleston.ts` and leaves the game in `gamePhase: "charleston"` with `stage: "second"`, `status: "vote-ready"`, and `currentDirection: null`.
- `packages/shared/src/types/actions.ts` currently has `CHARLESTON_PASS` but **not** `CHARLESTON_VOTE`.
- `packages/shared/src/types/game-state.ts` currently supports `CharlestonStage = "first" | "second"` and `CharlestonStatus = "passing" | "vote-ready"`, with hidden-across storage and per-player submission tracking, but no explicit vote collection or courtesy-ready handoff shape yet.
- `packages/shared/src/engine/actions/charleston.ts` currently hardcodes the first-Charleston pass order (`right -> across -> left`) and only reveals hidden across tiles on `left`, so Story `3B.2` must generalize that logic rather than duplicate it.
- `packages/server/src/websocket/state-broadcaster.ts` already exposes filtered Charleston metadata (`stage`, `status`, `currentDirection`, `submittedPlayerIds`, `myHiddenTileCount`, `mySubmissionLocked`) and is the correct boundary for any additional safe Charleston fields.
- `packages/server/src/integration/full-game-flow.test.ts` already proves the first Charleston ends at vote-ready with no hidden-tile leakage; extend that coverage instead of creating a separate Charleston integration harness.

### Architecture Patterns

- **Validate-then-mutate** remains mandatory in `shared/`.
- **Server authority** remains absolute: clients submit `CHARLESTON_VOTE` / `CHARLESTON_PASS`; the server validates, mutates, and broadcasts. No optimistic game-state mutation on the client.
- **Filtered protocol views over raw engine state** are required. Internal Charleston state may contain hidden across-received tiles, vote bookkeeping, or courtesy handoff metadata, but per-player protocol views must reveal only what is safe.
- **Pure shared logic only.** No `setTimeout`, browser APIs, or Node APIs in `shared/`; timeout, disconnect, and grace-period behavior stays on the server and belongs to Story `3B.5`.
- **Deterministic state machine composition** matters here: the game must remain in `gamePhase: "charleston"` through vote-ready, second-pass sequencing, and courtesy-ready handoff.
- **Code is the source of truth for current Charleston contracts.** `packages/shared/src/types/game-state.ts`, `packages/shared/src/types/actions.ts`, `packages/shared/src/types/protocol.ts`, and `packages/shared/src/engine/actions/charleston.ts` reflect repo reality. If `game-architecture.md` shows older Charleston resolved-action examples, follow the current code contracts and update docs separately rather than forcing the implementation back to stale shapes.

### Key Implementation Decisions

**1. Reuse the existing Charleston engine instead of forking it.**
Story `3B.1` already solved simultaneous pass locking, seat-direction transfer, and filtered hidden-tile storage. Story `3B.2` should extend that engine with stage-aware direction order and blind-pass rules, not introduce a second Charleston implementation path.

**2. Treat vote-ready and courtesy-ready as Charleston sub-phases, not as new top-level game phases.**
The game should remain in `gamePhase: "charleston"` until Story `3B.3` resolves courtesy and advances to `play`.

**3. Resolve "no" votes early, but resolve "yes" votes only when unanimity is proven.**
Per the planning artifact, one `accept: false` skips the second Charleston immediately. Starting the second Charleston requires all 4 explicit `accept: true` votes.

**4. Keep blind-pass logic stage-aware from one source of truth.**
The third pass of each Charleston is blind: `left` in the first Charleston, `right` in the second. Do not scatter that rule across multiple switch statements.

**5. Design the courtesy handoff so Story `3B.3` can start cleanly.**
This story should leave the engine in a clear courtesy-ready Charleston state with no ambiguity about which pairings act next, but it should not implement courtesy negotiation rules or the eventual `play` transition.

### Courtesy-Ready State Contract

- Keep `gamePhase: "charleston"` until Story `3B.3` resolves courtesy and advances to `play`.
- Preserve an explicit courtesy-ready Charleston sub-phase (new `status`, new stage marker, or equivalent) instead of overloading `vote-ready`.
- The engine handoff must make it obvious that courtesy acts across pairs (`east <-> west`, `south <-> north`) and that Story `3B.3` is the next legal action owner for `COURTESY_PASS`.
- Clear or archive second-Charleston-only vote / pass bookkeeping that should no longer affect courtesy validation.
- If protocol additions are needed for courtesy-ready rendering or reconnect restore, expose only safe pair / progress metadata, not future selected tile IDs.

### Suggested File Targets

| File | Change |
|------|--------|
| `packages/shared/src/types/actions.ts` | Add `CharlestonVoteAction` and extend `GameAction` |
| `packages/shared/src/types/game-state.ts` | Extend `CharlestonState`, `CharlestonStatus`, and `ResolvedAction` for vote + courtesy-ready handoff |
| `packages/shared/src/types/protocol.ts` | Add only safe vote / courtesy Charleston view metadata if needed |
| `packages/shared/src/engine/actions/charleston.ts` | Add vote handling and refactor pass sequencing / blind-pass logic to be stage-aware |
| `packages/shared/src/engine/actions/charleston.test.ts` | Add vote, reversed-pass, courtesy-ready, and no-leak coverage |
| `packages/shared/src/engine/game-engine.ts` | Register `CHARLESTON_VOTE` |
| `packages/shared/src/index.ts` | Export new Charleston action / helpers |
| `packages/shared/src/types/game-state.test.ts` | Keep state / action unions exhaustive |
| `packages/server/src/websocket/state-broadcaster.ts` | Extend filtered Charleston view safely |
| `packages/server/src/websocket/state-broadcaster.test.ts` | Add vote / no-leak assertions |
| `packages/server/src/websocket/join-handler.test.ts` | Preserve reconnect restore guarantees if Charleston view changes |
| `packages/server/src/websocket/action-handler.test.ts` | Extend shared-action flow coverage for `CHARLESTON_VOTE` |
| `packages/server/src/websocket/ws-server.test.ts` | Update any start / resync expectations touched by Charleston state shape changes |
| `packages/server/src/integration/full-game-flow.test.ts` | Add end-to-end vote and reversed-pass coverage |
| `packages/client/src/components/dev/TestHarness.vue` | Update only if the dev harness needs new safe Charleston mock state to stay aligned with protocol |
| `packages/client/src/components/dev/TestHarness.test.ts` | Adjust only if the dev harness Charleston shape changes |

### Existing Code To Reuse

- **`handleCharlestonPass()`** in `packages/shared/src/engine/actions/charleston.ts` for current validate / lock / resolve flow.
- **`getCharlestonTargetSeat()` / `getCharlestonTargetPlayerId()`** in `packages/shared/src/engine/actions/charleston.ts` for seat math; keep all direction mapping centralized.
- **`buildPublicCharlestonView()` / `buildPlayerView()`** in `packages/server/src/websocket/state-broadcaster.ts` as the filtering boundary for any new Charleston metadata.
- **`createPlayState()` / `createTestState()` / `fastForwardToPlayPhase()`** in `packages/shared/src/testing/` to preserve non-Charleston test ergonomics.
- **`handleChallengeVote()`** in `packages/shared/src/engine/actions/challenge.ts` as a pattern reference for vote collection, duplicate-vote rejection, and resolution timing. Reuse the validate / collect / early-resolve pattern, but do **not** copy its exact rules because second Charleston requires unanimity and early rejection on the first "no".
- **Story `3B.1` artifact** in `_bmad-output/implementation-artifacts/3b-1-first-charleston-with-blind-pass-enforcement.md` for handoff expectations, file targets, and prior review findings.

### Critical Gotchas

1. **`getCharlestonState()` currently rejects anything not in `status: "passing"`.** Vote-ready handling will not work until vote logic is added intentionally.
2. **Do not duplicate the pass engine for the second Charleston.** Reversed order must reuse the first-Charleston machinery with stage-aware sequencing.
3. **Blind-pass privacy shifts from `left` to `right` in Story `3B.2`.** The hidden-across mechanism must follow the third pass of the current Charleston stage.
4. **Any `accept: false` ends the vote immediately.** Do not wait for the remaining 3 votes once a "no" exists.
5. **Tile IDs, never indices.** Hidden / revealed rack timing makes index-based logic especially brittle here.
6. **Other players' vote choices are not automatically public.** Unless a specific UI requirement needs more, prefer aggregate or self-only metadata instead of per-player accept / reject details.
7. **Do not jump to `play` from Story `3B.2`.** Courtesy negotiation and the eventual East discard handoff belong to Story `3B.3`.
8. **Do not import Story `3B.5` disconnect behavior here.** Default-"No" after grace and auto-pass behavior are later server concerns, not part of this shared-engine story.

### Testing Standards

- Co-located tests only.
- Add zero-mutation coverage for every new rejection reason introduced by vote handling.
- Keep Charleston tests blackbox-focused: action in, resulting state / reason out.
- Add at least one end-to-end WebSocket test that proves vote-ready -> unanimous yes -> reversed passes -> courtesy-ready flow works through serialized `STATE_UPDATE` messages.
- Add at least one early-"no" integration test proving the engine skips second Charleston immediately and does not wait for more votes.
- Preserve no-leak assertions through JSON stringification for hidden across tiles, locked pass tile IDs, and any new vote metadata.
- Preserve reconnect coverage if Charleston view shape changes.

### Git Intelligence

Recent commit titles are still dominated by Epic `5A` retrospective and UI work:

- `chore: reconcile Epic 5A retrospective findings and update planning artifacts`
- `docs: add Epic 5A retrospective documentation`
- `feat(SharedPrimitives): extract shared Epic 5A UI primitives`
- `feat(KeyboardAccessibility): implement keyboard navigation and accessibility features`
- `feat(GameStatus): implement turn indicator, wall counter, and scoreboard UI`

Actionable takeaways:

- The current repo's best Charleston guidance comes from the existing `3B.1` code and story artifact, not recent commit history.
- Continue the repo pattern of targeted state / protocol edits plus focused shared and server regression tests.
- Respect the Epic `3B` execution gate instead of assuming live client-state integration already landed.

### Latest Technical Information

- No new dependency is justified for this story. The existing shared TypeScript engine, Fastify / `ws` server path, and filtered protocol model are sufficient.
- Continue using `vite-plus/test` for touched tests.
- The architecture already expects `CHARLESTON_VOTE` and Charleston-specific resolved actions; the implementation work here is aligning current code with that documented contract, not introducing a new transport or framework layer.

### Scope Boundaries

- This story **does** implement:
  - `CHARLESTON_VOTE`
  - unanimous second-Charleston entry
  - reversed `left -> across -> right` pass flow
  - second-Charleston blind-pass privacy on `right`
  - courtesy-ready state handoff for Story `3B.3`

- This story does **not** implement:
  - courtesy count negotiation or `COURTESY_PASS` resolution (`3B.3`)
  - inline Charleston vote UI, `CharlestonZone`, or `TileSelectionAction` (`3B.4`)
  - disconnect default-"No" or auto-pass timers (`3B.5`)
  - live client integration layer follow-through from Epic `5A` retro items

### Validation Checklist

- [ ] `CHARLESTON_VOTE` exists and is only accepted during the second-Charleston vote-ready window
- [ ] A single `accept: false` vote skips the second Charleston immediately
- [ ] Four explicit `accept: true` votes are required to start the second Charleston
- [ ] Reversed pass order is `left -> across -> right` and still resolves simultaneously for all 4 players
- [ ] Across-received tiles stay hidden before the second-Charleston `right` lock
- [ ] Hidden tiles, locked pass tile IDs, and unsafe vote details do not leak through filtered WebSocket views
- [ ] The story ends in courtesy-ready state for `3B.3`, not `play`
- [ ] No courtesy negotiation, UI componentization, or disconnect fallback logic scope-crept into this implementation

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic `3B` overview, Story `3B.2`, Story `3B.3`, execution gate]
- [Source: `_bmad-output/planning-artifacts/gdd.md` - full Charleston structure, unanimous second vote, blind-pass rule, Joker legality, disconnect separation]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` - server-authoritative state, `CHARLESTON_VOTE` contract, `STATE_UPDATE`, Charleston phase handling, reconnect expectations]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - no optimistic UI, no gameplay modals, second-Charleston vote UI expectation, Charleston action-zone constraints]
- [Source: `_bmad-output/project-context.md` - blind-pass timing, server authority, tile-ID rule]
- [Source: `_bmad-output/implementation-artifacts/3b-1-first-charleston-with-blind-pass-enforcement.md` - vote-ready handoff, prior review learnings, execution gate, file targets]
- [Source: `packages/shared/src/engine/actions/charleston.ts` - current first-Charleston engine helpers, hardcoded pass order, hidden-across reveal logic]
- [Source: `packages/shared/src/types/game-state.ts` - current Charleston state, status, and resolved-action shape]
- [Source: `packages/shared/src/types/actions.ts` - current action union lacks `CHARLESTON_VOTE`]
- [Source: `packages/shared/src/types/protocol.ts` - current filtered Charleston player-view shape]
- [Source: `packages/server/src/websocket/state-broadcaster.ts` - per-player Charleston filtering boundary]
- [Source: `packages/server/src/integration/full-game-flow.test.ts` - existing vote-ready end-to-end Charleston coverage]
- [Source: `packages/shared/src/engine/actions/challenge.ts` - reusable vote-collection pattern reference]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `rg` searches over Epic `3B`, Charleston architecture, UX constraints, previous `3B.1` artifact handoff notes, and current Charleston engine / protocol files
- Targeted verification runs:
  - `vp test run src/engine/actions/charleston.test.ts`
  - `vp test run src/types/game-state.test.ts`
  - `vp test run src/websocket/state-broadcaster.test.ts`
  - `vp test run src/integration/full-game-flow.test.ts`
  - `vp test run src/websocket/join-handler.test.ts`
  - `pnpm test && pnpm run typecheck && vp lint`

### Implementation Plan

- Add shared vote contracts and courtesy-ready handoff state without breaking the existing filtered Charleston protocol boundary.
- Refactor the current Charleston pass engine so stage-aware order and blind-pass rules cover both Charlestons from one code path.
- Extend shared and server regression coverage through vote-ready, early "no", unanimous "yes", reversed passes, no-leak guarantees, and courtesy-ready handoff.

### Completion Notes List

- Story context created from Epic `3B` planning artifacts, Story `3B.1` handoff notes, current Charleston engine code, and existing server filtering / integration tests.
- Added `CHARLESTON_VOTE`, Charleston vote bookkeeping, courtesy-ready pairings, and resolved-action variants for second-Charleston vote acceptance / rejection.
- Generalized Charleston pass sequencing and blind-pass reveal rules so both Charlestons run through one stage-aware shared engine and the second Charleston now hands off to courtesy-ready instead of `play`.
- Extended filtered Charleston protocol views with safe aggregate vote / courtesy metadata (`votesReceivedCount`, `myVote`, `courtesyPairings`) without leaking raw vote maps, hidden across tiles, or locked pass tile IDs.
- Added shared, broadcaster, integration, and reconnect regression coverage for unanimous yes, early no, reversed pass order, second blind-pass privacy, courtesy-ready handoff, and reconnect-safe vote-ready restoration.
- Final validation passed with `pnpm test && pnpm run typecheck && vp lint`.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3b-2-second-charleston-vote-reversed-passes.md`
- `packages/shared/src/types/actions.ts`
- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/types/game-state.test.ts`
- `packages/shared/src/engine/state/create-game.ts`
- `packages/shared/src/engine/game-engine.ts`
- `packages/shared/src/engine/actions/charleston.ts`
- `packages/shared/src/engine/actions/charleston.test.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/integration/full-game-flow.test.ts`
- `packages/server/src/websocket/join-handler.test.ts`

### Change Log

- 2026-04-01: Created Story `3B.2` context with explicit vote-ready handoff, reversed-pass guardrails, courtesy-ready boundary, and no-leak testing guidance.
- 2026-04-01: Implemented second-Charleston vote handling, reversed pass sequencing, courtesy-ready handoff, reconnect-safe filtered Charleston views, and shared/server regression coverage.

### Status

done

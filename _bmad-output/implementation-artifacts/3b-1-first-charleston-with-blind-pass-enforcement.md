# Story 3B.1: First Charleston with Blind Pass Enforcement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **player**,
I want **to participate in the mandatory first Charleston (Right, Across, Left) where the third pass enforces blind selection before revealing received tiles**,
so that **the pre-game ritual plays correctly with the strategic blind pass rule intact (FR32, FR35)**.

## Acceptance Criteria

1. **AC1 - Start-of-game Charleston entry:** Given the host starts a game and tiles are dealt, when the initial game state is created, then `gamePhase` is `"charleston"`, the first Charleston is active, the current direction is `"right"`, all 4 players are active simultaneously, and the state is ready to accept `CHARLESTON_PASS` actions.
2. **AC2 - Right pass resolution:** Given the Right pass is active, when all 4 players submit exactly 3 valid tile IDs via `CHARLESTON_PASS`, then the server resolves the swap simultaneously, each player's outgoing tiles are removed from their rack, each player receives 3 tiles from the player on their left, and a `CHARLESTON_PHASE_COMPLETE` resolved action is emitted for direction `"right"`.
3. **AC3 - Across pass resolution:** Given the Across pass is active, when all 4 players submit exactly 3 valid tile IDs, then the server resolves the swap simultaneously with the across player and emits `CHARLESTON_PHASE_COMPLETE` for direction `"across"`.
4. **AC4 - Blind-pass gating on Left:** Given the Left pass begins after the Across pass, when a player has not yet locked their Left pass selection, then the 3 tiles received from Across are not visible in that player's rack, are not available for selection, and are not leaked through the filtered player view or resolved action payloads.
5. **AC5 - Reveal after lock:** Given a player locks their Left pass selection, when the server accepts that `CHARLESTON_PASS`, then that player's hidden Across tiles become eligible to reveal only after the lock point, while the outgoing Left-pass exchange itself still waits for all 4 players to submit.
6. **AC6 - End-of-first-Charleston handoff:** Given all 3 passes are complete, when the Left pass resolves, then the first Charleston ends, racks reflect all completed exchanges, and the shared state advances to a second-Charleston vote-ready state for Story `3B.2` rather than jumping to `play`.
7. **AC7 - Pass-size validation:** Given a player submits fewer or more than 3 tile IDs for `CHARLESTON_PASS`, when validating, then the action is rejected with `{ accepted: false, reason: "MUST_PASS_THREE_TILES" }` and state is unchanged.
8. **AC8 - Tile-ownership validation:** Given a player submits a tile ID not currently available in their visible rack for the active Charleston pass, when validating, then the action is rejected with `{ accepted: false, reason: "TILE_NOT_IN_RACK" }` and state is unchanged.
9. **AC9 - Duplicate / repeat submission protection:** Given a player has already locked a submission for the active pass, when they submit again or include duplicate tile IDs in the same action, then the action is rejected with zero mutations.

## Tasks / Subtasks

- [x] Task 1: Add Charleston engine state and action contracts in `shared/` (AC: 1-9)
  - [x] 1.1 Add a forward-compatible internal `CharlestonState` subtree to `packages/shared/src/types/game-state.ts` rather than scattering ad hoc Charleston fields across `GameState`.
  - [x] 1.2 Add `CHARLESTON_PASS` to `packages/shared/src/types/actions.ts` with `playerId` and `tileIds: readonly string[]`.
  - [x] 1.3 Add the minimum new `ResolvedAction` variants needed for this story, including `CHARLESTON_PHASE_COMPLETE`; do not leak hidden tile IDs in resolved payloads.
  - [x] 1.4 Extend `packages/shared/src/types/protocol.ts` with a **filtered** Charleston view type for `PlayerGameView` / `SpectatorGameView`; do not expose the raw internal `CharlestonState` over WebSocket.
  - [x] 1.5 Add or update type-level tests so the new unions remain exhaustive and compile cleanly.

- [x] Task 2: Change game start to enter Charleston without breaking existing play-phase test helpers (AC: 1, 6)
  - [x] 2.1 Update `packages/shared/src/engine/state/create-game.ts` so the real game flow starts in `gamePhase: "charleston"` with first-pass direction `"right"` instead of jumping straight to `play`.
  - [x] 2.2 Keep `currentTurn` anchored to East as the eventual first discarder, but ensure Charleston logic does **not** depend on `turnPhase` sequencing.
  - [x] 2.3 Update `packages/shared/src/engine/actions/game-flow.ts` / tests so `START_GAME` produces a Charleston-starting state.
  - [x] 2.4 Preserve the usefulness of `createPlayState()` / `createTestState()` for the many existing play-phase tests by introducing an explicit fast-forward helper or equivalent test-only path rather than letting the entire suite accidentally flip to Charleston.

- [x] Task 3: Implement simultaneous first-Charleston pass resolution in a dedicated shared action module (AC: 2, 3, 7, 8, 9)
  - [x] 3.1 Create `packages/shared/src/engine/actions/charleston.ts` for Charleston-specific validation and mutation helpers.
  - [x] 3.2 Centralize seat-direction mapping there so Right / Across / Left are derived from `SEATS` once and reused consistently.
  - [x] 3.3 Record each player's locked submission for the active pass without resolving early.
  - [x] 3.4 When all 4 submissions exist, resolve the exchange simultaneously, then advance the Charleston direction state.
  - [x] 3.5 Allow Jokers to be passed normally in Charleston per `FR36`; do not carry Story `3B.5`'s auto-pass non-Joker courtesy rule into manual pass validation.

- [x] Task 4: Implement blind Across-to-Left gating without leaking hidden information (AC: 4, 5)
  - [x] 4.1 On Across completion, store the received tiles in internal pending Charleston state instead of immediately appending them to each player's visible rack.
  - [x] 4.2 For the Left pass, validate selections only against the currently visible rack, excluding the hidden Across tiles.
  - [x] 4.3 Reveal a player's hidden Across tiles only after that player has locked their Left pass selection; do not require all 4 players to lock before that player's reveal becomes legal.
  - [x] 4.4 Ensure `buildPlayerView()` never leaks hidden Across tile identities, pending incoming tiles, or other players' selected pass tile IDs through `myRack`, `charleston`, or `resolvedAction`.

- [x] Task 5: Wire Charleston through engine dispatch and state broadcasting (AC: 1-6)
  - [x] 5.1 Register `CHARLESTON_PASS` in `packages/shared/src/engine/game-engine.ts`.
  - [x] 5.2 Export the new Charleston types / helpers from `packages/shared/src/index.ts`.
  - [x] 5.3 Update `packages/server/src/websocket/state-broadcaster.ts` so filtered player views include safe Charleston metadata needed for future live integration and reconnect, but never hidden tile identities.
  - [x] 5.4 Update server-side start-game / state-sync tests whose current expectations assume `gamePhase: "play"` immediately after `START_GAME`.

- [x] Task 6: Add focused shared and server test coverage for Charleston start / pass / blind gating (AC: 1-9)
  - [x] 6.1 Create `packages/shared/src/engine/actions/charleston.test.ts` with blackbox coverage for Right, Across, and Left pass sequencing.
  - [x] 6.2 Add zero-mutation rejection tests for wrong phase, duplicate submission, duplicate tile IDs, wrong tile count, and tile-not-in-rack paths.
  - [x] 6.3 Add tests proving hidden Across tiles are absent from the visible rack before lock and appear only after the relevant player's Left-pass lock.
  - [x] 6.4 Add tests proving simultaneous exchange correctness for all 4 seats using deterministic fixtures and `SEATS`-based assertions rather than hardcoded seat math.
  - [x] 6.5 Add `state-broadcaster.test.ts` coverage proving Charleston hidden tiles and other players' submissions do not leak via JSON stringification.
  - [x] 6.6 Update `create-game.test.ts`, `game-flow.test.ts`, `ws-server.test.ts`, `action-handler.test.ts`, and any helper tests affected by the start-phase change.

- [x] Task 7: Respect story boundaries and forward compatibility (AC: 6)
  - [x] 7.1 End this story at "second Charleston vote ready" state only; Story `3B.2` owns vote handling and reversed second Charleston sequencing.
  - [x] 7.2 Do **not** implement courtesy pass (`3B.3`), Charleston UI / `TileSelectionAction` (`3B.4`), or disconnect auto-pass (`3B.5`) here.
  - [x] 7.3 Keep enough Charleston state shape for later stories to extend cleanly instead of forcing another breaking protocol redesign.

- [x] Task 8: Validation and backpressure gate (AC: all)
  - [x] 8.1 Run targeted shared tests for Charleston plus touched server tests.
  - [x] 8.2 Run `pnpm test`.
  - [x] 8.3 Run `pnpm run typecheck`.
  - [x] 8.4 Run `vp lint`.
  - [x] 8.5 Verify every acceptance criterion maps to at least one automated test.

### Review Follow-ups (AI)

- [x] [AI-Review][High] Add a shared blackbox test that completes the full Right -> Across -> Left sequence, asserts the `"left"` `CHARLESTON_PHASE_COMPLETE` resolved action, and verifies the final handoff is second-Charleston vote-ready (`stage: "second"`, `status: "vote-ready"`, `currentDirection: null`) so AC6 and Task 8.5 are actually proven by automation. [`packages/shared/src/engine/actions/charleston.test.ts:105`]
- [x] [AI-Review][Medium] Add at least one real WebSocket/integration test that drives `CHARLESTON_PASS` end-to-end instead of fast-forwarding straight to `play`, and assert the serialized state updates continue to hide other players' locked selections and hidden Across tiles while Charleston is active. [`packages/server/src/integration/full-game-flow.test.ts:225`]
- [x] [AI-Review][High] Fix Charleston seat-direction mapping so first Charleston passes actually resolve Right -> Across -> Left from the project's documented seat order (`SEATS = east -> south -> west -> north`, counterclockwise / "to the right"). The current implementation sends `right` to the previous seat and `left` to the next seat, reversing both pass directions. [`packages/shared/src/engine/actions/charleston.ts`]
- [x] [AI-Review][Medium] Send the active filtered game view on token reconnection instead of `LobbyState`, so reconnecting during Charleston immediately restores rack state and safe Charleston metadata without requiring a separate resync request. Add coverage that reconnects mid-Charleston and asserts the first reconnect payload already contains `gamePhase: "charleston"`, `myRack`, and filtered `charleston` state. [`packages/server/src/websocket/join-handler.ts`]
- [x] [AI-Review][Medium] Strengthen Charleston direction coverage so tests assert exact seat-to-seat transfers directly (for example, East `right` -> South and East `left` -> North) instead of deriving expectations through `getCharlestonTargetPlayerId()`. The current helper-coupled assertions can pass even when the production direction mapping is wrong. [`packages/shared/src/engine/actions/charleston.test.ts`]

## Dev Notes

### Execution Gate

- **Do not start Epic 3B implementation as if the client were already live-integrated.** Epic `5A` retro follow-through explicitly says the table still lacks the real client integration layer (`useWebSocket`, `useGameState`, room/table orchestration) and that Epic `3B` assumptions need a short planning review before execution.
- The story can still be contexted now, but the dev agent should treat the following as active prerequisites:
  - `5a-retro-4-client-integration-layer-before-epic-3b`
  - `5a-retro-5-epic-3b-planning-review`
- If implementation is forced before those gates are done, constrain this story to shared/server Charleston state + protocol groundwork and do **not** build Charleston UI on mock-only props.

### Current Implementation State

- `createGame()` currently deals tiles and jumps straight to `gamePhase: "play"` with East already in `turnPhase: "discard"`.
- `GamePhase` already includes `"charleston"`, but `GameState`, `GameAction`, `ResolvedAction`, and `PlayerGameView` do **not** yet contain Charleston-specific state or actions.
- There is no `packages/shared/src/engine/actions/charleston.ts` yet.
- `buildPlayerView()` currently forwards `callWindow`, `pendingMahjong`, and other public game state directly; a naive Charleston addition here would leak hidden Across tiles or other players' submitted pass selections.
- The server action path is already generic enough to carry new shared-engine actions once they are registered: `handleActionMessage()` authenticates `playerId`, calls `handleAction()`, and broadcasts the resulting filtered view.
- The current client package still has no real `useWebSocket` / `useGameState` integration layer in repo reality, despite those paths appearing in planning artifacts.

### Architecture Patterns

- **Validate-then-mutate** in `shared/` remains mandatory: read-only validation first, then mutate only on accepted Charleston submissions.
- **Server authority** remains absolute: clients submit `CHARLESTON_PASS`; the server validates, mutates, and broadcasts. No optimistic rack mutations in client code.
- **Filtered views over raw state** are a security and rules requirement here. Internal Charleston state may hold hidden pending tiles, but protocol views must not reveal them prematurely.
- **Pure shared logic** only: no `setTimeout`, browser APIs, or Node APIs in `shared/`. Timer-driven Charleston reconnect / auto-pass belongs to later server work in Story `3B.5`, not this story.

### Key Implementation Decisions

**1. Introduce a real Charleston subtree, not top-level sprawl.**
Use one `charleston` object in `GameState` to represent current pass direction, per-player locked submissions, pending hidden Across tiles, and the handoff state into Story `3B.2`.

**2. Separate internal state from protocol state.**
Do **not** expose raw `CharlestonState` in `PlayerGameView`. The internal engine needs actual tile identities for hidden pending receipts; the client view should receive only safe, filtered Charleston metadata.

**3. Keep simultaneous-pass logic in `shared/`.**
Seat math for Right / Across / Left, per-player submission tracking, and simultaneous exchange resolution belong in shared game logic so server and client stay aligned on one source of truth.

**4. Protect existing play-phase test helpers on purpose.**
The shared test suite currently depends heavily on `createPlayState()` / `createTestState()` for post-Charleston gameplay tests. Preserve that convenience with an explicit helper rather than letting dozens of unrelated tests fail because game start semantics changed.

**5. End in vote-ready state only.**
Story `3B.1` should finish by preparing the second-Charleston vote state; Story `3B.2` owns the actual vote flow and reversed pass order.

### Suggested File Targets

| File | Change |
|------|--------|
| `packages/shared/src/types/game-state.ts` | Add internal Charleston state types and new resolved actions |
| `packages/shared/src/types/actions.ts` | Add `CharlestonPassAction` to `GameAction` union |
| `packages/shared/src/types/protocol.ts` | Add filtered Charleston view types for player/spectator state |
| `packages/shared/src/engine/state/create-game.ts` | Start games in `gamePhase: "charleston"` |
| `packages/shared/src/engine/actions/game-flow.ts` | Keep `START_GAME` aligned with Charleston-first flow |
| `packages/shared/src/engine/actions/charleston.ts` | New Charleston validation / resolution helpers |
| `packages/shared/src/engine/actions/charleston.test.ts` | New focused Charleston tests |
| `packages/shared/src/engine/game-engine.ts` | Register `CHARLESTON_PASS` |
| `packages/shared/src/index.ts` | Export new Charleston types / helpers |
| `packages/shared/src/testing/fixtures.ts` | Preserve / clarify play-phase fixture helper semantics |
| `packages/shared/src/testing/helpers.ts` | Preserve / add fast-forward helper for play-phase tests |
| `packages/shared/src/engine/state/create-game.test.ts` | Update start-state expectations |
| `packages/server/src/websocket/state-broadcaster.ts` | Filter Charleston view safely |
| `packages/server/src/websocket/state-broadcaster.test.ts` | Add no-leak Charleston coverage |
| `packages/server/src/websocket/action-handler.test.ts` | Update start-game expectations and touched action flows |
| `packages/server/src/websocket/ws-server.test.ts` | Update resync expectation after `START_GAME` |

### Existing Code To Reuse

- **`SEATS`** in `packages/shared/src/constants.ts` for seat-order math. Do not hardcode seat relationships in multiple places.
- **`createGame()` / `handleStartGame()`** as the current game-entry path; extend them instead of adding a parallel start action.
- **`createPlayState()` / `createTestState()` / `injectTilesIntoRack()`** in `packages/shared/src/testing/` for deterministic Charleston test setup and regression protection.
- **`buildPlayerView()`** as the existing filtering boundary. Charleston safety belongs there.
- **Existing server action pipeline** in `packages/server/src/websocket/action-handler.ts` and `state-broadcaster.ts`; reuse it instead of inventing Charleston-specific transport code.

### Critical Gotchas

1. **Hidden Across tiles must not leak anywhere.** Not in `myRack`, not in `charleston`, not in `resolvedAction`, and not through JSON-stringified `STATE_UPDATE`.
2. **Other players' pass selections are also hidden information.** Even if their submission is locked, their selected tile IDs are not public until the exchange resolves.
3. **Jokers are legal manual Charleston passes.** Do not accidentally import Story `3B.5`'s reconnect auto-pass courtesy rule into this story's validation path.
4. **Tile IDs, never indices.** Charleston selection must use stable tile IDs because rack order can change and hidden-reveal timing will make index-based logic especially brittle.
5. **Simultaneous means simultaneous.** Do not resolve one player's pass at a time; lock all submissions, then apply the exchange in one deterministic batch per direction.
6. **`currentTurn` is not the active Charleston actor model.** All four players act simultaneously during Charleston, so do not try to serialize pass order through turn advancement.
7. **Architecture docs mention `components/actions/` and `components/charleston/`, but repo reality differs.** For this story, the important work is in `shared/` and server filtering; do not reorganize client folders as part of a rules-engine story.
8. **No `setTimeout` in `shared/`.** Story `3B.5` can schedule grace-period auto-pass on the server; Story `3B.1` must stay pure.

### Testing Standards

- Co-located tests only.
- For every rejection reason added here, include a **zero-mutation** test.
- Use deterministic seeds / fixtures so seat-direction exchange assertions are stable.
- Add explicit server view-filtering assertions that hidden Charleston information does not leak via JSON stringification, following the same spirit as the existing rack-secrecy tests.
- Keep the Charleston tests blackbox-focused: action in, resulting state / reason out. Avoid implementation-coupled assertions.

### Git Intelligence

Recent repo patterns relevant to this story:

- `chore: reconcile Epic 5A retrospective findings and update planning artifacts`
- `docs: add Epic 5A retrospective documentation`
- `feat(SharedPrimitives): extract shared Epic 5A UI primitives`
- `feat(KeyboardAccessibility): implement keyboard navigation and accessibility features`
- `feat(GameStatus): implement turn indicator, wall counter, and scoreboard UI`

Actionable takeaways:

- The most recent work was planning correction plus UI hardening, not live-state integration.
- The repo already has a strong pattern of targeted edits plus focused tests; follow that instead of broad speculative restructuring.
- Epic `3B` must respect the retrospective gate rather than assuming UI integration already landed.

### Latest Technical Information

- No new dependency is justified for this story. The existing TypeScript / shared-engine / WebSocket stack is sufficient.
- Continue using `vite-plus/test` for touched tests.
- The current protocol and filtering layer already support optional state extensions; the key requirement is **filtered Charleston view design**, not a transport-library change.

### Scope Boundaries

- This story does **not** implement:
  - second Charleston voting logic (`3B.2`)
  - courtesy pass negotiation (`3B.3`)
  - Charleston UI / `TileSelectionAction` (`3B.4`)
  - disconnect grace-period auto-pass (`3B.5`)
  - client live integration layer follow-through work from `5A` retro items

### Validation Checklist

- [ ] `START_GAME` now enters `gamePhase: "charleston"` with first-pass direction `"right"`
- [ ] Existing play-phase fixtures still exist for unrelated tests
- [ ] `CHARLESTON_PASS` accepts exactly 3 unique tile IDs from the visible rack only
- [ ] Right / Across exchanges resolve simultaneously and deterministically from `SEATS`
- [ ] Across-received tiles stay hidden before Left-pass lock
- [ ] Hidden Across tiles and other players' submissions do not leak in filtered WebSocket views
- [ ] Story ends in vote-ready state for `3B.2`, not `play`
- [ ] No disconnect / courtesy / UI scope crept into this implementation

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic `3B` overview, Story `3B.1`, Epic `5A` retro gating note]
- [Source: `_bmad-output/planning-artifacts/gdd.md` - Charleston structure, blind passing rule, Joker legality, simultaneous social nature]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` - Charleston system, filtered player-view model, phase-specific reconnection context, file-location intent]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - Charleston as peak social moment, ritual friction, hidden-reveal expectations, graceful degradation]
- [Source: `_bmad-output/project-context.md` - server authority, shared-package rules, tile-ID rule, blind-pass timing, testing rules]
- [Source: `_bmad-output/implementation-artifacts/epic-5a-retro-2026-04-01.md` - Epic `3B` execution gate, client integration prerequisite, planning-review requirement]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-01.md` - backlog gate and future story-creation validation-checklist requirement]
- [Source: `packages/shared/src/engine/state/create-game.ts` - current start-of-game flow jumps straight to `play`]
- [Source: `packages/shared/src/types/game-state.ts` - `GamePhase` already includes `"charleston"` but no Charleston state exists yet]
- [Source: `packages/shared/src/types/protocol.ts` - current player view shape and filtering boundary]
- [Source: `packages/server/src/websocket/state-broadcaster.ts` - existing per-player filtering implementation]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `vp test run src/engine/state/create-game.test.ts src/engine/actions/game-flow.test.ts src/engine/game-engine.test.ts src/engine/actions/charleston.test.ts`
- `vp test run src/websocket/state-broadcaster.test.ts src/websocket/action-handler.test.ts src/websocket/ws-server.test.ts src/integration/full-game-flow.test.ts`
- `vp test run src/websocket/join-handler.test.ts src/integration/full-game-flow.test.ts`
- `vp test run src/websocket/join-handler.test.ts src/websocket/action-handler.test.ts src/integration/full-game-flow.test.ts`
- `vp test run` (`packages/shared`)
- `vp test run` (`packages/server`)
- `vp test run src/components/dev/TestHarness.test.ts`
- `pnpm test && pnpm run typecheck && vp lint`

### Implementation Plan

- Add an internal Charleston state/action/protocol slice in `shared/`, keeping hidden Across receipts private to the engine while exposing only filtered metadata over the protocol.
- Start the real game flow in `gamePhase: "charleston"` while preserving existing play-phase fixtures and dev-only harness flows with explicit fast-forward helpers instead of relying on the old `START_GAME` behavior.
- Cover the new Right/Across/Left sequencing, blind-pass reveal timing, and no-leak broadcasting rules with focused shared/server tests and repo-wide regression verification.

### Completion Notes List

- Added `CharlestonState`, `CHARLESTON_PASS`, filtered Charleston protocol views, and `CHARLESTON_PHASE_COMPLETE` so the shared engine can model first-Charleston sequencing without leaking hidden information.
- Implemented `packages/shared/src/engine/actions/charleston.ts` to validate three-tile submissions, reject duplicate/repeat/hidden-tile selections with zero mutations, and end in second-Charleston vote-ready state; follow-up review then corrected the Right/Left seat mapping to match the documented `SEATS` order.
- Updated `createGame()` / `START_GAME` to begin in `gamePhase: "charleston"` while preserving play-phase test ergonomics through `fastForwardToPlayPhase()` and a dev-harness-only fast-forward path.
- Updated `buildPlayerView()` / `buildSpectatorView()` to publish only safe Charleston metadata (`currentDirection`, submitted players, self hidden-tile count, self submission lock) and explicitly avoid hidden Across tile IDs or locked selections.
- Added focused shared/server coverage for start-state expectations, simultaneous pass resolution, blind Across-to-Left reveal timing, zero-mutation validation failures, and JSON no-leak guarantees; also updated affected client dev-harness tests to keep their intended play-phase scope.
- Execution gate handling: this story was intentionally constrained to shared/server Charleston groundwork plus safe protocol filtering; it did **not** implement the missing live client integration layer or claim to complete retro prerequisites `5a-retro-4-client-integration-layer-before-epic-3b` and `5a-retro-5-epic-3b-planning-review`.
- Final verification passed with `pnpm test && pnpm run typecheck && vp lint`.
- ✅ Resolved review finding [High]: added a shared blackbox Charleston completion test that proves the final Left-pass resolution emits `CHARLESTON_PHASE_COMPLETE` and hands off to second-Charleston vote-ready state.
- ✅ Resolved review finding [Medium]: added a real WebSocket integration test that drives `CHARLESTON_PASS` end-to-end and proves serialized `STATE_UPDATE` payloads keep locked selections and hidden Across tiles private while Charleston remains active.
- Fixed first-Charleston seat mapping so Right now passes East -> South and Left now passes East -> North, matching the documented `SEATS` order.
- Added direct seat-to-seat direction coverage that proves the Right and Left Charleston transfers without relying on the production helper under test.
- Restored the filtered active game view on token reconnection so a player reconnecting mid-Charleston immediately receives `gamePhase`, `myRack`, and safe `charleston` metadata in the first `STATE_UPDATE`.
- ✅ Resolved review finding [High]: corrected the Charleston right/left seat-direction mapping in `packages/shared/src/engine/actions/charleston.ts`.
- ✅ Resolved review finding [Medium]: token reconnection during Charleston now returns the filtered game view instead of a lobby snapshot.
- ✅ Resolved review finding [Medium]: strengthened Charleston direction coverage with direct seat-transfer assertions for Right and Left passes.
- ✅ Resolved review finding [High]: room-level disconnect/reconnect broadcasts now keep sending filtered active-game state to the other connected players instead of regressing them to lobby snapshots during Charleston.
- Final verification gate passed with `pnpm test && pnpm run typecheck && vp lint` (lint completed with existing repo warnings but no errors).
- Follow-up note for the next story: repo-wide lint warning cleanup was reduced from 175 warnings to 68, but the remaining warning backlog lives outside this story's touched Charleston files and should be addressed opportunistically in the next story that touches those areas rather than reopening `3B.1` for warning debt alone.

### File List

- `_bmad-output/implementation-artifacts/3b-1-first-charleston-with-blind-pass-enforcement.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/client/src/components/dev/TestHarness.test.ts`
- `packages/client/src/components/dev/TestHarness.vue`
- `packages/server/src/integration/full-game-flow.test.ts`
- `packages/server/src/websocket/join-handler.test.ts`
- `packages/server/src/websocket/join-handler.ts`
- `packages/server/src/websocket/action-handler.test.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/ws-server.test.ts`
- `packages/shared/src/engine/actions/charleston.test.ts`
- `packages/shared/src/engine/actions/charleston.ts`
- `packages/shared/src/engine/actions/game-flow.test.ts`
- `packages/shared/src/engine/game-engine.test.ts`
- `packages/shared/src/engine/game-engine.ts`
- `packages/shared/src/engine/state/create-game.test.ts`
- `packages/shared/src/engine/state/create-game.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/testing/fixtures.ts`
- `packages/shared/src/testing/helpers.ts`
- `packages/shared/src/types/actions.ts`
- `packages/shared/src/types/game-state.test.ts`
- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/protocol.ts`

### Change Log

- 2026-04-01: Implemented first-Charleston shared/server engine flow with blind Across-to-Left enforcement, filtered protocol/state broadcasting, explicit play-phase fast-forward helpers, and focused shared/server regression coverage.
- 2026-04-01: Code review added follow-up criteria for missing AC6 completion-proof coverage and missing end-to-end Charleston WebSocket exercise; story returned to in-progress.
- 2026-04-01: Addressed code review findings by adding shared Charleston completion coverage plus a real WebSocket end-to-end Charleston privacy test, then re-ran the full repo validation gate.
- 2026-04-01: Follow-up review confirmed a Charleston right/left seat-mapping bug, a reconnect state-restore gap, and a helper-coupled test gap; story remains in-progress pending fixes.
- 2026-04-01: Fixed Charleston right/left seat mapping, restored filtered Charleston reconnection state, strengthened direct seat-transfer coverage, and re-ran `pnpm test && pnpm run typecheck && vp lint`; story is ready for review.
- 2026-04-01: Fixed active-room disconnect/reconnect broadcasts to preserve filtered game views for non-reconnecting players, added regression coverage, re-ran the full gate, and marked the story done.
- 2026-04-01: Added explicit handoff note that the remaining repo lint warning backlog should be handled in the next story touching those files, not by reopening this completed Charleston story.

### Status

done

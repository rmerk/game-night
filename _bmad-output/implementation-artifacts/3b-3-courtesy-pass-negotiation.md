# Story 3B.3: Courtesy Pass Negotiation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **player**,
I want **to optionally exchange 0-3 tiles with the player sitting across, where both players independently choose their count and the lower count is used**,
so that **the final fine-tuning pass happens fairly with transparent negotiation (FR34)**.

## Acceptance Criteria

1. **AC1 - Courtesy-ready entry and action contract:** Given Story `3B.2` has already moved the engine to `gamePhase: "charleston"` with `stage: "courtesy"`, `status: "courtesy-ready"`, `currentDirection: null`, and `courtesyPairings` for the across-seat pairs, when a player in one of those pairs submits their courtesy choice, then the engine accepts a new `COURTESY_PASS` action with `{ playerId, count, tileIds }` only during that courtesy-ready window.
2. **AC2 - Same-count pair resolution:** Given both players in one courtesy pair submit the same `count` from `0` to `3`, when the second valid submission is accepted, then that pair resolves immediately and simultaneously using exactly that count.
3. **AC3 - Lower-count resolution on mismatch:** Given the two players in a courtesy pair submit different counts, when the pair resolves, then the lower count is used for both sides and only the first `N` tile IDs from the higher-count player's submitted `tileIds` array are actually exchanged.
4. **AC4 - Zero-count skip semantics:** Given either player in a courtesy pair submits `count: 0`, when the pair resolves, then no tiles are exchanged for that pair, the effective count is `0`, and the untouched tiles remain in both racks.
5. **AC5 - Pair-local completion before overall Charleston completion:** Given one courtesy pair has resolved but the other pair has not, when the first pair finishes, then the game remains in `gamePhase: "charleston"` with courtesy still active for the unresolved pair rather than transitioning to `play` early.
6. **AC6 - Final handoff into play:** Given both courtesy pairs have resolved or been skipped, when the final required courtesy submission is processed, then the Charleston phase ends, `gamePhase` transitions to `"play"`, the temporary Charleston state is cleared, and East begins the opening turn in discard-only mode without drawing first.
7. **AC7 - Narration-ready resolved payloads:** Given a courtesy pair resolves, when the resulting state update is broadcast, then the resolved action includes both players' requested counts plus the actual applied count so the UI can narrate outcomes like "Alice wanted 3, Carol wanted 2 - passing 2 each" without reconstructing negotiation details client-side.
8. **AC8 - Validation rejects invalid courtesy submissions with zero mutation:** Given a courtesy submission is made in the wrong phase, by a player not in an active courtesy pair, with `count` outside `0-3`, with duplicate tile IDs, with a `tileIds.length` that does not equal `count`, with tiles not currently visible in the player's rack, or after that player already locked a courtesy submission for the active pair, when validating, then the action is rejected with an appropriate reason and the game state is unchanged.
9. **AC9 - No-leak broadcasting and reconnect safety:** Given courtesy negotiation is active, when state is broadcast or a player reconnects, then filtered views reveal only safe courtesy metadata needed for restore and future UI work; they must never leak the partner's requested count or selected tile IDs before that pair resolves.

## Tasks / Subtasks

- [x] Task 1: Extend shared courtesy contracts from the existing courtesy-ready handoff (AC: 1, 5, 6, 7, 8, 9)
  - [x] 1.1 Add `CourtesyPassAction` to `packages/shared/src/types/actions.ts` and extend `GameAction` with `type: "COURTESY_PASS"`, `playerId`, `count`, and ordered `tileIds`.
  - [x] 1.2 Extend `packages/shared/src/types/game-state.ts` so `CharlestonState` can track courtesy submissions and resolved-pair progress without redesigning the already-landed `stage: "courtesy"` / `status: "courtesy-ready"` contract from Story `3B.2`.
  - [x] 1.3 Extend `ResolvedAction` with courtesy-specific variants (recommended: a lightweight lock/cast event plus a pair-resolution event carrying requested counts and applied count) so narration and integration tests do not need to infer negotiation outcomes from raw state diffs.
  - [x] 1.4 Update `packages/shared/src/types/protocol.ts` only with the minimum safe courtesy metadata needed for reconnect restore and future `3B.4` UI consumption; keep partner count / tile selection private until pair resolution.
  - [x] 1.5 Update any exhaustiveness tests affected by the new action / state / resolved-action unions.

- [x] Task 2: Implement courtesy-pass validation and pair resolution in the shared Charleston engine (AC: 1, 2, 3, 4, 5, 6, 8)
  - [x] 2.1 Add courtesy-specific validation to `packages/shared/src/engine/actions/charleston.ts` for wrong phase, unknown player, inactive pair membership, invalid count range, tile-count mismatch, duplicate tile IDs, invisible tile selection, and repeat submission.
  - [x] 2.2 Reuse the current Charleston helper patterns (`captureLockedTiles`, simultaneous removal/application, seat math, filtered-state assumptions) instead of creating a parallel courtesy-only engine file.
  - [x] 2.3 Resolve a courtesy pair only when both members of that pair have submitted valid choices; one player's lock must not resolve or reveal the partner's requested count early.
  - [x] 2.4 Apply lower-count trimming deterministically from the submitted `tileIds` order; do not sort, randomize, or re-select tiles on the player's behalf.
  - [x] 2.5 Support `count: 0` as an explicit skip for a pair without mutating either rack.
  - [x] 2.6 Keep the game in courtesy mode until both across-seat pairs are complete, then clear Charleston state and hand off cleanly into `play`.

- [x] Task 3: Preserve correct play-start semantics after courtesy completion (AC: 5, 6, 7)
  - [x] 3.1 Transition from `gamePhase: "charleston"` to `gamePhase: "play"` only after both courtesy pairs resolve or skip.
  - [x] 3.2 Preserve the existing opening-turn contract established by `createGame()`: East is still the first discarder and must not draw before discarding.
  - [x] 3.3 Clear stale Charleston bookkeeping (`votesByPlayerId`, `hiddenAcrossTilesByPlayerId`, courtesy submissions, and pair-progress state) when the game enters play so later phases are not polluted by pre-game state.

- [x] Task 4: Wire courtesy handling through engine dispatch, exports, and filtered server views (AC: 1, 6, 7, 9)
  - [x] 4.1 Register `COURTESY_PASS` in `packages/shared/src/engine/game-engine.ts` and export any new action / helper types from `packages/shared/src/index.ts`.
  - [x] 4.2 Update `packages/server/src/websocket/state-broadcaster.ts` so courtesy-ready / courtesy-in-progress views remain reconnect-safe and filtered, exposing only self-safe submission state plus public pair metadata when truly needed.
  - [x] 4.3 Preserve the current reconnect guarantee: the first reconnect `STATE_UPDATE` during courtesy must restore the filtered active game view, not regress to a lobby-style snapshot.
  - [x] 4.4 Keep transport behavior inside the existing action-handler / broadcaster pipeline; do not introduce Charleston-specific WebSocket routes or server-only side channels.

- [x] Task 5: Add focused shared and server coverage for courtesy negotiation, no-leak guarantees, and play handoff (AC: 1-9)
  - [x] 5.1 Extend `packages/shared/src/engine/actions/charleston.test.ts` with blackbox tests for same-count exchange, lower-count trimming, zero-count skip, wrong-phase rejection, invalid count, tile-count mismatch, duplicate tile IDs, invisible tile selection, and repeat submission.
  - [x] 5.2 Add at least one shared test proving one courtesy pair can resolve while the other remains pending and that the game does not transition to `play` early.
  - [x] 5.3 Add a shared test proving the final courtesy resolution clears Charleston state and enters `play` with East still in discard-only opening-turn state.
  - [x] 5.4 Extend `packages/server/src/websocket/state-broadcaster.test.ts` so serialized `STATE_UPDATE` payloads do not leak the partner's requested count or selected tile IDs before pair resolution.
  - [x] 5.5 Extend `packages/server/src/integration/full-game-flow.test.ts` with a real WebSocket courtesy flow that starts from `courtesy-ready`, resolves both across-seat pairs, verifies lower-count narration payloads, and confirms the final transition into `play`.
  - [x] 5.6 Update reconnect / join-handler coverage if courtesy metadata changes so courtesy negotiation survives reconnect with the same filtering guarantees established in Stories `3B.1` and `3B.2`.

- [x] Task 6: Respect scope boundaries and complete validation gate (AC: all)
  - [x] 6.1 Do **not** build `CharlestonZone`, `TileSelectionAction`, vote buttons, or inline courtesy UI here; Story `3B.4` owns that UI work.
  - [x] 6.2 Do **not** add disconnect grace periods, auto-pass fallback, or timeout scheduling here; Story `3B.5` owns those server-timer behaviors.
  - [x] 6.3 Do **not** treat the Epic `5A` client-integration retro items as completed; keep any client changes minimal and only in service of safe protocol alignment or dev-harness realism if strictly required.
  - [x] 6.4 Run targeted Charleston tests plus touched server integration tests.
  - [x] 6.5 Run `pnpm test`.
  - [x] 6.6 Run `pnpm run typecheck`.
  - [x] 6.7 Run `vp lint`.
  - [x] 6.8 Verify each acceptance criterion is covered by at least one automated test, especially lower-count trimming, zero-count skip, no-leak courtesy privacy, and the final `charleston -> play` handoff.

## Dev Notes

### Execution Gate

- **Epic `3B` still carries the active Epic `5A` retro prerequisites** `5a-retro-4-client-integration-layer-before-epic-3b` and `5a-retro-5-epic-3b-planning-review`.
- **Execution policy for this story:** this can proceed as a shared / server courtesy-negotiation slice because Story `3B.4` still owns the real Charleston UI. Do not use this story to pretend the live client integration layer is already complete.
- Avoid mock-only UI scope creep. If a minimal protocol or dev-harness alignment is required, keep it narrowly tied to courtesy restore / filtering behavior.

### Current Implementation State

- Story `3B.2` already leaves the engine in `gamePhase: "charleston"` with `stage: "courtesy"`, `status: "courtesy-ready"`, `currentDirection: null`, and `courtesyPairings` built for the across-seat pairs.
- `packages/shared/src/types/actions.ts` currently includes `CHARLESTON_PASS` and `CHARLESTON_VOTE`, but **not** `COURTESY_PASS`.
- `packages/shared/src/types/game-state.ts` already includes `CharlestonStage = "first" | "second" | "courtesy"`, `CharlestonStatus = "passing" | "vote-ready" | "courtesy-ready"`, and `courtesyPairings`, but it does **not** yet model courtesy submissions or courtesy-resolution narration.
- `packages/shared/src/engine/actions/charleston.ts` already has the current Charleston sequencing helpers, `buildCourtesyPairings(state)`, and the handoff into courtesy-ready state; Story `3B.3` should extend that codepath rather than replacing it.
- `packages/server/src/websocket/state-broadcaster.ts` already publishes safe public Charleston metadata (`stage`, `status`, `currentDirection`, `activePlayerIds`, `votesReceivedCount`, `courtesyPairings`) plus self-only `myHiddenTileCount`, `mySubmissionLocked`, and `myVote`; treat that broadcaster as the filtering boundary for any courtesy additions.
- `packages/server/src/integration/full-game-flow.test.ts` already proves both early-"no" and full second-Charleston flows hand off to courtesy-ready state, so Story `3B.3` should extend that integration coverage instead of creating a separate Charleston harness.

### Architecture Patterns

- **Validate-then-mutate** remains mandatory in `shared/`.
- **Server authority** remains absolute: clients submit `COURTESY_PASS`; the server validates, mutates, and broadcasts. No optimistic rack mutations on the client.
- **Filtered protocol views over raw engine state** are required. Internal courtesy state may contain hidden requested counts or selected tile IDs, but per-player protocol views must reveal only what is safe.
- **Pure shared logic only.** No `setTimeout`, browser APIs, or Node APIs in `shared/`; timeout and disconnect behavior stays on the server and belongs to Story `3B.5`.
- **Deterministic state machine composition** matters here: courtesy remains part of `gamePhase: "charleston"` until both pairs are finished, then the game hands off once into `play`.
- **Code is the source of truth for current Charleston contracts.** Follow the current code-level `courtesy-ready` shape already landed in Stories `3B.1` and `3B.2` instead of forcing the implementation back to older planning-language assumptions.

### Key Implementation Decisions

**1. Start from the existing courtesy-ready contract, not a redesign.**  
Story `3B.2` already established `stage: "courtesy"` and `courtesyPairings`. Story `3B.3` should layer courtesy submissions and resolution on top of that state shape.

**2. Keep courtesy negotiation pair-local and simultaneous.**  
Each across-seat pair should resolve only after both members have submitted. One player's submission must not leak the partner's requested count or selected tiles early.

**3. Lower-count trimming must be deterministic.**  
If one player chooses `3` and the other chooses `2`, use the first two tile IDs from the `3`-count submission exactly as selected. Do not sort or make a replacement choice.

**4. Transition to play only after both courtesy pairs are done.**  
One resolved pair is not sufficient to end Charleston. The second pair must also resolve or skip before `gamePhase` changes.

**5. Preserve the opening-turn contract.**  
When courtesy ends, the game should not trigger an opening draw. East should still be the first discarder with the already-dealt dealer hand.

### Suggested File Targets

| File | Change |
|------|--------|
| `packages/shared/src/types/actions.ts` | Add `CourtesyPassAction` and extend `GameAction` |
| `packages/shared/src/types/game-state.ts` | Extend `CharlestonState` and `ResolvedAction` for courtesy submission / resolution |
| `packages/shared/src/types/protocol.ts` | Add only minimal safe courtesy metadata if reconnect or future UI requires it |
| `packages/shared/src/engine/actions/charleston.ts` | Add courtesy validation, pair resolution, lower-count trimming, and final play handoff |
| `packages/shared/src/engine/actions/charleston.test.ts` | Add courtesy negotiation and play-transition coverage |
| `packages/shared/src/engine/game-engine.ts` | Register `COURTESY_PASS` |
| `packages/shared/src/index.ts` | Export new courtesy action / helpers |
| `packages/shared/src/types/game-state.test.ts` | Keep unions exhaustive |
| `packages/server/src/websocket/state-broadcaster.ts` | Extend filtered courtesy metadata safely if needed |
| `packages/server/src/websocket/state-broadcaster.test.ts` | Add courtesy no-leak assertions |
| `packages/server/src/websocket/join-handler.test.ts` | Preserve reconnect restore guarantees if courtesy view shape changes |
| `packages/server/src/integration/full-game-flow.test.ts` | Add end-to-end courtesy negotiation coverage |
| `packages/client/src/components/dev/TestHarness.vue` | Update only if safe courtesy mock state is needed to keep dev harness aligned |
| `packages/client/src/components/dev/TestHarness.test.ts` | Adjust only if the dev harness Charleston shape changes |

### Existing Code To Reuse

- **`buildCourtesyPairings(state)`** in `packages/shared/src/engine/actions/charleston.ts` for the already-landed across-seat pair mapping.
- **`captureLockedTiles()` / `removeLockedTiles()`** in `packages/shared/src/engine/actions/charleston.ts` for tile-ID-based simultaneous exchange patterns.
- **`getCharlestonTargetSeat()` / `getCharlestonTargetPlayerId()`** in `packages/shared/src/engine/actions/charleston.ts` for centralized seat math.
- **`buildPublicCharlestonView()` / `buildPlayerView()`** in `packages/server/src/websocket/state-broadcaster.ts` as the filtering boundary.
- **Stories `3B.1` and `3B.2` artifacts** for the established execution gate, no-leak expectations, and current Charleston handoff assumptions.
- **`handleChallengeVote()`** in `packages/shared/src/engine/actions/challenge.ts` as a pattern reference for collect-then-resolve flows, while remembering courtesy differs because resolution is pair-local and count-based rather than majority vote.

### Critical Gotchas

1. **`count` is `0-3`, and `tileIds.length` must exactly match `count`.** `count: 0` must use an empty `tileIds` array.
2. **Do not leak the partner's requested count before resolution.** Courtesy is an independent choice, so revealing the first chooser's count early undermines the negotiation.
3. **Do not leak selected tile IDs before pair resolution.** The no-leak guarantees from Stories `3B.1` and `3B.2` still apply here.
4. **Resolve per pair simultaneously.** Remove both sides' outgoing tiles and apply the effective exchange in one deterministic step for that pair.
5. **Keep unresolved pairs active after the first pair finishes.** Do not transition the whole game to `play` until both across-seat pairs are complete.
6. **Preserve East's opening discard.** Courtesy completion must not accidentally trigger a `DRAW_TILE` flow.
7. **Clear stale pre-game bookkeeping on play entry.** Courtesy / vote / hidden-across state must not bleed into the play phase.
8. **Tile IDs, never indices.** Lower-count trimming and courtesy selection both require stable ID-based logic.
9. **No timers in `shared/`.** Story `3B.5` owns disconnect default behavior and timeout fallback.

### Testing Standards

- Co-located tests only.
- Add zero-mutation coverage for every new courtesy rejection reason.
- Keep shared Charleston tests blackbox-focused: action in, resulting state / reason out.
- Add at least one real WebSocket integration test that starts from courtesy-ready, resolves both pairs, and verifies the final play handoff.
- Preserve JSON-stringification no-leak assertions for partner requested counts and selected tile IDs before resolution.
- Preserve reconnect coverage if filtered courtesy metadata changes.

### Git Intelligence

Recent Charleston-related commit titles:

- `feat(Charleston): finalize second Charleston vote implementation and address privacy leak`
- `feat(Charleston): implement first and second Charleston phases with blind pass enforcement and voting`
- `chore: reconcile Epic 5A retrospective findings and update planning artifacts`
- `docs: add Epic 5A retrospective documentation`

Actionable takeaways:

- The current repo's best guidance is the landed `3B.1` / `3B.2` code and story artifacts, not the older architecture examples alone.
- Continue the repo pattern of narrow shared / server edits plus focused no-leak regression tests.
- Keep the Epic `3B` execution gate visible and avoid claiming the live client integration prerequisite is already complete.

### Latest Technical Information

- No new dependency is justified for this story. The existing shared TypeScript engine, Fastify 5, and `ws`-based server path remain sufficient.
- Current Fastify 5 / TypeScript WebSocket guidance still supports the existing server architecture; this story should align with the current action-handler and broadcaster pipeline rather than introducing a framework migration.
- Continue using `vite-plus/test` for touched tests.

### Scope Boundaries

- This story **does** implement:
  - `COURTESY_PASS`
  - same-count and lower-count courtesy resolution
  - explicit zero-count skip behavior
  - narration-ready courtesy resolved actions
  - the final `charleston -> play` handoff after both pairs complete

- This story does **not** implement:
  - Charleston UI, `CharlestonZone`, or `TileSelectionAction` (`3B.4`)
  - disconnect default behavior, grace periods, or auto-pass timers (`3B.5`)
  - live client-state integration follow-through from the Epic `5A` retro
  - Charleston reconnect policy redesign beyond preserving the current filtered restore behavior

## Validation Checklist

- [ ] **Pattern reuse:** Courtesy logic extends the existing Charleston engine / filtering helpers instead of introducing a duplicate courtesy subsystem.
- [ ] **No-leak privacy:** Partner requested counts and selected tile IDs stay private until the pair resolves, including through serialized `STATE_UPDATE` payloads.
- [ ] **Transition cleanup:** Courtesy bookkeeping is cleared when entering `play`; no stale vote, hidden-across, or courtesy submission state survives the phase change.
- [ ] **Accessibility / UX handoff:** Resolved actions contain enough narration data for future UI work to explain lower-count negotiation outcomes without reverse-engineering state diffs.
- [ ] **Integration risk containment:** No scope creeps into `3B.4` UI work, `3B.5` timer/disconnect work, or the unresolved Epic `5A` client-integration prerequisite.
- [ ] **Opening-turn correctness:** After courtesy completes, East is still the first discarder and no opening draw occurs.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic `3B` overview, Story `3B.3`, Epic `3B` execution gate]
- [Source: `_bmad-output/planning-artifacts/gdd.md` - courtesy pass rule, lower-count negotiation, final play handoff, Charleston social / ritual framing]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` - deterministic state-machine composition, server authority, reconnect expectations]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - Charleston as social ritual, state narration, no-modals guidance, reconnect / graceful-degradation expectations]
- [Source: `_bmad-output/project-context.md` - server authority, validate-then-mutate, tile-ID rules, protocol filtering boundary]
- [Source: `_bmad-output/implementation-artifacts/3b-1-first-charleston-with-blind-pass-enforcement.md` - no-leak Charleston patterns, execution gate, prior handoff notes]
- [Source: `_bmad-output/implementation-artifacts/3b-2-second-charleston-vote-reversed-passes.md` - current courtesy-ready handoff contract, existing file targets, no-leak vote / reconnect expectations]
- [Source: `_bmad-output/implementation-artifacts/epic-5a-retro-2026-04-01.md` - validation checklist requirement, client-integration prerequisite, Epic `3B` planning-review gate]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-01.md` - future story-creation validation-checklist follow-through]
- [Source: `packages/shared/src/types/actions.ts` - current action union lacks `COURTESY_PASS`]
- [Source: `packages/shared/src/types/game-state.ts` - current `CharlestonState`, `courtesyPairings`, and `ResolvedAction` contracts]
- [Source: `packages/shared/src/types/protocol.ts` - current filtered Charleston protocol shape]
- [Source: `packages/shared/src/engine/actions/charleston.ts` - current Charleston sequencing helpers and courtesy-ready handoff]
- [Source: `packages/server/src/websocket/state-broadcaster.ts` - current filtering boundary for Charleston metadata]
- [Source: `packages/server/src/integration/full-game-flow.test.ts` - existing courtesy-ready integration coverage]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `rg` searches over Epic `3B`, courtesy-pass planning text, Charleston architecture / UX constraints, previous `3B.1` and `3B.2` artifacts, and current Charleston code / protocol files
- Repository state check:
  - `git log --oneline -5`
- Workflow initialization:
  - Loaded `_bmad/gds/config.yaml`, `_bmad-output/project-context.md`, and `_bmad-output/implementation-artifacts/sprint-status.yaml`
  - Read the complete `3b-3-courtesy-pass-negotiation.md` story file and current shared/server Charleston implementation files
- Validation:
  - `pnpm exec vp test run packages/shared/src/engine/actions/charleston.test.ts`
  - `pnpm exec vp test run packages/server/src/websocket/state-broadcaster.test.ts packages/server/src/websocket/join-handler.test.ts packages/server/src/integration/full-game-flow.test.ts`
  - `pnpm exec vp test run packages/shared/src/types/game-state.test.ts packages/shared/src/engine/game-engine.test.ts packages/shared/src/engine/state/create-game.test.ts packages/server/src/websocket/action-handler.test.ts`
  - `pnpm test`
  - `pnpm run typecheck`
  - `pnpm exec vp lint`

### Implementation Plan

- Add shared courtesy action / state / resolved-action contracts on top of the existing courtesy-ready Charleston state.
- Implement pair-local courtesy validation and lower-count simultaneous resolution in the shared Charleston engine, then hand off cleanly into `play`.
- Extend filtered protocol coverage and WebSocket integration tests so courtesy remains reconnect-safe and private before pair resolution.

### Completion Notes List

- Story context created from Epic `3B` planning artifacts, current courtesy-ready Charleston code, previous `3B.1` / `3B.2` learnings, and existing server filtering / integration tests.
- Added a dedicated validation checklist section to satisfy the Epic `5A` retrospective requirement for future story specs.
- Scoped the story to shared / server courtesy negotiation so Epic `3B` can continue without pretending the deferred live client integration layer is already complete.
- Implemented `COURTESY_PASS` shared contracts, courtesy submission tracking, resolved-pair progress, and narration-ready `COURTESY_PAIR_RESOLVED` payloads while keeping `COURTESY_PASS_LOCKED` privacy-safe.
- Added courtesy validation and pair-local resolution to the shared Charleston engine, including deterministic lower-count trimming, explicit zero-count skips, and the final `charleston -> play` handoff with stale Charleston bookkeeping cleared.
- Extended filtered server Charleston views and reconnect restore so players only see their own courtesy submission details before resolution; partner counts and tile IDs remain private until the pair resolves.
- Added focused shared, broadcaster, reconnect, and end-to-end WebSocket coverage for courtesy negotiation, no-leak guarantees, and play-start correctness; full test, typecheck, and lint validation passed.

### File List

- `_bmad-output/implementation-artifacts/3b-3-courtesy-pass-negotiation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/shared/src/types/actions.ts`
- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/engine/state/create-game.ts`
- `packages/shared/src/engine/game-engine.ts`
- `packages/shared/src/engine/actions/charleston.ts`
- `packages/shared/src/engine/actions/charleston.test.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/websocket/join-handler.test.ts`
- `packages/server/src/integration/full-game-flow.test.ts`

### Change Log

- 2026-04-01: Created Story `3B.3` context with courtesy-ready guardrails, lower-count negotiation rules, no-leak privacy requirements, final play handoff guidance, and a dedicated validation checklist.
- 2026-04-01: Implemented courtesy-pass negotiation across shared engine and server filtering, added pair-local narration payloads, preserved courtesy privacy through reconnect/broadcast flows, and validated with targeted plus full repo test/typecheck/lint runs.

### Status

review

# Story 3A.8: Invalid Mahjong Handling & Challenge Mechanism

Status: done

## Story

As a **developer**,
I want **invalid Mahjong declarations to be handled with a private warning and cancel option, and a challenge mechanism for disputing validated results**,
So that **honest mistakes are forgivable but confirmed invalid declarations enforce dead hands (FR66, FR67, FR68)**.

## Acceptance Criteria

1. **Given** a player declares Mahjong but their tiles don't match any card pattern **When** auto-validation fails **Then** only the declaring player receives a private notification: "This hand doesn't match a card pattern" with a Cancel option (FR66)

2. **Given** the player receives an invalid Mahjong warning **When** the player dispatches `CANCEL_MAHJONG` **Then** the declaration is withdrawn with no penalty — play continues as if nothing happened (call window may reopen or turn continues)

3. **Given** the player receives an invalid Mahjong warning **When** the player dispatches `CONFIRM_MAHJONG` anyway (dismissing the warning) **Then** a dead hand is enforced immediately — the player can no longer win or call discards for the rest of the game (FR67)

4. **Given** a Mahjong is auto-validated as valid **When** other players dispute the result **Then** a Challenge button is available during the celebration phase; any non-winning player can tap it within 10 seconds (FR68)

5. **Given** a challenge is initiated **When** the challenge vote opens **Then** all 4 players see the winning hand alongside the matched NMJL card pattern for group review; each player votes Valid or Invalid within 30 seconds

6. **Given** a challenge vote **When** 3 or more players vote Invalid **Then** the Mahjong is overturned — winner receives a dead hand, scoring is reversed

7. **Given** a challenge vote **When** 2 or more players vote Valid (or a player doesn't vote within 30 seconds, defaulting to Valid) **Then** the Mahjong stands and the celebration resumes

8. **Given** the challenge mechanism **When** checking scope **Then** challenges apply ONLY to Mahjong declarations — not to calls, scoring, or other game events

## Tasks / Subtasks

### Part A: Invalid Mahjong Warning & Cancel/Confirm Flow

- [x] Task 1: Add new action types (AC: #1, #2, #3)
  - [x] Add `CancelMahjongAction` to `actions.ts` — `type: "CANCEL_MAHJONG"`, `playerId`
  - [x] Add `ConfirmInvalidMahjongAction` to `actions.ts` — `type: "CONFIRM_INVALID_MAHJONG"`, `playerId`
  - [x] Add both to `GameAction` union
  - [x] Add `INVALID_MAHJONG_WARNING` to `ResolvedAction` — `playerId`, `reason` (private to declaring player)
  - [x] Add `MAHJONG_CANCELLED` to `ResolvedAction` — `playerId`
  - [x] Add `DEAD_HAND_ENFORCED` to `ResolvedAction` — `playerId`, `reason`
  - [x] Export new types from `index.ts`

- [x] Task 2: Add dead hand support to PlayerState and GameState (AC: #3)
  - [x] Add `deadHand: boolean` to `PlayerState` (default: `false`)
  - [x] Add `pendingMahjong: PendingMahjongState | null` to `GameState` (tracks in-progress invalid declaration)
  - [x] Define `PendingMahjongState` interface: `{ playerId: string; path: "self-drawn" | "discard"; previousTurnPhase: TurnPhase; previousCallWindow: CallWindowState | null }`
  - [x] Update `createLobbyState` and `createGame` to initialize `deadHand: false` on all players, `pendingMahjong: null`

- [x] Task 3: Modify `handleDeclareMahjong` for warning flow (AC: #1)
  - [x] CHANGE current behavior: instead of returning `{ accepted: false, reason: "INVALID_HAND" }` on validation failure, return `{ accepted: true, resolved: { type: "INVALID_MAHJONG_WARNING", playerId, reason: "INVALID_HAND" } }`
  - [x] Set `state.pendingMahjong = { playerId, path: "self-drawn", previousTurnPhase: state.turnPhase, previousCallWindow: null }`
  - [x] Add dead hand check at top: if `player.deadHand === true`, reject with reason `"DEAD_HAND"` (dead hand players cannot declare Mahjong)
  - [x] Valid declarations continue to work unchanged — only the rejection path changes

- [x] Task 4: Modify `confirmMahjongCall` for warning flow (AC: #1)
  - [x] CHANGE current behavior: instead of returning `{ accepted: false, reason: "INVALID_HAND" }`, return `{ accepted: true, resolved: { type: "INVALID_MAHJONG_WARNING", playerId: callerId, reason: "INVALID_HAND" } }`
  - [x] Set `state.pendingMahjong = { playerId: callerId, path: "discard", previousTurnPhase: state.turnPhase, previousCallWindow: state.callWindow }`
  - [x] Do NOT clear `state.callWindow` yet (preserve for cancel restore)

- [x] Task 5: Modify `handleConfirmCall` mahjong path (AC: #1)
  - [x] Update the mahjong branch (call-window.ts:662-674): when `confirmMahjongCall` returns `INVALID_MAHJONG_WARNING`, DO NOT call `handleRetraction` — instead return the warning result directly
  - [x] The retraction/resume flow now happens in Task 6 (CANCEL_MAHJONG) or dead hand in Task 7 (CONFIRM_INVALID_MAHJONG)

- [x] Task 6: Implement `handleCancelMahjong` in `mahjong.ts` (AC: #2)
  - [x] Validate: `state.pendingMahjong !== null`, `state.pendingMahjong.playerId === action.playerId`
  - [x] If `path === "self-drawn"`: restore `state.turnPhase` to `previousTurnPhase` — player continues their turn (can discard)
  - [x] If `path === "discard"`: restore call window state and call `handleRetraction(state, "MAHJONG_CANCELLED")` to promote next caller or reopen window
  - [x] Clear `state.pendingMahjong = null`
  - [x] Return `{ accepted: true, resolved: { type: "MAHJONG_CANCELLED", playerId } }`

- [x] Task 7: Implement `handleConfirmInvalidMahjong` in `mahjong.ts` (AC: #3)
  - [x] Validate: `state.pendingMahjong !== null`, `state.pendingMahjong.playerId === action.playerId`
  - [x] Set `state.players[playerId].deadHand = true`
  - [x] If `path === "self-drawn"`: restore `state.turnPhase` to `previousTurnPhase` — player must discard
  - [x] If `path === "discard"`: restore call window and call `handleRetraction(state, "DEAD_HAND_ENFORCED")` to promote next caller or reopen window
  - [x] Clear `state.pendingMahjong = null`
  - [x] Return `{ accepted: true, resolved: { type: "DEAD_HAND_ENFORCED", playerId, reason: "CONFIRMED_INVALID_DECLARATION" } }`

- [x] Task 8: Enforce dead hand restrictions on existing handlers (AC: #3)
  - [x] In `handleCallAction` (call-window.ts): add dead hand check — if `player.deadHand === true`, reject with reason `"DEAD_HAND_CANNOT_CALL"`
  - [x] In `handleCallMahjong` (call-window.ts): add dead hand check — same rejection
  - [x] In `handleDeclareMahjong` (mahjong.ts): already handled in Task 3
  - [x] Dead hand players CAN still draw and discard normally — do NOT add dead hand checks to `handleDrawTile` or `handleDiscardTile`
  - [x] Dead hand players' discards CAN still be called by other players — no change to call window opening logic

- [x] Task 9: Wire new actions into game-engine.ts dispatcher (AC: #1, #2, #3)
  - [x] Add `case "CANCEL_MAHJONG"` → route to `handleCancelMahjong`
  - [x] Add `case "CONFIRM_INVALID_MAHJONG"` → route to `handleConfirmInvalidMahjong`
  - [x] Update exhaustive switch — TypeScript will enforce

### Part B: Challenge Mechanism

- [x] Task 10: Add challenge action types (AC: #4, #5, #6, #7, #8)
  - [x] Add `ChallengeMahjongAction` to `actions.ts` — `type: "CHALLENGE_MAHJONG"`, `playerId`
  - [x] Add `ChallengeVoteAction` to `actions.ts` — `type: "CHALLENGE_VOTE"`, `playerId`, `vote: "valid" | "invalid"`
  - [x] Add both to `GameAction` union
  - [x] Add `CHALLENGE_INITIATED` to `ResolvedAction` — `challengerId`, `winnerId`
  - [x] Add `CHALLENGE_VOTE_CAST` to `ResolvedAction` — `playerId`, `vote`
  - [x] Add `CHALLENGE_RESOLVED` to `ResolvedAction` — `outcome: "upheld" | "overturned"`, `votes: Record<string, "valid" | "invalid">`
  - [x] Export from `index.ts`

- [x] Task 11: Add challenge state to GameState (AC: #4, #5)
  - [x] Add `challengeState: ChallengeState | null` to `GameState`
  - [x] Define `ChallengeState`: `{ challengerId: string; winnerId: string; votes: Record<string, "valid" | "invalid">; challengeExpiresAt: number; originalGameResult: MahjongGameResult }`
  - [x] Initialize as `null` in `createLobbyState` and `createGame`

- [x] Task 12: Implement `handleChallengeMahjong` in new file `challenge.ts` (AC: #4, #5)
  - [x] Validate: `state.gamePhase === "scoreboard"`, `state.gameResult !== null`, `state.gameResult.winnerId !== action.playerId` (winner cannot challenge themselves), `state.challengeState === null` (only one challenge at a time)
  - [x] Validate: `gameResult` is a `MahjongGameResult` (has `winnerId !== null`)
  - [x] Set `state.challengeState = { challengerId, winnerId, votes: { [challengerId]: "invalid" }, challengeExpiresAt: Date.now() + 30000, originalGameResult: state.gameResult }`
  - [x] Pre-set challenger's vote to "invalid" (they initiated the challenge)
  - [x] Return `{ accepted: true, resolved: { type: "CHALLENGE_INITIATED", challengerId, winnerId } }`

- [x] Task 13: Implement `handleChallengeVote` in `challenge.ts` (AC: #5, #6, #7)
  - [x] Validate: `state.challengeState !== null`, player hasn't already voted, player is a game participant
  - [x] Record vote: `state.challengeState.votes[playerId] = vote`
  - [x] Check if all 4 players have voted — if so, resolve immediately (don't wait for timer)
  - [x] Resolution logic: count "invalid" votes. If >= 3: overturn. If "valid" >= 2 (majority): uphold.
  - [x] On OVERTURN: set `state.players[winnerId].deadHand = true`, reverse scoring (negate all `originalGameResult.payments`), clear `state.gameResult`, set `state.gamePhase = "play"`, restore game state for continued play
  - [x] On UPHOLD: clear `state.challengeState = null`, game remains on scoreboard
  - [x] Return resolved `CHALLENGE_VOTE_CAST` for individual votes, `CHALLENGE_RESOLVED` when resolved

- [x] Task 14: Handle challenge vote timeout (AC: #7)
  - [x] Non-voters default to "valid" after 30 seconds
  - [x] NOTE: Timer scheduling is the server's responsibility (not shared/) — add a `CHALLENGE_TIMEOUT_SECONDS = 30` constant in shared/
  - [x] When timeout fires on server, submit default "valid" votes for all non-voters, then resolve
  - [x] Server integration is Epic 4A's responsibility — for now, define the constant and document the timeout contract

- [x] Task 15: Wire challenge actions into game-engine.ts (AC: #4, #5, #6, #7)
  - [x] Add `case "CHALLENGE_MAHJONG"` → route to `handleChallengeMahjong`
  - [x] Add `case "CHALLENGE_VOTE"` → route to `handleChallengeVote`
  - [x] Update exhaustive switch

### Part C: Tests

- [x] Task 16: Tests for invalid Mahjong warning flow (AC: #1, #2, #3)
  - [x] Self-drawn invalid declaration → returns INVALID_MAHJONG_WARNING (not rejection)
  - [x] Discard invalid declaration → returns INVALID_MAHJONG_WARNING (not rejection)
  - [x] Cancel after self-drawn warning → play continues, player can discard, no penalty
  - [x] Cancel after discard warning → call window retraction/resume flow triggers
  - [x] Confirm invalid after self-drawn → dead hand enforced, player must discard
  - [x] Confirm invalid after discard → dead hand enforced, call window retraction triggers
  - [x] Cancel/Confirm without pending mahjong → rejected
  - [x] Cancel/Confirm by wrong player → rejected
  - [x] Zero-mutation verification: state unchanged after cancel (except pendingMahjong cleared)

- [x] Task 17: Tests for dead hand enforcement (AC: #3)
  - [x] Dead hand player cannot call pung/kong/quint/news/dragon_set → rejected with DEAD_HAND_CANNOT_CALL
  - [x] Dead hand player cannot call mahjong → rejected
  - [x] Dead hand player cannot declare mahjong → rejected with DEAD_HAND
  - [x] Dead hand player CAN draw tiles normally
  - [x] Dead hand player CAN discard tiles normally
  - [x] Other players CAN call dead hand player's discards
  - [x] Dead hand player's exposed tiles remain visible (not cleared)

- [x] Task 18: Tests for challenge mechanism (AC: #4, #5, #6, #7, #8)
  - [x] Challenge initiated during scoreboard phase → accepted, challenger vote pre-set
  - [x] Challenge by winner → rejected (cannot challenge own Mahjong)
  - [x] Challenge during non-scoreboard phase → rejected
  - [x] Challenge when challenge already active → rejected
  - [x] Challenge on wall game result → rejected (no Mahjong to challenge)
  - [x] Vote cast by participant → recorded correctly
  - [x] Vote by non-participant → rejected
  - [x] Duplicate vote → rejected
  - [x] 3+ invalid votes → Mahjong overturned, dead hand on winner, scoring reversed
  - [x] 2+ valid votes → Mahjong upheld, challenge cleared
  - [x] All 4 votes cast → auto-resolve without waiting for timer
  - [x] Scoring reversal: all payment amounts negated correctly
  - [x] Game phase transitions: overturned → back to "play", upheld → stays "scoreboard"

- [x] Task 19: Regression verification
  - [x] Run full test suite (`pnpm -r test`): all existing tests pass
  - [x] Typecheck passes (`tsc --noEmit`), lint passes
  - [x] Existing mahjong tests (story 3a-7) still pass — valid declarations unchanged
  - [x] Existing call window tests still pass — pung/kong/quint/news/dragon_set unchanged

## Dev Notes

### Two Distinct Features in This Story

This story has two independent but related features:

1. **Invalid Mahjong Warning Flow (Part A):** Changes the existing rejection path so invalid declarations get a private warning + cancel/confirm option instead of an immediate rejection. This is the "forgiving of honest mistakes" UX requirement (FR66).

2. **Challenge Mechanism (Part B):** Adds a post-validation dispute system where other players can challenge a valid Mahjong declaration via group vote. This is the "safety valve for card data bugs" requirement (FR68).

### CRITICAL: Changing Existing Rejection Behavior

Story 3a-7 currently returns `{ accepted: false, reason: "INVALID_HAND" }` when validation fails. This story CHANGES that to return `{ accepted: true, resolved: { type: "INVALID_MAHJONG_WARNING" } }` with a pending state. This is a **behavioral change to existing code**, not just adding new code.

**Impact on existing tests:** The 3a-7 tests that verify invalid hand rejection will need updating:
- `mahjong.test.ts` tests checking `accepted: false` for invalid hands must change to `accepted: true` with `INVALID_MAHJONG_WARNING` resolved action
- Tests checking zero-mutation on invalid declaration must account for `pendingMahjong` being set

### Dead Hand Data Model

Add `deadHand: boolean` to `PlayerState`. This is the simplest model that satisfies FR76-FR79 for the invalid declaration trigger. Other dead hand triggers (invalid exposure, wrong tile count, table talk) are deferred to Epic 3C (Story 3c-3).

**Dead hand behavior summary (FR77-FR79):**
- CAN draw from wall and discard normally
- CANNOT call any discards (pung, kong, quint, news, dragon_set, mahjong)
- CANNOT declare mahjong (self-drawn)
- Other players CAN call the dead hand player's discards
- Exposed tiles remain visible

### Pending Mahjong State

The `pendingMahjong` field on `GameState` tracks an in-progress invalid declaration waiting for cancel/confirm. This is needed because:

1. **Self-drawn path:** The player is mid-turn (has drawn, hasn't discarded). After cancel, they resume discarding. After confirm (dead hand), they must still discard.
2. **Discard path:** The call window was active. After cancel, the retraction/resume flow must trigger. After confirm (dead hand), the same retraction/resume flow triggers.

The `previousCallWindow` preserves the call window state for the discard path restore.

### Challenge Mechanism: Overturning a Valid Mahjong

When a challenge succeeds (3+ invalid votes):
1. Winner gets dead hand
2. Scoring is reversed (negate all payments in `originalGameResult.payments`)
3. Game returns to play phase — the game continues

**Key question:** After an overturned Mahjong, whose turn is it and what phase?
- **Self-drawn overturned:** The winner was mid-turn, had drawn. They should be in discard phase (must discard a tile).
- **Discard overturned:** The winner called a discard. The call window should reopen or the discarder's turn resumes.
- **Simplification:** Since challenge resolution happens after celebration (scoreboard phase), treat overturned Mahjong as a new turn for the player AFTER the winner (counterclockwise). This avoids complex state restoration.

### Challenge Timer: Server Responsibility

The 30-second challenge vote timer is a server concern (no `setTimeout` in shared/). Define `CHALLENGE_TIMEOUT_SECONDS = 30` as a constant. Document the contract: when timeout fires, the server submits default "valid" votes for all non-voters, then calls `handleChallengeVote` for each.

Similarly, the 10-second challenge window (time to press the Challenge button during celebration) is a UI/server concern — not enforced in shared/ game logic. The `handleChallengeMahjong` handler simply validates that `gamePhase === "scoreboard"`.

### Key Dependencies — Existing Code to Use (NOT Reinvent)

| Need | Use This | File |
|------|----------|------|
| Hand validation | `validateHandWithExposure(tiles, exposedGroups, card)` | `card/exposure-validation.ts:125` |
| Current mahjong handlers | `handleDeclareMahjong`, `confirmMahjongCall` | `engine/actions/mahjong.ts` |
| Call retraction flow | `handleRetraction(state, reason)` | `engine/actions/call-window.ts:584` |
| Call handlers (add dead hand check) | `handleCallAction` | `engine/actions/call-window.ts:76` |
| Call mahjong handler | `handleCallMahjong` | `engine/actions/call-window.ts:159` |
| Confirm call mahjong path | `handleConfirmCall` (mahjong branch) | `engine/actions/call-window.ts:662` |
| Payment calculation | `calculatePayments(...)` | `engine/scoring.ts:22` |
| Game result types | `MahjongGameResult`, `WallGameResult` | `types/game-state.ts:48, 39` |
| Test helpers | `createPlayState`, `injectTilesIntoRack`, `setupMahjongConfirmation`, `buildInvalidHand` | `mahjong.test.ts`, `shared/testing/helpers` |

### CRITICAL: `handleRetraction` Is Not Exported

`handleRetraction` in `call-window.ts:584` is a module-private function. To call it from `mahjong.ts` (for cancel/confirm-invalid flows in the discard path), either:
1. **Export `handleRetraction`** from `call-window.ts` — preferred, cleanest approach
2. **Move retraction logic into the mahjong handlers** — duplicates code, avoid

### CRITICAL: ResolvedAction Privacy

`INVALID_MAHJONG_WARNING` must be sent ONLY to the declaring player, not broadcast. This is a server/protocol concern (Epic 4A), but the resolved action type should be designed to enable this. Add a `privateToPlayerId` field to the resolved action, or handle it in the server's `buildPlayerView` filter. For now in shared/, just define the resolved action type — the server will handle privacy.

### UX Context (from UX Design Spec)

- **Dead hand indicator:** Subtle badge near rack, `text-secondary` with `state-error` coral border. Call buttons removed during call windows. Mahjong button shows "Dead hand — cannot declare" on tap. Other players see NO indicator — behavioral change only. (UX-DR35)
- **Challenge flow:** Inline on game table (not modal), 30-second group review, winning hand + card pattern side-by-side, two large buttons (Valid/Invalid) in action zone. No penalty for challenging. Voice chat active throughout. (UX-DR50)
- **Invalid Mahjong notification:** Private, gentle, never broadcast. Cancel option = forgiving. (UX spec line 1110)

These UX elements are client-side (Epic 5A/5B). This story implements the shared/ game logic that enables them.

### Project Structure Notes

- New file: `packages/shared/src/engine/actions/challenge.ts` + `challenge.test.ts`
- Modified files:
  - `types/actions.ts` — new action types
  - `types/game-state.ts` — `deadHand` on PlayerState, `pendingMahjong` and `challengeState` on GameState, new ResolvedAction variants
  - `engine/actions/mahjong.ts` — modify rejection paths, add cancel/confirm handlers
  - `engine/actions/mahjong.test.ts` — update existing invalid hand tests, add new tests
  - `engine/actions/call-window.ts` — export `handleRetraction`, add dead hand checks to call handlers, update handleConfirmCall mahjong path
  - `engine/game-engine.ts` — new dispatcher cases
  - `engine/state/create-game.ts` — initialize new fields
  - `index.ts` — exports
- All changes in `packages/shared/src/` — pure game logic, no client/server changes

### Previous Story Intelligence (3a-7)

- **Two Mahjong paths implemented:** `DECLARE_MAHJONG` (self-drawn) and `CALL_MAHJONG` (discard). Both are fully working and tested.
- **`card: NMJLCard | null` already on GameState** — loaded in `createGame` via `loadCard("2026")`.
- **`handleCallMahjong` is separate from `handleCallAction`** — mahjong calls skip tile validation at call time (validation deferred to confirmation).
- **`handleConfirmCall` branches early for mahjong** — calls `confirmMahjongCall`, and if invalid, currently calls `handleRetraction`. This is the code path that changes.
- **34 existing mahjong tests** covering both paths, scoring, priority, rejections. Some will need updating.
- **Total test count:** 559 tests across 3 packages.
- **Key code review fix from 3a-7:** Tile array construction in mahjong handlers must include exposed group tiles. Pattern: `[...player.rack, ...player.exposedGroups.flatMap(g => g.tiles)]`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3A, Story 3A.8 lines 1280-1319]
- [Source: _bmad-output/planning-artifacts/gdd.md — Mahjong Declaration Flow, Dead Hand rules]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Challenge Flow lines 1116-1133, Dead Hand Indicator lines 1491-1495, Invalid Mahjong lines 1110-1114]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-03-26.md — FR66-FR68 coverage, FR76-FR79 dead hand]
- [Source: packages/shared/src/engine/actions/mahjong.ts — handleDeclareMahjong, confirmMahjongCall]
- [Source: packages/shared/src/engine/actions/call-window.ts — handleCallMahjong, handleConfirmCall, handleRetraction]
- [Source: packages/shared/src/types/game-state.ts — GameState, PlayerState, ResolvedAction, CallWindowState]
- [Source: packages/shared/src/types/actions.ts — GameAction union]
- [Source: packages/shared/src/engine/game-engine.ts — handleAction dispatcher]
- [Source: _bmad-output/implementation-artifacts/3a-7-mahjong-declaration-auto-validation.md — Previous story intelligence]
- [Source: _bmad-output/project-context.md — Technology stack, testing rules, anti-patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- 3 existing mahjong tests updated to reflect behavioral change (rejection → warning)
- Dead hand check in handleCallAction moved before tile validation for correct priority
- Challenge "all 4 votes" test fixed: early resolution (2+ valid) was triggering before 4th vote

### Completion Notes List

- Part A: Invalid Mahjong declarations now return INVALID_MAHJONG_WARNING with pendingMahjong state instead of hard rejection. Players can CANCEL (no penalty) or CONFIRM (dead hand enforced). Both self-drawn and discard paths fully implemented with proper state restoration.
- Dead hand enforcement: players with deadHand=true cannot call discards or declare Mahjong, but CAN still draw and discard normally. Other players can call their discards.
- Part B: Challenge mechanism allows non-winning players to dispute a validated Mahjong during scoreboard phase. 4-player vote with 3+ invalid = overturn (dead hand + scoring reversal), 2+ valid = uphold. Challenge auto-resolves when all 4 votes are in.
- handleRetraction exported from call-window.ts for use by mahjong cancel/confirm handlers.
- CHALLENGE_TIMEOUT_SECONDS constant defined for server timer integration (Epic 4A).
- All 593 tests pass (571 shared + 1 server + 21 client), typecheck clean, lint clean.
- 34 new tests added across mahjong.test.ts and challenge.test.ts.

### Change Log

- 2026-03-28: Implemented invalid Mahjong handling & challenge mechanism (Story 3A.8, all 19 tasks)
- 2026-03-28: Code review fixes — normalized pendingMahjong clearing order in cancel/confirm handlers, documented early resolution logic in challenge.ts, fixed pre-existing flaky client tests (button filter and reactivity flush issues)

### File List

- packages/shared/src/types/actions.ts (modified — added CancelMahjongAction, ConfirmInvalidMahjongAction, ChallengeMahjongAction, ChallengeVoteAction)
- packages/shared/src/types/game-state.ts (modified — added deadHand to PlayerState, PendingMahjongState, ChallengeState, CHALLENGE_TIMEOUT_SECONDS, pendingMahjong/challengeState to GameState, new ResolvedAction variants)
- packages/shared/src/engine/actions/mahjong.ts (modified — warning flow for handleDeclareMahjong/confirmMahjongCall, new handleCancelMahjong/handleConfirmInvalidMahjong)
- packages/shared/src/engine/actions/mahjong.test.ts (modified — updated 3 existing tests, added 20 new tests for warning flow, dead hand, dispatcher)
- packages/shared/src/engine/actions/call-window.ts (modified — exported handleRetraction, added dead hand checks to handleCallAction/handleCallMahjong, updated handleConfirmCall mahjong path)
- packages/shared/src/engine/actions/challenge.ts (new — handleChallengeMahjong, handleChallengeVote, resolveChallenge)
- packages/shared/src/engine/actions/challenge.test.ts (new — 16 tests for challenge mechanism)
- packages/shared/src/engine/game-engine.ts (modified — new dispatcher cases, pendingMahjong/challengeState init in createLobbyState)
- packages/shared/src/engine/state/create-game.ts (modified — deadHand:false on PlayerState, pendingMahjong/challengeState:null on GameState)
- packages/shared/src/index.ts (modified — new type/function exports)
- packages/client/src/components/dev/TestHarness.test.ts (modified — fixed flaky button filter and reactivity flush in discard tests)

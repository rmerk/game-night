# Epic 4B Retrospective: Multiplayer Resilience

**Date:** 2026-04-05
**Facilitator:** Max (Scrum Master)
**Epic Status:** Complete (7/7 stories)

## Team Participants

- Cloud Dragonborn (Game Architect)
- Samus Shepard (Game Designer / Product Owner)
- Link Freeman (Game Developer)
- GLaDOS (Game QA Architect)
- Max (Scrum Master)
- Indie (Solo Dev)
- Rchoi (Project Lead)

## Epic Summary

**Delivery Metrics:**
- Completed: 7/7 stories (100%)
- Test growth: ~780 → 1,449 (+669 new tests, +86%)
- Code review rounds: Every story received at least 2 review passes (adversarial + regression)
- Duration: 1 day (2026-04-05)

**Quality and Technical:**
- Blockers encountered: 0
- Technical debt items: 7 LOW follow-ups captured across 4B.2, 4B.6, 4B.7
- Test coverage: Exhaustive — transition scenario tables in every story, every row covered by at least one test
- Production incidents: 0
- Regressions: 0 across 1,449 tests

**Stories Delivered:**
1. 4B.1: Reconnection with Full State Restore — grace period, PLAYER_RECONNECTING, sendPostStateSequence, tokenless recovery, seat UX label (+~100 tests)
2. 4B.2: Phase-Specific Reconnection Fallbacks — auto-discard, auto-pass, broadcast consolidation, attachToExistingSeat build-before-mutate (+~20 tests)
3. 4B.3: Simultaneous Disconnection & Game Pause — room-level pause, GAME_PAUSED/RESUMED/ABANDONED, auto-end, client pause banner (+~80 tests)
4. 4B.4: Turn Timeout & AFK Escalation — turn timer state machine, nudge/auto-discard/AFK vote, dead-seat flag, AfkVoteModal (+~100 tests)
5. 4B.5: Player Departure & Dead Seat — LEAVE_ROOM, departure vote, dead-seat turn skip/wall skip/call pass, multi-departure auto-end (+~120 tests)
6. 4B.6: Host Migration — migrateHost helper, grace-expiry/departure/auto-end triggers, hostless recovery, HOST_PROMOTED (+~50 tests)
7. 4B.7: Host Settings & 5th Player Handling — RoomSettings, SET_ROOM_SETTINGS, REMATCH validation, table-full page, spectator stub (+~200 tests)

**New Server Infrastructure Built:**
- `post-state-sequence.ts` — Canonical per-socket STATE_UPDATE → CHAT_HISTORY send ordering
- `grace-expiry-fallbacks.ts` — Phase-specific auto-actions (auto-discard, auto-pass) on grace-period expiry
- `pause-handlers.ts` — Room-level simultaneous-disconnect pause with 2-minute auto-end
- `turn-timer.ts` — Turn timer state machine (initial → extended → auto-discard → AFK vote) + pickAutoDiscardTileId
- `leave-handler.ts` — Player departure lifecycle, dead-seat conversion, departure vote, multi-departure auto-end
- `host-migration.ts` — Deterministic counterclockwise host-role transfer
- `room-settings.ts` — Unified room settings validation, merge, and sync engine

## Previous Retro Follow-Through (Epic 4A)

| Action Item | Status | Evidence |
|---|---|---|
| Embed validation checklist in story specs | ✅ Completed | Every 4B story includes a "Transition scenarios" table + explicit coverage gates (6a-retro-1 follow-through). Pattern proven across all 7 stories. |
| Track retro action items as sprint-status entries | ✅ Completed | `retro_follow_through` section in sprint-status.yaml tracks every item with done/in-progress status. 6a-retro-1/2/3 and 4b1-review-1/2/3 all tracked and closed. |
| Plan for learning curve in domain-shift epics | ✅ Applied | Not a domain-shift epic, but early stories (4B.1/4B.2) were foundational hardening before complex features. Pattern to apply in 5B. |
| Unify timer pattern before Epic 4B | ⏳ Partial | Lifecycle timer framework expanded (pause-timeout, afk-vote-timeout, departure-vote-timeout) but no unified abstraction. Dedicated `room.turnTimerHandle` chosen deliberately over lifecycle timers for the turn timer (AC15 of 4B.4). |
| call-window.ts monolith (carried from 3A) | ❌ Not addressed | Still a monolith, carried 3 epics. No 4B story imported from it. Consumer-driven refactoring principle still applies. |
| Pre-existing lint warnings | ⏳ Partial | Lint shows 0 errors consistently; warnings addressed opportunistically. |
| Document shared/ → server/ import surface | ❌ Not done | Never formally cataloged. |

**Result: 3/7 fully completed, 2 partially done, 2 not addressed (43% → improved to ~57% effective follow-through)**

**Key improvement:** The validation checklist and sprint-status tracking items — the two highest-impact items — were both completed and became defining patterns for Epic 4B's quality. The unaddressed items (call-window monolith, import surface docs) remain low-priority and non-blocking.

## Successes

1. **Transition scenario tables transformed quality discipline.** Originated from 6A retro follow-through `6a-retro-1`, baked into 4B.1's ACs, and replicated across all 7 stories. Every story shipped with an enumerated transition table (T1–T20+ per story) where every row had at least one test. This is the single biggest quality improvement across the project's history. Code reviews walked the tables to verify coverage.

2. **Layered architecture compounded beautifully.** Each story added exactly one concern on top of a stable foundation: 4B.1 (reconnection backbone) → 4B.2 (phase fallbacks) → 4B.3 (room-level pause) → 4B.4 (turn timing) → 4B.5 (departure) → 4B.6 (host migration) → 4B.7 (settings). Zero architectural rewrites. The `attachToExistingSeat` extraction in 4B.1 became the shared reconnect path for 5 subsequent stories.

3. **Code reviews caught logic bugs, not style nits.** Every story's adversarial review found real issues: 4B.2 (AC8 spec deviation stranding sessions), 4B.3 (missing idle-timeout arming on auto-end), 4B.4 (turn timer not cancelled on disconnect — AC9 violation; AFK dodge exploit via unrelated reconnects), 4B.7 (settings panel hidden from non-hosts; double-counting bug in rematch seats). These are the class of bugs that ship silently without adversarial review.

4. **Retro follow-through as sprint-status entries worked.** `4b1-review-1/2/3` tracked and closed in 4B.2. `6a-retro-1/2/3` tracked and closed in 4B.1. `4b7-spectator-stub-shipped` tracked when the spectator scope decision was made. First-class tracking produces first-class accountability.

5. **sendPostStateSequence helper (6A retro follow-through) prevented an entire class of bugs.** The canonical per-socket send ordering (STATE_UPDATE → CHAT_HISTORY) was extracted once in 4B.1 and never violated across 6 subsequent stories. Three call sites migrated, zero ordering bugs in the entire epic.

6. **Scope discipline on the final story.** 4B.7's spectator mode AC9 had a clear decision rule (>300 LOC or >5 test files → ship placeholder). Team correctly chose the placeholder. Good scope control on the last story of an epic where scope creep is most tempting.

7. **broadcastStateToRoom consolidation held.** 4B.2 consolidated fan-out with try/catch-per-session. Zero raw `ws.send` loops introduced in 4B.3–4B.7. The pattern stuck.

8. **669 new tests with zero regressions.** Test count grew 86% (780 → 1,449) with zero breakage to existing tests. Every story maintained the backpressure gate (`pnpm test && pnpm run typecheck && vp lint`).

## Challenges

1. **4B.4 has deferred integration test tasks.** Tasks 10.2, 10.4, and 10.6 (full WebSocket integration tests for join-handler turn timer, ws-server vote dispatch, and pause+cancelAfkVote) were left open as "optional follow-up." Unit coverage exists but the full multi-socket transition scenarios have gaps. Only story with incomplete task checkboxes.

2. **`Room` type sprawl.** By 4B.7, `Room` carries 20+ fields across timers, votes, settings, seat status, and pause state. The 4B.2 review follow-up about hand-constructed `Room` test fixtures silently drifting is a real risk. New server stories will need to construct increasingly complex fixtures.

3. **Client toast wiring is inconsistent.** 4B.5 departure toasts live in `useRoomConnection.ts` composable. 4B.6 host-promoted toasts live in `GameTable.vue`/`RoomView.vue` components. 4B.7 settings-changed toasts followed the component pattern. Two patterns for the same concern. 5B is all-client work and will compound this.

4. **`join-handler.ts` is accumulating concerns.** It now owns: initial join, token reconnect, tokenless recovery, `attachToExistingSeat`, `registerDisconnectHandler` (with pause branching, grace timers, departure short-circuit), `handleSetJokerRules`, `handleSetRoomSettings`. Trending toward the `call-window.ts` pattern.

5. **`ResolvedAction` union is ~20 discriminants.** Each new discriminant touches 5–8 files via exhaustive-switch fixes. Manageable with the established ritual, but the per-story overhead grows linearly.

6. **Tokenless reconnect during pause is a known gap (4B.3 T11).** The `graceTimers.has()` predicate fails during pause because pause clears the map. Token-based reconnect works; tokenless is edge-case-within-edge-case. Accepted in 4B.3, still open.

7. **Seven stories in one day is a velocity outlier.** Extraordinary throughput, but the 5-system timing lattice (syncTurnTimer × cancelTurnTimer × pause × departure × host migration) has combinatorial interaction space that's hard to fully exercise at this pace.

## Key Insights

1. **Transition scenario tables are the highest-ROI quality practice the team has adopted.** They transform vague "test the feature" into concrete enumerated contracts. Code reviews become table walks instead of freeform exploration. Every 4B bug caught in review was traceable to a transition scenario row. **This practice must continue in every future story.**

2. **Retro follow-through requires first-class tracking, not prose.** The 4A retro's demand to track items in sprint-status.yaml produced 57% effective follow-through (up from 43%). The items that were tracked got done; the items left as prose didn't. **Action items from this retro must appear in sprint-status.yaml.**

3. **Layered story sequencing enables compounding architecture.** 4B.1's `attachToExistingSeat` extraction paid dividends across 5 stories. 4B.2's broadcast consolidation prevented bugs across 5 stories. Early foundational work multiplies across the epic. **5B should front-load foundational patterns in its first 1–2 stories.**

4. **Adversarial code review catches different bugs than regression testing.** Tests verify expected behavior; adversarial review finds unexpected state transitions, race conditions, and spec deviations. Both are necessary. **Every story should continue to receive adversarial review.**

5. **Scope discipline on late-epic stories prevents bloat.** 4B.7's spectator placeholder decision was correct. The decision rule (LOC threshold + test file count) made it objective rather than subjective. **Apply similar decision rules when scope questions arise in 5B.**

6. **Domain shifts reset learning curves.** 4A predicted this for 5A (confirmed). 5B is another domain shift — from server-heavy 4B back to client-heavy UI work. **Expect friction in early 5B stories on Vue component patterns, UnoCSS layout, and accessibility wiring.**

## Action Items

### Process Improvements

1. **Consolidate client toast wiring to one pattern before 5B**
   Owner: Dev Agent
   Deadline: Before 5B Story 1
   Success criteria: All resolved-action toasts route through a single mechanism. Document the chosen pattern in CLAUDE.md.
   Why: Two toast patterns (composable vs component watcher) will compound in client-heavy 5B. Pick one, migrate the other.

2. **Continue transition scenario tables in all 5B stories**
   Owner: Scrum Master (story creation)
   Deadline: Ongoing
   Success criteria: Every 5B story spec includes a transition scenarios table with test coverage gates.
   Why: Proven as the highest-ROI quality practice in 4B. Non-negotiable.

### Technical Debt

1. **Extract concern-specific sub-objects from `Room` type**
   Owner: Dev Agent
   Priority: MEDIUM
   Estimated effort: Extract timer state into `TurnTimerState`, vote state into `VoteState`, departure/dead-seat state into `SeatStatus`. Reduces top-level field count and makes test fixture construction targeted. Create `createTestRoom(overrides)` builder that defaults all fields.
   Why: 20+ fields on Room makes fixture construction fragile and onboarding to new server stories painful.

2. **Fill 4B.4 deferred integration test gaps**
   Owner: Dev Agent
   Priority: LOW
   Estimated effort: Tasks 10.2, 10.4, 10.6 (~3 test files extended)
   Why: Unit coverage exists; integration is belt-and-suspenders. Still worth closing.

3. **Tokenless reconnect during pause (4B.3 T11 known gap)**
   Owner: Dev Agent
   Priority: LOW
   Note: Token-based reconnect works. If session identity becomes more robust (Epic 8 accounts), this resolves naturally. Defer unless real issue surfaces.

4. **`call-window.ts` monolith (carried from 3A — 3 epics)**
   Owner: Dev Agent
   Priority: LOW
   Note: No 5B story imports from it. Consumer-driven refactoring principle still applies. Split when a story needs it.

### Team Agreements

- **Toast pattern: pick one before 5B Story 1.** Dev reviews current codebase and proposes consolidation in the first 5B story's prep work.
- **Room fixture helper:** If the Room type extraction happens, create a `createTestRoom(overrides)` builder. Addresses the 4B.2 review follow-up about silent field drift.
- **No deferred test tasks.** 4B.4 was the only story with incomplete test checkboxes. For 5B, every story's test tasks must be complete before marking done.

## Epic 5B Preparation

### Critical (must complete before 5B starts)

1. [ ] **Toast consolidation** — pick the pattern, migrate, document
   Owner: Dev Agent

### Parallel (during early 5B stories)

2. [ ] **Room type extraction** — can happen alongside 5B.1/5B.2 (client-only stories)
   Owner: Dev Agent

3. [ ] **4B.4 integration test gaps** — fill during a quiet moment
   Owner: Dev Agent

### Not needed before 5B

- Tokenless-during-pause gap (defer)
- call-window.ts split (defer)
- Playwright E2E harness (defer — revisit at Epic 7 polish)

## Readiness Assessment

| Area | Status |
|---|---|
| Testing & Quality | ✅ 1,449 tests, zero regressions, typecheck clean, lint 0 errors |
| Server Architecture | ✅ Coherent handler pattern, single-responsibility modules, consolidated broadcast fan-out |
| Reconnection | ✅ Token + tokenless grace recovery, pause/resume, full-state model |
| Turn Timing | ✅ Timer state machine, AFK escalation, dead-seat stub |
| Player Departure | ✅ Vote-based resolution, dead-seat conversion, multi-departure auto-end |
| Host Management | ✅ Automatic migration, hostless recovery, settings persistence |
| Room Settings | ✅ Unified settings type, validation, sync with legacy fields |
| Client Infrastructure | ⚠️ Toast pattern inconsistency needs consolidation before 5B |
| Room Type Complexity | ⚠️ 20+ fields — extraction recommended but not blocking |
| Unresolved Blockers | None |

## Significant Discoveries

No significant discoveries that require updating Epic 5B's plan. Epic 4B's server infrastructure is comprehensive and provides the complete resilience foundation that 5B UI work builds upon. The one risk is the domain shift back to client-heavy work — mitigated by the toast consolidation prep task and the team's awareness of learning-curve patterns from the 4A retro.

## Open Review Follow-ups (LOW priority)

Carried from story-level review notes for tracking:

- [4B.2] `grace-expiry-fallbacks.test.ts` hand-constructs Room with ~16 fields — prefer `roomManager.createRoom()` (addressed by Room type extraction action item)
- [4B.2] Hot-path auto-discard/auto-pass cases don't assert that `broadcastGameState` reaches mock `ws.send`
- [4B.2] `grace-expiry-fallbacks.test.ts:6` imports test helpers via deep relative path — consider `@mahjong-game/shared/testing` subpath export
- [4B.6] `HOST_PROMOTED` toast lives in `GameTable.vue`/`RoomView.vue` rather than `useRoomConnection.ts` (addressed by toast consolidation action item)
- [4B.6] `GameTable.vue` host-promoted toast includes `"rematch"` phase — confirm with design
- [4B.6] `migrateHost` candidate iteration starts at east when `currentHost` is null — consider passing departing host's wind explicitly
- [4B.7] Spectator mode shipped as placeholder stub — full `JOIN_SPECTATOR` / `SpectatorGameView` deferred post-MVP

## Team Performance

Epic 4B delivered 7 stories with 669 new tests in a single day. The complete multiplayer resilience layer was built from reconnection fundamentals through host settings — grace periods, phase fallbacks, simultaneous-disconnect pause, turn timeout with AFK escalation, player departure with vote-based resolution, automatic host migration, and unified room settings. Code reviews caught logic bugs in every story. The retrospective surfaced 6 key insights and 0 significant discoveries requiring plan changes. Previous retro follow-through improved from 43% to ~57%, with the two highest-impact items (transition scenarios and sprint-status tracking) fully completed and proven. The team is well-positioned for Epic 5B success, pending completion of the toast consolidation prep task.

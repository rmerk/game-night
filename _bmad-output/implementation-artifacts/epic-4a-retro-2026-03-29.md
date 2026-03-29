# Epic 4A Retrospective: Core Multiplayer

**Date:** 2026-03-29
**Facilitator:** Max (Scrum Master)
**Epic Status:** Complete (8/8 stories)

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
- Completed: 8/8 stories (100%)
- Tests grown: 593 → ~780 (+187 new server tests)
- Code review rounds: ~8 total across 8 stories (avg 1.0/story — down from 1.4 in 3A)
- Duration: 2 days (2026-03-28 to 2026-03-29)

**Quality and Technical:**
- Blockers encountered: 0
- Technical debt items: 2 carried from 3A (call-window monolith, CallType→GroupType bypass), 0 new
- Test coverage: Comprehensive — all server layers tested (HTTP, WebSocket, rooms, sessions, lifecycle)
- Production incidents: 0
- Regressions: 0

**Stories Delivered:**
1. 4A.1: HTTP Room Creation & Room Codes (32 server tests, 624 total)
2. 4A.2: WebSocket Server & Connection Management (60 server tests, 652 total)
3. 4A.3: Room Join via WebSocket & Seat Assignment (17 new, 669 total)
4. 4A.4: Session Identity & Token Management (21 new, 692 total) — stale token leak caught in review
5. 4A.5: Action/State Protocol & Message Handling (18 new, 710 total)
6. 4A.6: Per-Player View Filtering & Security Test (34 new, 744 total)
7. 4A.7: Game Start & Host Controls (7 new, 751 total)
8. 4A.8: Room Cleanup & Lifecycle Management (28 new, ~780 total) — orphaned timer bug caught in review

**New Server Infrastructure Built:**
- `packages/server/src/rooms/` — Room management, session identity, seat assignment, lifecycle timers
- `packages/server/src/websocket/` — WebSocket server, join handler, action handler, state broadcaster, message handler, connection tracker
- `packages/server/src/http/` — HTTP routes (room creation, status, health)
- `packages/shared/src/types/protocol.ts` — Full WebSocket protocol types

## Previous Retro Follow-Through (Epic 3A)

| Action Item | Status | Evidence |
|---|---|---|
| Create action handler validation checklist | ⏳ Partial | No formal checklist embedded in stories; reviews still catching bugs reactively (4A.4 stale token, 4A.8 orphaned timers) |
| Verify forward compatibility contracts in code review | ✅ Working | 4A.7 cleanly extended 4A.5's action handler; 4A.8 cleanly extended lifecycle patterns. No forward-compat breakage |
| Review for lesson propagation across handlers | ⏳ Partial | 4A.4's stale token leak is the exact class of cross-handler bug this was meant to prevent. Review caught it, but pattern wasn't applied proactively |

**Result: 1/3 action items fully completed, 2 partially done**

| Preparation Task | Status | Evidence |
|---|---|---|
| Establish server-side test patterns for Fastify + ws | ✅ Completed | 4A.1 established `app.inject()`, 4A.2 established real WebSocket client testing. Patterns reused in all 6 subsequent stories |
| Design GameTimer abstraction for multi-timer orchestration | ❌ Not built | Grace timers (session-manager) and lifecycle timers (room-lifecycle) use raw `setTimeout` with separate Map-based storage. No unified abstraction. |
| Plan buildPlayerView filtering for new 3A state fields | ✅ Completed | 4A.5 implemented, 4A.6 exhaustively tested with 4-player security assertions (AR31 satisfied) |
| Document import surface from shared/ → server/ | ❌ Not done | Import surface discovered organically during 4A.5, never formally documented |

**Result: 2/4 preparation tasks completed, 2 not addressed**

**Overall follow-through: 3/7 (43%) — flagged by Rchoi as needing improvement**

## Successes

1. **Pattern establishment in 4A.1/4A.2 carried through the entire epic** — `createApp()` factory, Fastify plugin pattern, child loggers per room, and validate-then-respond all replicated cleanly across 6 subsequent stories. Same architecture-first payoff seen in 3A with the call window design.

2. **Code reviews caught security-relevant bugs in 5/8 stories** — Modular bias in random generation (4A.1), redundant removeConnection (4A.2), stale token leak (4A.4), weak call window test assertion (4A.5), orphaned timers from stale WebSocket handlers (4A.8). Higher-impact catches than 3A with fewer review rounds.

3. **Code review efficiency improved** — Average 1.0 rounds per story, down from 1.4 in 3A. Reviews focused on deeper architectural and security issues rather than surface-level problems.

4. **Zero regressions across 187 new tests** — Every story maintained full test suite integrity. No shared/ or client/ tests broken by server changes.

5. **Debug issues dropped to zero in second half of epic** — Stories 4A.1-4A.4 each had debug issues (EADDRINUSE, MaxPayload, oxlint errors). Stories 4A.5-4A.8 reported "no debug issues encountered." Classic learning curve — exploration then exploitation.

6. **Story intelligence chain compounded server knowledge** — Each story explicitly referenced previous story learnings. By 4A.8, the dev agent had 7 stories of accumulated architecture knowledge, resulting in cleaner implementations.

7. **4A.6 improved pre-existing code health** — Reduced pre-existing TypeScript errors from 16 to 1 while adding 34 new tests. Stories actively improved the codebase, not just added features.

8. **Server-authoritative model held across all 8 stories** — Validate-then-mutate, no optimistic updates, information boundary (opponent racks never transmitted). Zero architectural deviations.

## Challenges

1. **Validation checklist from 3A retro still not proactively enforced** — Two consecutive retros flagged this gap. Reviews catch bugs reactively, but no mechanical enforcement exists to ensure patterns from story N are applied in story N+1. The stale token leak in 4A.4 (same class as 3A.2's duplicate tile ID exploit) demonstrates the continued risk.

2. **Timer implementations fragmented** — Three separate timer patterns emerged: grace period timers in `session-manager.ts`, lifecycle timers in `room-lifecycle.ts`, and call window timers in `shared/engine/`. All use `Map<string, ReturnType<typeof setTimeout>>` but with no shared abstraction. Risk increases in Epic 4B (reconnection/timeout heavy).

3. **Retro action item follow-through at 43%** — 3/7 items from 3A retro completed. Same items (validation checklist, timer abstraction) deferred across two epics. Rchoi flagged this as unacceptable — accountability mechanism needed.

4. **Import surface undocumented** — Which shared/ modules the server imports was never formally cataloged. Discovered organically but creates blind spots for future refactoring.

## Key Insights

1. **Architecture-first continues to pay off exponentially** — 4A.7 (game start) required minimal code changes because 4A.5's action handler was well-designed, mirroring 3A.6's zero-code experience. Investing in foundational stories saves work across all subsequent stories.

2. **Documentation is not enforcement** — Story intelligence chains document lessons in prose, but similar validation bugs still appear in later handlers. Prose lessons need mechanical enforcement (checklists in story specs, not just retro references).

3. **Learning curves reset with domain shifts** — Debug issues concentrated in first 4 stories (server infrastructure exploration), dropped to zero in last 4 (exploitation). Epic 5A's client shift will reset this curve. Plan for exploration in early stories.

4. **Code review ROI improved through pattern maturity** — Cleaner foundational patterns meant reviews could focus on deeper security and architecture issues rather than surface problems. Pattern quality → review quality.

5. **Retro accountability requires tracking, not just documentation** — Action items captured only in markdown prose don't get followed through reliably. Items need to be tracked in sprint-status or equivalent system to ensure visibility.

## Action Items

### Process Improvements

1. **Embed validation checklist in story specs**
   Owner: Scrum Master (story creation workflow)
   Deadline: First Epic 5A story
   Success criteria: Every new story spec includes a "Validation Checklist" section with: (a) pattern reuse from prior stories, (b) security checks (input sanitization, information boundary), (c) zero-mutation-on-rejection test, (d) cleanup/disposal verification
   Why: Two consecutive retros flagged this. Reviews catch bugs reactively; checklists prevent them proactively.

2. **Track retro action items as sprint-status entries**
   Owner: Scrum Master
   Deadline: This retro's output
   Success criteria: Action items from this retro appear as trackable items in sprint-status.yaml
   Why: Follow-through at 43% is unacceptable. Items in sprint-status get tracked; items in prose get forgotten.

3. **Expect and plan for learning curve in domain-shift epics**
   Owner: Team
   Deadline: Ongoing
   Success criteria: First 2-3 stories of domain-shift epics are scoped smaller to account for infrastructure exploration
   Why: 4A showed debug issues in first 4 stories, zero in last 4. Same pattern will repeat in 5A.

### Technical Debt

1. **Unify timer pattern before Epic 4B**
   Owner: Dev Agent
   Priority: Medium — not blocking 5A, critical before 4B
   Note: Extract shared timer management from `session-manager.ts` (grace timers) and `room-lifecycle.ts` (lifecycle timers)

2. **`call-window.ts` monolith (carried from 3A, now 2 epics)**
   Owner: Dev Agent
   Priority: Low — no 5A story imports from it; revisit when a story needs the split
   Note: Consumer-driven refactoring principle still applies

3. **Pre-existing lint warnings (74 warnings)**
   Owner: Dev Agent
   Priority: Low — address opportunistically

### Documentation

1. **Document shared/ → server/ import surface**
   Owner: Dev Agent
   Deadline: Before Epic 4B
   Note: Catalog which shared modules server imports, inform future refactoring decisions

## Epic 5A Preparation

### Critical (must complete before Epic 5A starts)

1. [ ] **Create `useWebSocket` composable** — WebSocket lifecycle, send/receive, auto-reconnect stub, mock WebSocket for testing
   Owner: Dev Agent (prep sprint)

2. [ ] **Create `useGameState` composable** — consumes WebSocket, exposes `Readonly<Ref<PlayerGameView | LobbyState>>`
   Owner: Dev Agent (prep sprint)

3. [ ] **Establish client test patterns** — `@vue/test-utils` with `createTestingPinia`, composable testing via `withSetup` helper, mock WebSocket
   Owner: Dev Agent (embedded in composable work)

### Parallel (during early stories)

4. [ ] **Research UnoCSS Wind4 preset** — theme key differences from Wind3 (`font` not `fontFamily`, etc.)
   Owner: Dev Agent (5A.1)

5. [ ] **Research Vue DnD Kit API** — understand `@vue-dnd-kit/core` integration patterns
   Owner: Dev Agent (before 5A.3)

## Readiness Assessment

| Area | Status |
|---|---|
| Testing & Quality | ✅ ~780 tests, zero regressions, typecheck clean, lint 0 errors |
| Server Architecture | ✅ Server-authoritative model, validate-then-mutate, information boundary all solid |
| Security | ✅ Exhaustive 4-player view filtering (AR31), session supersession, token revocation |
| Room Lifecycle | ✅ Three cleanup triggers tested, idempotent cleanup, room isolation verified |
| Timer Edge Cases | ⚠️ All tests use fake timers with controlled scenarios; real-world concurrent edge cases untested |
| Client Infrastructure | ⚠️ No composables, no real client tests — critical prep needed before 5A |
| Package Boundary | ✅ Clean — TypeScript project references enforce imports |
| Unresolved Blockers | None |

## Significant Discoveries

No significant discoveries that require updating Epic 5A's plan. Epic 4A's server infrastructure is solid and provides the complete foundation 5A needs. The protocol types (`StateUpdateMessage`, `PlayerGameView`, `ActionMessage`) are defined and tested. The one risk is the domain shift to client-side Vue development — mitigated by the prep sprint for composables and test patterns.

## Next Steps

1. Execute preparation sprint — create composables and client test patterns (critical)
2. Begin Epic 5A story creation when prep is complete
3. Embed validation checklist in story spec template
4. Track action items in sprint-status.yaml
5. Review these action items when first Epic 5A story starts

## Team Performance

Epic 4A delivered 8 stories with ~187 new server tests in 2 days. The complete multiplayer server was built from a skeleton — HTTP routes, WebSocket management, room join, session identity, action dispatching, per-player view filtering, game start, and room lifecycle cleanup. Code reviews caught security-relevant bugs in 5/8 stories. The retrospective surfaced 5 key insights and 0 significant discoveries requiring plan changes. The team is well-positioned for Epic 5A success, pending completion of client composable prep work.

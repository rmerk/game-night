# Epic 5B Retrospective: Remaining UI

**Date:** 2026-04-06
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
- Test growth: ~1,449 → ~1,561 (+112 new tests, +8%)
- Code review rounds: Every story received 2-3 review passes (adversarial + regression)
- Duration: ~12 hours (5B.1 evening Apr 5, 5B.2-5B.7 morning Apr 6)

**Quality and Technical:**
- Blockers encountered: 0
- Technical debt items: 3 carried from 4B (unaddressed), 1 new observation (scope bundling)
- Test coverage: Comprehensive — every AC verified in code and tests
- Production incidents: 0
- Regressions: 0

**Stories Delivered:**
1. 5B.1: NMJL Card Panel — 54 hand patterns, 7 categories, detail view, Charleston split-view, mutual exclusivity with chat
2. 5B.2: Hand Guidance Engine — shared closeness engine, room setting, 3-game auto-disable, guidance-achievable/distant styling
3. 5B.3: Wall Counter States — animated tone transitions, shared threshold constants, CSS custom property animations
4. 5B.4: Session Scoreboard & Rematch — session economics, dealer rotation, END_SESSION protocol, mood-lingering
5. 5B.5: Show Hands & Post-Game Social — voluntary hand reveal, ShownHand at seat positions, HAND_SHOWN toast
6. 5B.6: Settings Panel & Dealing Style — BaseToggle/BaseNumberStepper primitives, SlideInPanel settings, DealingAnimation
7. 5B.7: Activity Ticker — auto-expiring ticker store, exhaustive ResolvedAction copy (60 types), role="log" accessibility

**New Infrastructure Built:**
- `hand-guidance.ts` — Shared closeness engine with distance computation
- `BaseToggle.vue`, `BaseNumberStepper.vue` — Reusable form primitives with ARIA
- `DealingAnimation.vue` — Traditional dealing visual overlay
- `ActivityTicker.vue` + `activityTicker.ts` store — Auto-expiring event log
- `Scoreboard.vue` + `SessionScores.vue` — Multi-game session tracking
- `ShownHand.vue` — Post-game hand reveal at seat positions
- `session-scoring.ts` — Server session merge + dealer rotation

## Previous Retro Follow-Through (Epic 4B)

| Action Item | Status | Evidence |
|---|---|---|
| Toast consolidation before 5B | ✅ Completed | `resolvedActionToastCopy.ts` established as canonical copy source, documented in CLAUDE.md. Used in 5B.2, 5B.4, 5B.5, 5B.7 |
| Continue transition scenario tables | ✅ Completed | Every 5B story includes transition scenario tables with test coverage |
| Room type extraction (TurnTimerState, VoteState, SeatStatus) | ❌ Not Addressed | `4b-retro-2-room-type-extraction: pending` — server-focused, no natural moment in client-heavy epic |
| Fill 4B.4 integration test gaps | ❌ Not Addressed | `4b-retro-3-fill-4b4-integration-test-gaps: pending` — same rationale |
| Tokenless reconnect during pause | ❌ Not Addressed | `4b-retro-4-tokenless-reconnect-during-pause: pending` — edge-case, deferred |

**Result: 2/5 completed (40%). The two highest-impact items (toast consolidation, transition tables) were completed and proven. The three unaddressed items are server-focused and didn't compound during the client-heavy epic — but Room type extraction and 4B.4 test gaps are now 2 epics old and must be addressed before 6B.**

## Successes

1. **Smoothest epic in project history.** Zero blockers, zero regressions, every story passing quality gates on first implementation pass. Code reviews found documentation gaps and minor polish, not logic bugs — a qualitative shift from 4B where every review caught real bugs.

2. **SlideInPanel architecture compounded across 3 stories.** The foundation from Epic 6A served 5B.1 (NMJL card), 5B.6 (settings panel), and 5B.7 (ticker positioning) without rewrites. Same compounding pattern celebrated in 4B.

3. **Domain shift warning didn't materialize.** 4B retro predicted friction returning to client-heavy work. It didn't happen because Vue/UnoCSS/Pinia patterns were well-established from 5A and 6A. The learning curve reset didn't occur because foundational patterns were solid.

4. **Toast consolidation prep work paid off immediately.** The critical 4B retro item was completed and used cleanly across 5B.2, 5B.4, 5B.5, and 5B.7 with zero wiring confusion.

5. **Proactive accessibility across all stories.** `role="log"` with `aria-live="polite"` on ticker, `role="switch"` on toggles, `role="spinbutton"` on steppers, proper `aria-labelledby` associations. Second pass on 5B.6 caught and fixed label duplication.

6. **Hand guidance engine reused exposure filtering scaffolded in Epic 2.** `filterAchievableByExposure` was built "for future hand guidance" — and that future arrived in 5B.2. Clean reuse across epic boundaries.

7. **Velocity driven by foundational investment, not shortcuts.** 7 stories in ~12 hours because 5 of 7 stories were client-side work on top of existing server infrastructure. 5B.5 was 100% client wiring — engine already built. 5B.7 followed reactions.ts pattern. Speed came from reaping earlier epics.

8. **UI primitive extraction.** `BaseToggle` and `BaseNumberStepper` from 5B.6 are genuinely reusable design system investments for future epics.

## Challenges

1. **Scope bundling in 5B.6/5B.7.** The 5B.7 commit included DealingAnimation and settings panel slide-in refactor from 5B.6. Four files modified but not documented in File List (SlideInReferencePanels, slideInPanelIds, MobileBottomBar, RoomSettingsPanel). Git showed 15 modified files vs 11 documented. Reduces review accuracy and rollback safety.

2. **ResolvedAction union grew to ~60 discriminants.** From ~20 in 4B. The `tickerCopyForAction` composable explicitly returns `null` for 48 of 60 types. TypeScript exhaustive checking mitigates, but per-story maintenance overhead grows linearly.

3. **Three 4B retro items carried unaddressed for 2 epics.** Room type extraction, 4B.4 integration test gaps, tokenless reconnect during pause. Server-focused items had no natural moment in client-heavy 5B, but the carry pattern is concerning.

4. **Test growth was modest (+112 vs +669 in 4B).** Appropriate for enhancement work on tested infrastructure, but worth noting the slower growth rate.

## Key Insights

1. **Mature patterns eliminate domain-shift friction.** Nine epics of foundational work meant 5B stories implemented correctly on first pass. The predicted learning curve reset didn't happen because the patterns were solid.

2. **Velocity comes from reaping investment, not cutting corners.** Every "fast" 5B story traces back to a "slow" foundational decision in an earlier epic. 6B will NOT have this tailwind — WebRTC is greenfield.

3. **Prep work follow-through matters asymmetrically.** The one critical 4B retro item got done and paid off across 4 stories. The deferred items are now 2 epics old. Critical items must be done; lower-priority items need honest re-evaluation each retro.

4. **Transition scenario tables: three consecutive epics proven.** Non-negotiable practice going forward. The evidence base is overwhelming.

5. **Scope bundling trades traceability for velocity.** Team decision: choose traceability. One commit per story, File Lists must match git diff.

6. **Clean up before domain shifts.** Rchoi's instinct to address carried debt before attempting 6B (fundamentally new domain) is correct. The teams that ship well know when to sharpen the axe.

## Action Items

### Process Improvements

1. **One commit per story — no scope bundling**
   Owner: Dev Agent + Scrum Master (enforce in story specs)
   Deadline: Starting Epic 6B
   Success criteria: Every story's git diff matches its File List exactly. No undocumented files in commits.

2. **Continue transition scenario tables in all future stories**
   Owner: Scrum Master (story creation)
   Deadline: Ongoing
   Success criteria: Every story spec includes transition scenario table. Non-negotiable — proven across 3 consecutive epics.

3. **File List audit as code review gate**
   Owner: Code Reviewer
   Deadline: Starting Epic 6B
   Success criteria: Code review explicitly checks git diff against story File List. Discrepancies flagged as MEDIUM findings.

### Technical Debt (Clean before 6B)

1. **Extract concern-specific sub-objects from Room type**
   Owner: Dev Agent
   Priority: MEDIUM (carried 2 epics — originally from 4B retro)
   Scope: Extract `TurnTimerState`, `VoteState`, `SeatStatus` sub-objects. Create `createTestRoom(overrides)` builder. Reduce 20+ top-level fields.
   Success criteria: No server test file hand-constructs a Room with >10 fields. Builder provides sensible defaults.

2. **Fill 4B.4 deferred integration test gaps**
   Owner: Dev Agent
   Priority: LOW (carried 2 epics — originally from 4B retro)
   Scope: Tasks 10.2 (join-handler turn timer), 10.4 (ws-server vote dispatch), 10.6 (pause+cancelAfkVote). ~3 test files extended.
   Success criteria: Full WebSocket integration tests for timer/vote/pause transitions. These are the flows 6B.5 (A/V reconnection) will stress.

### Deferred (not blocking 6B)

- **Tokenless reconnect during pause (4B.3 T11)** — Edge-case-within-edge-case. Token-based works. Resolves naturally with Epic 8 accounts.
- **call-window.ts monolith (carried 4 epics)** — No consumer imports it in recent epics. Consumer-driven refactoring principle still applies. Split when a story needs it.

### Team Agreements

- One commit per story. Bundling trades traceability for velocity — choosing traceability.
- File Lists are audit trail. Must match git diff exactly.
- ResolvedAction union growth is accepted cost. TypeScript exhaustive checking is the mitigation. No abstraction needed yet.
- Debt cleanup sprint before 6B. Room extraction + 4B.4 test gaps. No new features until clean.

## Epic 6B Preparation

### Critical (must complete before 6B starts)

- [ ] Room type extraction + `createTestRoom` builder
- [ ] 4B.4 integration test gaps (Tasks 10.2, 10.4, 10.6)

### 6B-Specific Preparation (during or before first story)

- [ ] Research LiveKit server SDK integration — token generation, room mapping, Fastify route
- [ ] Evaluate `livekit-client` bundle size and lazy-loading strategy (must not count toward 5MB budget)
- [ ] Document TURN/STUN server requirements for production deployment
- [ ] Establish physical device testing workflow (iOS Safari, Android Chrome) — no emulators for A/V

### Not needed before 6B

- Tokenless-during-pause gap (defer)
- call-window.ts split (defer)

## Readiness Assessment

| Area | Status |
|---|---|
| Testing & Quality | ✅ 1,561 tests, zero regressions, typecheck clean, lint 0 errors |
| All ACs Verified | ✅ Every story received 2-3 review passes, all ACs confirmed |
| 5B Features | ✅ All 7 stories complete, production-ready |
| Carried Debt | ⚠️ Room type extraction and 4B.4 test gaps — 2 epics old, must address before 6B |
| 6B Readiness | ⚠️ New domain (WebRTC/LiveKit), new testing requirements (physical devices), prep needed |
| Unresolved Blockers | None for 5B |

## Significant Discoveries

No significant discoveries that require updating Epic 6B's plan. The key strategic insight is that **5B's velocity was driven by mature patterns and existing infrastructure — 6B will not have that tailwind.** WebRTC is greenfield with new dependencies, new testing workflows, and new deployment requirements. The team should expect 4B-style (or slower) velocity, not 5B-style. The cut line designation is appropriate and should remain as a genuine escape hatch.

## Team Performance

Epic 5B delivered 7 stories with 112 new tests in approximately 12 hours — the fastest and cleanest epic in the project's 9-epic history. The complete remaining UI layer was built: NMJL card reference with hand guidance, wall counter tension states, session scoreboard with rematch flow, post-game hand reveal, settings panel with dealing animation, and activity ticker. Code reviews found documentation gaps rather than logic bugs — a qualitative maturity shift. Previous retro follow-through was 40% (2/5), but the two completed items (toast consolidation and transition tables) were the highest-impact ones and paid off across multiple stories. The team is well-positioned for Epic 6B, pending completion of the debt cleanup sprint (Room type extraction, 4B.4 integration test gaps) and 6B-specific preparation (LiveKit research, device testing workflow).

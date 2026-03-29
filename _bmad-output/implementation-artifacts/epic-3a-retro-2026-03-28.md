# Epic 3A Retrospective: Turn Flow & Calling

**Date:** 2026-03-28
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
- Tests grown: 375 → 593 (+218 new tests)
- Code review rounds: 0+3+2+2+1+1+1+1 = 11 total (avg 1.4/story)
- Duration: 2 days (2026-03-27 to 2026-03-28)

**Quality and Technical:**
- Blockers encountered: 0
- Technical debt items: 2 (type safety bypass CallType→GroupType, abstract color matching carried forward from Epic 2)
- Test coverage: Comprehensive — all call types, priority resolution, confirmation/retraction, both Mahjong paths, dead hand, challenge mechanism
- Production incidents: 0
- Regressions: 0

**Stories Delivered:**
1. 3A.1: Call Window — Open, Timer, Pass & Early Close (16 tests, 391 total)
2. 3A.2: Call Actions — Pung, Kong, Quint with Validation (16 tests, 407 total) — 3 review rounds
3. 3A.3: Pattern-Defined Group Calls — NEWS, Dragon Sets (30+ tests, 435 total)
4. 3A.4: Call Window Freeze & Priority Resolution (27 tests, 464 total)
5. 3A.5: Call Confirmation, Exposure & Retraction (28 tests, 492 total)
6. 3A.6: Turn Advancement After Calls — Skip-Ahead (11 tests, 525 total) — zero code changes needed
7. 3A.7: Mahjong Declaration & Auto-Validation (34 tests, 559 total)
8. 3A.8: Invalid Mahjong Handling & Challenge Mechanism (34 tests, 593 total)

**New Action Types Added (15+):**
PASS_CALL, CALL_PUNG, CALL_KONG, CALL_QUINT, CALL_NEWS, CALL_DRAGON_SET, CALL_MAHJONG, DECLARE_MAHJONG, CONFIRM_CALL, RETRACT_CALL, CANCEL_MAHJONG, CONFIRM_INVALID_MAHJONG, CHALLENGE_MAHJONG, CHALLENGE_VOTE, CONFIRMATION_TIMEOUT

**Functional Requirements Implemented:**
FR19-FR31, FR55, FR57-FR58, FR64-FR69, FR71-FR72, FR76-FR79

## Previous Retro Follow-Through (Epic 2)

| Action Item | Status | Evidence |
|---|---|---|
| Extract shared utilities on second use, not third | ✅ Completed | Story 3A.6 extracted `getNonDiscarders` and `injectTilesIntoRack` to shared testing helpers |
| Review test assertions for substance, not just existence | ✅ Completed | Reviews caught: duplicate tile ID exploit (3A.2 R2), Joker double-counting (3A.3), dead code in pair rejection (3A.2 R1) |
| Fix lint warning noise in test helpers | ⏳ Partial | New code lint-clean (0 errors), some pre-existing client TestHarness warnings remain (3A.8 fixed some) |
| Abstract color matching limitation | ❌ Deferred | Low priority, not relevant to 3A |
| Card data encoding tooling | ❌ Deferred | Not blocking |

**Result: 3/5 action items completed, 2 intentionally deferred (low priority)**

**Epic 3A Preparation Tasks:**

| Prep Task | Status | Evidence |
|---|---|---|
| Extend test helpers for multi-step action sequences | ✅ Completed | `setupCallScenario`, `setupPatternCallScenario`, `executeCallFlow` built incrementally |
| Validate `vi.useFakeTimers()` works | ✅ Completed | Validated in 3A.1 for `Date.now()`, used throughout for confirmation/challenge timeouts |
| Plan action type extensions (7+ new types) | ✅ Completed | 15+ action types added cleanly with exhaustive type checking maintained |

**Result: 3/3 preparation tasks completed (100%)**

## Successes

1. **Architecture-first design enabled the entire epic** — The call window design in 3A.1 (opening after every discard instead of calling `advanceTurn` directly) was the foundation for all 7 subsequent stories. Story 3A.6 required ZERO code changes — skip-ahead worked because the architecture was right.

2. **Story intelligence chain compounded knowledge** — Every story's dev notes explicitly referenced previous story learnings. 3A.2 carried forward the validation chain from 3A.1. 3A.3 carried forward the duplicate tile ID security fix from 3A.2. By 3A.8, dev agents built on 7 stories of accumulated knowledge.

3. **Test helper ecosystem evolved organically** — From raw `createTestState()` in 3A.1 to `setupCallScenario`, `setupPatternCallScenario`, `injectTilesIntoRack`, `executeCallFlow` — each extracted when needed the second time, per Epic 2 retro commitment.

4. **Code reviews caught real security bugs** — Duplicate tile ID exploit via `rack.find()` (3A.2 R2), Joker double-counting in `getValidCallOptions` (3A.3), ALREADY_CALLED guard missing (3A.4). These would have been game-breaking in multiplayer.

5. **Epic 2 retro prep tasks eliminated infrastructure surprises** — `vi.useFakeTimers()` validated early, action type extensions planned, test helpers extended. Zero infrastructure blockers across 8 stories.

6. **Single `handleCallAction` design avoided duplication** — One function handling pung, kong, quint, NEWS, and dragon set with `isPatternDefinedCall` branching. Clean separation of concerns.

7. **Package boundary discipline held** — 21 client tests passed throughout. All game logic stayed in shared/. No cross-package violations.

8. **100% story completion with zero regressions** — 593 tests, typecheck clean, lint clean across all 8 stories.

## Challenges

1. **Code review rounds increased (1.2 → 1.4 avg)** — Story 3A.2 took 3 review rounds (the most of any story across Epics 1-3A). Pair rejection ordering bug, `tilesMatch` reuse gap, and duplicate tile ID exploit all missed in initial implementation.

2. **Lesson propagation gaps across handlers** — Duplicate tile ID check was solved in 3A.2's `handleCallAction` but missing in 3A.5's `handleConfirmCall`. The lesson was documented in the story intelligence chain but not enforced as a checklist.

3. **`call-window.ts` growing into a monolith** — 18+ functions in one file by 3A.5: handlePassCall, handleCallAction, handleCallMahjong, closeCallWindow, resolveCallWindow, resolveCallPriority, getSeatDistance, enterConfirmationPhase, handleConfirmCall, handleRetractCall, handleRetraction, handleConfirmationTimeout, getValidCallOptions, tilesMatch, validateNewsGroup, validateDragonSetGroup, isPatternDefinedCall, buildGroupIdentity, validateConfirmationGroup.

4. **Forward compatibility notes not honored** — 3A.7 dev notes explicitly said "Design the rejection path so 3a-8 can extend it without refactoring." But 3A.8 still had to change the behavioral contract (rejection → warning) and rewrite 3 existing tests. The extension point wasn't verified in code review.

## Key Insights

1. **Story intelligence works for knowledge transfer but needs checklist enforcement** — The chain documents lessons well, but similar validation patterns must be actively applied to new handlers via a checklist, not just referenced in prose.

2. **File complexity should be managed proactively but refactored by consumers** — Document the splitting need when it's observed; defer the refactor to when a story actively imports from the file (consumer-driven splitting).

3. **Forward compatibility contracts should be verified in code review** — When dev notes reference a future story, the reviewer should explicitly check: "Can story X extend this without breaking existing tests?"

4. **The retro loop is demonstrably working** — Epic 2 action items (shared utility extraction, test assertion quality) were executed and measurably improved Epic 3A. This validates the retro process itself.

5. **Architecture-first pays off exponentially** — Getting the call window design right in 3A.1 saved implementation effort across 7 subsequent stories and enabled emergent behavior (skip-ahead) with zero additional code.

## Action Items

### Process Improvements

1. **Create action handler validation checklist**
   Owner: Scrum Master (embed in story creation)
   Deadline: First Epic 4A story
   Success criteria: Every new action handler story includes checklist — duplicate ID check, zero-mutation-on-rejection test, dead hand check (where applicable), existing validation patterns applied

2. **Verify forward compatibility contracts in code review**
   Owner: Code Reviewer
   Deadline: Ongoing from Epic 4A
   Success criteria: When a story's dev notes reference a future story, reviewer explicitly verifies the extension point works without breaking existing tests

3. **Review for lesson propagation across similar handlers**
   Owner: Code Reviewer
   Deadline: Ongoing
   Success criteria: When a validation pattern is established in story N, reviewer checks it's applied in story N+1's similar handlers

### Technical Debt

1. **`call-window.ts` monolith (18+ functions)**
   Owner: Dev Agent (when first server import story begins)
   Priority: Medium — defer to Epic 4A consumer-driven refactor
   Note: Let Story 4A.5 drive the split based on actual import patterns

2. **Type safety bypass: `CallType` includes "mahjong" but `GroupType` does not**
   Owner: Dev Agent
   Priority: Low — deferred from 3A.5, mahjong doesn't create exposed groups
   Note: Revisit if type errors surface in Epic 4A

3. **Abstract color matching limitation (carried from Epic 2)**
   Owner: Deferred
   Priority: Low — revisit with 2027 card data

## Epic 4A Preparation

### Critical (should address early)

1. [ ] **Establish server-side test patterns for Fastify + ws**
   Owner: Dev Agent (Story 4A.1 or 4A.2)
   Note: First server stories set testing conventions — Fastify `inject()` for HTTP, ws client mocking for WebSocket. Patterns reused by all subsequent stories.

2. [ ] **Design `GameTimer` abstraction for multi-timer orchestration**
   Owner: Game Architect
   Note: Three timer patterns — call window (cancel on freeze), confirmation (cancel on confirm/retract), challenge (fill defaults on expiry). Must handle cleanup on room destruction.

### Parallel (can happen during early stories)

3. [ ] **Plan `buildPlayerView` filtering for new 3A state fields**
   Owner: Game Architect / Dev Agent
   Note: `pendingMahjong` (private to declaring player), `challengeState` (semi-public), `INVALID_MAHJONG_WARNING` resolved action (private). Story 4A.6 needs exhaustive adversarial assertions.

4. [ ] **Document import surface from shared/ → server/**
   Owner: Dev Agent (Story 4A.5)
   Note: Which shared/ functions does the server need? Informs whether `call-window.ts` split is needed before or during 4A.5.

## Readiness Assessment

| Area | Status |
|---|---|
| Testing & Quality | ✅ 593 tests passing, typecheck clean, lint clean |
| Shared/ Engine | ✅ Solid — all action handlers, both Mahjong paths, dead hand, challenge |
| Server Timer Patterns | ⚠️ Zero implementation experience — needs early attention in 4A.5 |
| View Filtering Design | ⚠️ Privacy requirements from 3A.8 add complexity beyond basic rack hiding |
| Server/ Codebase | ⚠️ Blank slate — first real server code in 4A.1/4A.2 |
| Package Boundary | ✅ Clean — TypeScript project references enforce imports |
| Test Infrastructure | ⚠️ Need WebSocket test patterns (Fastify injection, ws mocking) |
| Unresolved Blockers | None |

## Significant Discoveries

No significant discoveries that require updating Epic 4A's plan. The shared/ engine is solid, all action types are ready for network wiring, and Epic 4A's stories already account for the complexity built in 3A. Story 4A.5 explicitly covers call window message types and networked synchronization. The plan is sound.

## Next Steps

1. Begin Epic 4A story creation when ready
2. Establish server-side test patterns in Stories 4A.1/4A.2 (critical)
3. Design `GameTimer` abstraction before Story 4A.5
4. Plan `buildPlayerView` privacy filtering for 3A state fields
5. Review these action items when first Epic 4A story starts

## Team Performance

Epic 3A delivered 8 stories with 218 new tests (375 → 593) in 2 days. The calling system, both Mahjong paths, dead hand enforcement, and challenge mechanism are all fully implemented. The retrospective surfaced 4 key insights and 0 significant discoveries requiring plan changes. The team is well-positioned for Epic 4A success.

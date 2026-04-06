# Epic 6B Retrospective: Voice & Video (WebRTC)

**Date:** 2026-04-06
**Facilitator:** Max (Scrum Master)
**Epic Status:** Complete (5/5 stories)

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
- Completed: 5/5 stories (100%)
- Duration: ~1 day (all stories implemented, reviewed, and marked done April 6)
- Code review rounds: Every story received 2-3 review passes (adversarial + regression)
- Pre-6B debt cleanup: Completed as gated prerequisite (Room type extraction, 4B.4 test gaps)

**Quality and Technical:**
- Blockers encountered: 0
- Technical debt items created: 0
- Production incidents: 0
- Regressions: 0

**Stories Delivered:**
1. **6B.1:** LiveKit SDK integration, server token generation, `useLiveKit` composable, WS protocol extension, deployment docs
2. **6B.2:** PlayerPresence/VideoThumbnail/AvatarFallback components, responsive sizing, mobile tap-to-expand
3. **6B.3:** AVControls with mic/camera toggles, permission UX with friendly pre-prompts, graceful denial
4. **6B.4:** Speaking indicator with accessibility-aware animation, `prefers-reduced-motion` support, local voice status dot
5. **6B.5:** A/V reconnection with 10s watchdog, manual retry button, `retryLiveKitConnection` promise infrastructure

**New Infrastructure Built:**
- `useLiveKit` composable — full LiveKit SDK wrapper with connection, tracks, speakers, controls, permissions
- `useLiveKitStore` — Pinia store for serializable A/V state
- `useAvReconnectUi` — reconnection watchdog + manual retry coordination
- `AVControls.vue` — mic/camera toggles with permission guidance and reconnect UI
- `PlayerPresence.vue` / `VideoThumbnail.vue` / `AvatarFallback.vue` — seat-position video rendering
- `livekit-handler.ts` — server-side token generation
- `presenceFrame.ts` — responsive sizing constants
- `docs/livekit-deployment.md` — TURN/STUN production deployment guide

## Previous Retro Follow-Through (Epic 5B)

| Action Item | Status | Evidence |
|---|---|---|
| One commit per story | ✅ Completed | Every 6B story used a single conventional commit. No scope bundling. |
| File List audit as code review gate | ✅ Completed | Every code review explicitly checked git diff against story File List. |
| Room type extraction + `createTestRoom` builder | ✅ Completed | `pre6b-debt-cleanup` Part A — commit `e079dd7`, done before 6B started |
| 4B.4 integration test gaps | ✅ Completed | `pre6b-debt-cleanup` Part B — done before 6B started |
| Transition tables in story specs | ✅ Completed | Story 6B.5 includes AC→FR traceability table; all stories include task-to-AC mapping |

**Result: 5/5 completed (100%).** First time in project history. The pre-6B debt cleanup as a gated prerequisite was the key driver — carried debt from 4B retro (2 epics old) was resolved before starting greenfield WebRTC work.

## Successes

1. **100% retro follow-through for the first time.** Pre-6B debt cleanup gate proved the model: treat carried debt as first-class work items gated before domain shifts.

2. **Progressive composable growth without rewrites.** `useLiveKit` started as a simple connection wrapper in 6B.1 and grew through 5 stories without restructuring. The initial API surface (reactive refs + methods + `shallowRef` room) was the right abstraction from day one. Credit to 6B.1's dev notes: "Design the composable API with 6B.2-6B.5 needs in mind."

3. **NFR23 invariant held across all 5 stories.** "LiveKit failure NEVER impacts game state" was tested from five angles: connection failure (6B.1), track attach failure (6B.2), permission denial (6B.3), disconnected speaking state (6B.4), reconnection timeout (6B.5). Confidence-building for production.

4. **`presenceFrame.ts` sizing constants eliminated layout shift concerns.** Fixed dimensions at each breakpoint meant zero layout shift across 6B.3, 6B.4, and 6B.5 — a small 6B.2 investment that paid off in 3 subsequent stories.

5. **Multi-pass code reviews caught quality gaps in every story.** 6B.1: missing connect-failure test, dead composable file, trySendJson duplication. 6B.2: four missing track event tests. 6B.4: token-driven CSS variable improvement. 6B.5: timer cleanup, race condition in retry logic.

6. **Greenfield WebRTC integration completed faster than predicted.** 5B retro warned "expect 4B-style velocity" for 6B. All 5 stories shipped in a single day.

7. **Separation of concerns across three composables.** `useLiveKit` (SDK wrapper), `useLiveKitStore` (serializable state), `useAvReconnectUi` (UI coordination) — three distinct responsibilities, clean boundaries.

## Challenges

1. **Zero real-device / real-server verification.** Entire epic tested with mocked LiveKit SDK. Permission flows, NAT traversal, audio quality, mobile camera behavior, stream startup timing all unverified. Project context explicitly requires physical device testing for WebRTC. This is the critical gap.

2. **NFR50 (streams within 5 seconds) unverified.** 6B.3 completion notes: "not automated; relies on manual verification." Manual verification has not occurred.

3. **First-pass test coverage consistently under-covers edge cases.** Pattern across all 5 stories — code reviews found missing tests every time. Not logic bugs, but coverage gaps (event handlers, cleanup/teardown, race conditions).

4. **`ShallowRef<unknown>` room typing creates repeated friction.** Three stories (6B.2, 6B.3, 6B.5) needed the `getRoom(): Room | null` cast pattern. Trade-off for declaration-emit portability, but friction for consumers.

5. **`liveKitTokenRequested` flag trap in reconnection flow.** Subtle state management issue where the flag stays `true` after first `STATE_UPDATE`, blocking automatic re-request after LiveKit connect failure. Story spec anticipated this ("manual retry trap"), which saved debugging time.

6. **Race condition in `retryLiveKitConnection`.** After 10s timeout, late completions from stale attempts could invoke the waiter's `finish`. Caught on third dev pass — fix was incrementing `liveKitRetryGeneration` on timeout.

## Key Insights

1. **Story specs that anticipate edge cases save significant review time.** 6B.5's token flag trap callout prevented a multi-hour debugging session. Extending this to all stories as "edge-case test hints" is a low-cost, high-impact improvement.

2. **Debt cleanup as a gated prerequisite works and should remain standard.** Pre-6B cleanup resolved all carried debt and directly benefited 6B implementation (Room type extraction made livekit-handler tests cleaner; 4B.4 test gaps covered flows 6B.5 stressed).

3. **Forward-looking API design in foundation stories prevents mid-epic rewrites.** 6B.1's composable API anticipated all 4 subsequent stories' needs.

4. **Velocity was context-dependent.** Single-session, same-agent, full context carry-forward. Don't extrapolate to Epic 7, which may involve different sessions and context gaps.

5. **Mock-only testing is insufficient for hardware-dependent features.** Unit/component tests verify wiring correctness but cannot validate real WebRTC behavior. Real-device testing must be a first-class gate.

6. **Epic 7 requires a different testing strategy.** Visual polish and audio are subjective — automated tests verify code, but "does the felt look real" and "does the Mahjong motif feel cinematic" require manual sign-off.

## Action Items

### Process Improvements

1. **Edge-case test hints in story specs**
   Owner: Scrum Master (story creation)
   Deadline: Starting Epic 7
   Success criteria: Every story spec includes a short "edge cases to test" section alongside task list. Reduces review-found test gaps.

2. **Continue one-commit-per-story + File List audit gate**
   Owner: Dev Agent + Code Reviewer
   Deadline: Ongoing
   Success criteria: Maintained — proven across 2 consecutive epics.

3. **Continue transition scenario tables in all future stories**
   Owner: Scrum Master
   Deadline: Ongoing
   Success criteria: Proven across 4 consecutive epics. Non-negotiable.

### Technical Debt

1. **`ShallowRef<unknown>` room typing in `useLiveKit`**
   Owner: Dev Agent
   Priority: LOW
   Scope: Investigate typed facade or generic parameter to eliminate repeated `getRoom()` casts.
   Success criteria: No `as Room` casts needed in consumer code.

### Team Agreements

- Real-device A/V validation is a first-class gate before Epic 7
- Edge-case test hints in story specs — lightweight guidance, not formal checklist
- Debt cleanup gate before domain shifts is standard practice
- Don't assume 6B's velocity carries to Epic 7 (different domain, subjective validation)

## Epic 7 Preparation

### Critical (must complete before Epic 7 starts)

1. **Stand up self-hosted LiveKit server**
   Owner: Dev Agent + Rchoi
   Success criteria: LiveKit server reachable, env vars configured in `.env.local` for both packages.

2. **Real-device A/V validation matrix**
   Owner: Dev Agent + Rchoi (manual testing)
   Success criteria: All verified on real hardware:

   | Test | Devices | Validates |
   |------|---------|-----------|
   | Two-player audio/video call | Desktop + mobile | 6B.1 connection, 6B.2 thumbnails |
   | Permission prompt flow | iOS Safari, Android Chrome | 6B.3 friendly guidance UX |
   | Mic/camera toggles | All devices | 6B.3 controls, avatar swap |
   | Speaking indicator from real speech | Any two devices | 6B.4 VAD |
   | Network drop → reconnection | Mobile (airplane mode toggle) | 6B.5 watchdog + retry |
   | Stream start timing | All devices | NFR50 (<5s on grant) |
   | Cross-network TURN/STUN | Two different networks | NAT traversal |

3. **Fix any issues discovered during validation**
   Owner: Dev Agent
   Success criteria: All critical issues resolved. Known limitations documented.

### 7-Specific Preparation

- [ ] Source audio assets for 7.3 (10-12 sound effects — tile sounds, motifs, alerts)
- [ ] Verify PlayerPresence/VideoThumbnail survive mood class transitions without layout shift (7.1 dependency)
- [ ] Confirm celebration overlay (7.2) dim logic excludes video thumbnails and interactive buttons

### Not needed before Epic 7

- `ShallowRef<unknown>` typing fix (LOW — address opportunistically)

## Significant Discoveries

**Real-device validation gap requires gating Epic 7.** The entire 6B epic was tested with mocked LiveKit SDK. While unit/component test coverage is comprehensive for wiring correctness, no real WebRTC connections have been established. Permission flows, NAT traversal, audio quality, mobile camera behavior, and stream startup timing are all unverified. Epic 7 is gated behind completing the real-device validation matrix above. This is not an architectural concern — the design is sound — but an integration verification gap that must close before building visual polish on top of A/V infrastructure.

## Readiness Assessment

| Area | Status |
|---|---|
| Testing & Quality (unit/component) | ✅ All tests passing, typecheck clean, zero lint errors |
| Real-Device A/V Validation | ❌ Not started — critical path gate |
| NFR50 Verification | ❌ Not verified — included in device validation matrix |
| All ACs Verified (code level) | ✅ Every story received 2-3 review passes |
| Carried Debt | ✅ None — first time in project history |
| Epic 7 Readiness | ⛔ Blocked on real-device validation + audio asset sourcing |

## Team Performance

Epic 6B delivered the complete voice and video layer — LiveKit SDK integration, video thumbnails at seat positions, mic/camera controls with permission guidance, accessibility-aware speaking indicators, and A/V reconnection with graceful degradation — in a single day with zero regressions and zero technical debt created. Previous retro follow-through hit 100% for the first time, validating the debt-cleanup-as-gate model. The team identified a critical gap in real-device validation and made the disciplined call to gate Epic 7 behind it rather than building visual polish on top of unverified A/V infrastructure. Code-level quality is excellent; hardware-level confidence requires the validation matrix before proceeding.

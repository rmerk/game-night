# Journey Into Epic 6A — Text Chat & Reactions

**Generated:** 2026-04-05
**Scope:** Epic 6A only (Stories 6A.1 → 6A.4)
**Period covered:** 2026-04-03 → 2026-04-05 (three calendar days, four stories)
**Data sources:** claude-mem observations (#710–719, 9 entries), git log (29 commits), story files (6A.1–6A.4), Epic 6A retrospective

> **Note on data density.** Epic 6A executed largely through Cursor cloud agents on short-lived branches (PRs #11–#18). claude-mem captured the high-level milestones — story creation, handler implementation, test coverage, retrospective — but not the moment-by-moment debugging telemetry that would exist for a local development session. The richest narrative evidence for Epic 6A lives in the **git log** and the **story files themselves** (particularly their Change Log and Dev Agent Record sections). This timeline synthesizes all three sources and is explicit when it leans on one over the others.

---

## Project Genesis — Where Epic 6A Started

Epic 6A did not begin on 2026-04-03. It began at the end of Epic 3C, on 2026-04-04, when the team made the deliberate choice to treat multiplayer social features as the next in-repo epic rather than jumping directly to Epic 4B (Multiplayer Resilience).

The rationale, visible in the Epic 3C retrospective (`epic-3c-retro-2026-04-04.md`), was sequencing: Epic 3C had just finished closing the last of the client integration debt carried forward from Epic 3B. Specifically, Stories 3C.8 and 3C.9 had established the production path from server `PlayerGameView` → `mapPlayerGameViewToGameTable` → prop-driven `GameTable` UI. Epic 6A was framed as the first epic that could *assume* that path existed rather than *build* it.

Alice's retro note captured the intent: *"6A is mostly protocol + UI surface — it should assume 3C.8's live state path is the norm, not the exception."*

The founding technical decision for Epic 6A was therefore an architectural constraint rather than a feature: **chat and reactions would ride on the existing WebSocket connection**, would be **orthogonal to `STATE_UPDATE`** (not embedded in game state), and would **not route through the game engine** (`handleAction` / `GameAction`). Every subsequent story honored this constraint without ambiguity.

---

## Day One — 2026-04-04 Early Morning: Story Creation and Protocol Design

Epic 6A opened at **7:03 AM on April 4** with observation #710: *"Chat and Reaction Protocol Specification (Story 6A.1)."* One minute later, #711 recorded the first substantive decision: *"Story 6A.1 Enhanced with Implementation Guardrails."*

The two observations back-to-back are worth noticing. The team did not write a thin story and then start coding. They wrote a story *and then deliberately enhanced it with guardrails* before handing it off. The guardrails that appear in the final 6A.1 story file — silent-drop semantics for invalid payloads, the `CONTROL_CHARS` regex reused from `join-handler.ts`, the explicit list of anti-patterns ("Add `CHAT`/`REACTION` to `GameAction`", "Push chat into `StateUpdateMessage`") — are the visible fingerprint of that enhancement pass.

This is the start of a pattern that holds across all four stories: **every story received a second pass on its specification before implementation began**. The commit log makes this explicit for 6A.2 and 6A.4:

- `ee8ded9 docs(gds): second pass on story 6A.2 (placeholder, lobby, Pinia, AC tweaks)`
- `5ed2c20 docs(gds): second pass on Story 6A.3 quick reactions spec`
- `eda4bd0 docs(gds): second pass on story 6A.4 (UTF-8 cap, REQUEST_STATE, ordering)`

Three minutes later, at 7:06 AM, observation #712 — *"Chat and Reaction System Foundation"* — marked the start of 6A.1 implementation. #713 followed immediately: *"Chat and Reaction Server-Side Handler Implementation."* #714: *"Chat and Reaction Test Suite."*

In the span of four memory observations (from spec enhancement to test suite), the server-side chat and reaction pipeline was functionally complete. No intermediate debugging observations were recorded. Either the implementation was genuinely smooth, or — more likely — the moment-by-moment debugging happened on a Cursor branch and was not surfaced back into claude-mem.

The git log supports the "genuinely smooth" reading. Commit `4fa1beb feat(server): implement chat and reaction message handling` landed Story 6A.1's implementation in a single feat commit. There is no `fix` commit between the initial implementation and the first code review.

---

## Day One — Mid-Morning: The First Pass-2 Bug

The first bug of Epic 6A was caught in code review on 2026-04-04: commit `d4e8b2b fix(server): clear chat/reaction rate limits when seat is released`.

The bug was subtle. Rate-limit state — the per-player sliding-window timestamps used to throttle chat and reactions — was keyed by `playerId`. When a player left during the grace period and their seat was later recycled to a new occupant, the new occupant inherited the previous occupant's rate-limit clock. If the previous player had hit the limit right before disconnecting, the new player would start rate-limited.

This bug has two notable properties. First, it was caught by an adversarial second review, not by the happy-path acceptance criteria. The AC tested "rate limit throttles a player" — which worked. It did not test "rate limit state is cleared when a seat is recycled," because the AC was written in happy-path shape. Second, this exact pattern — a state-boundary bug caught by pass 2 and not by pass 1 — would recur in every subsequent story of Epic 6A.

By the time observation #719 was written on 2026-04-05 at 8:35 AM, this pattern had crystallized into the epic's defining narrative: *"Every story's pass-2 review caught a state-transition bug that pass-1 missed."*

---

## Day One — Afternoon: Story 6A.2 and the SlideInPanel Decision

The commit `81e2e44 docs(gds): add story 6A.2 chat panel SlideInPanel spec and sprint status` followed `ee8ded9` (the second-pass refinement) on the same day. Story 6A.2 is the most architecturally ambitious story in Epic 6A because it establishes a contract — `useSlideInPanelStore` with mutual-exclusivity semantics — that no story in 6A would consume in full. The contract was built in 6A.2 knowing that **6A.3 would consume `isAnySlideInPanelOpen`**, and **Epic 5B's future NMJL panel would consume `activePanel === 'nmjl'`**.

The 6A.2 story spec anticipated this by requiring a **stub NMJL panel** to be shipped in 6A.2 — not because the NMJL feature was ready, but because shipping the stub *proves the contract in code*, not just in documentation. The spec's exact language: *"the NMJL panel may be a stub (no real content) as long as the store contract exists for 5B."*

This is an unusual discipline. Most teams build a contract, document it, and hope the next consumer honors it. Epic 6A built the contract and exercised it in code at the moment of introduction.

Implementation landed as `80512e0 feat(client): add chat panel UI and CHAT protocol wiring (6A.2)`. Then the pass-2 pattern repeated. Commit `ac2d2af refactor(client): harden slide-in panels and sendChat tests (6A.2 pass 2)` caught two problems: duplicate DOM element IDs when both the mobile and desktop panels mounted (broke `aria-controls`), and a subtle issue where the `sendChat` test coverage had gaps around socket-closed state.

Then a second pass-2 bug, even more interesting: commit `bef070e fix(client): keep chat slide-in available during scoreboard phase`. The bug: during scoreboard phase, `SlideInReferencePanels` and `MobileBottomBar` were `v-if="!isScoreboardPhase"` (hidden), but the **chat toggle itself** remained visible in the game chrome. A player could click the toggle, setting `activePanel = 'chat'`, but there was no panel DOM to render — broken UX with no error. The fix: always mount the slide-in panels and mobile bar, add a `scoreboardChatFocusReturnRef` for Escape-key behavior when there is no action zone.

This bug is the purest example of a **phase-transition bug**. Pass 1 tested "chat panel opens and shows messages" (happy path). It worked. Pass 2 tested "what if the game is in scoreboard phase when the user clicks the toggle?" (transition). It didn't work.

---

## Day One — Night: Story 6A.3 and Reaction Dedupe

Story 6A.3 — the quick reactions system — was created at `8e150eb` and refined at `5ed2c20`. Implementation landed in two feat commits: `88d1b63 feat(client): parse REACTION_BROADCAST and add sendReaction path` and `50be788 feat(client): add reaction bar, bubbles, and GameTable anchoring`.

The most interesting engineering moment in 6A.3 is captured in commit `17b1452 fix(client): tighten reaction anchors (AC4), dedupe broadcasts, a11y motion`. The three fixes in that single commit are individually significant:

1. **Reaction anchor tightening.** Initial implementation resolved `playerId` → seat position using ad-hoc geometry. The fix refactored this to use `reactionBubbleAnchorForPlayer` in `mapPlayerGameViewToGameTable.ts`, reusing the same wind rotation logic the table layout already used. **This was the direct application of the Epic 3C retrospective's action item** about not forking mapper logic. The connection is visible in story dev notes.

2. **Broadcast dedupe.** The server echoes `REACTION_BROADCAST` to all sessions including the sender. If the client also showed an optimistic local bubble, the sender would see duplicate bubbles. The fix established a "broadcast-only" rule — the local player's own bubble appears only when the server echo arrives — and added explicit dedupe on `playerId + serverTimestamp`.

3. **Reduced-motion handling.** Respecting `prefers-reduced-motion` on bubble entry/exit. A11y discipline that could easily have slipped.

But the pass-2 pattern struck again. Commit `fb725fa fix(client): harden reaction broadcast dedupe and handleMessage flow` caught a regression: the dedupe compared the first fix's bubble-record string `id` instead of the raw `ReactionBroadcast.timestamp`. Under certain broadcast orders, this allowed duplicates through. The fix stored `serverTimestamp` on the bubble record explicitly, avoiding fragile string parsing. Additionally, `handleMessage` was missing an explicit `return` after the `reaction_broadcast` branch — minor but inconsistent with other branches.

And one more pass-2 bug: `22a7432 feat(client): lobby reaction bubbles and clear on game start (6A.3)`. This bug surfaced a lobby↔game transition gap. Lobby reaction bubbles (shipped for AC12 parity) needed to be cleared when `playerGameView` appeared after lobby-only state, otherwise stale lobby bubbles would render over the game table seat positions.

Three bugs in one story, all caught in pass 2, all state-transition bugs. The pattern was now unmistakable.

---

## Day Two — 2026-04-05: Story 6A.4 and the UTF-8 Revelation

Story 6A.4 was created at `dbd8576 docs(gds): add story 6A.4 chat history on connect/reconnect` and refined at `eda4bd0`. The second pass is particularly notable: the commit message — *"Pass 2: fixed payload sizing (UTF-8 bytes), mandated send order, REQUEST_STATE path, SESSION_SUPERSEDED + list-key notes"* — reveals that the spec refinement *itself* caught a critical bug class before implementation began.

The bug the spec caught: measuring the chat-history payload size with JavaScript's `string.length` property. `string.length` counts UTF-16 code units, not UTF-8 bytes. For ASCII chat messages, the two values are identical. But for chat messages containing emoji, astral-plane characters, or multi-byte UTF-8 content, the WebSocket frame's actual byte count can exceed `string.length` significantly. A 65,536-character string containing emoji could easily serialize to 100,000+ bytes on the wire, exceeding the server's `maxPayload`.

The spec pass-2 mandated `Buffer.byteLength(json, "utf8")` as the measurement primitive and centralized the limit as a named constant, `WS_MAX_PAYLOAD_BYTES = 65_536`, exported from the server. This fix happened at the *specification* level — before a single line of implementation was written.

Implementation followed cleanly across three commits:
- `b8e2442 feat(shared): add ChatHistoryMessage protocol type (6A.4)`
- `4e635e6 feat(server): send CHAT_HISTORY after STATE_UPDATE with UTF-8 size cap (6A.4)`
- `f2d9212 feat(client): parse CHAT_HISTORY and hydrate chat store (6A.4)`

Three separate feat commits — shared, server, client — mirror the monorepo's package boundary. This ordering is itself meaningful: shared types first, server producer second, client consumer third. Each layer is buildable and testable in isolation.

Then, on 2026-04-05, the pass-2 pattern struck for the fourth and final time: `a6dcf9a refactor(6A.4): tie maxPayload to WS_MAX_PAYLOAD_BYTES; tighten CHAT_HISTORY parse`. The bug: the server's inbound `maxPayload` in `ws-server.ts` was a separate hardcoded constant (`65536`), while the outbound truncation used `WS_MAX_PAYLOAD_BYTES`. Pass 1 had both values set to 65536 and everything worked. Pass 2 observed that the two numbers *could* drift and required them to reference the same exported constant.

This is a pass-2 finding of a different character than the previous three. The first three pass-2 bugs were *actual bugs* with observable wrong behavior. This fourth finding was a **latent coupling**: nothing was broken today, but a future edit to one constant would silently create a mismatch that would only manifest under large payloads. Pass 2 caught the latent version before it could become a real bug.

At the same commit, a second fix: the `CHAT_HISTORY` element parse was too loose. The validator checked that `messages` was an array and that each element had the right shape, but did not check `type === "CHAT_BROADCAST"` on each element. A spoofed server message could have slipped through. The fix tightened the element check and added parser tests for non-array `messages` and wrong element types.

Commit `6f54ed4 feat(server): harden chat/reaction path and close 6A.1 ticket` landed the same day, closing the final hardening pass on the entire chat path. Epic 6A's implementation was complete.

---

## Day Two — Morning: The Retrospective

Observation #719 at 8:35 AM captured the retrospective's key decision: Epic 6A shipped with protocol-first architecture, the state-transition bug pattern was identified as the epic's defining process finding, and four action items were established for Epic 4B.

The retrospective ran through three interactive phases:
1. **Deep story analysis** — the facilitator synthesized themes from all four story files and the git log, surfacing the cross-cutting patterns.
2. **Pattern recognition** — the pass-2 bug pattern was named explicitly: *"These are not four different bugs. They are one bug pattern in four costumes: state-transition hygiene."*
3. **Forward projection to Epic 4B** — the risk analysis identified message-ordering invariants (currently living in inline comments) as the highest-priority transition task for 4B.

The key insight the retrospective crystallized: **pass-2 review findings are a signal about pass-1 acceptance criteria shape**. When pass 2 catches the same category of bug four times in four stories, the fix is not "keep doing pass 2." The fix is rewriting pass-1 ACs to enumerate that category. This insight informed action item #1: adding a "Transition scenarios" section to the story spec template.

---

## Key Breakthroughs

Three moments in Epic 6A deserve to be called "breakthroughs" in the sense that they unlocked later work or established patterns that reduced future friction:

**1. The 6A.1 guardrails pass (observation #711, 7:04 AM day one).** Enhancing the first story with explicit anti-patterns, silent-drop semantics, and the reused `CONTROL_CHARS` regex before implementation began set the tone for the entire epic. Every subsequent story spec received the same two-pass treatment. No story in Epic 6A was implemented against a first-draft specification.

**2. The SlideInPanel mutual-exclusivity store in 6A.2.** Building the contract *and exercising it* with a stub NMJL panel meant 6A.3 consumed the contract via a single computed (`isAnySlideInPanelOpen`) with zero scaffolding. Compare this to the alternative: documenting the contract in 6A.2, leaving NMJL entirely out of scope, and having 6A.3 add duplicate panel-detection logic. The stub cost one file. It saved an architectural rework.

**3. The 6A.4 spec pass-2 catch of `Buffer.byteLength`.** Catching a unit-mismatch bug (UTF-16 code units vs UTF-8 bytes) in specification rather than in code is unusually cheap. Most teams discover this kind of bug at runtime with a mysterious `WebSocket frame too large` error weeks later. The second-pass spec refinement here paid for itself immediately.

---

## Work Patterns

Epic 6A's rhythm is strikingly uniform. Four stories, each following the same five-phase cycle:

1. **Story creation** (`docs(gds): add story…`)
2. **Second-pass specification refinement** (`docs(gds): second pass on story…`)
3. **Feat commit(s)** — typically shared → server → client
4. **Pass-1 code review** (`docs(gds): complete code review…`) with a "done" marker
5. **Pass-2 fix** (`refactor` or `fix` commit) catching a state-transition bug

The uniformity is itself significant. Epic 6A was not a grab-bag of unrelated stories — it was the same process applied four times, and the pass-2 pattern emerged because the process was applied consistently enough that variance could be detected.

There are no debugging sagas in Epic 6A. There are no multi-session struggles. There are no architectural dead ends requiring backtracking. Every story shipped on its first implementation attempt, and every story's pass-2 bug was caught and fixed within the same review cycle, not weeks later.

This is remarkable in a way that is easy to miss. Most multi-story epics contain at least one "this took three sessions to debug" moment. Epic 6A contains zero. The closest equivalent is the 6A.4 UTF-8 bytes issue, and *that* was caught in specification, not implementation.

---

## Technical Debt

Epic 6A incurred no new technical debt that is unpaid at epic close. It *did* identify one smell and one latent coupling that were deliberately not refactored:

- **Implicit Pinia coupling in `useRoomConnection`** (6A.2 dev notes). Calling `useChatStore()` inside `handleMessage` works because Pinia is installed in `main.ts` before `useRoomConnection` runs, but this couples the composable to a specific global Pinia app. Flagged as a smell in the retrospective; no action until it hurts.

- **Message ordering invariants living in inline comments** (6A.4). The rule "`CHAT_HISTORY` goes immediately after `STATE_UPDATE`" exists as one-line comments at three `ws.send` call sites. This worked for Epic 6A. It is the highest-priority technical task for Epic 4B, captured as action item #2: extract `sendPostStateSequence` helper.

Epic 6A also *paid down* debt inherited from earlier epics: the Epic 3C retro's mapper-reuse action item was applied in 6A.3's anchor helpers, and the validation-checklist action item was applied in all four 6A story files.

---

## Challenges and Debugging Sagas

There are none to report. This is the truest observation about Epic 6A's development history.

The closest thing to a saga is the **accumulation of four pass-2 bugs across four stories**, which in aggregate became the epic's defining narrative. Individually, none of them were dramatic — each was a few-line fix applied within the same review cycle. Collectively, they revealed a structural issue with how story acceptance criteria were shaped (happy paths, not transitions), and led to a process improvement for Epic 4B.

A saga in the classical sense — days of stuck debugging, multiple failed approaches, architectural backtracking — simply did not happen in Epic 6A. Whether this is because the epic was unusually tractable, the specifications were unusually rigorous, or the Cursor agents executing implementation were unusually lucky, the evidence from git and claude-mem is consistent: Epic 6A shipped without a crisis.

---

## Memory and Continuity

Epic 6A's relationship with claude-mem was unusual. Observations #710–719 captured milestone events (spec creation, implementation, test coverage, retrospective) but not the moment-by-moment telemetry of a locally developed feature. The moment-by-moment telemetry exists in git commits and story file Change Log sections, which are themselves a form of persistent memory — human-authored, not passively recorded.

The most valuable continuity moment of Epic 6A was the **cross-epic carry**: Epic 3C's retrospective action items (mapper reuse, validation checklist, no client `GameState`) were explicitly referenced in Epic 6A story files and the 6A retrospective, and three of four were applied. The fourth — recording `retro_follow_through` entries for the epic consuming the commitments — was itself closed as an Epic 6A retrospective action item.

This is continuity working at its highest leverage: a retrospective from the previous epic shaped the specifications of the current epic, and the current epic's retrospective shaped the specifications of the next epic. The mechanism was deliberate and visible in the story files, not emergent or implicit.

---

## Timeline Statistics

| Metric | Value |
|---|---|
| **Date range** | 2026-04-04 early morning → 2026-04-05 morning (retrospective close) |
| **Stories shipped** | 4 / 4 (100%) |
| **Git commits touching Epic 6A** | 29 (feat + fix + docs + refactor + test) |
| **claude-mem observations** | 9 (#710, 711, 712, 713, 714, 715, 717, 718, 719) |
| **memory sessions** | 5 (S279, S280, S281, S282, S283) |
| **Pass-2 bugs caught** | 4 (one per story — all state-transition class) |
| **Schema changes between 6A.1 and 6A.4** | 0 (only additive — `CHAT_HISTORY` in 6A.4) |
| **Client rollbacks against shipped protocol** | 0 |
| **Debugging sagas (multi-session stuck states)** | 0 |
| **3C retro commitments applied** | 3 / 4 (4th closed as 6A retro action item) |
| **New 6A retro action items for Epic 4B** | 4 |
| **Significant plan revisions required** | 0 |

**Most active development day:** 2026-04-04. All four stories had either spec creation, implementation, or code review activity on this date. Epic 6A was shipped in a single concentrated development burst.

---

## Lessons and Meta-Observations

Epic 6A's development history, read as a whole, supports four meta-observations about how this project works:

**1. Specification rigor compounds.** Every story received two specification passes before implementation. Every story shipped without schema churn. The correlation is not coincidence — the second pass catches the structural problems that would have required a rewrite if discovered during implementation. For Epic 6A, this showed up as zero `fix(protocol)` commits, zero client rollbacks, and one pre-implementation catch (the UTF-8 byte length issue in 6A.4) that would have been a runtime bug if missed.

**2. Pass-2 review findings are a signal about pass-1 AC shape.** When the same *category* of bug is caught four times in four stories, the signal is not "pass 2 is working" — it is "pass 1 is not shaped correctly." Epic 6A's defining process decision was to feed this signal forward into Epic 4B's story spec template (action item #1: Transition scenarios section).

**3. Build the contract, exercise the contract.** `useSlideInPanelStore` was built in 6A.2 with a stub NMJL panel specifically so the contract was *exercised in code* at the moment of introduction, not documented and hoped for. 6A.3 consumed the contract with zero scaffolding. The pattern should be named and reused: for any store, composable, or protocol type that will have its second consumer in a later story, ship a proof-in-code of the second consumer's contract at introduction, even if it's a stub.

**4. Continuity through retrospectives is a first-class engineering mechanism.** The Epic 3C retrospective's action items shaped Epic 6A's story specifications (validation checklist, mapper reuse, no client `GameState`). The Epic 6A retrospective's action items will shape Epic 4B's story specifications (transition scenarios, `sendPostStateSequence` helper, `resetSocialUiForSession` as extension point). This chain only works if each retrospective is recorded, referenced in the next epic's story creation, and closed when its commitments are applied. Epic 6A was the first epic in this project to use `sprint-status.yaml`'s `retro_follow_through` block to track cross-epic commitments at the story level, not the prose level.

---

## Final Reflection

A new developer reading Epic 6A's timeline would learn five things about this codebase:

1. **Protocol comes first.** Server contracts are completed before UI work starts. Shared types are the first touch, then the server producer, then the client consumer. This is a hard rule, not a convention.

2. **Constants live in shared.** Anything that needs to match across client and server lives in `packages/shared/src/chat-constants.ts` (or equivalent). Inline numeric literals are suspect.

3. **Render safety is non-negotiable.** Vue's `{{ }}` only. No `v-html` on any user-derived string. This rule is enforced by reviewer discipline and recurring NFR48 references in story dev notes.

4. **Transitions are where bugs live.** Seat recycle, phase changes, lobby↔game, session supersede, parse boundaries. Happy-path tests never catch these. Story specs should enumerate transitions explicitly.

5. **Retrospectives close loops.** An action item in a retrospective is not a note; it is a commitment with an owner, tracked in `sprint-status.yaml`, and expected to be applied in the next epic's first story.

Epic 6A delivered a complete text chat and reactions social layer — sanitization, rate limits, ring buffer, panel UI, seat-anchored bubbles, reconnect history hydration — in four stories across two calendar days, with zero rollbacks, zero schema churn, and zero debugging sagas. More durably, it produced a process finding (pass-2 reviews are a signal about pass-1 AC shape) that directly shapes how Epic 4B will be specified.

The journey into Epic 6A was short, concentrated, and almost boring in its lack of drama. That is the highest compliment a software epic can receive.

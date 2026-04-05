# Epic 6A Retrospective: Text Chat & Reactions

**Date:** 2026-04-05
**Facilitator:** Bob (Scrum Master)
**Epic:** 6A — Text Chat & Reactions
**Epic status:** All scoped stories complete (4/4)

### Definition: "Epic 6A complete"

For this retrospective, **epic complete** means:

- **Story / engineering bar:** All Epic 6A stories in `sprint-status.yaml` are `done`; automated tests and the backpressure gate (`pnpm test`, `pnpm run typecheck`, `vp lint`) pass on the merged codebase.
- **Not automatically included:** Production deployment, external stakeholder sign-off, or a four-client live playtest of chat + reactions at the table.

Same split as Epic 3C — rules / code-path completeness vs. shipping confidence are tracked separately.

---

## Team participants

- Bob (Scrum Master) — facilitation
- Alice (Product Owner)
- Charlie (Senior Developer)
- Dana (QA Engineer)
- Elena (Junior Developer)
- Rchoi (Project Lead)

---

## Epic discovery

Sprint-status at the time of retrospective showed `6a-4` in `review` with implementation + tests merged and the regression gate green. With Rchoi's confirmation, `6a-4`, `epic-6a`, and `epic-6a-retrospective` were transitioned to `done` at the start of the retro.

Epic 6A shipped the lightweight social layer on the existing WebSocket connection: protocol, sanitization, rate limits, ring buffer, Chat UI (`SlideInPanel`), quick reactions with seat-anchored bubbles, and chat history hydration on join / token reconnect / `REQUEST_STATE`.

---

## Deep story analysis — cross-cutting themes

### Strengths

1. **Protocol-first sequencing (the headline win).** 6A.1 landed shared types, server sanitization, rate limits, ring buffer, and constants *before* any client work. 6A.2 consumed the contract with a single import. 6A.3 extended it. 6A.4 added one new message type alongside. **Git evidence:** zero "fix protocol shape" commits, zero client rollbacks, zero schema churn between 6A.1 and 6A.4. That pattern is unusual — most features build UI first and backfill the server contract. It held for four consecutive stories here.

2. **Single source of truth for constants.** `MAX_CHAT_LENGTH`, `REACTION_EMOJI_ALLOWLIST`, `CHAT_HISTORY_CAPACITY`, `REACTION_BUBBLE_MS`, and `WS_MAX_PAYLOAD_BYTES` all live in `packages/shared/src/chat-constants.ts` (or adjacent server helper). The 6A.4 pass-2 move — tying inbound `ws-server` `maxPayload` to the same `WS_MAX_PAYLOAD_BYTES` constant as outbound truncation — is the kind of single-source fix that prevents a whole class of future drift bugs, not just the specific one it addressed.

3. **Design-for-the-next-story.** `useSlideInPanelStore` was built in 6A.2 *for* 6A.3 (`isAnySlideInPanelOpen` computed) and 5B NMJL (stub panel shipped as proof-in-code, not docs). 6A.3 consumed the computed exactly as intended — no duplicated panel detection, no conditional scaffolding. The contract worked because it was exercised in code at the moment it was introduced.

4. **Server authority, render-safe client.** NFR48 (`{{ }}` only, no `v-html`) held across every story. Sanitization and rate limits stayed server-side; client pre-checks (`isAllowedReactionEmoji`, client-side length guard) are UX polish, not trust boundaries. Clean separation — no ambiguity about who enforces what.

5. **Session reset semantics owned end-to-end.** `resetSocialUiForSession` clears chat + reactions + slide-in on `disconnect` / socket `close` / start of `connect()`. Every story updated this single function. No "stale transcript" bugs at session boundaries — including across the lobby↔game transition in 6A.3.

6. **Mapper reuse in 6A.3.** Seat anchor resolution extended `mapPlayerGameViewToGameTable` (`reactionBubbleAnchorForPlayer` / `reactionBubbleAnchorForLobby`) instead of re-deriving wind geometry in the reaction layer. Direct application of the Epic 3C retro action item.

### Recurring review-feedback pattern — the hidden story

Every single story had a pass-1 review that approved against ACs, followed by a pass-2 review that caught a bug and required a fix before `done`. On the surface this looks like adversarial review is earning its keep. Looking at *what* pass 2 caught tells a different story:

| Story | Pass-2 finding |
|---|---|
| **6A.1** | Rate-limit state leaked across **recycled seat ids** (grace-period seat release → new occupant inherited the previous player's rate-limit clock) |
| **6A.2** | Scoreboard-phase UI hid `SlideInReferencePanels` / `MobileBottomBar` but left the chat toggle visible → `activePanel = 'chat'` with no panel DOM (broken UX at a **phase transition**) |
| **6A.3** | Dedupe on fragile string ids; lobby reaction bubbles carried into the table across the **lobby→game transition** |
| **6A.4** | Inbound `ws-server` `maxPayload` and outbound `WS_MAX_PAYLOAD_BYTES` were separate constants; history element `type` validation was too loose at the **parse boundary** |

These are not four different bugs. They are **one bug pattern in four costumes**: *state-transition hygiene*. Pass 1 reviews against ACs, which are written in happy-path given/when/then form. Pass 2 reviews against transitions. Every pass-2 finding in Epic 6A is a transition bug — seat recycle, phase change, lobby↔game, inbound/outbound boundary, session supersede.

The honest implication is not "keep doing pass 2." It is: **pass 1 should be catching these**. If story ACs enumerated transition scenarios explicitly, pass 2 would shrink from structural work to polish. That is an action item for Epic 4B, where state-transition bugs are the *entire surface area* of the epic.

---

## Epic 3C retrospective follow-through (continuity)

| Commitment (Epic 3C retro) | Intended outcome | Evidence in Epic 6A |
|---|---|---|
| Validation checklist in new story specs | Fewer review-only gaps | **Adopted** — 6A.1–6A.4 all have "Scope boundaries" + "Anti-patterns" sections, explicit "In scope / Out of scope" tables, and reference to `story-validation-checklist.md` |
| List `mapPlayerGameViewToGameTable` dependencies in dev notes | No duplicate mapper logic | **Adopted** — 6A.3 extended the mapper (`reactionBubbleAnchorForPlayer` / `*ForLobby`) instead of re-deriving seat math. Explicit anti-pattern entry: "Re-implementing seat math." |
| No client-side authoritative `GameState` | Three-tier state integrity | **Held** — `useChatStore`, `useReactionsStore`, `useSlideInPanelStore` are all social/UI state only. Engine untouched. |
| One-line assumption note in next epic's kickoff artifact | Scope doesn't drift silently | **Partially missed** — 6A story files document dependencies prose-style in dev notes, but `sprint-status.yaml`'s `retro_follow_through:` block has no `epic-6a` entry. Closed as an action item in this retro. |

**Synthesis:** Three of four 3C commitments were applied cleanly. The fourth — recording a `retro_follow_through:` block for the epic consuming the commitments — was missed. That is closed below.

---

## Next epic preview — Epic 4B: Multiplayer Resilience

Epic 4B (seven stories: reconnection with full state restore, phase-specific fallbacks, simultaneous disconnect, turn timeout / AFK, player departure, host migration, host settings) is the natural successor and depends heavily on the infrastructure 6A just hardened.

### What 6A already delivered for 4B

| 4B requirement | 6A status |
|---|---|
| `CHAT_HISTORY` sent on reconnect (4B.1 AC: "send full game state + chat history") | **Done** in 6A.4 — join, token reconnect, `REQUEST_STATE` paths |
| `SESSION_SUPERSEDED` handling path documented | **Done** in 6A.4 dev notes (AC14) |
| `resetSocialUiForSession` covers disconnect / close / reconnect ordering | **Done** across 6A.2, 6A.3, 6A.4 — clear-then-receive ordering is established |
| `mapPlayerGameViewToGameTable` as single seat-resolution source | **Extended** in 6A.3 with anchor helpers — 4B reconnect should extend, not fork |
| `REQUEST_STATE` wiring with post-state follow-ups | **Done** in 6A.4 — `sendCurrentState` + `CHAT_HISTORY` paired in `ws-server` |

### What 4B must add fresh

- 30-second grace period timer + `PLAYER_RECONNECTING` broadcast
- Phase-specific fallback actions (auto-discard, auto-pass, Charleston auto-pass)
- Two-player pause (FR108 / FR109) and auto-end at 2 minutes
- Turn timeout / AFK escalation
- Host migration protocol
- 5th player replacement flow

### Carry-forward risks from 6A to 4B

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Message ordering on post-`STATE_UPDATE` sends** | 6A.4 established `CHAT_HISTORY` goes *immediately after* `STATE_UPDATE` on join / token reconnect / `REQUEST_STATE`. That invariant lives as inline comments at three separate `ws.send` call sites. 4B.1 will add more post-state messages (`PLAYER_RECONNECTED`, grace-cancel signals, phase-specific broadcasts) and order between them will matter. One wrong-order `ws.send` = race bug that only shows under real network conditions. | **Action item (Technical): extract `sendPostStateSequence` helper before 4B.1.** See action items below. |
| **Forking the reconnect path instead of extending it** | 4B will be tempted to add its own reset / rehydrate logic parallel to `resetSocialUiForSession`. The existing function already handles chat + reactions + slide-in. 4B should extend it, not shadow it. | **Action item (Documentation): 4B.1 story spec must reference `resetSocialUiForSession` and name it as the extension point.** |
| **Transition-scenario bugs dominating 4B pass 2** | 4B is literally all state transitions. If pass 1 doesn't enumerate them, pass 2 will catch them and 4B's bug count will dwarf 6A's. | **Action item (Process): story spec template adds a "Transition scenarios" section.** See action items. |
| **Implicit Pinia coupling in `useRoomConnection`** | 6A.2 chose to call `useChatStore()` inside `handleMessage` (valid — Pinia is installed in `main.ts` before `useRoomConnection` runs). This couples the composable to a specific global Pinia app. If 4B ever needs reconnect tested in a secondary store scope (parallel E2E sessions, isolated component tests), the implicit coupling could bite. | **No action today — a smell, not a bug.** Flagged so future debugging doesn't waste time. |

---

## Significant discovery

**Epic plan update required: No.**

Epic 6A execution *confirmed* the architecture from Epic 3C. The `PlayerGameView` → mapper → prop-driven UI path that 3C.8 established was consumed cleanly by 6A's reaction anchor work. The three-tier state model held. No invalidation of Epic 4B's plan.

One process discovery does require action: **pass-2 reviews are catching a consistent class of bug (state transitions) that pass 1 should be catching.** That is a story-spec shape issue, not an architectural one. Addressed in action items below.

---

## Successes

1. **Full social layer delivered** — Chat (with sanitization, rate limiting, ring buffer, history on reconnect), reactions (with seat-anchored bubbles, dedupe, per-seat cap, lobby parity), and mutual-exclusivity with future NMJL panel. All on the existing WebSocket — zero new transport.
2. **Protocol-first sequencing held for four consecutive stories.** Zero schema churn.
3. **3C retro commitments applied** — validation checklist, mapper extension, three-tier state discipline.
4. **Single-source constants** — including the 6A.4 pass-2 alignment of inbound and outbound `WS_MAX_PAYLOAD_BYTES`.
5. **Reset semantics own the session boundary** — one function, called in three places, updated by every story.

## Challenges

1. **Every story had a pass-2 bug.** Not a failure of review — a symptom of pass-1 AC shape. Pass 1 tested the happy path; pass 2 tested transitions. The pattern is consistent enough that it deserves to be addressed at the story-spec level.
2. **The `retro_follow_through:` continuity pattern from 3C wasn't applied to 6A.** Prose-level dependency notes in story files are good but `sprint-status.yaml` remained the canonical place for tracking retro commitments, and that block was empty for `epic-6a` until this retro.
3. **Message send order invariants live in comments, not code.** Fine for 4 stories. Dangerous for 4B.

## Key insights

1. **Protocol-first sequencing compounds.** Each 6A story consumed the previous story's contract without friction because 6A.1 finished the server contract *before* UI work started. That is cheap to do once (one extra story of rigor) and pays back across every follow-on story.
2. **Pass-2 review findings are a signal about pass-1 AC shape.** When pass-2 finds the same *category* of bug repeatedly, the fix is not "more pass 2" — it is rewriting pass-1 ACs to enumerate that category.
3. **"Design for the next story" beats speculative abstraction.** `useSlideInPanelStore` was built in 6A.2 knowing 6A.3 would consume `isAnySlideInPanelOpen`. Stub NMJL panel was shipped for 5B's benefit. Both decisions paid off within the epic, unlike speculative abstractions that never get consumed.

---

## Readiness assessment

| Area | Status |
|---|---|
| Shared chat/reaction protocol | Strong — single source constants, explicit types, no drift |
| Server sanitization & rate limits | Strong — per-player per-channel, silent drops, seat-recycle hardened |
| Chat history on reconnect | Strong — three paths (join, token reconnect, `REQUEST_STATE`), UTF-8 byte-accurate truncation |
| Client parse + store hydration | Strong — replace-not-append on history, dedupe on `serverTimestamp` for reactions |
| Session reset semantics | Strong — one function, three call sites, exercised by every story |
| Mapper-based seat resolution for reactions | Strong — extends existing helper, no forked seat math |
| SlideInPanel mutual exclusivity | Strong — store-driven, proven in code with NMJL stub, extends cleanly to 5B |
| Message ordering invariant (post-`STATE_UPDATE`) | **Fragile** — lives in comments at 3 call sites; addressed as 4B transition task |
| Production deployment / stakeholder sign-off | Out of band — confirm with Rchoi |
| Four-client live playtest with chat enabled | Not done — track separately if / when product readiness milestone is scheduled |

**Verdict:** Epic 6A is complete for story acceptance and *materially de-risks* Epic 4B by pre-delivering the chat-history-on-reconnect path, session reset semantics, and mapper-based seat anchoring. Further hardening belongs to 4B (grace period, phase fallbacks, host migration) and product QA (live playtest).

---

## Action items (SMART)

### Process

1. **Add a "Transition scenarios" section to the story spec template (apply first at Story 4B.1 creation).**
   - **Owner:** Scrum Master + Rchoi
   - **Tracked as:** `retro_follow_through.epic-6a.6a-retro-1-transition-scenarios-in-story-specs`
   - **Success criteria:** Story 4B.1's file contains an explicit "Transition scenarios" section listing, at minimum: socket disconnect / reconnect, grace-period expiry, session supersede, phase transitions (deal / charleston / call window / discard / scoreboard), player departure, host migration. Pass-1 review is required to check each scenario against the implementation. If Epic 4B's pass-2 reviews surface a transition bug *not* enumerated in the story, the template is amended.

2. **Record `retro_follow_through:` entries for this epic in `sprint-status.yaml`.**
   - **Owner:** Scrum Master (this retro)
   - **Tracked as:** `retro_follow_through.epic-6a.*`
   - **Success criteria:** `sprint-status.yaml` has an `epic-6a:` block under `retro_follow_through` with entries for each action item below, matching the 3C pattern. **Closed during this retro** — see sprint-status commit.

### Technical

3. **Extract `sendPostStateSequence` helper before Story 4B.1 implementation begins.**
   - **Owner:** Developer (handoff from Scrum Master)
   - **Tracked as:** `retro_follow_through.epic-6a.6a-retro-2-send-post-state-sequence-helper`
   - **Success criteria:** A single server-side helper owns the canonical order of `STATE_UPDATE` → `CHAT_HISTORY` → (future 4B post-state messages). The three current call sites in `join-handler.ts` and `ws-server.ts` (`handleJoinRoom`, `handleTokenReconnection`, `REQUEST_STATE` branch) route through the helper. New post-state messages added in 4B must be added to the helper, forcing an explicit ordering decision in one file. Tests cover ordering.

4. **4B.1 story spec must name `resetSocialUiForSession` as the extension point for client-side reconnect reset (not fork it).**
   - **Owner:** Scrum Master (during `gds-create-story` for 4B.1)
   - **Tracked as:** `retro_follow_through.epic-6a.6a-retro-3-extend-resetSocialUiForSession`
   - **Success criteria:** Story 4B.1's dev notes explicitly reference `resetSocialUiForSession` with file path and require 4B reconnect logic to extend it rather than introduce a parallel reset function. Anti-pattern section forbids a `resetGameStateForSession` shadow function.

### Quality (no new items)

No new QA-specific action items. Existing regression gate discipline (backpressure gate on every merge, `state-broadcaster.test.ts` when filters change) held across Epic 6A and should continue.

---

## Epic 4B preparation tasks

| Task | Owner | Notes |
|---|---|---|
| Extract `sendPostStateSequence` helper (action item 3) | Developer | Must complete before 4B.1 merges; ideally before 4B.1 starts |
| Create Story 4B.1 with "Transition scenarios" section (action item 1) | Scrum Master | First story to exercise new template section |
| Document `resetSocialUiForSession` as extension point in 4B.1 dev notes (action item 4) | Scrum Master | Part of story creation |
| Confirm `CHAT_HISTORY` path (6A.4) covers reconnect requirement in 4B.1 AC | Developer | Reference in 4B.1 dev notes — reconnect does not re-implement history send |

No critical-path items block Epic 4B today. The three action items above should be completed as part of / immediately prior to 4B.1 creation, not as a separate prep sprint.

---

## Follow-ups that are optional (not debt)

| Item | Source | Note |
|---|---|---|
| Four-client live playtest with chat + reactions enabled | Product readiness | Tracks a different question than story acceptance — schedule when product scope asks for it |
| `useRoomConnection` decoupling from global Pinia app | 6A.2 dev notes | Smell, not a bug. Revisit if / when 4B adds a test context that needs a secondary store scope |
| Call-confirmation countdown from `confirmationExpiresAt` | Carried from 3C retro | Still optional; engine already exposes timing fields |

---

## Retrospective closure

Epic 6A shipped the lightweight social layer in four stories with zero schema churn, zero client rollbacks, and every story's pass-2 review catching a state-transition bug that pass 1 missed. The epic's pattern-level lesson — pass-2 findings are a signal about pass-1 AC shape — is more valuable than any individual bug fix, and applies directly to Epic 4B, which is all state transitions.

Infrastructure hardened in 6A (chat history on reconnect, session reset semantics, mapper-based seat resolution, constants discipline) materially de-risks Epic 4B. Three action items close the known gaps before 4B.1 begins.

---

## Related artifacts

| Artifact | Path |
|---|---|
| Story 6A.1 — Chat protocol & server handling | [`6a-1-chat-message-protocol-server-handling.md`](./6a-1-chat-message-protocol-server-handling.md) |
| Story 6A.2 — Chat panel UI (SlideInPanel) | [`6a-2-chat-panel-ui-slideinpanel.md`](./6a-2-chat-panel-ui-slideinpanel.md) |
| Story 6A.3 — Quick reactions system | [`6a-3-quick-reactions-system.md`](./6a-3-quick-reactions-system.md) |
| Story 6A.4 — Chat history on connect/reconnect | [`6a-4-chat-history-on-connect-reconnect.md`](./6a-4-chat-history-on-connect-reconnect.md) |
| Shared chat constants & allowlist | [`packages/shared/src/chat-constants.ts`](../../packages/shared/src/chat-constants.ts) |
| Server chat handler (sanitize, rate limit, ring buffer) | [`packages/server/src/websocket/chat-handler.ts`](../../packages/server/src/websocket/chat-handler.ts) |
| Server chat history helper (UTF-8 cap, send) | [`packages/server/src/websocket/chat-history.ts`](../../packages/server/src/websocket/chat-history.ts) |
| Client connection composable (reset, sendChat, sendReaction) | [`packages/client/src/composables/useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) |
| Pinia stores (chat, reactions, slide-in) | [`packages/client/src/stores/chat.ts`](../../packages/client/src/stores/chat.ts), [`reactions.ts`](../../packages/client/src/stores/reactions.ts), [`slideInPanel.ts`](../../packages/client/src/stores/slideInPanel.ts) |
| Chat panel + reaction UI components | [`packages/client/src/components/chat/`](../../packages/client/src/components/chat/), [`packages/client/src/components/reactions/`](../../packages/client/src/components/reactions/) |
| Mapper with reaction anchor helpers | [`packages/client/src/composables/mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) |
| Epic 3C retrospective (continuity source) | [`epic-3c-retro-2026-04-04.md`](./epic-3c-retro-2026-04-04.md) |
| Epic definition (6A stories) | [`../planning-artifacts/epics.md`](../planning-artifacts/epics.md) (Epic 6A section) |

---

## Metrics (non-time-based)

- **Stories completed:** 4 / 4 (100%)
- **Pass-2 review bugs caught:** 4 / 4 stories (one per story) — all state-transition bugs
- **Protocol schema changes between 6A.1 and 6A.4:** 0 (only additive — `CHAT_HISTORY` in 6A.4)
- **Client rollbacks / refactors against shipped 6A protocol:** 0
- **3C retro commitments applied in 6A:** 3 / 4 (4th closed as retro action item in this retrospective)
- **Significant plan revisions required for Epic 4B:** 0

# Epic 3B Retrospective: Charleston

**Date:** 2026-04-04  
**Facilitator:** Max (Game Dev Scrum Master)  
**Epic:** 3B — Charleston  
**Epic status:** All scoped stories complete (5/5)

---

## Team participants

- Max (Scrum Master) — facilitation  
- Samus Shepard (Product Owner)  
- Link Freeman (Senior Developer)  
- Cloud Dragonborn (Game Architect)  
- GLaDOS (QA Architect)  
- Elena (Junior Developer) — voice in dialogue  
- Rchoi (Project Lead)

---

## Facilitated session (party mode)

**Max (Scrum Master):** "Welcome back, Rchoi. Epic 3B is fully delivered — first Charleston through disconnect handling. Before we celebrate, I want to be explicit: we’re reviewing Charleston end-to-end, and you’re not here to watch — your read on tradeoffs matters."

**Samus Shepard (Product Owner):** "From the roadmap, Charleston was the first big chunk where multiplayer phase state, hidden information, and reconnect all had to agree. That’s a different risk profile than ‘another UI screen.’"

**Max (Scrum Master):** "Here’s the headline from sprint-status and the story files: **5 of 5 stories done** — `3b-1` first Charleston and blind pass, `3b-2` second Charleston vote and reversed passes, `3b-3` courtesy negotiation, `3b-4` Charleston UI and `useTileSelection`, `3b-5` disconnect grace and auto-actions. Epic `3b-retrospective` was still optional; we’re closing that loop today."

**Link Freeman (Senior Developer):** "Engine-side we didn’t fork Charleston — we kept extending `charleston.ts`. That mattered when blind-pass rules moved from first Charleston left to second Charleston right."

**GLaDOS (QA Architect):** "The tests earned their keep. Review follow-ups added full Right→Across→Left integration coverage, WebSocket flows, seat-direction fixes, and broadcaster JSON checks so hidden tiles and peer submissions don’t leak. I approve of tests that make cheating the protocol harder."

**Elena (Junior Developer):** "Story 3B.4 was a lot of UI surface — zone, vote, courtesy, GameTable wiring, animations, accessibility. We still shipped it prop-driven where live `useGameState` wasn’t there yet."

**Cloud Dragonborn (Game Architect):** "The planning artifact still said: don’t start 3B until live client integration and a planning review. We treated that as a **risk gate**, not a hard stop: shared and server landed first, then UI on testable props. That’s a deliberate trade."

**Max (Scrum Master):** "Rchoi — what stood out to you as **going well** in Epic 3B?"

**Rchoi (Project Lead):** *[Session synthesis — invite Rchoi to add personal notes in a future edit.]* **Planned team synthesis:** Delivery of a full Charleston loop with NMJL-aligned blind pass, unanimous second-Charleston vote, courtesy lower-count rule, rich UI with `TileSelectionAction` for reuse, and server-side auto-actions so disconnects don’t stall the ritual.

**Samus Shepard (Product Owner):** "I’ll build on that — FR32–FR38 and FR107 are represented in shipped behavior, not just docs."

**Max (Scrum Master):** "Now the hard part: **challenges**. Where did we strain?"

**Link Freeman (Senior Developer):** "Seat-direction mapping had to be corrected after review — ‘right’ vs seat order bit us once. We fixed it and strengthened tests to assert seat-to-seat transfers directly, not only through helpers."

**GLaDOS (QA Architect):** "Malformed payloads and server robustness — 3B.3’s review pushed runtime validation for `COURTESY_PASS` and defensive dispatch so one bad message doesn’t take down the process."

**Samus Shepard (Product Owner):** "Epic 5A’s retro said client integration was incomplete. Epic 3B story notes repeated that gate. We still shipped UI without a repo-wide `useGameState` — that’s technical debt we’re carrying into Epic 3C unless we wire it."

**Max (Scrum Master):** "Pattern from story analysis: **every** story stressed filtered views, no-leak broadcasting, and reconnect-safe first payloads. That theme appeared in all five — not accidental; it’s the core risk of Charleston."

**Max (Scrum Master):** "Let’s connect to **Epic 5A retrospective follow-through** and the sprint file’s `retro_follow_through` block."

---

## Epic 5A retrospective and sprint follow-through (continuity)


| Item (source)                                          | Intended outcome                     | Evidence in Epic 3B                                                                                                         |
| ------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Validation checklist in story specs (5A retro)         | Fewer review-only fixes              | Partial — stories have exhaustive ACs and tasks; formal checklist embed is still inconsistent                               |
| Retro action items in sprint tracking (5A retro)       | Visible accountability               | **Improved** — `retro_follow_through.epic-5a` exists in `[sprint-status.yaml](./sprint-status.yaml)`; items 1–3 marked done |
| Client integration layer before 3B (`5a-retro-4`)      | Live table driven by WebSocket state | **Not done** — no `useGameState` in client; Charleston UI remains prop-driven / harness-friendly                            |
| Epic 3B planning review (`5a-retro-5`)                 | Aligned assumptions                  | **Backlog** in sprint-status — stories proceeded with architect notes and execution gates in each story file                |
| Charleston reconnect / auto-pass early focus (5A prep) | Design-first                         | **Addressed** in 3B.5 with grace-period auto-pass, auto-vote `false`, auto-courtesy skip                                    |


**Synthesis:** Retro tracking improved structurally, but the **live client pipe** called out at Epic 5A close is still open. Epic 3B succeeded by **separating** shared/server correctness from client wiring.

---

## Epic 3A continuity (technical)

Epic 3B did not have a dedicated `epic-3b-minus-one` retro file; the numerically prior epic with a saved retro is Epic 3A (Turn Flow & Calling). Relevant carryover:

- **Validate-then-mutate** and exhaustive unions — maintained across new Charleston and courtesy actions.
- **Story intelligence** — later Charleston stories explicitly extended `charleston.ts` rather than duplicating pass logic.
- **Review discipline** — similar to 3A, reviews caught real issues (direction mapping, integration coverage, server hardening).

---

## Epic summary (delivery)


| Story | Focus                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------- |
| 3B.1  | Charleston phase entry, simultaneous passes, blind Across→Left gating, filtered views, server broadcast       |
| 3B.2  | `CHARLESTON_VOTE`, reversed Left→Across→Right, blind pass on `right`, courtesy-ready handoff                  |
| 3B.3  | `COURTESY_PASS`, lower-count trimming, pair-local resolution, narration payloads, `charleston` → `play`       |
| 3B.4  | `CharlestonZone`, `CharlestonVote`, `CourtesyPassUI`, `useTileSelection`, GameTable integration, motion, a11y |
| 3B.5  | Grace-expiry auto-actions (pass / vote / courtesy), ordering before seat release, join-handler tests          |


**Quality themes:** Broad automated coverage in shared and server; client component tests for new UI; integration tests for flows and serialization safety.

---

## Successes

1. **Single Charleston engine path** — Stage-aware direction and blind-pass rules centralized in `charleston.ts`, reducing duplication across first and second Charleston.
2. **Security-relevant correctness** — Filtered player views, broadcaster tests, and review-driven integration tests addressed hidden tiles and peer submission privacy repeatedly.
3. **Composable investment** — `useTileSelection` created for reuse (call confirmation, Joker exchange per planning note).
4. **Disconnect resilience** — 3B.5 aligned auto-actions with existing grace timers and engine dispatch, with explicit ordering before seat release.
5. **Honest scope management** — Stories documented Epic 5A gates while still shipping vertical slices (engine-first, then UI).

---

## Challenges

1. **Client integration still not unified** — Prop-driven `GameTable` and showcases do not replace a single live game-state composable; Epic 3C will stress this further.
2. **Planning gate vs delivery** — `5a-retro-4` and `5a-retro-5` remain backlog; the team mitigated with per-story execution gates but did not close the formal review item.
3. **Review load** — High-severity review items (seat direction, E2E Charleston paths, reconnect payloads) required follow-up passes; acceptable cost but not free.
4. **TileSelectionAction retroactive application to 3A.5** — Planned in `[epics.md](../planning-artifacts/epics.md)`; track explicitly so it does not slip.

---

## Key insights

1. **Gates can be risk-managed without blocking all progress** — Shared/server work proceeded with clear “no UI on mocks only” boundaries in dev notes; UI followed with testable props.
2. **Privacy is a cross-cutting feature** — Charleston success required repeating the same no-leak discipline at every layer (engine, protocol, broadcaster, tests).
3. **Retro follow-through works when tracked in YAML** — The `retro_follow_through` section makes 5A commitments visible; remaining items are now obvious tech debt.
4. **Auto-defaults must match product safety** — Vote `false`, courtesy `0`, random non-Joker pass — conservative defaults for absent players.

---

## Next epic preview: Epic 3C (Advanced Rules)

**In progress in sprint-status:** Stories `3c-1` … `3c-5` done; `3c-6` (wall end / last tile rules) and `3c-7` (concealed validation at Mahjong) backlog.

**Dependencies on Epic 3B:** Joker exchange and social flows assume Charleston completes and play begins with correct opening turn; disconnect handling shares grace-period patterns with future resilience epics.

**Preparation needs:** Wire-or-document live client state when Epic 3C UI touches table flows; continue exhaustive action typing and server tests.

---

## Significant discovery

**Epic plan update required:** **Partial — process, not wholesale rewrite.**

- **Finding:** Epic 5A and planning artifacts assumed a **live client integration milestone** before Charleston; Epic 3B delivered full Charleston behavior with **strong shared/server and testable client UI**, but **without** a unified `useGameState`-style layer in the client package (confirmed: no matches under `packages/client` for that composable name at retro time).
- **Impact on Epic 3C:** Advanced rules stories should either budget **thin wiring work** or explicitly scope **server-first** slices until the integration layer lands.
- **Recommendation:** Complete or formally defer `5a-retro-4` and `5a-retro-5` with a recorded decision; optionally add a spike story for client integration before heavy 3C UI.

---

## Action items (SMART)

### Process

1. **Close or defer Epic 5A retro items `5a-retro-4` and `5a-retro-5` with a recorded decision**
  - **Owner:** Max (Scrum Master) + Rchoi (Project Lead)  
  - **Success criteria:** Sprint-status shows `done` or `cancelled` with reason, not perpetual `backlog`  
  - **Deadline:** Before the first Epic 3C story that requires live table wiring
2. **Add a short validation checklist subsection to the next created story file**
  - **Owner:** Max (Scrum Master)  
  - **Success criteria:** Checklist covers filtered views, zero-mutation rejection tests, reconnect assumptions  
  - **Deadline:** Next story created after this retro

### Technical / architecture

1. **Spike or implement minimal WebSocket → table prop wiring**
  - **Owner:** Link Freeman (Developer)  
  - **Success criteria:** Documented path from `STATE_UPDATE` to `GameTable` props (composable or store), even if feature-flagged  
  - **Success observable:** One integration test or dev route proves live state drives Charleston or play-phase UI
2. **Track `TileSelectionAction` refactor for Epic 3A call confirmation**
  - **Owner:** Link Freeman + Cloud Dragonborn  
  - **Success criteria:** Issue or story exists; `epics.md` note is either done or re-scoped

### Quality

1. **Regression pass: Charleston JSON payloads** after any future broadcaster refactor
  - **Owner:** GLaDOS (QA)  
  - **Success criteria:** Existing `state-broadcaster` and integration tests remain green; add one case if new fields are added

---

## Epic 3C preparation tasks


| Task                                                         | Owner             | Critical?       |
| ------------------------------------------------------------ | ----------------- | --------------- |
| Decide client integration approach for 3C UI                 | Architect + Rchoi | Yes             |
| Keep action-handler validation pattern for new 3C actions    | Developer         | Yes             |
| Extend integration tests for wall-end and Mahjong edge cases | QA                | As stories land |


---

## Readiness assessment


| Area                                | Status                                       |
| ----------------------------------- | -------------------------------------------- |
| Shared Charleston + courtesy engine | Strong — covered by blackbox tests           |
| Server broadcast / reconnect        | Strong — review items integrated             |
| Charleston UI + composables         | Strong — component and GameTable tests       |
| Live client game-state pipe         | **Gap** — integration composable not present |
| Stakeholder / playtest sign-off     | Out of band — confirm with Rchoi             |
| Production incidents                | None recorded in story artifacts             |


**Verdict:** Epic 3B is **done for story acceptance**; **readiness for production multiplayer UX** still depends on closing the client integration gap.

---

## Retrospective closure

**Max (Scrum Master):** "We shipped the Charleston ritual with rules fidelity, privacy discipline, and humane disconnect behavior. The open thread is making the client as honest as the server about state — that’s our bridge into Epic 3C."

**Samus Shepard (Product Owner):** "And we finally wrote this retro down so 3C doesn’t repeat the same ‘assumed integration’ surprise."

**Rchoi (Project Lead):** *[Space for final reflections]*

---

## Action item execution log (2026-04-04)

| Item | Status | Artifact / notes |
|------|--------|------------------|
| 1. Close `5a-retro-4` and `5a-retro-5` with decision | Done | [`sprint-status.yaml`](./sprint-status.yaml) `retro_follow_through.epic-5a`: both `done` with inline rationale (thin bridge + story gates). |
| 2. Validation checklist template | Done | [`story-validation-checklist.md`](./story-validation-checklist.md) — paste into future story specs. |
| 3. `PlayerGameView` → `GameTable` bridge | Done | [`packages/client/src/composables/mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts), tests in `mapPlayerGameViewToGameTable.test.ts`, dev route [`/dev/player-view-bridge`](../../packages/client/src/dev-showcase-routes.ts) → `PlayerGameViewBridgeShowcase.vue`. |
| 4. Track `TileSelectionAction` / 3A.5 refactor | Done | Superseded by Epic 3C: story **3C.9** + sprint key `3c-9-call-confirmation-use-tile-selection`; `retro_follow_through.epic-3b` follow-up marked done with pointer to 3c-9. |
| 5. Broadcaster regression (process) | Documented | Checklist item in `story-validation-checklist.md` (run broadcaster + integration tests after filter changes). |

---

## Next steps

1. Implement Epic 3C Story **3C.8** (`3c-8-websocket-client-state-update-to-gametable`) — production WebSocket path to `mapPlayerGameViewToGameTableProps`.
2. Proceed with Epic 3C backlog stories `3c-6`, `3c-7` when prioritized; include [`story-validation-checklist.md`](./story-validation-checklist.md) in new story specs.
3. Implement Epic 3C Story **3C.9** (`3c-9-call-confirmation-use-tile-selection`) — `useTileSelection` for 3A.5 call confirmation.


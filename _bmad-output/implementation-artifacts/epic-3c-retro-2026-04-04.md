# Epic 3C Retrospective: Advanced Rules

**Date:** 2026-04-04  
**Facilitator:** Bob (Scrum Master)  
**Epic:** 3C — Advanced Rules  
**Epic status:** All scoped stories complete (9/9)

### Definition: "Epic 3C complete"

For this retrospective, **epic complete** means:

- **Story / engineering bar:** All Epic 3C stories in `sprint-status.yaml` are `done`; automated tests and the backpressure gate (`pnpm test`, `pnpm run typecheck`, `vp lint`) pass for the merged codebase.
- **Not automatically included:** Production deployment, external stakeholder sign-off, or a formal **multiplayer playtest** milestone — those are product milestones and can be tracked separately (see [Readiness](#readiness-assessment) and [Optional playtest milestone](#optional-playtest-milestone-product)).

That split avoids conflating **rules-engine and client-path completeness** with **shipping confidence**.

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

**Bob (Scrum Master):** "Welcome, Rchoi. Sprint-status shows every Epic 3C story — `3c-1` through `3c-9` — marked **done**. That includes the Epic 3B retro follow-ups: live `STATE_UPDATE` wiring (`3c-8`) and call confirmation on `useTileSelection` (`3c-9`). Unless you want to review a different epic, we’re closing the loop on **Epic 3C** today."

**Alice (Product Owner):** "This epic was the ‘rules-complete’ milestone in the roadmap — Jokers, dead hands, social governance, wall end, concealed validation, and the client integration debt we explicitly scheduled."

---

## Facilitated session (party mode)

**Bob (Scrum Master):** "Before we debate, I pulled themes from the story files and from Epic 3B’s retro. Epic 3C wasn’t greenfield — it built on validate-then-mutate discipline from earlier epics and finally landed the **thin bridge** from server views to the table UI."

**Charlie (Senior Developer):** "3C.1 set the tone: reuse `validateJokerExchange`, parse `jokerGroupId` without a breaking `ExposedGroup.id` change, keep `turnPhase` on `discard` for multiple exchanges. That’s the same ‘extend the model carefully’ playbook we used in 3A."

**Dana (QA Engineer):** "Governance stories (3C.4 / 3C.5) duplicated risk: votes, timers, silence-as-deny, and host-visible logs. Tests had to stay strict on **zero mutation** on reject paths — same bar as Charleston and calls."

**Elena (Junior Developer):** "3C.8 and 3C.9 read like a sequel to the 3B retro — `mapPlayerGameViewToGameTable` was already there; we connected the **live** pipe and unified selection UX for call confirmation."

**Bob (Scrum Master):** "Rchoi — what stood out to you as **going well** in Epic 3C?"

**Rchoi (Project Lead):** *[Add your own bullets here — e.g. rule completeness, test depth, closing 3B follow-ups.]*

**Alice (Product Owner):** "I’ll add one: **voting pattern reuse** — unanimous Social Override before majority Table Talk Report — matched the epic note and reduced one-off UI experiments."

---

## Epic 3B retrospective follow-through (continuity)

| Commitment (Epic 3B retro / sprint `retro_follow_through`) | Intended outcome | Evidence in Epic 3C |
| --- | --- | --- |
| `PlayerGameView` → `GameTable` bridge (`5a-retro-4`, 3B retro) | Production path from authoritative state to table | **Done** — Story **3C.8** wires WebSocket `STATE_UPDATE` through the mapper; dev bridge and tests pre-existed |
| `TileSelectionAction` / 3A.5 call confirmation (`3b-retro-tile-selection-refactor`) | Shared selection composable for calls | **Done** — Story **3C.9** refactors call confirmation to `useTileSelection` with parity to Charleston patterns |
| Validation checklist in later story specs | Fewer review-only gaps | **Adopted** — `story-validation-checklist.md` referenced from 3C.6+ story files and 3C.8/3C.9 dev notes |
| Broadcaster / protocol changes | No regressions in filtered views | **Process** — checklist and tests flag `state-broadcaster.test.ts` when filters change |

**Synthesis:** Epic 3C **closed** the open client-integration thread that Epic 3B had honestly labeled as debt — not with a monolithic `useGameState`, but with an architecture-aligned **server-authoritative** path and explicit anti-patterns in story specs (no optimistic `GameState` mutation on the client).

---

## Deep story analysis — cross-cutting themes

**Common strengths**

1. **Shared engine first** — Joker exchange, dead hand, wall end, and concealed validation extend the same handler and type patterns; server parsing stays aligned with shared types.
2. **Explicit scope boundaries** — Story dev notes repeatedly call out “shared only,” “client only,” “no UI in this story” to keep reviews focused.
3. **Reuse before new types** — `validateJokerExchange`, `mapPlayerGameViewToGameTable`, `useTileSelection` — fewer schema shocks to the rest of the repo.
4. **AR5 / three-tier state** — 3C.8 and 3C.9 document server authority, Pinia for rack/UI-only concerns, and no duplicate engine paths on the client.

**Recurring risks (managed, not eliminated)**

- **Cross-package coordination** — Any change to `PlayerGameView`, protocol, or broadcaster ripples to mapper tests and integration tests; the checklist exists precisely for this.
- **Governance UX complexity** — Social override and table talk share patterns but differ on thresholds and side effects (undo vs dead hand); easy to confuse in review without AC discipline.

**Breakthrough**

- **Rule-complete engine** (per planning) — NMJL-advanced behaviors are represented in code with tests, not only in GDD tables.

---

## Previous epic retrospective comparison

Epic 3B’s retro (same calendar date artifact) predicted heavy Epic 3C load on “live table wiring.” Epic 3C **delivered** that via 3C.8 and 3C.9 rather than deferring again — the team treated follow-ups as **first-class stories**, not comments in `epics.md`.

---

## Next epic preview

**Bob (Scrum Master):** "What’s next depends on roadmap priority. In sprint-status, **Epic 6A** (Text Chat & Reactions) is the next **in-repo** epic in the backlog after 3C; **Epic 4B** (resilience) and **Epic 5B** (remaining UI) are also queued."

**Alice (Product Owner):** "6A is mostly protocol + UI surface — it should assume **3C.8’s live state path** is the norm, not the exception. 4B will want the same mapper and session story for reconnect."

**Charlie (Senior Developer):** "4B will stress **REQUEST_STATE** and phase-specific recovery — we should not fork table mapping; extend composables and tests."

**Dependencies from Epic 3C on next work**

- **6A:** Chat must respect filtered views and not leak hidden information; reuse room/session patterns from `RoomView` / WebSocket composables.
- **4B:** Reconnect builds on authoritative `STATE_UPDATE` handling and rack reconciliation called out in 3C.8 dev notes.
- **5B:** Hand guidance and card panel depend on concealed/exposed metadata and validation from 3C.7 and card engine.

**Carry-forward risk (one line each)**

| Next epic | Primary risk if 3C assumptions are ignored |
| --- | --- |
| **6A** (chat) | Chat payloads or UI leak hidden tile / peer information that `PlayerGameView` and the broadcaster deliberately suppress. |
| **4B** (resilience) | Reconnect or `REQUEST_STATE` paths apply state in the wrong order or duplicate mapper logic, causing rack/discard drift vs live `STATE_UPDATE`. |
| **5B** (remaining UI) | Guidance highlights impossible concealed patterns or fights concealed-at-Mahjong metadata from 3C.7 if group-origin rules are mis-modeled in UI. |

---

## Significant discovery

**Epic plan update required:** **No wholesale rewrite.**

- Epic 3C execution **confirmed** the architecture notes (server authority, mapper as single mapping source, voting reuse).
- **Optional follow-up:** If product scope adds new game actions, keep extending discriminated unions and rejection tests in the same pattern — no new “significant discovery” that invalidates Epic 6A or 4B plans.
- **Ongoing watch:** Broadcaster / `PlayerGameView` / mapper coupling remains the main place where “small” protocol edits have outsized impact — not a plan change, a **discipline** reminder for the next epic.

---

## Follow-ups that are optional (not debt)

These are called out in story dev notes or UX as **nice-to-have**, not missing acceptance criteria:

| Item | Source | Note |
| --- | --- | --- |
| Call confirmation **countdown** from `confirmationExpiresAt` | 3C.9 dev notes | Improves UX; engine already exposes timing fields. |
| Richer **E2E** or live-room automation | 3C.8 / general | Integration tests cover key paths; full browser E2E can wait for priority. |
| **Hand guidance** filtering for concealed-only patterns | 3C.7 / planning | Explicitly deferred to Epic 5B per GDD dependency. |

Listing them here avoids misclassifying polish as forgotten work.

---

## Successes

1. **Full advanced-rules surface** — Joker exchange (+ simplified host option), dead hand, social override, table talk report, wall end, concealed-at-Mahjong, live client wiring, call-confirmation selection.
2. **Closed 3B / 5A integration debt** via explicit stories (3C.8, 3C.9) with traceability in `retro_follow_through`.
3. **Consistent validation discipline** — Checklist + broadcaster regression expectations where protocol or filters change.
4. **Composable reuse** — `useTileSelection` spans Charleston and call confirmation; mapper centralizes seat/discard/rack projection.

---

## Challenges

1. **Surface area** — Nine stories touching engine, server, and client; coordination cost is real even with good specs.
2. **Governance edge cases** — Timers, silence-as-deny, and host logs require careful UX + test alignment across two voting flows.
3. **Ongoing vigilance** — Any future change to `state-broadcaster` or `PlayerGameView` shape remains a **multi-file** review (mapper, tests, integration).

---

## Key insights

1. **Retro follow-through as stories works** — 3C.8/3C.9 proved that backlog items from a retro become shippable when they have ACs and owners.
2. **Thin client integration beats a mock global store** — Prop-driven `GameTable` plus mapper + WebSocket composable matches the documented three-tier model.
3. **Reuse patterns reduce UI risk** — Voting UI and `useTileSelection` echo across features; naming and reset behavior must stay documented in dev notes.

---

## Readiness assessment

| Area | Status |
| --- | --- |
| Shared rules engine | Strong — Joker, dead hand, wall end, concealed checks in shared tests |
| Server protocol & broadcaster | Strong — integration tests and checklist when touching filters |
| Live client → `GameTable` | **Addressed in 3C.8** — production path exists; 4B will deepen reconnect |
| Call confirmation UX | **Addressed in 3C.9** — aligns with Charleston selection patterns |
| Production deployment / stakeholder sign-off | Out of band — confirm with Rchoi |

**Verdict:** Epic 3C is **complete for story acceptance** and **materially advances** multiplayer honesty (authoritative UI path). Further hardening belongs to Epic 4B and product QA.

### Optional playtest milestone (product)

If the goal is **“we’d show this to friends,”** track a lightweight milestone outside story status, for example:

- Four clients (or four tabs / devices), one full game through wall or Mahjong, **without** relying on dev-only routes for core flow.
- Chat **off** is fine for a rules pass; turn on chat when Epic 6A matters.

Failing this does **not** undo Epic 3C completion under the [definition above](#definition-epic-3c-complete); it answers a different question (**product readiness**).

---

## Action items (SMART)

### Process

1. **Keep retro follow-through keys accurate when superseding a debt item with a story**  
   - **Owner:** Scrum Master + Rchoi  
   - **Success criteria:** `retro_follow_through` entries reference the story IDs that resolved them (pattern already used for 3b → 3c-9).

2. **For Epic 6A first story, paste validation checklist** into the story file per Epic 3C convention.  
   - **Owner:** Scrum Master  
   - **Success criteria:** New story file includes `story-validation-checklist.md` section for filtered-view and WS concerns.

3. **When the next epic is selected for development**, add a one-line assumption note in the first story file or in `sprint-status.yaml` comments — e.g. “Epic 6A assumes 3C.8 live `STATE_UPDATE` → mapper path; no optimistic client `GameState`.”  
   - **Owner:** Scrum Master + Rchoi  
   - **Success criteria:** Next epic’s kickoff artifact explicitly names which 3C outcomes it builds on, so scope does not drift silently.

### Technical

1. **Epic 6A / 4B — explicitly list dependencies** on `mapPlayerGameViewToGameTable`, rack reconciliation, and session token flow in story dev notes.  
   - **Owner:** Architect + Developer  
   - **Success criteria:** No new client-side authoritative `GameState` stores without architecture review.

### Quality

1. **When touching `state-broadcaster` or protocol filters** — run `state-broadcaster.test.ts` and relevant WebSocket integration tests (already standard; keep in checklist).  
   - **Owner:** QA + Developer  
   - **Success criteria:** CI green; no skipped integration tests for privacy-sensitive paths.

---

## Epic 6A preparation tasks (indicative)

| Task | Owner | Notes |
| --- | --- | --- |
| Chat message type design aligned with `protocol.ts` | Developer | No hidden tile payload leakage |
| Reuse room WebSocket / session patterns | Developer | Extend, don’t duplicate `RoomView` connection logic |
| UI: slide-in panel pattern | Client | Align with existing panels from 5A where possible |

---

## Retrospective closure

**Bob (Scrum Master):** "Epic 3C delivered advanced rules and finished the integration stories we owed from Epic 3B. Next, we choose whether **6A**, **4B**, or **5B** leads — with clear dependencies on the mapper and WebSocket path we just hardened."

**Alice (Product Owner):** "And we should mark the epic retrospective **done** in sprint-status so the record matches delivery."

**Rchoi (Project Lead):** *[Space for final reflections]*

---

## Related artifacts (spine of Epic 3C)

| Artifact | Path |
| --- | --- |
| Story validation checklist | [`story-validation-checklist.md`](story-validation-checklist.md) |
| `PlayerGameView` → `GameTable` mapper + tests | [`packages/client/src/composables/mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts), [`mapPlayerGameViewToGameTable.test.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts) |
| Live room shell / WS wiring | [`RoomView.vue`](../../packages/client/src/views/RoomView.vue), [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) |
| Server filtered views | [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) |
| Tile selection (Charleston + call confirmation) | [`useTileSelection.ts`](../../packages/client/src/composables/useTileSelection.ts) |
| Architecture / protocol context | [`game-architecture.md`](../planning-artifacts/game-architecture.md), [`project-context.md`](../project-context.md) |
| Epic definition (3C stories) | [`epics.md`](../planning-artifacts/epics.md) (Epic 3C section) |

---

## Metrics (non-time-based)

- **Stories completed:** 9 / 9 (100%)  
- **Epic 3B retro follow-up stories completed:** 2 / 2 (3C.8, 3C.9)  
- **Significant plan revisions required:** None identified  

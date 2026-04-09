# Sprint Change Proposal: Game Experience Quality
**Date:** 2026-04-09
**Author:** Rchoi (SM)
**Status:** Approved
**Replaces:** Initial draft (phase transitions focus), Second draft (table visual design)

---

## Section 1: Issue Summary

**Trigger:** Story 7.5 Task 1.6 — live golden path session (first human run of the full game end-to-end).

**Problem statement:** Mahjong Night is technically complete through Epic 7. All features are implemented correctly, tests pass, code reviews passed. But the first live four-player session revealed the game feels disconnected and broken. A Playwright visual audit confirmed the root causes.

**Root cause — two distinct layers:**

1. **Two P0 bugs** that make the game look more broken than it is:
   - The Table Talk Report form is permanently visible in the center of the game table, covering discard pools. Should be a button that opens an overlay.
   - Dev-solo ghost players render in the "reconnecting" wireframe state, making all three opponent seats appear as empty dashed boxes during solo testing.

2. **Design quality gaps** where components were built correctly per spec but sized/weighted too conservatively to achieve the GDD's visual bar:
   - Opponent areas: 40px avatar frames, 12px names, 140px max-width — reads as metadata labels, not player presence
   - Landing page: unstyled white page with no brand identity or palette
   - Tile rack: ~36px tiles vs 44px minimum for comfortable iPad touch
   - Lobby player list: flat text rows, no avatar circles or seat presence

**Why this wasn't caught earlier:** Agent-driven development can verify that a component renders correctly and passes tests. It cannot evaluate whether the result looks right in a running browser. No story in Epics 1–7 was scoped to validate experiential quality end-to-end. Story 7.5 was designed to catch exactly this — and it did.

---

## Section 2: Impact Analysis

| Epic | Status | Impact |
|------|--------|--------|
| Epic 7 — Visual Polish & Audio | **done** | Closed. All features correct. Story 7.5 produced this proposal — its job is done. |
| **Epic 9 — Game Experience Quality** | **in-progress** | New epic. Phase 0 bug fixes + 3 design quality stories. |
| Epic 8 — Profiles, Stats & Accessibility | backlog | **On hold** until Epic 9 passes live visual review. Don't ship profile screens on a table that doesn't feel designed. |

**Artifacts updated:**
- `sprint-status.yaml` — Epic 7 → done, Story 7.5 → done, Epic 9 added
- `epics.md` — Epic 9 added with Phase 0 bug fixes and Stories 9.1–9.3

---

## Section 3: Recommended Approach

**Option 1 — Direct Adjustment (selected).** Fix bugs immediately, then execute targeted design quality stories. No rollback. No MVP scope reduction. All existing work is correct and stays.

**Rationale:** The bugs are small, targeted fixes. The design quality gaps are in component sizing and visual weight — the layout architecture (CSS Grid, component structure) is correct and doesn't need restructuring. Changes are additive and low-risk.

---

## Section 4: Detailed Change Plan

### Phase 0: Bug Fixes (immediate fix commits, no story files)

**Bug A — Table Talk Report always visible (P0)**
- **Problem:** `TableTalkReport` or equivalent component renders permanently in the game table center, covering discard pools during every turn.
- **Fix:** Gate rendering behind a button trigger. The form should only appear as an overlay/modal when a player actively initiates a report.
- **Commit:** `fix(client): gate table talk report behind trigger button (closes P0 playtest finding)`

**Bug B — Dev-solo ghost players render as "reconnecting"**
- **Problem:** Ghost players created by `DEV_SOLO` mode receive "reconnecting" connection status, triggering the wireframe/dashed-box placeholder state in `OpponentArea.vue` for all three seats. Solo testing always looks visually broken.
- **Fix:** Ensure dev-solo ghost players are initialized with connected status and render as normal seated players (face-down tile stacks, avatar circles, names).
- **Commit:** `fix(server): dev-solo ghost players initialize as connected, not reconnecting`

---

### Story 9.1: Landing Page Brand Identity

**Problem:** The landing/entry page is an unstyled white form with no brand identity, wrong palette, and no visual connection to the game. First impression is a university project.

**What to build:** Apply the game's visual language to the entry experience. The design tokens, palette (teal/cream/gold), and typography system already exist — this is application, not invention. Specifically:
- Landing page background uses game palette (teal or warm cream), not white
- "Mahjong Night" heading uses the game's typography treatment
- Create/join form feels like the ante-room to a game table, not a generic web form
- Room code is prominently displayed on the join confirmation screen
- Dev showcase links are visually separated from player-facing content

**Done when:** Landing page passes a live visual check — it reads as the beginning of the Mahjong Night experience. Backpressure gate passes.

---

### Story 9.2: Game Table Visual Quality Pass

**Problem:** Components are correctly implemented but sized for a developer's monitor, not a 40-70+ audience on a propped-up iPad. Opponent seats feel like metadata labels. Tile interactions are below the 44px touch minimum.

**What to change (specific values from audit):**
- Avatar frames: `h-10 w-10` (40px) → minimum `h-14 w-14` (56px) tablet / `h-18 w-18` (72px) desktop
- Opponent area max-width: relax from `max-w-[140px]` to allow names and scores to breathe
- Player name text: `text-3` (12px) → minimum `text-3.5` (14px) tablet / `text-4` (16px) desktop  
- Scores: increase visual weight — visible secondary element, not `text-on-felt/85` opacity ghost
- Tile rack tiles: increase toward 44px minimum touch target for iPad
- Active-turn styling: strengthen ring/highlight so the active seat is unmissable at arm's length
- Lobby player list: add avatar circles with initials and seat wind indicators

**Process gate:** This story is NOT done until it passes a live browser visual check at 1024px (iPad landscape). The test suite cannot validate visual quality. This is the lesson of the prior epics.

**Done when:** Opponent seats feel like people, not stats. Text is readable without leaning in. Tile interactions are comfortable thumb-sized. Passes live visual check + backpressure gate.

---

### Story 9.3: Phase Transitions & Session Cohesion

**Problem:** Phase boundaries are instantaneous state switches. The game reads as a sequence of separate screens rather than one session arc.

**What to build:**
- Choreographed enter/leave transitions at each phase boundary using motion-v (already in stack): lobby→dealing, charleston→play, mahjong→scoreboard, scoreboard→rematch
- Verify CSS mood crossfades (arriving→playing→lingering) are perceptible in a live browser — 1-2 seconds as specified in GDD
- Brief phase announcement moments: "Game starting — East deals first", "Charleston begins", "Game 2"
- Persistent player names + session scores across all phases
- Rematch anticipatory beat before dealing resumes

**Done when:** A live browser session reads as one designed arc. Backpressure gate passes.

---

## Section 5: Process Change (Critical)

**Every Epic 9 story must include a live browser visual check as an explicit completion gate** — not just the backpressure gate. The test suite verifies correctness; it cannot verify quality. Specifically: open the game at 1024px (iPad landscape), walk through the relevant phase, and confirm the visual change achieves its goal before marking the story done.

This is the root process failure that produced the current state. Fixing it here prevents it from recurring in Epic 8.

---

## Section 6: Success Criteria

After Epic 9 Phase 0 + Stories 9.1–9.2: A second live four-player session produces a reaction closer to *"oh, this is nice"* than *"this is broken."*

After Story 9.3: The full session arc (lobby → rematch) feels like one designed experience.

After Epic 9 complete: Begin Epic 8 (Profiles, Stats & Accessibility).

---

## Appendix: Audit Evidence

Visual audit conducted 2026-04-09 via Playwright at 1024×768 (iPad landscape). Key findings:

| Finding | Type | Priority |
|---------|------|----------|
| Table Talk Report form permanently covers discard pools | Bug | P0 |
| Dev-solo ghost players show wireframe state for all 3 seats | Bug | P1 |
| Landing page: unstyled white, no brand identity | Design | High |
| Opponent avatar frames 40px, names 12px | Design | High |
| Tile rack tiles ~36px (below 44px touch minimum) | Design | Medium |
| Lobby player list: flat text, no presence | Design | Medium |
| Wall counter: no spatial meaning, stat label only | Design | Low |
| Emoji reaction column: cramped right-edge strip | Design | Low |

**What already works well:** Teal/cream palette is warm and cohesive inside a room. Charleston modal (3 of 3 selected, amber Pass CTA) is clean. Courtesy pass segmented control is well-executed. Amber Mahjong vs outlined Discard hierarchy is correct. Tile art SVGs have character and visual richness.

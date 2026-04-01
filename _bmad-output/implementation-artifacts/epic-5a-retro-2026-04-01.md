# Epic 5A Retrospective: Core Game UI

**Date:** 2026-04-01
**Facilitator:** Max (Scrum Master)
**Epic Status:** Complete (10/10 stories)

## Team Participants

- Cloud Dragonborn (Game Architect)
- Samus Shepard (Product Owner)
- Link Freeman (Game Developer)
- GLaDOS (QA Architect)
- Max (Scrum Master)
- Rchoi (Project Lead)

## Epic Summary

**Delivery Metrics:**
- Completed: 10/10 stories (100%)
- Scope delivered: design system, tile rendering, rack interaction, immersive table layout, discard flow, call buttons, Mahjong declaration UI, turn/wall/score status, keyboard accessibility foundation, and consumer-driven shared UI primitives
- Validation pattern: focused component tests, integration tests, and dedicated dev showcase surfaces used throughout the epic

**Quality and Technical:**
- Review catches remained valuable across the epic, including DnD wiring, animation/integration behavior, layout corrections, and accessibility regressions
- Primitive extraction was completed after real consumers existed rather than speculatively up front
- Tile readability validation corrected a real UI assumption: the shared small-tile width moved from 30px to 32px after manual review of the 152-tile surface
- Final story records report client-suite, repo test, typecheck, and lint validation passing at epic close

**Stories Delivered:**
1. 5A.1: Design System Foundation
2. 5A.2: Tile Component & SVG Sprite Sheet
3. 5A.3: TileRack with Drag-and-Drop & Sort
4. 5A.4: Game Table Layout (Immersive Table)
5. 5A.5: Discard Pool & Two-Step Discard Interaction
6. 5A.6: Action Zone & Call Buttons
7. 5A.7: Mahjong Button & Declaration UI
8. 5A.8: Turn Indicator, Wall Counter & Game Scoreboard
9. 5A.9: Keyboard Navigation & Accessibility Foundation
10. 5A.10: Shared Primitive Extraction & Tile Readability Validation

## Previous Retro Follow-Through (Epic 4A)

| Action Item | Status | Evidence |
|---|---|---|
| Embed validation checklist in story specs | ❌ Not addressed | No formal validation checklist appears in the Epic 5A story records |
| Track retro action items in sprint tracking | ❌ Not addressed | Sprint tracking captured story completion, but not retro action items as first-class tracked entries |
| Complete client integration prep (`useWebSocket`, `useGameState`) | ❌ Not addressed | No client integration layer appears in `packages/client/src`; Epic 5A succeeded via prop-driven, mock-friendly UI scaffolding instead |
| Expect domain-shift learning curve | ✅ Applied | Early UI stories established reusable patterns, and later stories compounded on them instead of restarting |

**Result: 1/4 action items fully completed, 3 not addressed**

## Successes

1. **Strong sequencing reduced churn.** The epic progressed from tokens and tiles to rack and table layout, then to interaction layers, accessibility, and finally primitive extraction. Later stories mostly extended existing surfaces instead of replacing them.

2. **UI architecture compounded well.** `GameTable`, `ActionZone`, `TileRack`, shared dev showcases, and later UI primitives gave the epic a coherent spine instead of ten disconnected feature implementations.

3. **Review and test discipline protected quality.** Important issues were caught before they became downstream debt: DnD integration gaps, exit-animation behavior, layout corrections, scoreboard behavior, and accessibility regressions.

4. **Validation corrected a real usability assumption.** Story 5A.10 verified the full 152-tile surface and found 30px readability insufficient, leading to a shared minimum size increase to 32px for all current consumers.

5. **The epic delivered a credible UI vertical slice.** Players can now see tiles, arrange racks, discard with a two-step flow, call, declare Mahjong, read turn/wall/score status, and navigate the table by keyboard.

## Challenges

1. **Review remained the main enforcement mechanism.** The epic shipped good outcomes, but too many important fixes still landed reactively during review instead of being prevented by story execution discipline.

2. **Previous retro follow-through was weak.** The validation checklist, retro action tracking, and client integration prep called out after Epic 4A were not completed before or during Epic 5A.

3. **The epic closed more cleanly as a UI milestone than as a fully integrated playtest milestone.** The client UI is strong, but the real client-state integration layer (`useWebSocket`, `useGameState`, room/table orchestration) is still absent.

4. **Definition-of-done blurred around implied playtest readiness.** Epic 5A planning language suggested a more integrated first-playtest milestone, and also mentioned basic audio, but the story records still defer audio behavior rather than shipping it.

## Key Insights

1. **Prop-driven scaffolding is a powerful tactic, but it does not eliminate the need for real integration.** Epic 5A proved the UI can be built cleanly this way, but Epic 3B now needs the real state pipe.

2. **Consumer-driven extraction worked.** Waiting until Story 5A.10 to extract `BaseButton`, `BasePanel`, `BaseBadge`, and `BaseToast` produced cleaner abstractions than extracting primitives too early.

3. **Dev showcases became high-leverage assets.** `/dev/*` surfaces repeatedly supported visual verification, manual QA, and review conversations across the epic.

4. **Readability should be validated on actual use surfaces, not just assumed from spec intent.** The 152-tile validation changed a shared UI constraint before future epics inherited the wrong minimum.

5. **Retrospective lessons need visible tracking to change team behavior.** Insights written only in markdown prose were not enough to ensure follow-through from Epic 4A into Epic 5A.

## Next Epic Preview: Epic 3B - Charleston

**Epic 3B focus:** full Charleston pre-game ritual with blind pass enforcement, optional second Charleston vote, courtesy pass negotiation, reusable `TileSelectionAction`, and disconnect handling.

**Why it matters:** Charleston is the first major UI flow after Epic 5A that depends on synchronized multiplayer phase state, temporary hidden information, simultaneous player choices, and phase-specific reconnect behavior.

**Dependencies on Epic 5A work:**
- `GameTable` and `ActionZone` as the primary play surface
- `TileRack` keyboard/selection foundation
- shared button/panel/badge primitives
- interaction patterns that must now shift from mocked props to live state

## Significant Discovery

**Epic update required: YES**

Epic 5A revealed that the current UI milestone is strong, but Epic 3B should not begin as-is without a short planning review. The next epic assumes a live client-state integration layer that still does not exist in the client package.

**Impact on Epic 3B:**
- Charleston UI should not be built on mock-only state once simultaneous pass selection and blind-pass hiding are involved
- `TileSelectionAction` reuse needs explicit design before it is applied to both Charleston and earlier call-confirmation work
- reconnect and auto-pass behavior must be treated as first-class Charleston design concerns from the start

## Action Items

### Process Improvements

1. **Add a validation checklist to future story specs**
   - Owner: Max (Scrum Master)
   - Success criteria: the next created story includes a dedicated validation checklist covering pattern reuse, accessibility, cleanup/disposal, and integration risks

2. **Track retro action items in visible sprint tracking**
   - Owner: Max (Scrum Master)
   - Success criteria: future retrospective outcomes are captured as explicitly trackable work items rather than prose-only commitments

3. **Clarify milestone language when scope remains deferred**
   - Owner: Samus Shepard (Product Owner)
   - Success criteria: deferred items such as basic playtest audio are called out explicitly so milestone readiness is not overstated

### Technical / Architectural

4. **Create the real client integration layer before Epic 3B implementation**
   - Owner: Link Freeman (Game Developer)
   - Success criteria: `GameTable` can be driven by live server state via a client integration surface rather than showcase-only props

5. **Hold an Epic 3B planning review before story execution**
   - Owner: Max (Scrum Master) + Cloud Dragonborn (Architect) + Rchoi (Project Lead)
   - Success criteria: Epic 3B assumptions are reviewed and updated for client integration, `TileSelectionAction` reuse, and Charleston reconnect behavior before implementation begins

## Preparation Tasks for Epic 3B

### Critical Path

1. [ ] Establish client-side game-state integration surface for the real table UI
   - Owner: Link Freeman

2. [ ] Review and update Epic 3B plan to account for the missing integration prerequisite
   - Owner: Max / Cloud Dragonborn / Rchoi

### Important Follow-Through

3. [ ] Define the `TileSelectionAction` reuse plan across Charleston and existing call-confirmation UI
   - Owner: Link Freeman / Cloud Dragonborn

4. [ ] Bring Charleston reconnect and auto-pass behavior into early design/testing, not late cleanup
   - Owner: GLaDOS / Link Freeman

## Readiness Assessment

| Area | Status |
|---|---|
| Epic 5A UI quality | ✅ Strong |
| Component reuse and design consistency | ✅ Strong |
| Accessibility foundation | ✅ Strong baseline |
| Review/test discipline | ✅ Strong |
| Client integration for live multiplayer UI | ⚠️ Incomplete |
| Readiness for Charleston implementation | ⚠️ Requires critical-path prep |
| Audio/playtest completeness | ⚠️ Deferred |

## Final Takeaways

1. Epic 5A was a successful UI epic with real architectural compounding.
2. The team corrected usability assumptions honestly instead of protecting the original plan.
3. The main unresolved risk is not visual polish, but missing live client integration before Charleston work begins.
4. Epic 3B should start only after a focused planning review aligns the next phase with what Epic 5A actually delivered.

## Next Steps

1. Complete the critical-path client integration prep for the table UI.
2. Run the Epic 3B planning review and update the epic/story assumptions as needed.
3. Carry the validation checklist and retro action tracking improvements into the next planning cycle.

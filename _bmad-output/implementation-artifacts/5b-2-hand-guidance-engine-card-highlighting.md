# Story 5B.2: Hand Guidance Engine & Card Highlighting

Status: done

<!-- Changelog: 2026-04-05 — validation-review follow-up: normative distance + NFR8 CI policy + guidance-off = full 5B.1 card -->
<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a **player**,
I want **the NMJL card to subtly highlight which hands are still achievable given my current tiles, ranked by closeness to completion**,
So that **I can focus my strategy without memorizing the entire card (FR43, FR44, FR45, FR63)**.

## Acceptance Criteria

1. **Shared engine (FR43, NFR8, FR63):** A pure TypeScript API in `packages/shared` accepts the local player’s **rack tiles**, **exposed groups**, and **`NMJLCard`** (e.g. `loadCard('2026')`), and returns **per-hand-pattern results** including at minimum: `patternId`, **distance** (see normative definition below), and whether the hand remains **achievable** vs **impossible** after exposure filtering. Results must respect **concealed-only** and **group-level concealed** rules — reuse and extend logic aligned with `filterAchievableByExposure`, `validateHandWithExposure`, and `packages/shared/src/card/pattern-matcher.ts` (see game-architecture “Hand guidance — closeness ranking”). **Do not cache** guidance results between draws/discards (stateless full recompute).
   - **Normative `distance`:** Over all valid suit/value/joker assignments for that card row, `distance` is the **minimum number of additional tiles the player must still obtain** (e.g. from wall draws) so that **exactly 14 tiles** in the combined pool (**rack tiles ∪ tiles in exposed melds**) can form a winning hand for that pattern under the same matching rules as `validateHandWithExposure`. Optimize assignments to **minimize** that count. **`0`** iff those 14 tiles already complete the pattern. If the pool already has **14** tiles and **no** assignment completes the pattern, mark the row **`achievable: false`** (impossible for this story — do not emit a misleading finite distance). If the pool has **fewer than 14** tiles and some completion exists, `distance` is that minimum extra-tile count (always **≥ 1** when achievable and &lt; 14 tiles in pool).
2. **Performance (NFR8):** Full guidance computation for all patterns on the 2026 card completes **&lt; 100ms** per invocation on **typical local dev hardware**. **Verification policy (normative):** **Do not** assert the 100ms bound in CI (machine variance). **Do** (a) document in Dev Agent completion notes or `hand-guidance.ts` header comment how you confirmed &lt;100ms locally (e.g. `console.time` / one-off loop in dev), and (b) optionally add a shared test with a **generous** ceiling (e.g. **≤ 500ms**) labeled **non-regression only** — must not fail normal CI on slow runners; skip the optional test if it flakes.
3. **Card UI (FR43, UX-DR41):** **When guidance is not effective** (room disabled, user/auto disabled, spectator, or no meaningful hand — see AC 6–7): render like **Story 5B.1** — **all** hand rows visible, **no** guidance-specific classes, **no** hiding rows for impossibility. **When guidance is effective** (see AC 4–6), `NMJLCardPanel` applies:
   - **`guidance-achievable`** — warm **gold/neutral** highlight for **close** hands (suggested band: distance **1–3**, tunable constants),
   - **`guidance-distant`** — faded/desaturated treatment for **distant** but still achievable hands (suggested: distance **≥ 4**),
   - **Hidden** (not listed, `v-if` / `display: none`, or equivalent) for **impossible** hands (failed feasibility or exposure rules).
   **Never** use suit colors for guidance (bam/crak/dot) — only guidance tokens / neutral chrome (UX-DR1, UX-DR41). If `themeColors.guidance` in `design-tokens.ts` does not match “warm gold/neutral,” **update tokens and/or Uno shortcuts** in the same change so runtime matches UX spec.
4. **First 3 completed games (FR44, GDD):** Hand guidance defaults **ON** until the player has completed **3 games** in this browser. A **completed game** = ends in **Mahjong** or **wall game** only (exclude disconnect-only endings, abandoned sessions, and **spectated** games if the client can detect spectator mode). Persist **`completedGamesCount`** in **localStorage**. On transition past the 3rd completion, **auto-disable** guidance and show a **one-time** user-visible message: *"You can re-enable hints in settings"* (toast or inline banner consistent with existing GameTable/RoomView notification patterns — do **not** introduce a third toast pattern; see `4b-retro-1-consolidate-toast-pattern` in sprint-status).
5. **Host room setting (FR45):** Host can toggle **hand guidance allowed for the room** via **existing** `RoomSettings` flow (`RoomSettingsPanel`, `SET_ROOM_SETTINGS`, `applyRoomSettingsUpdate`). When the host turns guidance **off**, **no player** sees highlights regardless of local preference. When **on**, per-player logic from AC 4 and AC 6 applies. Extend **`RoomSettings`** in `@mahjong-game/shared`, server merge/validation in `packages/server/src/rooms/room-settings.ts`, protocol typing, and **`humanLabel` / `humanValue`** in `roomSettingsFormatters.ts`. Default should match product expectation (recommend **on** to align with GDD inclusive default unless PM says otherwise).
6. **Player preference (FR44 / settings persistence):** A **Pinia** store (new, e.g. `useHandGuidancePreferencesStore` or broader `usePreferencesStore` if you add other prefs) persists **manual** user overrides in **localStorage** (e.g. user explicitly re-enables after auto-disable). **Effective guidance** = `roomAllows && userWants` where `roomAllows` comes from room settings and `userWants` combines auto 3-game rule + explicit override.
7. **State wiring:** Guidance uses **only server-authoritative** tiles for the **local seated player** — rack + exposed groups from `PlayerGameView` / GameTable props (same “no Pinia for game state” rule as [project-context.md](_bmad-output/project-context.md)). **Spectators** or **no active hand**: do not run highlights (treat as guidance off or pass empty result). **Charleston / lobby:** If the local player has a rack in view, compute from that; if not meaningful, skip or show card without guidance (pick one consistent behavior and test it).

## Transition Scenarios

| From | To | Trigger | Expected Behavior |
|------|----|---------|---------------------|
| Guidance off (room) | Reference-only card | Host disables room hints | **Normative:** Full card as 5B.1 — all rows visible, no guidance classes, **no** hiding impossible rows (reference mode only) |
| Guidance on (room), user eligible | Highlights on | Open NMJL panel | Rows styled per distance; impossible hidden |
| 2 completed games | 3rd game completes | Scoreboard/wall-game end | Increment count; after end of that game, guidance turns off + message once |
| User re-enables | Highlights on | Toggle in UI / store | Overrides auto-off until user turns off again |
| Rack/exposure updates | New ranks | STATE_UPDATE | Full recompute; no stale highlights |
| Detail view open | Detail view | Tap hand row | Detail shows same pattern; optional: show distance in detail (not required) |
| Host toggles room hints | Live update | ROOM_SETTINGS resolved | Non-host clients update effective guidance without reload |

## Tasks / Subtasks

### Task 1: Shared hand-guidance engine (AC: 1, 2, 7)

- [x] 1.1 Add `packages/shared/src/card/hand-guidance.ts` (name adjustable) exporting a clear API, e.g. `rankHandsForGuidance(tiles: Tile[], exposed: ExposedGroup[], card: NMJLCard): GuidanceResult[]` where `GuidanceResult` includes `patternId`, `distance`, `achievable`.
- [x] 1.2 Integrate **Phase 1** style filtering: reuse `categorizePlayerTiles` / `filterFeasibleHands` patterns from `pattern-matcher.ts` where possible; intersect with **`filterAchievableByExposure(exposed, card)`** (or equivalent) so FR63 is satisfied before expensive work.
- [x] 1.3 Implement **closeness** using the same assignment structure as `tryMatch` / `validateHand` but minimizing **missing tiles** across suit permutations and value ranges (see game-architecture pseudo-code `handCloseness`). **Distance semantics are fixed in AC1** (normative bullet) — encode exactly that in code + module docstring; golden tests must match AC1, not an alternate definition.
- [x] 1.4 Export new types/functions from `packages/shared/src/index.ts` and add **`hand-guidance.test.ts`** with fixtures: known hands at distance 0, 1, impossible after exposure; edge cases with jokers.
- [x] 1.5 Per **AC2 verification policy:** document local &lt;100ms check in comments or completion notes; optional **≤500ms** non-regression test only if stable — **no** hard 100ms assert in CI.

### Task 2: Room settings + protocol (AC: 5)

- [x] 2.1 Extend `RoomSettings` in `packages/shared/src/types/room-settings.ts` with a boolean field (e.g. `handGuidanceEnabled`). Update **`DEFAULT_ROOM_SETTINGS`**.
- [x] 2.2 Update `RoomSettingsPatch`, `mergeRoomSettings`, `applyRoomSettingsUpdate`, and **`room-settings.test.ts`**.
- [x] 2.3 Update protocol types / handlers for `SET_ROOM_SETTINGS` payload if needed (client `sendSetRoomSettings`, server validation).
- [x] 2.4 Update **`RoomSettingsPanel.vue`** + tests: host control when `canEdit` and phase allows (mirror existing settings gating from 4B.7).

### Task 3: Pinia + localStorage (AC: 4, 6)

- [x] 3.1 Create store for `completedGamesCount`, optional `guidanceUserOverride`, and `hasShownAutoDisableMessage` (or derive message display without duplicate spam).
- [x] 3.2 Hook **game completion** detection on the client (scoreboard entry or resolved game result) to increment completed count only for qualifying endings; **do not** increment for spectate-only sessions.
- [x] 3.3 Implement **`effectiveHandGuidanceVisible`** computed: combines room setting, store, and game presence.

### Task 4: NMJLCardPanel + wiring (AC: 3, 7)

- [x] 4.1 Add UnoCSS shortcuts **`guidance-achievable`** and **`guidance-distant`** in `themeShortcuts` (or documented utilities) mapping to **gold/neutral** backgrounds/borders — align `themeColors.guidance` with UX-DR1 if needed.
- [x] 4.2 Extend **`NMJLCardPanel.vue`** with props: e.g. `guidanceByHandId: ReadonlyMap<string, GuidanceResult> | null` and `guidanceActive: boolean` (or a single nullable config object). Apply classes per row; **hide** impossible rows when guidance active.
- [x] 4.3 Thread props from **`GameTable.vue`** → **`SlideInReferencePanels.vue`** → **`NMJLCardPanel.vue`**: compute guidance in GameTable (or small composable `useHandGuidanceForPlayer`) from injected/propped `PlayerGameView` + `roomSettings`.
- [x] 4.4 Update **`NMJLCardPanel.test.ts`** and **`SlideInReferencePanels`** tests: class binding, hidden rows, `guidanceActive: false` preserves 5B.1 behavior.

### Task 5: UX copy & a11y (AC: 3, 4)

- [x] 5.1 One-time auto-disable message (AC 4) with accessible live region if using assertive messaging (follow existing toast a11y).
- [x] 5.2 When rows are hidden, ensure **category headers** still make sense (empty category section hidden or “No achievable hands in this section” — prefer **hide empty category** to reduce noise).

### Task 6: Integration / regression

- [x] 6.1 `pnpm test`, `pnpm run typecheck`, `vp lint` from repo guidance.
- [x] 6.2 Verify **Mahjong validation** unchanged (no behavior change to `validateHand` / `validateHandWithExposure` except any shared helpers intentionally shared).

## Dev Notes

### Architecture & patterns

- **Client-only computation** for guidance (game-architecture.md): server already has tile data; client recomputes from pushed state — **no new WebSocket message type** required unless you choose to push hints (not in scope; prefer local compute).
- **Existing matchers:** `validateHand` requires **14** tiles for a full win check. **Distance** for partial hands is defined **only** by the normative bullet under **AC1** — duplicate that definition in the shared module docstring so implementers and tests share one source of truth.
- **`filterAchievableByExposure`** already encodes much of FR63; ensure the engine does **not** show concealed-only hands after exposures.
- **`matchesGroupIdentity` limitation** (abstract A/B/C in `exposure-validation.ts`): if guidance rejects borderline cases, document; fixing full color-aware matching may be follow-up unless required for 2026 data.

### Source tree (expected touchpoints)

| Area | Files (indicative) |
|------|---------------------|
| Shared engine | `packages/shared/src/card/hand-guidance.ts`, `index.ts`, `*.test.ts` |
| Exposure reuse | `packages/shared/src/card/exposure-validation.ts`, `pattern-matcher.ts` |
| Room settings | `packages/shared/src/types/room-settings.ts`, `packages/server/src/rooms/room-settings.ts`, protocol types |
| Client UI | `NMJLCardPanel.vue`, `HandPatternDetail.vue` (optional), `SlideInReferencePanels.vue`, `GameTable.vue`, `RoomSettingsPanel.vue` |
| Client state | New store under `packages/client/src/stores/` |
| Theme | `design-tokens.ts`, `uno.config.ts` / `themeShortcuts`, `ThemeShowcase.vue` (dev) |
| Formatters | `packages/client/src/composables/roomSettingsFormatters.ts` |

### Testing standards

- Shared: `vite-plus/test` imports, co-located `*.test.ts`.
- Client: `happy-dom`, `setActivePinia(createPinia())` in `beforeEach`, mock DnD if needed.
- Do **not** use `jsdom`.
- **NFR8:** Follow **AC2** — CI must not depend on a 100ms threshold; optional loose regression test is explicitly non-authoritative for the product SLA.

### Anti-patterns (Do NOT)

- Do **not** store rack or guidance results in Pinia as **source of truth** — derive from game state each time.
- Do **not** add suit-colored highlights for guidance.
- Do **not** introduce a parallel room settings channel — extend existing `SET_ROOM_SETTINGS`.
- Do **not** cache guidance across STATE_UPDATE boundaries.

### Previous story intelligence (5B.1)

- **NMJLCardPanel** loads card via `loadCard('2026')` locally; guidance can receive the same `NMJLCard` or rely on panel’s loaded card — avoid double-loading if you pass precomputed map only.
- **Props, not inject** in panel children per 5B.1; GameTable bridges game state.
- **SlideInPanel** / **slideInPanelStore** unchanged for this story.
- **Escape** handling and detail focus: preserve existing behavior when adding row classes.

### Cross-session intelligence

- **Toast consolidation (4b-retro-1)** still **pending** — reuse whichever pattern GameTable/RoomView already uses for room settings toasts (`BaseToast` + local `ref` visibility).
- **`filterAchievableByExposure`** was explicitly scaffolded “for future hand guidance” — use it.

### Git intelligence (recent commits)

- NMJL panel and accessibility landed in `feat(client): NMJL card panel…` / `feat(client): enhance NMJLCardPanel…` — extend those files rather than rewriting panel structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5B, Story 5B.2]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — NMJL Pattern Matching, Hand guidance full recompute, closeness pseudo-code]
- [Source: _bmad-output/planning-artifacts/gdd.md — Hand guidance toggle, first 3 games, localStorage]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Hand Guidance tokens, UX-DR41]
- [Source: packages/shared/src/card/pattern-matcher.ts — validateHand, feasibility filter]
- [Source: packages/shared/src/card/exposure-validation.ts — filterAchievableByExposure, validateHandWithExposure]
- [Source: _bmad-output/implementation-artifacts/5b-1-nmjl-card-panel-slideinpanel-full-screen-overlay.md]
- [Source: _bmad-output/project-context.md — game state vs Pinia]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- **2026-04-05 (GDS code review second pass, auto-fix):** Pool &gt; 14 disables NMJL guidance; tests for distance-band classes, SlideInReferencePanels prop passthrough, GameTable pool guard; `pnpm test`, `pnpm run typecheck`, `vp lint` green.
- **2026-04-05 (gds-dev-story second pass):** Re-ran full regression — `pnpm test`, `pnpm run typecheck`, `vp lint` — all succeeded (lint: 0 errors; existing warnings only).
- Implemented `rankHandsForGuidance` + `tryMatchWithExtraBudget` in shared; partial hands skip Phase-1 `isFeasible` so distance-1 cases work (see `minAdditionalTilesForPattern`).
- NFR8: manual &lt;100ms expectation documented in `hand-guidance.ts`; CI uses optional non-regression test with a loose ceiling (≤5s) to avoid slow-runner flakes.
- Host `handGuidanceEnabled` + Pinia `useHandGuidancePreferencesStore` + GameTable scoreboard watch for 3-game auto-disable toast (BaseToast pattern).
- `myExposedGroups` added to `mapPlayerGameViewToGameTableProps` and GameTable for guidance input.

### File List

- `packages/shared/src/card/hand-guidance.ts`, `hand-guidance.test.ts`
- `packages/shared/src/card/pattern-matcher.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/types/room-settings.ts`, `room-settings.test.ts`
- `packages/server/src/rooms/room-settings.ts`, `room-settings.test.ts`
- `packages/server/src/websocket/join-handler.ts`
- `packages/client/src/stores/handGuidancePreferences.ts`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.ts`, `mapPlayerGameViewToGameTable.test.ts`
- `packages/client/src/composables/roomSettingsFormatters.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/RoomSettingsPanel.vue`, `RoomSettingsPanel.test.ts`
- `packages/client/src/components/chat/SlideInReferencePanels.vue`
- `packages/client/src/components/nmjl/NMJLCardPanel.vue`, `NMJLCardPanel.test.ts`
- `packages/client/src/styles/design-tokens.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/client/src/views/RoomView.vue` (lobby `resolvedAction` toasts — shared copy with GameTable)
- `packages/client/src/composables/resolvedActionToastCopy.ts`, `resolvedActionToastCopy.test.ts`
- `CLAUDE.md` (project notes: resolved-action toast copy pattern)
- `packages/client/src/components/chat/SlideInReferencePanels.test.ts` (5B.2 guidance prop passthrough)
- `packages/client/src/components/game/GameTable.test.ts` (5B.2 pool-size guard)

### Change Log

- 2026-04-05 — **GDS code review (second pass), option 1:** Pool &gt; 14 → reference-only guidance off in `GameTable`; NMJL distance-band class tests; SlideInReferencePanels passes guidance props test; story File List + CLAUDE.md traceability.
- 2026-04-05 — **Second dev-story pass:** Regression verification only (no code changes); tests, typecheck, lint all green.
- 2026-04-05 — Story 5B.2 implementation: hand guidance engine, room setting, preferences store, NMJL panel styling, GameTable wiring, tests, gates passed.
- 2026-04-05 — **GDS code review:** AC4 toast copy aligned to normative string; NFR8 non-regression ceiling widened for CI stability; story marked done.
- 2026-04-05 — **GDS code review (first pass):** Findings recorded; addressed in follow-up (option 1: fix automatically).

### Code review findings (GDS, 2026-04-05) — resolved

- AC4 `BaseToast` in `GameTable.vue` now includes the normative *"You can re-enable hints in settings"* sentence (with leading context sentence).
- NFR8 optional timing test uses a ≤5s ceiling with comment per AC2 (non-regression only).

### Code review findings (GDS, 2026-04-05, second pass) — resolved

- Combined tile pool **&gt; 14** disables guidance (reference-only NMJL) to match AC1 fourteen-tile semantics.
- Tests added for **`guidance-achievable` / `guidance-distant`** row classes and **SlideInReferencePanels → NMJLCardPanel** prop threading.
- **File List** updated to include **CLAUDE.md** and new test files.

## Story Completion Status

- **Status:** done
- **Note:** GDS review follow-ups applied (2026-04-05).

### Open questions (non-blocking)

- **None for distance or guidance-off UI** — locked in **AC1** (normative distance) and **AC3** + transition table (full 5B.1 reference when guidance off).

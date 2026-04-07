# Story 7.2: Celebration Overlay Sequence

Status: done

## Story

As a **player**,
I want **a staged celebration when Mahjong is declared — dim, held beat, hand fan-out, winner spotlight, scoring overlay, and signature motif**,
So that **the climactic moment feels cinematic and shareable (FR70, FR129, UX-DR27)**.

## Acceptance Criteria

1. **Staged sequence** — When `gamePhase` transitions to `"scoreboard"` with a non-null `gameResult`, the celebration sequence plays through: (1) Dim — other players' table areas reduce to 20–30% opacity, excluding video thumbnails and interactive buttons (2) Held beat — 0.5s anticipatory pause (3) Hand fan-out — winner's tile backs fan from their seat toward center stage in an arc using `timing-expressive` (4) Winner spotlight — warm "Mahjong!" text with winner's name in `celebration-gold` (5) Scoring overlay — hand value and payment breakdown below the fanned tiles (6) Signature motif placeholder — hook for audio (Story 7.3); visually: a brief pulse or glow on the "Mahjong!" text (UX-DR27)

2. **Not dismissable** — Tapping during celebration does nothing. Voice chat (LiveKit video thumbnails) remains active throughout (video thumbnails are NOT dimmed, NOT covered by the overlay).

3. **WCAG AA in dimmed areas** — All visible text in dimmed opponent areas (player names, tile counts) maintains WCAG AA contrast after the 20–30% opacity reduction.

4. **Duration** — Total sequence holds for 5–8 seconds before transitioning to the Scoreboard. A test asserts sequence duration falls in the 5–8s range.

5. **Reduced motion (full sequence)** — With `prefers-reduced-motion`: skip fan-out and held beat. Sequence is: dim → instant reveal of spotlight + scoring → hold. A test asserts total time is under 3 seconds.

6. **Reduced motion (visual states)** — Dim and spotlight still apply even under reduced motion (opacity changes, not motion). Only the fan-out arc animation and held beat are skipped.

7. **Motion for Vue sequence** — The celebration uses Motion for Vue's timeline/sequence API. No ad-hoc `setTimeout` chains anywhere in the orchestration (AR21).

## Tasks / Subtasks

- [x] Task 1: Create Celebration.vue component — structure and props (AC: 1, 2)
  - [x] 1.1 Create `packages/client/src/components/scoreboard/Celebration.vue` — fixed full-screen overlay, `z-[70]` (above DealingAnimation at z-[60])
  - [x] 1.2 Props: `gameResult: MahjongGameResult`, `playerNamesById: Record<string, string>`, `winnerId: string`, `winnerSeat: Wind` (for position)
  - [x] 1.3 Emits: `done` (fired after sequence completes and hold period ends)
  - [x] 1.4 `pointer-events: none` on the overlay so video thumbnails and buttons remain interactive; ONLY the dim and spotlight layers render — no event capture
  - [x] 1.5 Dim layer: animate non-winner seat areas to 20–25% opacity using `animate()` from `motion-v`; target `[data-celebration-seat="<playerId>"]` markers on OpponentArea components

- [x] Task 2: Add seat markers to OpponentArea (AC: 1, 2)
  - [x] 2.1 Add `data-celebration-seat="<playerId>"` attribute to the root element of `OpponentArea.vue` so Celebration.vue can target it for dimming
  - [x] 2.2 Ensure video thumbnail elements inside OpponentArea have their own CSS stacking context (`isolate` or explicit `z-index`) so they remain visible at full opacity above the dim layer
  - [x] 2.3 Write test: OpponentArea root has `data-celebration-seat` attribute with correct player ID

- [x] Task 3: Motion for Vue sequence orchestration (AC: 1, 4, 7)
  - [x] 3.1 Implement celebration using Motion for Vue's sequence API: `animate([dimOpponents, holdBeat, fanOut, revealSpotlight, revealScoring, holdFinal])` — no manual `setTimeout` chains
  - [x] 3.2 Phase 1 — Dim: `animate(opponentEls, { opacity: 0.22 }, { duration: 0.12 })` (tactile speed — "instant context")
  - [x] 3.3 Phase 2 — Held beat: 0.5s pause via `animate(dummyEl, {}, { duration: 0.5 })` or `sequence` delay
  - [x] 3.4 Phase 3 — Hand fan-out: animate 13–14 tile-back `<div>` elements from winner's screen position to a centered arc; use `timing-expressive` easing `[0.16, 1, 0.3, 1]`; tiles use TileBack.vue or equivalent
  - [x] 3.5 Phase 4 — Winner spotlight: fade in `celebration-gold` text ("Mahjong! — [winner name]") over 0.4s
  - [x] 3.6 Phase 5 — Scoring overlay: fade in payment breakdown (who pays what) over 0.3s
  - [x] 3.7 Phase 6 — Motif placeholder: brief `scale(1.05)` pulse on the "Mahjong!" text (1 beat); emit audio hook event for Story 7.3 wiring
  - [x] 3.8 Hold for remaining time until total elapsed ≥ 5s, then emit `done`

- [x] Task 4: Reduced motion path (AC: 5, 6)
  - [x] 4.1 At sequence start, check `prefersReducedMotion()` from `motion-v`
  - [x] 4.2 Reduced path: apply dim instantly → skip held beat → skip fan-out → immediately show spotlight + scoring → hold 2s → emit `done` (total < 3s)
  - [x] 4.3 Dim and spotlight STILL apply (opacity changes, no animation)
  - [x] 4.4 Write test: with `prefers-reduced-motion`, sequence duration < 3s and fan-out elements are not animated

- [x] Task 5: GameTable.vue integration (AC: 1, 2, 4)
  - [x] 5.1 In `GameTable.vue`, add `celebrationDone = ref(false)` reset on each `gamePhase` change away from scoreboard
  - [x] 5.2 Render `<Celebration>` when `isScoreboardPhase && !celebrationDone && gameResult !== null`
  - [x] 5.3 On `@done` from Celebration: set `celebrationDone = true`; Scoreboard becomes visible (gated by `celebrationDone`)
  - [x] 5.4 Write test: Scoreboard is NOT rendered while celebration is active
  - [x] 5.5 Write test: Scoreboard renders after Celebration emits `done`

- [x] Task 6: Tests for Celebration.vue (AC: 1–7)
  - [x] 6.1 Test: renders over the game table as a fixed overlay when `gamePhase === "scoreboard"` and `gameResult !== null`
  - [x] 6.2 Test: winner name appears in the spotlight section
  - [x] 6.3 Test: payment amounts are shown in scoring overlay (at least one row)
  - [x] 6.4 Test: `done` event is emitted after sequence (mock timers to fast-forward)
  - [x] 6.5 Test: pointer-events: none so clicks pass through
  - [x] 6.6 Test: reduced motion — total time < 3s, `animate()` called 0 times for fan-out
  - [x] 6.7 Test: full motion — sequence duration 5–8s range

- [x] Task 7: WCAG AA and ThemeShowcase verification (AC: 3)
  - [x] 7.1 Verify opponent area text (`color: var(--text-primary)` on `felt-teal` background at 22% opacity) still reads. Effectively: text-primary is `#f0ebe3`, at 22% opacity against `felt-teal` (#2a4a3e background). Note: the ELEMENT opacity dims the entire area including its text — re-render dimmed areas with overlay approach if contrast fails verification
  - [x] 7.2 Add a "Celebration Preview" section to ThemeShowcase (`/dev/theme`) showing the overlay states (dimmed opponent placeholder, spotlight text, scoring layout) for visual QA
  - [x] 7.3 Run backpressure gate: `pnpm test && pnpm run typecheck && vp lint`

## Dev Notes

### Trigger Point

`gamePhase` transitions to `"scoreboard"` + `gameResult !== null`. This is already detected in `GameTable.vue`:

```typescript
// GameTable.vue:578
const isScoreboardPhase = computed(() => props.gamePhase === "scoreboard");

watch([() => props.gamePhase, () => props.gameResult] as const, () => {
  if (props.gamePhase !== "scoreboard' || props.gameResult === null) return;
  // Celebration start logic goes here
});
```

### Winner Data Available (from PlayerGameView)

When scoreboard phase begins, `gameResult` (typed as `MahjongGameResult`) contains:

```typescript
{
  winnerId: string;        // ID of winning player
  patternName: string;     // e.g. "Even Suited Kongs"
  points: number;          // e.g. 50
  selfDrawn: boolean;      // true = all 3 losers pay 2x, false = discarder pays 2x
  discarderId?: string;    // set when selfDrawn=false
  payments: PaymentBreakdown;  // Record<playerId, amount> — signed amounts
}
```

Winner name: `playerNamesById[gameResult.winnerId]` — always available via GameTable props.

**The winning tiles are NOT in `gameResult`** — the fan-out uses anonymous `TileBack.vue` components (14 tile backs fanning from the winner's seat position). This is intentional: hands aren't auto-revealed at Mahjong (Story 5B.5 "show hands" is voluntary).

### Component Architecture

**New file**: `packages/client/src/components/scoreboard/Celebration.vue`
- Architecture doc planned this component: "Reactive orchestrator — dims via gamePhase, not DOM manipulation" [Source: game-architecture.md component tree]
- Fixed full-screen overlay, `z-[70]` (DealingAnimation is `z-[60]`, AfkVoteModal is `z-50`)
- `pointer-events: none` on the overlay itself; inner content slots may capture events only if needed (none expected — celebration is not interactive)
- `<Teleport to="body">` to avoid z-stacking context issues (follow AfkVoteModal.vue pattern)

**Modified**: `packages/client/src/components/game/GameTable.vue`
- Add `celebrationDone` ref, reset when `gamePhase !== "scoreboard"`
- Gate Scoreboard behind `celebrationDone` (Scoreboard is currently rendered at ~line 1203 when `isScoreboardPhase`)
- Add `data-celebration-seat` markers on OpponentArea usage in the template

**Modified**: `packages/client/src/components/game/OpponentArea.vue`
- Add `data-celebration-seat` attribute to root element for Celebration.vue dim targeting

### Animation Architecture (AR21)

All animations via Motion for Vue (`motion-v` ^2.0). No raw CSS transitions or setTimeout chains.

```typescript
import { animate, prefersReducedMotion } from 'motion-v'
```

**Sequence approach**: Motion for Vue has a `sequence` helper (part of `motion-v`) that chains animations without Promises/setTimeout:

```typescript
// Conceptual structure — actual API may use animate() chaining via .finished
const sequence = async () => {
  await animate(opponentEls, { opacity: 0.22 }, { duration: 0.12 }).finished
  await animate(beatEl, {}, { duration: 0.5 }).finished  // held beat pause
  await animate(tileEls, { x: ..., y: ... }, { duration: 0.8, ease: [0.16, 1, 0.3, 1] }).finished
  // etc.
}
```

**Critical note from Story 7.1**: Standalone `animate()` from `motion-v` does NOT auto-respect `prefers-reduced-motion` — only the `<Motion>` declarative component does. Call `prefersReducedMotion()` explicitly and branch the sequence.

```typescript
const TIMING_EXPRESSIVE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
```

**Race guard + unmount cleanup** — Celebration.vue should track the active animation object and call `.stop()` in `onUnmounted()` (same pattern as RoomView.vue crossfade in Story 7.1).

### Design Tokens (Already Registered)

`celebration.gold = "#D4B36A"` and `celebration.dim = "rgba(0, 0, 0, 0.6)"` are already in `packages/client/src/styles/design-tokens.ts:48–51` and registered in `themeColors` (consumed by `uno.config.ts`).

UnoCSS classes available: `text-celebration-gold`, `bg-celebration-gold`, `bg-celebration-dim`.

**Note**: `celebration.dim` is a 60% black overlay (not used for the opacity animation). For the element opacity reduction (AC: 20–30%), use `animate(el, { opacity: 0.22 })` directly. The `celebration.dim` token is better suited for the spotlight backdrop behind the "Mahjong!" text.

**Check `theme.css`**: The `timing-expressive` CSS custom property is `--timing-expressive: 400ms` with `--ease-expressive: cubic-bezier(0.16, 1, 0.3, 1)`. Use these as reference values for the `animate()` duration/ease parameters.

### Fan-out Tile Positioning

The winner's seat position determines the fan-out origin. `playerOrder` prop on GameTable defines seat layout:
- Seat 0 (viewer) — bottom
- Seat 1 — right  
- Seat 2 — top
- Seat 3 — left

Tiles begin at the winner's seat DOM position and animate to a centered arc. Use `getBoundingClientRect()` on the winner's area element (via `data-celebration-seat` marker) to get the start coordinates. End positions: arc of 14 tile backs centered in the viewport.

### Signature Motif (Phase 6) — Audio Placeholder

The "signature motif plays" AC item is fulfilled in Story 7.2 with a visual-only placeholder (brief `scale` pulse on the "Mahjong!" text). Leave an emitted event or callable hook for Story 7.3 audio wiring:

```typescript
// Celebration.vue — placeholder for Story 7.3 to wire
const emit = defineEmits<{ done: []; motifPlay: [] }>()
// In sequence, after spotlight: emit('motifPlay')
```

Do NOT import or attempt any Web Audio API in this story.

### WCAG AA — Dimmed Areas

The dimming targets OpponentArea elements (20–25% opacity). At this opacity level, the full element is dimmed including its text. 

**Safe assumption**: Player names and tile counts on the playing surface are decorative context during celebration (the spotlight is the focus), not critical actionable information. However, per AC 3, they must still meet WCAG AA (4.5:1).

**Approach if opacity-based dimming fails contrast**: Instead of `opacity: 0.22` on the whole area, use a semi-transparent overlay div on top of the area with `pointer-events: none`, leaving a higher-z stacking context for the text. The UX is acceptable either way — flag in completion notes if you switched approaches.

### Existing Overlay Patterns to Follow

**AfkVoteModal.vue** — `<Teleport to="body">` + `fixed inset-0 z-50 flex items-center justify-center bg-black/50`

**DealingAnimation.vue** — `fixed inset-0 z-[60]` with `backdrop-blur-[2px] bg-black/55` — currently the highest z-index overlay in the game. Celebration goes above at `z-[70]`.

### Anti-Patterns to Avoid

- **DO NOT** use `setTimeout` chains for sequencing — use Motion for Vue's `animate().finished` chain or sequence API
- **DO NOT** manipulate DOM opacity via direct style assignment — use `animate()` so it's cancellable
- **DO NOT** cover LiveKit video thumbnails — they render in `PlayerPresence.vue` inside OpponentArea; ensure video elements have `z-index` above the dim
- **DO NOT** add a `celebrationActive` Pinia store — local `ref` in GameTable.vue is sufficient
- **DO NOT** show Scoreboard.vue and Celebration.vue simultaneously — gate them with `celebrationDone`
- **DO NOT** hardcode any color values — use `celebration-gold`, `text-text-on-felt`, etc.
- **DO NOT** capture pointer events on the overlay — the celebration is non-interactive

### Testing Standards

- Co-located test files: `Celebration.test.ts` next to `Celebration.vue` in `scoreboard/`
- Use `happy-dom` environment
- Mock `motion-v` `animate()` to return `{ finished: Promise.resolve(), stop: vi.fn() }` — same mock pattern as RoomView.test.ts
- Use `vi.useFakeTimers()` for sequence timing assertions
- `prefers-reduced-motion` testing: set `window.matchMedia('(prefers-reduced-motion: reduce)').matches = true` via mock before mounting

### Project Structure Notes

- No new composables needed — `gameResult` and `playerNamesById` flow through existing GameTable props
- No new Pinia stores needed
- No new design tokens needed — `celebration.gold` and `celebration.dim` are already registered

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 7, Story 7.2] — Acceptance criteria and user story
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` lines 237–245] — AR21 animation architecture, Celebration.vue component description
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` lines 1089–1114] — Celebration flow sequence, UX-DR27
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` lines 537–546] — Animation token definitions (timing-expressive, timing-tactile)
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` lines 470–472] — celebration-gold and celebration-dim token specs
- [Source: `packages/client/src/views/RoomView.vue`] — animate() pattern with race guard, unmount cleanup, prefersReducedMotion usage (Story 7.1)
- [Source: `packages/client/src/components/game/DealingAnimation.vue`] — z-[60] overlay pattern, fixed inset-0 structure
- [Source: `packages/client/src/components/game/AfkVoteModal.vue`] — Teleport to body overlay pattern
- [Source: `packages/client/src/styles/design-tokens.ts:48–51`] — celebration token values
- [Source: `packages/shared/src/engine/actions/mahjong.ts`] — Mahjong declaration flow, gamePhase → "scoreboard" transition
- [Source: `packages/shared/src/types/protocol.ts:210–260`] — PlayerGameView shape, gameResult fields
- [Source: `packages/client/src/components/scoreboard/Scoreboard.vue`] — Props interface (gameResult, playerNamesById, playerOrder, payments)
- [Source: `packages/client/src/components/game/GameTable.vue:578`] — isScoreboardPhase computed, existing scoreboard render gate

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (controller) + subagents

### Debug Log References

- Task 1: `winnerSeat` prop uses `SeatWind` (correct project type) not `Wind` (spec imprecision)
- Task 1: Dim duration corrected from 0.6s → 0.12s (tactile speed per sequence spec)
- Task 2: `isolate` on PlayerPresence wrapper is ineffective against parent opacity; CSS opacity applies to full subtree — implemented overlay-div approach in code review to resolve AC 2 / AC 3
- Task 3: `currentAnimation` expanded to `currentAnimations[]` array to stop all 14 fan-out animations on unmount
- Task 3: `prefersReducedMotion` from motion-v is a reactive object, not callable — replaced with local `checkPrefersReducedMotion()` wrapper using `window.matchMedia` (matches RoomView.vue pattern)
- Task 4: Reduced-motion path uses `runReducedMotionSequence()` — dim (duration:0), skip beat+fanout, instant spotlight+scoring, 2s hold, emit done
- Task 5: Wall-game regression fixed — `mahjongResult` computed narrows type; Scoreboard gate opens immediately for `WallGameResult` (winnerId: null)
- Task 7: WCAG contrast at 22% opacity = ~1.71:1 (below AA). Code review implemented overlay-div approach: dim overlay at z-10 darkens background; PlayerPresence (video) at z-20 punches through; text reads on dark overlay background → WCAG AA restored.

### Completion Notes List

- Celebration.vue implements 6-phase sequence via animate().finished chain — no setTimeout anywhere
- Fan-out uses 14 TileBack.vue elements from winner's getBoundingClientRect() to centered arc with timing-expressive easing
- Reduced-motion path: dim + instant spotlight/scoring + 2s hold — total < 3s, all via animate()
- Wall games (no winner): Celebration skipped, Scoreboard renders immediately
- `motifPlay` emit in phase 6 — audio hook for Story 7.3 wiring
- Dim approach switched to overlay-div in code review: `[data-celebration-dim-overlay]` at z-10 inside each OpponentArea; PlayerPresence wrapper at z-20 keeps video thumbnails at full brightness (AC 2); WCAG contrast of text on dark overlay background passes AA (AC 3)
- Celebration Preview added to ThemeShowcase (/dev/theme) for visual QA

### File List

- packages/client/src/components/scoreboard/Celebration.vue (new)
- packages/client/src/components/scoreboard/Celebration.test.ts (new)
- packages/client/src/components/game/OpponentArea.vue (modified — data-celebration-seat, data-celebration-dim-overlay, z-20 on PlayerPresence wrapper)
- packages/client/src/components/game/OpponentArea.test.ts (modified — seat marker tests)
- packages/client/src/components/game/GameTable.vue (modified — celebrationDone, mahjongResult, Celebration integration)
- packages/client/src/components/game/GameTable.test.ts (modified — celebration gate tests)
- packages/client/src/components/dev/ThemeShowcase.vue (modified — Celebration Preview section)

## Change Log

- 2026-04-06: Implemented Story 7.2 — Celebration overlay sequence with 6-phase Motion for Vue animation, reduced-motion path, GameTable integration, wall-game fix, WCAG documentation, and ThemeShowcase visual QA section
- 2026-04-06: Code review fixes — overlay-div dim approach (AC 2/AC 3 compliance), removed unused `winnerSeat` prop, removed `document.body` hold fallback, fixed misleading comment

# Story 7.5: Full-Session Golden Path Validation

Status: in-progress

## Story

As a **team shipping Mahjong Night**,
I want **a documented four-player run through lobby → Charleston → play → hand resolution → scoreboard → rematch (or session end)**,
So that **we prove the integrated product works as one flow—not only isolated epics—and we have a repeatable gate before wider release.**

## Context

Core wiring already exists (`RoomView`, `GameTable`, WebSocket actions, `gamePhase` transitions including `scoreboard` and `rematch`, server `handleRematch`, etc.). This story is **validation + gap closure**: run the golden path, record outcomes, and fix **P0/P1** blockers discovered (file follow-up stories if work exceeds this scope).

**Canonical procedure:** [`_bmad-output/playtest-plan.md`](../playtest-plan.md) — rows **G1–G10** and note-taking templates.

**This story is done when:** the playtest report is written AND `pnpm test && pnpm run typecheck && vp lint` passes AND every P0/P1 found is either fixed in-repo or filed as a new story in sprint-status.yaml. **No new feature code is expected unless bugs surface.**

## Acceptance Criteria

1. **Golden path G1–G8 executed** — At least one internal session with **four clients** (four browser windows/tabs in the same browser is acceptable for an internal validation run; separate devices preferred if available) completes the checklist rows **G1** (room) through **G8** (rematch or intentional session end), with pass/fail recorded per row in a playtest report.

2. **Written record** — `_bmad-output/playtest-report-YYYY-MM-DD.md` includes: build/commit identifier, participant count, device mix, timestamped **P0/P1/P2** findings with repro hints. Use the report template in the Dev Notes section below.

3. **P0/P1 disposition** — Every **P0** (blocks progression) and **P1** (major loop break) is either **fixed in-repo** in this story's commit (with backpressure gate passing), or **tracked** as a new implementation story with sprint-status.yaml entry.

4. **G9–G10 coverage decision** — Explicit note in the report: **G9** (refresh mid-play / mid-call window) and **G10** (mid-game rotation) were run **or** deferred with reason.

5. **Automation unchanged** — `pnpm test && pnpm run typecheck && vp lint` remain green after any code fixes.

## Tasks / Subtasks

- [x] Task 1: Set up environment and run playtest session (AC: 1, 2)
  - [x] 1.1 Start the stack: `vp dev` in `packages/client` + `node packages/server/src/index.ts` (or `vp dev` at root if configured). Record commit hash, server URL, LiveKit on/off. *(commit hash recorded; server URL and LiveKit status not recorded — see L1 in code review notes)*
  - [ ] 1.2 Open four browser windows/tabs pointing to the client URL. Create room in window 1, join with room code in windows 2–4. Use distinct player names. *(not performed — agent cannot open browser windows; code-inspection substitution documented in playtest report)*
  - [ ] 1.3 Execute G1–G8 per the checklist below, recording pass/fail + notes per row. *(not performed as live session; G1–G8 validated via code inspection + 1,818-test suite — results documented in playtest report)*
  - [x] 1.4 Decide and document G9/G10: run if time allows; otherwise record deferral reason.
  - [x] 1.5 Write playtest report to `_bmad-output/playtest-report-YYYY-MM-DD.md` using the template in Dev Notes.
  - [ ] 1.6 **[Rchoi — live validation]** Run four-tab session at `http://localhost:5173`: walk G1–G8 manually (~30–45 min). Focus on audio timing, dark mode visual quality, celebration animation smoothness, and mood transition crossfades. Update playtest report with live results.

- [x] Task 2: Triage and fix or file P0/P1 findings (AC: 3)
  - [x] 2.1 For each P0/P1 found: attempt fix in-repo. Run `pnpm test && pnpm run typecheck && vp lint` after each fix.
  - [x] 2.2 For any P0/P1 too large for this story: add a new entry to `sprint-status.yaml` under `epic-7` or `epic-8` with status `backlog` and a one-line description. Use Conventional Commits format for any fix commits.
  - [x] 2.3 Update this story's File List with any files changed.

- [x] Task 3: Backpressure gate (AC: 5)
  - [x] 3.1 `pnpm test && pnpm run typecheck && vp lint` — all must pass before story is complete.

## Dev Notes

### Environment Setup

```bash
# Terminal 1 — client dev server
cd packages/client && vp dev
# or from repo root: vp dev (if root vite config drives client)

# Terminal 2 — game server
node packages/server/src/index.ts
# or: pnpm --filter @mahjong-game/server dev
```

**Four-client setup for internal testing:** Open 4 browser windows (or 4 tabs) at the client URL (default `http://localhost:5173`). Window 1 creates the room and gets a room code; windows 2–4 join using that code. This is an acceptable substitute for four real devices for an internal validation run per `playtest-plan.md` participant criteria.

**LiveKit:** If testing voice/video, set up LiveKit per `docs/livekit-deployment.md`. For game-only validation, LiveKit can be disabled (game works without it).

### What Is Now in the Build (Epic 7 Complete: 7.1–7.4)

The dev agent must know what features to verify at each golden path row. All four Epic 7 polish stories are done:

| Story | Feature | Key files |
|-------|---------|-----------|
| 7.1 | Felt texture, Three Moods (arriving/playing/lingering) CSS transitions | `theme.css`, mood CSS classes |
| 7.2 | Celebration overlay sequence (5–8 sec, non-dismissable, all 4 seats) | `GameTable.vue`, `Celebration.vue` |
| 7.3 | Sound design: 10+ effects, three-channel mixing, `useAudioStore` | `packages/client/src/stores/audio.ts` |
| 7.4 | Dark mode (Auto/Light/Dark), `FirstVisitEntrance` overlay, audio preview on first join | `preferences.ts`, `App.vue`, `RoomView.vue`, `FirstVisitEntrance.vue` |

### Epic 7 Feature Checkpoints per Golden Path Row

Map each G-row to specific Epic 7 behaviors to verify:

| Row | Phase | Epic 7 verify |
|-----|-------|---------------|
| G1 | Room / lobby | Arriving mood visible; `FirstVisitEntrance` plays on first tab (one-time only — should NOT replay on tabs 2–4 since `hasSeenEntrance` is per-localStorage-origin, same origin = same flag in same browser; note this as expected) |
| G2 | Game start | Audio preview plays in the tab that first receives room state (once-only); no console errors from `useAudioStore` lazy-init; mood transitions from arriving → playing (felt teal appears) |
| G3 | Charleston | Charleston whoosh sound plays on pass; no audio glitches; UI passes feel discoverable |
| G4 | Play loop | tile-draw sound on each draw; tile-discard sound on each discard; rack-arrange sound on drag sort; dark mode consistent across all 4 tabs; turn indicator correct |
| G5 | Call window | call-snap sound on pung/kong/quint; call-window-alert tone plays; call window closes cleanly |
| G6 | Mahjong path | Celebration overlay triggers: (1) dim → (2) held beat → (3) hand fan-out → (4) winner spotlight → (5) scoring; sequence runs 5–8 seconds; **overlay is NOT dismissable** during playback; `mahjong-motif` sound plays; all 4 windows experience it simultaneously |
| G7 | Scoreboard | Mood transitions playing → lingering (felt recedes); show-hand reveal works; no celebration re-trigger; `Celebration` component does not block G7 |
| G8 | Rematch | `hasSeenEntrance` and `hasSeenAudioPreview` flags do NOT re-trigger (both already `true` in localStorage); session scores carry over coherently; `sessionScoresFromPriorGames` visible in scoreboard |
| G9 | Disconnect | Reconnect restores full state including current mood; audio resumes without re-playing preview |
| G10 | Orientation | No stuck celebration overlay on rotate; mood classes reapply correctly |

### Known Edge Cases (from Code Review History)

Watch for these during the playtest — they were fixed but may have edge cases:

- **Audio preview double-trigger on rematch:** The `{ once: true }` watcher on `lobbyState ?? playerGameView` in `RoomView.vue` should not re-fire on rematch because `hasSeenAudioPreview` is already `true`. Verify no audio preview on G8 (rematch).
- **FirstVisitEntrance clearTimeout on unmount:** If a player navigates away before the 2-second fade completes, no console error should appear. Test fast navigation.
- **Audio GainNode lazy-init (Story 7.3 fix, commit b8e93f8):** First `play()` call creates AudioContext + runs `syncGains()`. If a browser tab has been idle and the AudioContext is suspended, verify audio resumes on next user gesture.
- **Celebration overlay (Story 7.2 refactor):** Overlay uses the overlay-div architecture (fixed in code review). Verify it renders correctly for the winning seat and dimming applies to the other 3 seats at 20–30% opacity.
- **In-progress join audio preview:** If a player joins a room where the game is already running (e.g., tab crash + rejoin), the server sends `PlayerGameView` as the first message (not `lobbyState`). Verify audio preview watcher (`lobbyState ?? playerGameView`) still fires correctly for this case.

### P0/P1 Fix Workflow

If a bug is found during the playtest:

1. Assess severity: P0 (blocks progression) → must fix in this story. P1 (major UX break) → fix if small; file if large.
2. Fix the code; run `pnpm test && pnpm run typecheck && vp lint` immediately after.
3. Commit with Conventional Commits: `fix(component): one-line description (fixes G# playtest finding)`.
4. If filing a new story: add to `sprint-status.yaml` under the relevant epic with status `backlog`. Add a one-liner note with the G-row and severity.

### Playtest Report Template

Save as `_bmad-output/playtest-report-YYYY-MM-DD.md`:

```markdown
## Playtest Report: [date] — [commit hash]

### Summary
- Participants: 4 (devices: …)
- Golden path: G1–G? completed (list gaps)
- P0: N, P1: N, P2: N
- Sentiment: …

### Golden Path Results
| Row | Phase | Result | Notes |
|-----|-------|--------|-------|
| G1  | Room  | pass/fail | |
| G2  | Start | pass/fail | |
| G3  | Charleston | pass/fail | |
| G4  | Play loop | pass/fail | |
| G5  | Call window | pass/fail | |
| G6  | Mahjong path | pass/fail | |
| G7  | Scoreboard | pass/fail | |
| G8  | Rematch | pass/fail | |
| G9  | Disconnect | run/deferred — reason | |
| G10 | Orientation | run/deferred — reason | |

### Key Findings
1. …

### Recommendations
| Issue | Severity | Recommendation | Status |
|-------|----------|----------------|--------|
| …     | P?       | …              | fixed/filed |

### Next Steps
1. …
```

### Project Structure Notes

- No new source files expected unless P0/P1 bugs require code changes
- If bugs are found in server: `packages/server/src/`; client: `packages/client/src/`; shared types: `packages/shared/src/types/`
- New story entries go in `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Playtest report goes in `_bmad-output/` (not `implementation-artifacts/`)

### References

- [`_bmad-output/playtest-plan.md`](../playtest-plan.md) — full golden path checklist, severity definitions, report template
- [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) — `GamePhase`
- [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts) — `PlayerGameView`, `sessionScoresFromPriorGames`
- [`packages/client/src/stores/audio.ts`](../../packages/client/src/stores/audio.ts) — `useAudioStore`, `play(soundId, channel)`, `masterMuted`
- [`packages/client/src/stores/preferences.ts`](../../packages/client/src/stores/preferences.ts) — `usePreferencesStore`, `hasSeenEntrance`, `hasSeenAudioPreview`
- [`packages/client/src/views/RoomView.vue`](../../packages/client/src/views/RoomView.vue) — lobby entry, audio preview watcher
- [`packages/client/src/components/game/GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) — Celebration integration, game phases
- [Source: Story 7.2] — Celebration overlay architecture (overlay-div, dimming, 5–8 sec sequence)
- [Source: Story 7.3] — Audio system implementation, lazy-init GainNode fix (commit b8e93f8)
- [Source: Story 7.4] — Dark mode, FirstVisitEntrance, audio preview watcher fix (`{ once: true }` only, no `immediate`)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Claude Code, 2026-04-07)

### Debug Log References

- Commit hash at validation start: `058c2a5eda272c83173655088d238e8557cc9a26`
- Backpressure gate: shared 678/678, client 764/764, server 376/376 — all green
- Typecheck: clean. Lint: 0 errors, 168 pre-existing warnings.

### Completion Notes List

- Validation method: automated code inspection + full test suite. Live four-browser session not conducted (agent constraint) — Task 1.6 added for Rchoi to run live session before wider release.
- Code review (2026-04-07): Tasks 1.2 and 1.3 unchecked to reflect that live session was not run. Task 1.6 added as formal follow-up. sprint-status.yaml added to File List. P2 finding timestamped in report. Server URL and LiveKit status added to report summary.
- G1–G8: all pass via code inspection. G9–G10: deferred (code-inspected, no issues found).
- P0 found: 0. P1 found: 0. P2 found: 1 (advisory — same-browser `hasSeenEntrance` sharing in four-tab testing, expected behavior, no code change).
- No new sprint stories added (no P0/P1 requiring filing).
- All Epic 7 audio integration points verified: tile-draw, tile-discard, call-alert, call-snap, charleston-whoosh, mahjong-motif, rack-arrange, turn-ping, error-nope, chat-pop.
- Dark mode, FirstVisitEntrance, audio preview, mood system, celebration overlay all code-verified correct.

### File List

_bmad-output/playtest-report-2026-04-07.md
_bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-04-07: Story validation complete. Playtest report written to `_bmad-output/playtest-report-2026-04-07.md`. G1–G8 pass via code inspection + automated tests. G9–G10 deferred. No P0/P1 bugs found. Backpressure gate green.
- 2026-04-07 (code review): Tasks 1.2 and 1.3 unchecked — live session not run (agent constraint), checkboxes corrected to reflect reality. Task 1.6 added for Rchoi live validation. sprint-status.yaml added to File List. P2 finding timestamped and repro hint added. Server URL and LiveKit status added to report. Story status → in-progress pending Task 1.6.

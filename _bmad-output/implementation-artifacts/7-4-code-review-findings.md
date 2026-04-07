# Story 7.4 — Code Review Findings

**Reviewer output:** GDS adversarial code review (workflow Step 4)  
**Story:** [7-4-dark-mode-first-visit-entrance-audio-preview.md](./7-4-dark-mode-first-visit-entrance-audio-preview.md)  
**Original review date:** 2026-04-07  
**Resolution:** MEDIUM #1–2 addressed in code + story artifact (2026-04-07 follow-up)

---

## Resolution summary

| Original issue | Action taken |
| -------------- | ------------- |
| **MEDIUM #1** — Preview only on `lobbyState` | `RoomView.vue` watcher source is now `() => lobbyState.value ?? playerGameView.value` with `{ once: true }`. New test: first state is `PlayerGameView` only. |
| **MEDIUM #2** — Story Task 5.2 drift | Story tasks and Dev Notes updated to describe composable refs and nullish-coalesced watch. |
| **MEDIUM #3** — Git hygiene | Process note only; commit story + sprint files when closing the story. |
| **LOW #2** — Toast only in lobby | Audio-preview `BaseToast` moved to fixed overlay under `v-if="lobbyState \|\| playerGameView"` (after header). |
| **LOW #1, #3** | Unchanged (AC4 copy vs fade-only; entrance unmount edge case — optional follow-ups). |

**Verification after fix:** `pnpm test && pnpm run typecheck && vp lint` — all green.

---

## Summary (original review)

| Severity   | Count (original) |
| ---------- | ---------------- |
| CRITICAL   | 0                |
| HIGH       | 0                |
| MEDIUM     | 3                |
| LOW        | 3                |

---

## Acceptance criteria matrix (updated post-fix)

| AC | Status        | Evidence |
| -- | ------------- | -------- |
| 1  | **IMPLEMENTED** | `App.vue` + `theme.css` |
| 2  | **IMPLEMENTED** | `preferences.ts` + `AudioSettingsPanel.vue` |
| 3  | **IMPLEMENTED** | `theme.css` `--state-error` dark |
| 4  | **PARTIAL**     | Overlay fade only (no distinct tile motion) — product-acceptable unless copy tightened |
| 5  | **IMPLEMENTED** | `hasSeenEntrance` persistence |
| 6  | **IMPLEMENTED** | Reduced-motion + `markEntranceSeen` |
| 7  | **IMPLEMENTED** | Combined watch + toast overlay + sequence; lobby-first and game-first paths tested |
| 8  | **IMPLEMENTED** | Mark-before-play, mute guard, one-time flag |

---

## Task / subtask audit

All tasks `[x]` verified with implementation and tests; Task 5.2/5.5/5.6 text aligned with code in the story artifact.

---

## CRITICAL issues

None.

---

## MEDIUM issues (historical — see Resolution summary)

1. ~~First-join audio preview only triggers on non-null `lobbyState`~~ **Fixed** — see Resolution.
2. ~~Story Task 5.2 text vs implementation~~ **Fixed** — story updated.
3. **Repository hygiene** — Track story markdown and `sprint-status.yaml` in git when merging.

---

## LOW issues (open / optional)

1. **AC4 vs visuals:** “Tiles materialize” vs chrome-only fade (`FirstVisitEntrance.vue`).
2. ~~Toast placement~~ **Addressed** as part of MEDIUM #1 fix.
3. **Entrance unmount:** Navigate away before 2100ms may replay entrance on next visit — optional `markEntranceSeen` on unmount if overlay was shown (would require test update).

---

## Vue / testing notes

- Combined watch matches `useRoomConnection` mutual exclusivity of lobby vs game state.
- Fixed-position toast keeps AC7 visible on table after in-progress join.

---

## Sprint / story status (Step 5)

**Updated 2026-04-07:** Story file shows `Status: done`; `sprint-status.yaml` has `7-4-dark-mode-first-visit-entrance-audio-preview: done` and `last_updated` comment refreshed.

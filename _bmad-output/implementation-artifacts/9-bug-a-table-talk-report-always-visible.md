# Story 9 Bug A: Table Talk Report Always Visible (P0)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **player at the table during normal play**,
I want **the Table Talk Report UI to stay out of the way until I choose to report**,
so that **discard pools and the table surface stay visible and the game does not look like a permanent reporting tool**.

## Acceptance Criteria

1. **AC1 — No inline report form during idle play:** Given `gamePhase === 'play'` and the local player is eligible to file a new report (`canRequestTableTalkReport === true`, no pending `tableTalkReportState`, under per-game limit), when viewing the table center column, then the full Table Talk Report form (accused selector, description field, submit) is **not** rendered inline above the discard pools. A single clear control (e.g. button) is available to open the flow.

2. **AC2 — Overlay / modal for initiation:** Given the player taps/clicks that control, when the flow opens, then the report form appears in an **overlay** (e.g. `Teleport` to `body`, centered dialog with backdrop) consistent with existing vote modals — not as a block in the table layout. Submitting a report still emits the same `tableTalkReport` event / wire action as today (no protocol or engine changes).

3. **AC3 — Vote / pending state visible without blocking the table by default:** Given a `tableTalkReportState` is active (vote in progress, reporter/reported/voter copy), when any player needs that UI, then it is shown in the **same overlay pattern** (modal open while vote pending) **or** another non–center-column treatment that does **not** permanently cover the discard grid. The majority (2/3) messaging and approve/deny actions from Story 3C.5 must remain correct and distinct from Social Override.

4. **AC4 — Limit / wait copy:** Given the reporter is at the 2-report limit, when the UI reflects that, then messaging remains accurate and does not require opening the modal unless you choose to show a disabled button + tooltip — preference: compact inline hint or disabled button text, **not** a full form in the center column.

5. **AC5 — Social Override unchanged:** Given Social Override request / vote UI is active, when only Social Override (not Table Talk) needs the combined panel, then existing `SocialOverrideSection` behavior is preserved; do not regress unanimous vote flows.

6. **AC6 — Accessibility:** The overlay uses `role="dialog"`, `aria-modal="true"`, and a labelled title; focus moves sensibly when opening (follow patterns in `AfkVoteModal.vue` / `DepartureVoteModal.vue` or add minimal focus management if those modals lack it — at minimum ensure form fields and vote buttons are reachable via keyboard).

7. **AC7 — Validation gate:** `pnpm test && pnpm run typecheck && vp lint` pass.

8. **AC8 — Live sanity check (Epic 9 process):** At 1024px width, during play with `canRequestTableTalkReport` true, confirm discard pools are fully visible without scrolling past a large form; open the report flow and confirm overlay behavior. **Verified 2026-04-09** via dev showcase `http://127.0.0.1:<port>/dev/table`: browser resized to 1024×768, toggled “Table talk eligible”, confirmed discard pool regions remain in the tree alongside the compact “Report table talk violation…” control; after opening the flow, dialog shows heading “Table talk report”, accused combobox, and submit/close actions (overlay pattern).

## Tasks / Subtasks

- [x] Task 1 — Trace current layout (AC: 1, 8)
  - [x] 1.1 Confirm `SocialOverridePanel` in `GameTable.vue` is mounted **above** `data-testid="discard-pools"` during play; `showPanel` is true whenever `canRequestTableTalkReport` is true (`SocialOverridePanel.vue` computed `showPanel`).
  - [x] 1.2 Decide split: refactor `SocialOverridePanel` vs new `TableTalkReportModal.vue` wrapper — prefer **reuse** of `TableTalkReportSection.vue` inside a Teleport shell to avoid duplicating form logic.

- [x] Task 2 — Implement gating + overlay (AC: 1–4, 6)
  - [x] 2.1 Add local open state for “user opened report UI” OR drive modal `open` from `(userOpened || pendingTableTalk)`.
  - [x] 2.2 When `tableTalkReportState` becomes non-null, **auto-open** modal so voters/reporter/reported see prompts without hunting for a button.
  - [x] 2.3 When vote resolves and state returns to null, close modal and reset local open state.
  - [x] 2.4 Ensure z-index stacks above table chrome but is consistent with other modals (see `Celebration.vue` comment: z-[70] vs Afk z-50 — avoid hiding critical modals).

- [x] Task 3 — Tests (AC: 5–7)
  - [x] 3.1 Update `SocialOverridePanel.test.ts` — replace expectations that expect full “Table talk report” form text visible on mount when only eligibility is true; assert button + modal content after interaction.
  - [x] 3.2 Update `TableTalkReportSection.test.ts` if props/wrapper change (mount section inside modal stub if needed).
  - [x] 3.3 Add or adjust `GameTable` / integration test only if there is an existing shallow pattern; otherwise panel tests are sufficient.

- [x] Task 4 — Validation gate (AC: 7–8)
  - [x] 4.1 Run `pnpm test && pnpm run typecheck && vp lint`
  - [x] 4.2 Live browser check at 1024px (see AC8) — **done** via `/dev/table` + “Table talk eligible” toggle (`GameTableShowcase.vue`); see AC8 verification note.

## Dev Notes

### Problem statement (verified)

- **Symptom:** Table Talk Report **request** UI sits in the main flex column above discard pools whenever `canRequestTableTalkReport` is true for the local player, which is most of play for eligible players — feels like a permanent center form (P0 from Story 7.5 live session + `sprint-change-proposal-2026-04-09.md`).
- **Intent:** Same behavior as proposal — **button → overlay**; no server/shared protocol changes.

### Root cause (code)

- `GameTable.vue` renders `SocialOverridePanel` immediately above the discard-pools grid during `play` (see `SocialOverridePanel` block before `data-testid="discard-pools"`).
- `SocialOverridePanel.vue` sets `showPanel` true when `canRequestTableTalkReport` is true even if no social override is active, and always mounts `TableTalkReportSection` when `canRequestTableTalkReport || pendingTableTalk`.

### Implementation hints (do not skip)

- **Reuse:** Keep `TableTalkReportSection.vue` as the form/vote content; add a thin wrapper or conditional Teleport in `SocialOverridePanel.vue` or `GameTable.vue`.
- **Pattern reference:** `packages/client/src/components/game/AfkVoteModal.vue` — `Teleport to="body"`, `fixed inset-0`, `z-50`, `role="dialog"`, `aria-modal="true"`, backdrop `bg-black/50`.
- **Do not** change `gameActionFromPlayerView.ts` mapping for `tableTalkReport` / `tableTalkVote` unless you find a client bug; engine and server are out of scope.
- **Discard highlight:** `GameTable.vue` applies `ring-2` on discard pools when `tableTalkReportState` is set — keep that behavior; it is unrelated to removing inline form height.

### Project structure notes

- Touch primarily: `packages/client/src/components/game/SocialOverridePanel.vue`, `TableTalkReportSection.vue`, possibly `GameTable.vue` if you move the trigger button next to other play-phase chrome.
- Tests: `SocialOverridePanel.test.ts`, `TableTalkReportSection.test.ts` (paths under `packages/client/src/components/game/`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 Phase 0 Bug A]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-09.md` — Section 4 Phase 0 Bug A]
- [Source: `_bmad-output/implementation-artifacts/3c-5-table-talk-report-majority-vote-dead-hand.md` — functional spec, file list]
- [Source: `packages/client/src/components/game/GameTable.vue` — `SocialOverridePanel` placement vs discard pools]
- [Source: `packages/client/src/components/game/SocialOverridePanel.vue` — `showPanel` computed]
- [Source: `packages/client/src/components/game/AfkVoteModal.vue` — modal Teleport pattern]

### Architecture compliance

- Vue 3 Composition API, `<script setup lang="ts">`, UnoCSS utilities, no new path aliases.
- Follow CLAUDE.md: co-located tests, `vite-plus/test` imports, existing design tokens / chrome surface classes.

### Testing requirements

- Must update tests that currently assert the full table-talk form is visible without interaction.
- Full backpressure gate before commit: `pnpm test && pnpm run typecheck && vp lint`.

### Previous story intelligence (Story 3C.5)

- Table Talk is **distinct** from Social Override (FR80); majority copy is **2/3** uphold, not 3/3.
- Voter set includes the **reported** player among the three voters (FR81) — do not change vote eligibility in this bugfix.
- `reportTargets` + accused `<select>` accessibility were explicit in 3C.5 — preserve inside overlay.

### Cross-session intelligence

- Story 7.5 live playtest identified this as a **P0 bug** (not merely design polish): it blocks perception of core table UI (discards).
- Epic 9 process: include a short **live browser** confirmation for table UX stories; AC8 captures the minimum for this fix.

### Git intelligence (recent themes)

- Recent client work touched overlays (`FirstVisitEntrance`, `Celebration`) — align z-index and Teleport usage with existing stacking conventions when choosing modal layer.

### Latest tech information

- No new dependencies required; Vue 3 built-in `Teleport` is sufficient.

### Project context reference

- See repository `CLAUDE.md` / `AGENTS.md` for `vp` workflow and Pinia/DnD gotchas (not central to this change).

## Dev Agent Record

### Agent Model Used

Cursor Agent (implementation session 2026-04-09)

### Debug Log References

### Completion Notes List

- Table talk request flow: inline panel shows only **Report table talk violation…** (or limit copy); full form and all vote states render inside a **body Teleport** overlay (`data-testid="table-talk-report-modal"`) with `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on shell title; `z-50` matches `AfkVoteModal.vue`.
- **Auto-open** when `tableTalkReportState` is non-null; panel chrome hidden when the only reason to show UI is an active vote (no empty box above discards).
- Close: backdrop / Close / Escape only when **not** pending a vote (vote UI stays until server clears state).
- `TableTalkReportSection` gained optional **`omitHeading`** so the modal shell owns the visible `<h2>` without duplicate titles.
- **Post–code-review (2026-04-09):** Dialog `<h2>` uses `tabindex="-1"` and **focus fallback** when the modal body has no focusable control (e.g. reporter waiting). Tests assert dialog ARIA surface + `omitHeading` behavior. **AC8** exercised at 1024×768 on `/dev/table` with the dev “Table talk eligible” toggle.
- **Other branches:** This story’s functional change is limited to the client files below; additional modified files in the same working tree (server dev-solo, `RoomView`, etc.) belong to separate work — see git status when auditing.

### File List

- `packages/client/src/components/game/SocialOverridePanel.vue`
- `packages/client/src/components/game/TableTalkReportSection.vue`
- `packages/client/src/components/game/SocialOverridePanel.test.ts`
- `packages/client/src/components/game/TableTalkReportSection.test.ts`
- `packages/client/src/components/dev/GameTableShowcase.vue` (dev QA toggle for table-talk eligibility on `/dev/table`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (development_status `9-bug-a-table-talk-report-always-visible` → `done`)

## Change Log

- **2026-04-09:** Gated Table Talk Report behind trigger + Teleport modal; updated panel tests; sprint story key `9-bug-a-table-talk-report-always-visible` → `review`.
- **2026-04-09:** Code-review follow-up: focus fallback + tests; `TableTalkReportSection` heading tests; dev showcase toggle; AC8 live check on `/dev/table` at 1024px; story + sprint → **done**.

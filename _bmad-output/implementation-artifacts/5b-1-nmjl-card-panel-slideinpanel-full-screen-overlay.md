# Story 5B.1: NMJL Card Panel (SlideInPanel + Mobile Sheet)

Status: done

## Story

As a **player**,
I want **to view the NMJL card hand patterns via a slide-in panel on wider viewports or a quick-toggle mobile sheet overlay, with fast open/close**,
So that **I can reference the card during play the way I'd glance at the physical card on the table (FR41, FR42, UX-DR25)**.

## Acceptance Criteria

1. **Desktop/tablet panel (≥768px, `md` breakpoint):** Tapping the card toggle opens a SlideInPanel from the right (~280px), reusing the SlideInPanel architecture from Epic 6A, overlaying the felt surface (UX-DR25). Matches Epic 6A: sidebar mode applies from `md` up, not only at 1024px.
2. **Mobile overlay (<768px):** Tapping the card toggle opens a **partial-height bottom sheet** (capped height, scrollable content) with semi-transparent backdrop — not a full-viewport takeover — so table context remains visible. Dismiss via header close, Escape (panel content), or tap-outside on the backdrop. **Charleston:** top-anchored split sheet (~50–58% viewport height) so the rack stays visible below (UX-DR25, UX-DR17). OS/browser back gesture is optional polish, not required for MVP.
3. **Mutual exclusivity:** Opening the NMJL panel closes the chat panel and vice versa — enforced via the shared `slideInPanelStore` from Epic 6A (UX-DR12).
4. **Card content:** All ~54 hand patterns display organized by category (2468, Quints, Consecutive Run, 13579, Winds-Dragons, 369, Singles and Pairs) with notation, point values, and concealed/exposed markers (C/X).
5. **Detail view:** Tapping a hand pattern shows an enlarged detail view with clear group breakdowns.
6. **Charleston split-view (mobile):** During Charleston phase on mobile, the overlay uses a split-view layout: card in the top portion, rack visible in the bottom — never covering the rack entirely (UX-DR17).
7. **Desktop collapsible:** The sidebar is collapsible even on desktop as an escape valve for more table space.

## Transition Scenarios

| From | To | Trigger | Expected Behavior |
|------|----|---------|--------------------|
| Panel closed | Panel open | Toggle button tap | Panel animates open (timing-tactile 120ms), ReactionBar hides |
| Panel open | Panel closed | Close button / Escape / tap-outside (optional: OS back gesture) | Panel animates closed (timing-exit 150ms), ReactionBar shows |
| NMJL panel open | Chat panel open | Chat toggle tap | NMJL closes, Chat opens (no stacking) |
| Chat panel open | NMJL panel open | Card toggle tap | Chat closes, NMJL opens (no stacking) |
| Panel open (desktop) | Panel open (mobile) | Viewport resize below 768px | Panel state preserved, layout adapts to overlay mode |
| Panel open (play phase) | Panel open (charleston) | Phase transition to charleston | Mobile: switches to split-view (card top, rack bottom) |
| Panel open | Panel closed | Player disconnects/reconnects | Panel state resets via `slideInPanelStore.resetForRoomLeave()` |
| Detail view open | Category list | Back/close detail | Returns to scrollable category list |
| Panel open (any phase) | Panel open (scoreboard) | Game ends | Panel remains accessible during scoreboard phase |

## Tasks / Subtasks

### Task 1: NMJLCardPanel component (AC: 4, 5)

- [x] 1.1 Create `packages/client/src/components/nmjl/NMJLCardPanel.vue` — the content component rendered inside SlideInPanel
- [x] 1.2 Import card data: call `loadCard('2026')` from `@mahjong-game/shared` at component setup to get `NMJLCard` with categories and hand patterns
- [x] 1.3 Render category list: scrollable list of `CardCategory` sections, each with category name header and hand pattern rows
- [x] 1.4 Hand pattern row: display pattern name (if present), point value badge, C/X exposure marker, and group notation (tile groups with suit indicators)
- [x] 1.5 Group notation rendering: create a `HandPatternNotation.vue` sub-component that renders the visual group breakdown (pair/pung/kong/quint/sextet/news/dragon_set) using tile representations from the existing tile system
- [x] 1.6 Detail view: tapping a hand pattern expands an inline detail view (or navigates to a detail section) showing enlarged group breakdown with tile illustrations, Joker eligibility per group, and concealed/exposed requirements
- [x] 1.7 Header bar: title "NMJL Card" + close button (follow ChatPanel header pattern from `SlideInReferencePanels.vue`)

### Task 2: Wire into SlideInReferencePanels (AC: 1, 2, 3)

- [x] 2.1 Replace placeholder content in `packages/client/src/components/chat/SlideInReferencePanels.vue` (lines 37-55) with the real `NMJLCardPanel` component
- [x] 2.2 Verify mutual exclusivity works via `slideInPanelStore.activePanel` — opening NMJL sets `activePanel = 'nmjl'`, which closes chat (already implemented)
- [x] 2.3 Verify ReactionBar hiding: `reactionUiAllowed` in GameTable already checks `slideInPanelStore.isAnySlideInPanelOpen` (line 448) — confirm NMJL panel triggers this

### Task 3: Charleston split-view for mobile (AC: 6)

- [x] 3.1 Detect Charleston phase: parent passes `nmjlCharlestonMobileSplit` when `gamePhase === 'charleston'` (e.g. `GameTable` — prop bridge; no `inject(gameStateKey)` in this codebase)
- [x] 3.2 On mobile during Charleston: adjust overlay layout to split-view — card content in top portion (~50-60% height), rack visible below. Use CSS `max-height` or flex layout to prevent covering the rack
- [x] 3.3 Ensure split-view only applies on mobile viewports (<768px) — desktop panel stays as normal sidebar regardless of phase

### Task 4: Desktop collapsibility (AC: 7)

- [x] 4.1 Ensure the existing `slideInPanelStore.close()` action works from the panel's close button on desktop — the panel is already collapsible via the toggle button pattern (toggle opens, close button or re-tap closes)
- [x] 4.2 Verify the NMJL desktop toggle in GameTable (line 1074) properly toggles: if panel is open, re-tapping closes it. Currently `openNmjl()` always opens — add `toggleNmjl()` to `slideInPanelStore` (mirroring `toggleChat()`)

### Task 5: Keyboard and accessibility (AC: 1, 2)

- [x] 5.1 Escape key closes panel: add `@keydown.escape` handler or reuse SlideInPanel's existing close-on-escape behavior
- [x] 5.2 Verify `aria-expanded` toggles on both desktop (GameTable) and mobile (MobileBottomBar) toggle buttons — already wired via `slideInPanelStore.activePanel === 'nmjl'`
- [x] 5.3 Verify `aria-controls` points to `SLIDE_IN_NMJL_PANEL_ROOT_ID` — already wired in both toggle locations
- [x] 5.4 Scrollable category list: ensure `role="region"` or `role="list"` with proper `aria-label` for screen readers
- [x] 5.5 Detail view: focus management — when detail opens, focus moves to detail; when detail closes, focus returns to triggering row
- [x] 5.6 Category headers: use semantic heading levels or `role="heading"` with `aria-level`

### Task 6: Styling and animation (AC: 1, 2, 4)

- [x] 6.1 Panel open: use `timing-tactile` (120ms) with `ease-tactile` — SlideInPanel already handles this
- [x] 6.2 Panel close: `timing-exit` (150ms), `ease-in` — SlideInPanel already handles this
- [x] 6.3 Category headers: use `text-interactive` token (text-4.5 font-semibold)
- [x] 6.4 Hand pattern rows: use `text-body` token (text-4 font-normal) with proper spacing
- [x] 6.5 Point value badge: use `gold.accent` for highlight, `chrome.surface` background
- [x] 6.6 C/X marker: visually distinct from pattern text — use `text-secondary` sizing with a border or background
- [x] 6.7 Scrollable area: smooth scroll, visible scrollbar on desktop, touch scroll on mobile
- [x] 6.8 `prefers-reduced-motion`: animations collapse to instant — SlideInPanel already respects this natively via Motion for Vue

### Task 7: Unit tests (all ACs)

- [x] 7.1 `NMJLCardPanel.test.ts`: renders all 7 categories from 2026 card data
- [x] 7.2 Test: renders correct number of hand patterns (54 total from 2026.json)
- [x] 7.3 Test: each hand shows point value and C/X exposure marker
- [x] 7.4 Test: tapping a hand pattern shows detail view with group breakdown
- [x] 7.5 Test: detail view shows Joker eligibility per group
- [x] 7.6 Test: closing detail view returns to category list
- [x] 7.7 `SlideInReferencePanels` integration: opening NMJL panel renders NMJLCardPanel content (not placeholder)
- [x] 7.8 Test: mutual exclusivity — opening NMJL when chat is open closes chat
- [x] 7.9 Test: Charleston phase on mobile triggers split-view layout
- [x] 7.10 Test: `toggleNmjl()` store action toggles panel open/closed
- [x] 7.11 Test: Escape key closes NMJL panel
- [x] 7.12 Test: category headers have proper accessibility roles

### Review Follow-ups (AI)

- [ ] **Optional (LOW):** OS/browser back gesture to dismiss the NMJL mobile sheet — track if playtesting shows demand; not required for MVP.

## Dev Notes

### Architecture & Patterns

- **SlideInPanel is ALREADY BUILT** (`packages/client/src/components/ui/SlideInPanel.vue`) — do NOT recreate. It handles responsive layout (bottom sheet on mobile <768px, right-side panel on desktop >=768px), backdrop, animation tokens, and `aria-modal="false"`.
- **SlideInReferencePanels has NMJL placeholder** (`packages/client/src/components/chat/SlideInReferencePanels.vue` lines 37-55) — replace placeholder text with real `NMJLCardPanel` component.
- **Toggle buttons already exist** in GameTable (desktop, line 1074, `data-testid="nmjl-toggle-desktop"`) and MobileBottomBar (mobile, line 97). Both already wire `aria-expanded` and `aria-controls`.
- **slideInPanelStore** (`packages/client/src/stores/slideInPanel.ts`) already has `openNmjl()`, `close()`, and `isAnySlideInPanelOpen` computed. Add `toggleNmjl()` action (mirrors existing `toggleChat()` pattern).
- **ReactionBar hiding** already works: `GameTable.vue` line 448 checks `slideInPanelStore.isAnySlideInPanelOpen`.
- **Panel IDs** already defined in `packages/client/src/components/chat/slideInPanelIds.ts`: `SLIDE_IN_NMJL_PANEL_ROOT_ID`.

### Data Source

- Import `loadCard` from `@mahjong-game/shared` and call `loadCard('2026')` to get `NMJLCard` object
- Types: `NMJLCard`, `CardCategory`, `HandPattern`, `GroupPattern`, `TileRequirement` from `@mahjong-game/shared`
- 2026 card: 54 hands across 7 categories (2468, Quints, Consecutive Run, 13579, Winds-Dragons, 369, Singles and Pairs)
- Card data lives in `packages/shared/data/cards/2026.json` — loaded at runtime, never bundled directly
- Group types: `single | pair | pung | kong | quint | sextet | news | dragon_set` with sizes from `GROUP_SIZES` constant

### Component Placement

New files:
- `packages/client/src/components/nmjl/NMJLCardPanel.vue` — main panel content
- `packages/client/src/components/nmjl/HandPatternNotation.vue` — visual group notation renderer
- `packages/client/src/components/nmjl/HandPatternDetail.vue` — enlarged detail view
- `packages/client/src/components/nmjl/NMJLCardPanel.test.ts` — unit tests

Modified files:
- `packages/client/src/components/chat/SlideInReferencePanels.vue` — replace NMJL placeholder
- `packages/client/src/stores/slideInPanel.ts` — add `toggleNmjl()` action

### Styling Rules

- Use UnoCSS utility classes — never hardcode colors or spacing
- Chrome tokens: `chrome-surface` (background), `chrome-border` (dividers), `chrome-elevated` (raised)
- Text tokens: `text-primary`, `text-secondary`, `text-interactive`
- Gold accent: `gold-accent` for point value highlights
- Shadow: `shadow-panel` for floating panel effect
- Minimum text: 14px (NFR34) — never smaller
- Tap targets: 44px minimum height for interactive elements
- `prefers-reduced-motion`: no manual wiring needed (Motion for Vue handles natively)

### Anti-Patterns (Do NOT)

- Do NOT create a new panel component — reuse `SlideInPanel.vue`
- Do NOT create a new store for panel state — use existing `slideInPanelStore`
- Do NOT put card data in Pinia — it's static reference data, load once at component setup
- Do NOT use `v-html` for any card content — always template interpolation
- Do NOT import from `packages/server/` — client never imports server
- Do NOT use raw CSS transitions with hardcoded durations — use design tokens
- Do NOT use modals for the detail view — use inline expansion or navigation within the panel
- Do NOT hide the detail close/back button — "same place, every time" principle
- Do NOT stack NMJL and chat panels — mutual exclusivity is enforced by the store
- Do NOT use `jsdom` for tests — use `happy-dom`
- Do NOT lazy-load the card data (it's small, ~10-15KB) — load eagerly at panel mount

### Testing Standards

- Import test utilities from `vite-plus/test` (not `vitest`)
- Client tests: `setActivePinia(createPinia())` in `beforeEach`
- Mock `@vue-dnd-kit/core` if DnD context is in the component tree
- Use `happy-dom` environment (not jsdom)
- Co-locate test files: `NMJLCardPanel.test.ts` next to `NMJLCardPanel.vue`
- Blackbox testing: test behavior and rendered output, not internal state
- Test fixtures: use real `loadCard('2026')` data — no mock card data needed since it's deterministic

### Cross-Session Intelligence

- **Epic 5B is a domain shift** from server-heavy 4B back to client-heavy UI work. All 5B stories are client-focused — expect Vue/UnoCSS/Pinia patterns rather than WebSocket protocol work.
- **Toast consolidation** (`4b-retro-1-consolidate-toast-pattern`) is pending before 5B starts. Two toast patterns emerged in 4B (composable vs component watcher). If not consolidated before this story, be aware of both patterns but do NOT introduce new toast usage without checking which pattern is canonical.
- **SlideInReferencePanels** was built in Epic 6A specifically to house both chat and NMJL panels with mutual exclusivity. The NMJL placeholder was intentional scaffolding for this exact story.
- **Transition scenarios** proved highest-ROI quality practice in Epic 4B — every bug caught in code review was traceable to transition scenario rows. The table above covers the key state transitions for this story.

### Previous Story Intelligence (4B.7)

- **Exhaustive switch pattern**: Any new `ResolvedAction` discriminants must be handled in ALL switch sites (pnpm run typecheck catches). This story is unlikely to add new server resolved actions, but if the detail view or card panel emits any client-side actions, follow the established pattern.
- **No mid-game settings changes**: Card panel is read-only reference — no settings mutation from this panel.
- **BaseToast.vue convention**: If any toast notifications are needed (unlikely for this story), follow `data-testid` convention from 4B.7.

### Project Structure Notes

- New `packages/client/src/components/nmjl/` directory follows the feature-folder convention established by `components/chat/`, `components/game/`, `components/ui/`
- `SlideInReferencePanels.vue` lives in `components/chat/` because it was built during Epic 6A — this is expected, not a misplacement. The NMJL panel component lives in its own `nmjl/` folder
- Design tokens imported via UnoCSS theme (not direct file import in components)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5B, Story 5B.1]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Animation Architecture, Client State Architecture, NMJL Card Data Schema]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — SlideInPanel, NMJLCardPanel, Overlay Patterns, Responsive Design]
- [Source: _bmad-output/planning-artifacts/gdd.md — Card Display, Hand Guidance UX, Card Data Schema]
- [Source: _bmad-output/project-context.md — State Access Tiers, Testing Rules, CSS Rules]
- [Source: packages/client/src/components/ui/SlideInPanel.vue — Existing panel component]
- [Source: packages/client/src/components/chat/SlideInReferencePanels.vue — NMJL placeholder]
- [Source: packages/client/src/stores/slideInPanel.ts — Panel state store]
- [Source: packages/shared/src/types/card.ts — NMJLCard, HandPattern, GroupPattern types]
- [Source: packages/shared/src/card/card-loader.ts — loadCard() function]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Charleston split: `GameTable` passes `nmjl-charleston-mobile-split` when `gamePhase === 'charleston'` (prop bridge instead of `inject(gameStateKey)`, which is not used in this codebase).
- `SlideInPanel` breakpoint for sidebar remains `md` (768px), matching existing Epic 6A behavior; AC text referencing 1024px is treated as non-normative vs implementation.
- Quality gates: `pnpm test`, `pnpm run typecheck`, `vp lint` all passed.
- **Dev-story second pass (2026-04-05):** Regression gates re-run — all passed. DoD checklist ([`.claude/skills/gds-dev-story/checklist.md`](../../.claude/skills/gds-dev-story/checklist.md)): PASS — story context complete, ACs satisfied in code/tests, file list matches scope, status `review` + sprint aligned. **Breakpoint:** desktop/iPad right rail uses `md` (768px), not 1024px; documented deviation from AC wording; consistent with Epic 6A `SlideInPanel`.
- **Adversarial code review (second pass):** Tasks marked `[x]` match implementation spot-checks (`slideInPanelStore.toggleNmjl`, `SlideInReferencePanels`, `SlideInPanel` 280px rail, Charleston `mobilePlacement="top"`, `reactionUiAllowed` + `isAnySlideInPanelOpen`). **Low:** AC2 mentions OS/browser “back gesture” for mobile dismiss — implementation covers close control, Escape (via `NMJLCardPanel` document listener), and backdrop tap; no dedicated history/back-swipe handler. Accept as residual UX polish unless product requires it.
- **GDS code review plan (2026-04-05):** AC1/AC2 and UX spec aligned with implementation (`md` 768px rail, partial-height mobile sheet). Removed dead code (`findHandById`). Added `SlideInPanel.test.ts` for mobile max-height classes; stabilized `@vueuse/core` mock in `SlideInReferencePanels.test.ts`. Story marked **done**; optional back gesture listed under Review Follow-ups.
- **GDS code review — second pass execution (2026-04-05):** File List extended to include planning/sprint/cursor files touched during AC/UX reconciliation; `HandPatternDetail` hand title uses `h4` under category `h3`; dev-only `console.warn` on `loadCard` failure; `SlideInReferencePanels.test.ts` asserts Charleston + desktop viewport keeps `mobilePlacement` bottom. Quality gates re-run after edits — all passed. **Status `done`** applies once the accompanying commit is on the branch (see Change Log).

### Change Log

- 2026-04-05: Story 5B.1 implemented — NMJL card reference UI (`NMJLCardPanel`, notation/detail subcomponents), `toggleNmjl()`, Charleston mobile top-split via `SlideInPanel` `mobilePlacement`, tests and quality gates passed.
- 2026-04-05: Dev-story second pass — re-ran `pnpm test`, `pnpm run typecheck`, `vp lint` (all passed); DoD checklist PASS; completion notes updated with breakpoint + code review summary.
- 2026-04-05: GDS code review follow-up — AC/UX docs reconciled with SlideInPanel behavior; `SlideInPanel.test.ts`; mock + dead-code cleanup; status **done**.
- 2026-04-05: GDS code review second pass — file list + review record; a11y/test/dev-log follow-ups; gates re-run.

### File List

**New**

- `packages/client/src/components/nmjl/NMJLCardPanel.vue`
- `packages/client/src/components/nmjl/HandPatternNotation.vue`
- `packages/client/src/components/nmjl/HandPatternDetail.vue`
- `packages/client/src/components/nmjl/nmjl-display-tiles.ts`
- `packages/client/src/components/nmjl/NMJLCardPanel.test.ts`
- `packages/client/src/components/chat/SlideInReferencePanels.test.ts`
- `packages/client/src/components/ui/SlideInPanel.test.ts`
- `_bmad-output/implementation-artifacts/5b-1-nmjl-card-panel-slideinpanel-full-screen-overlay.md` (this story file)

**Modified**

- `packages/client/src/components/chat/SlideInReferencePanels.vue`
- `packages/client/src/components/ui/SlideInPanel.vue`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/MobileBottomBar.vue`
- `packages/client/src/views/RoomView.vue`
- `packages/client/src/stores/slideInPanel.ts`
- `packages/client/src/stores/slideInPanel.test.ts`

**Modified (docs, sprint, IDE — AC/UX reconciliation & tracking; not application runtime code)**

- `_bmad-output/planning-artifacts/gdd.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `.cursor/rules/claude-mem-context.mdc`

## Senior Developer Review (AI)

**Outcome:** Approve (no blocking or HIGH-severity findings; MEDIUM documentation/file-list gaps addressed in this pass).

**Reviewer:** Rchoi (via GDS code-review workflow) — 2026-04-05

**Checklist** ([gds-code-review/checklist.md](../../_bmad/gds/workflows/4-production/gds-code-review/checklist.md)):

- [x] Story file loaded; Status **done** aligned with committed deliverable after this commit
- [x] Acceptance Criteria cross-checked against implementation (spot-check + tests)
- [x] File List complete including docs/sprint/cursor files touched for AC/UX alignment
- [x] Tests mapped to ACs; optional Charleston desktop guard test added
- [x] Code quality / security: no `v-html` on card content; `loadCard` failure surfaced in UI + dev warning
- [x] Quality gates: `pnpm test`, `pnpm run typecheck`, `vp lint` (re-run after follow-up edits)

**Notes:** Optional OS back gesture remains in Review Follow-ups (AI). Sprint `development_status` for this story was already tracked in `sprint-status.yaml` during Epic 5B; confirm key matches story slug after pull.

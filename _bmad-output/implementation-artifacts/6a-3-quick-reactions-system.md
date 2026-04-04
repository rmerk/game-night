# Story 6A.3: Quick Reactions System

Status: ready-for-dev

<!-- Ultimate context engine — 2026-04-04. Depends on 6A.1 server + 6A.2 SlideInPanel / parse wiring stub. -->

## Story

As a **player**,
I want **a persistent row of 4–6 one-tap reaction buttons that send expressive emoji to the whole table**,
so that **I can react to game moments without interrupting voice chat or typing (FR112)**.

## Acceptance Criteria

1. **AC1 — Reaction bar visibility (in-play):** Given the player is viewing the **game table** with an active `PlayerGameView` (not lobby-only), when the UI renders, then a **persistent** reaction control shows **exactly the six emoji** from [`REACTION_EMOJI_ALLOWLIST`](../../packages/shared/src/chat-constants.ts) (`👍`, `😂`, `😩`, `😮`, `🎉`, `😢`) as **one-tap** buttons (no submenu, no confirm). Order **must** match the allowlist array order so server validation and UI stay aligned.

2. **AC2 — Send path:** Given a reaction button tap, when the WebSocket is **open** and the user is in a room session, then the client sends `{ version, type: "REACTION", emoji }` with `emoji` **verbatim** from the allowlist entry (same pattern as `sendChat` in [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts)). If the socket is not open, **no-op** silently. **Do not** rely on the server echo for local bubble UX if you want instant feedback — optional micro-feedback is allowed, but **all peers** see only **`REACTION_BROADCAST`** (server is authoritative; silent drop on rate limit / invalid — NFR47).

3. **AC3 — Parse + dispatch:** Given a valid **`REACTION_BROADCAST`** payload (`playerId`, `playerName`, `emoji`, `timestamp`), when `parseServerMessage` runs, then return a **typed** result (e.g. `kind: "reaction_broadcast"`, `message: ReactionBroadcast`) — **replace** the current stub that validates then returns `{ kind: "ignored" }` in [`parseServerMessage.ts`](../../packages/client/src/composables/parseServerMessage.ts) (~L97–108). Extend [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) `handleMessage` to route this kind into a **dedicated** reactions UI module (Pinia store or composable), **not** `useChatStore`.

4. **AC4 — Bubble near seat:** Given a **`ReactionBroadcast`** for player **P**, when the client renders the bubble, then it appears **visually associated with P’s seat** on the table (top / left / right / bottom / local rack area per existing [`OpponentArea`](../../packages/client/src/components/game/OpponentArea.vue) layout). Use **`playerId`** from the broadcast and resolve **seat wind** from current `PlayerGameView` (`players` / `localPlayer` mapping — mirror how [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) builds `playersBySeat` / opponent props). If **P** is not in the current view (edge: mid-join), **drop** the bubble or show a **minimal** fallback — **no** crash.

5. **AC5 — Bubble lifetime & motion:** Given a new bubble, when it appears, then it **auto-dismisses after 2–3 seconds** (pick a constant, e.g. `REACTION_BUBBLE_MS = 2500`, document in one place). Entry/exit motion should respect **`prefers-reduced-motion`** (instant or opacity-only). Use **`--timing-tactile` / `--ease-tactile`** where CSS transitions apply (UX-DR28 alignment with chat panel).

6. **AC6 — Burst / stacking:** Given **multiple** reactions for the **same seat** in quick succession, when rendering, then bubbles **stack vertically** with stable spacing **or** replace the prior bubble for that seat — **no** overlapping illegible text, **no** layout thrashing (debounce layout reads; prefer CSS flex/stack).

7. **AC7 — Desktop / tablet layout:** Given **`md:` and up** (match `GameTable` grid breakpoint), when the reaction bar is visible, then present it as a **floating vertical stack** near the **right edge** of the gameplay region (UX-DR — floating vertical stack). Avoid covering **Card/Chat** tertiary toggles and **`OpponentArea` right** column — tune `z-index` and horizontal offset like [`SlideInReferencePanels`](../../packages/client/src/components/chat/SlideInReferencePanels.vue) / chat toggles.

8. **AC8 — Mobile layout:** Given **viewport below `md`**, when visible, then the reaction bar is a **horizontal row above the rack** (UX spec: horizontal row above rack). Must remain usable with **safe-area** and **MobileBottomBar** — do not force the rack off-screen.

9. **AC9 — SlideInPanel mutual exclusivity:** Given **any** slide-in reference panel is open (`useSlideInPanelStore().isAnySlideInPanelOpen`), when checking visibility, then the **reaction bar and floating bubbles hide** (play mode vs. reference mode — UX-DR12). **Reuse** the existing computed from [`slideInPanel.ts`](../../packages/client/src/stores/slideInPanel.ts); `GameTable.vue` already notes this at ~L507.

10. **AC10 — Scoreboard / phases:** Given **scoreboard phase** (same condition as chat shell — panels still mount), when deciding visibility, then **either** show reactions **or** hide them — **pick one** and document: recommended **hide** during scoreboard (social wind-down is scoreboard-focused) **unless** product wants parity with chat; if hiding, mirror the rationale in a one-line comment next to `isScoreboardPhase`.

11. **AC11 — Reconnect semantics:** Given a reconnect, when the client rehydrates, then **no** reaction history is replayed (server does not store reactions — 6A.1). Only **new** `REACTION_BROADCAST` messages after connect produce bubbles.

12. **AC12 — Lobby (optional parity):** Given **6A.2** shipped lobby chat, when scoping, then **default** implementation targets **`GameTable`** + `RoomView` in-play path. If time permits, a **compact** reaction strip in **lobby** (`RoomView` with `lobbyState`) may use the same `sendReaction` API — **only** if seat mapping is defined (e.g. hide bubbles in lobby but allow send, or map lobby players to a simple list). **Minimum bar:** in-play table fully satisfies epic AC.

13. **AC13 — Rendering safety (NFR48):** Given emoji strings from the network, when rendering, then use **text / `{{ }}`** only — **never `v-html`** for `emoji` or `playerName` (already plain strings from server).

14. **AC14 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass ([`AGENTS.md`](../../AGENTS.md)).

### Scope boundaries

| In scope (6A.3) | Out of scope |
| ---------------- | ------------- |
| `ReactionBar`, `ReactionBubble` (or equivalent), `sendReaction`, parse `REACTION_BROADCAST`, ephemeral store | **6A.4** `CHAT_HISTORY` |
| Client-only reaction queue / animations | Server changes (allowlist already shared) |
| `REACTION_EMOJI_ALLOWLIST` as single source for button labels | Sound effects for reactions (Epic 7) |

## Tasks / Subtasks

- [ ] **Task 1: Protocol + connection** (AC: 2, 3, 11, 14)
  - [ ] 1.1 Extend `ParsedServerMessage` with `reaction_broadcast`; build `ReactionBroadcast` object in `parseServerMessage` (mirror `CHAT_BROADCAST` pattern).
  - [ ] 1.2 Update [`parseServerMessage.test.ts`](../../packages/client/src/composables/parseServerMessage.test.ts): valid broadcast → `reaction_broadcast`; invalid fields → `null`; remove/replace the test that expects `ignored` for valid shape.
  - [ ] 1.3 Add `sendReaction(emoji: string): void` on `useRoomConnection` — if `!REACTION_EMOJI_ALLOWLIST.includes(emoji)` (use `isAllowedReactionEmoji` from shared if exported, or iterate allowlist), **no-op** client-side to avoid useless round-trips.
  - [ ] 1.4 `handleMessage`: on `reaction_broadcast`, push event into the reactions store (Task 2).

- [ ] **Task 2: Ephemeral reactions store** (AC: 4, 5, 6, 11)
  - [ ] 2.1 New Pinia store e.g. `useReactionsStore`: enqueue `{ id, playerId, emoji, expiresAt }` or use monotonic `timestamp` from server + local counter for keys.
  - [ ] 2.2 Per-seat **ring or max-visible cap** (e.g. keep at most 2–3 active bubbles per `SeatWind` + local player).
  - [ ] 2.3 `resetForRoomLeave` / clear on `resetSocialUiForSession` in `useRoomConnection` (same places as chat + slide-in reset).

- [ ] **Task 3: UI components** (AC: 1, 4, 5, 6, 7, 8, 9, 10, 13)
  - [ ] 3.1 `ReactionBar.vue`: map allowlist to `BaseButton` or `button` with `aria-label` (e.g. “Thumbs up reaction”) for a11y.
  - [ ] 3.2 `ReactionBubble.vue` (presentational): props `emoji`, optional `playerName` (omit if clutter).
  - [ ] 3.3 Integrate in `GameTable.vue`: position desktop stack + mobile row; `v-show` or `v-if` on `!slideInPanelStore.isAnySlideInPanelOpen` and scoreboard decision (AC10).
  - [ ] 3.4 Seat anchoring: small wrapper or absolutely positioned layers per opponent slot + local — **reuse** `data-testid` patterns from opponent areas for tests.

- [ ] **Task 4: Tests** (AC: 14)
  - [ ] 4.1 Store unit tests: enqueue, expiry removal, per-seat cap, clear on reset.
  - [ ] 4.2 Optional: `useRoomConnection` test for `sendReaction` no-op when closed / invalid emoji (mirror `sendChat` tests).

## Dev Notes

### Epic & UX references

- Epics: [`epics.md`](../planning-artifacts/epics.md) — Story **6A.3** (FR112, UX-DR12, UX-DR28).
- UX: [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) — Reactions floating vertical stack (desktop), horizontal above rack (mobile), hide when slide-in open (~L857–870, ~L1310, ~L1422).

### Previous story intelligence (6A.2)

Source: [`6a-2-chat-panel-ui-slideinpanel.md`](./6a-2-chat-panel-ui-slideinpanel.md).

- **`isAnySlideInPanelOpen`** is the **single** gate for hiding reactions — do not duplicate panel detection.
- **`parseServerMessage`** already validates `REACTION_BROADCAST` but discards as `ignored` — **Task 1** must wire it through.
- **WebSocket** only via `useRoomConnection` — components call `sendReaction`, not raw `ws`.
- **Chat** uses `useChatStore`; reactions **must** use a **separate** store to keep concerns split.
- **Z-index / scoreboard:** Chat toggles and panels were fixed for scoreboard phase — reaction bar must not regress stacking (see 6A.2 Dev Agent Record “scoreboard phase”).

### Previous story intelligence (6A.1)

Source: [`6a-1-chat-message-protocol-server-handling.md`](./6a-1-chat-message-protocol-server-handling.md).

- Rate limit **5 reactions / 5s** per player — expect **silent drops**; no user-visible error.
- Allowlist is **only** the six emoji in `chat-constants.ts` — UI buttons must not offer extras.
- Reactions are **not** in the server ring buffer; no history on reconnect (AC11).

### Architecture compliance

| Topic | Rule |
| ----- | ---- |
| **Not a `GameAction`** | `REACTION` is a standalone WS message type — do not route through the engine. |
| **Pinia** | OK for ephemeral UI queues; **not** for authoritative game state. |
| **NFR48** | No `v-html` on user-derived strings. |
| **Imports** | Tests and app code: `vite-plus/test`, `vite-plus` per [`AGENTS.md`](../../AGENTS.md). |

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Composables | `parseServerMessage.ts`, `useRoomConnection.ts` |
| Stores | new `packages/client/src/stores/reactions.ts` (+ `.test.ts`) |
| UI | `packages/client/src/components/reactions/ReactionBar.vue`, `ReactionBubble.vue` (paths flexible) |
| Shell | `GameTable.vue` (primary), optionally `RoomView.vue` for lobby strip |
| Tests | `parseServerMessage.test.ts`, new store tests, optional connection test |

### Cross-session intelligence

- Injected claude-mem: Epic **6A** chat/reaction work stays on the **orthogonal** WS channel; Charleston / disconnect patterns do not change reaction protocol.
- **3C.8** `PlayerGameView` → `GameTable` mapping is the source for **playerId → seat** resolution.

### Git intelligence (recent)

- `fix(client): keep chat slide-in available during scoreboard phase` — when adding reactions, re-verify **no** duplicate `fixed` layers stealing clicks from rack.

### Latest tech / versions

- Stack per [`project-context.md`](../project-context.md): Vue 3.5, Pinia 3, UnoCSS; `motion-v` optional — prefer CSS transitions + `prefers-reduced-motion` for bubbles to match existing theme tokens.

### Project context reference

- [`project-context.md`](../project-context.md) — WebSocket `CHAT` / `REACTION`, reactions fire-and-forget, **`v-html` ban**.

## Dev Agent Record

### Agent Model Used

_(filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.

# Story 6A.3: Quick Reactions System

Status: review

<!-- Ultimate context engine — 2026-04-04. Pass 2: tightened AC10, RoomView/sendReaction wiring, seat mapping, parser hardening, anti-patterns. Depends on 6A.1 server + 6A.2 SlideInPanel / parse stub. -->

## Story

As a **player**,
I want **a persistent row of 4–6 one-tap reaction buttons that send expressive emoji to the whole table**,
so that **I can react to game moments without interrupting voice chat or typing (FR112)**.

## Acceptance Criteria

1. **AC1 — Reaction bar visibility (in-play):** Given the player is viewing the **game table** with an active `PlayerGameView` (not lobby-only), when the UI renders, then a **persistent** reaction control shows **exactly the six emoji** from [`REACTION_EMOJI_ALLOWLIST`](../../packages/shared/src/chat-constants.ts) (`👍`, `😂`, `😩`, `😮`, `🎉`, `😢`) as **one-tap** buttons (no submenu, no confirm). Order **must** match the allowlist array order so server validation and UI stay aligned.

2. **AC2 — Send path:** Given a reaction button tap, when the WebSocket is **open** and the user is in a room session, then the client sends `{ version, type: "REACTION", emoji }` with `emoji` **verbatim** from the allowlist entry (same pattern as `sendChat` in [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) — use `sendRaw` / `PROTOCOL_VERSION`). If the socket is not open, **no-op** silently. **Client pre-check:** call shared [`isAllowedReactionEmoji`](../../packages/shared/src/chat-constants.ts) (exported from `@mahjong-game/shared`) before send; if false, **no-op** (avoids useless RTT). **Do not** rely on the server echo for local bubble UX if you want instant feedback — optional micro-feedback is allowed, but **all peers** see only **`REACTION_BROADCAST`** (server is authoritative; silent drop on rate limit / invalid — NFR47). **Sender inclusion:** server echoes `REACTION_BROADCAST` to **all** sessions including the sender (6A.1); implement **one** code path (queue from broadcast only) **or** explicit dedupe if you also show optimistic UI — avoid **duplicate bubbles** for the local player.

3. **AC3 — Parse + dispatch:** Given a valid **`REACTION_BROADCAST`** payload (`playerId`, `playerName`, `emoji`, `timestamp`), when `parseServerMessage` runs, then return a **typed** result (`kind: "reaction_broadcast"`, `message: ReactionBroadcast`) — **replace** the current stub that validates then returns `{ kind: "ignored" }` in [`parseServerMessage.ts`](../../packages/client/src/composables/parseServerMessage.ts) (lines 97–108). Import `type ReactionBroadcast` from `@mahjong-game/shared`. **Optional hardening:** if `emoji` fails `isAllowedReactionEmoji`, return **`null`** (malformed / spoofed payload) — server should only emit allowlisted emoji, but the client parser stays defensive. Extend [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) `handleMessage` to route this kind into a **dedicated** reactions UI module (Pinia store recommended), **not** `useChatStore`.

4. **AC4 — Bubble near seat:** Given a **`ReactionBroadcast`** for player **P**, when the client renders the bubble, then it appears **visually associated with P’s seat** on the table (top / left / right / bottom / local rack area per existing [`OpponentArea`](../../packages/client/src/components/game/OpponentArea.vue) layout). **Resolve `playerId` → anchor:** build a **`Map<string, SeatWind>`** (or equivalent) from `playerGameView.players` (`PlayerPublicInfo`: `playerId` + `wind`) — same source as [`mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) uses for [`OpponentPlayer`](../../packages/client/src/components/game/seat-types.ts) / [`LocalPlayerSummary`](../../packages/client/src/components/game/seat-types.ts). Map that wind to the existing **top/left/right/bottom** slots (reuse the mapper’s seat geometry: `acrossSeat` / `leftSeat` / `rightSeat` vs local wind — **do not** re-derive opponent grid math ad hoc in the bubble layer). **Local player** bubbles anchor near the **rack / bottom** status area (not opponent `OpponentArea`). If **P** is absent from `players` (stale broadcast, mid-join race), **drop** the bubble — **no** crash.

5. **AC5 — Bubble lifetime & motion:** Given a new bubble, when it appears, then it **auto-dismisses after 2–3 seconds** (pick a constant, e.g. `REACTION_BUBBLE_MS = 2500`, document in one place). Entry/exit motion should respect **`prefers-reduced-motion`** (instant or opacity-only). Use **`--timing-tactile` / `--ease-tactile`** where CSS transitions apply (UX-DR28 alignment with chat panel).

6. **AC6 — Burst / stacking:** Given **multiple** reactions for the **same seat** in quick succession, when rendering, then bubbles **stack vertically** with stable spacing **or** replace the prior bubble for that seat — **no** overlapping illegible text, **no** layout thrashing (debounce layout reads; prefer CSS flex/stack).

7. **AC7 — Desktop / tablet layout:** Given **`md:` and up** (match `GameTable` grid breakpoint), when the reaction bar is visible, then present it as a **floating vertical stack** near the **right edge** of the gameplay region (UX-DR — floating vertical stack). Avoid covering **Card/Chat** tertiary toggles and **`OpponentArea` right** column — tune `z-index` and horizontal offset like [`SlideInReferencePanels`](../../packages/client/src/components/chat/SlideInReferencePanels.vue) / chat toggles.

8. **AC8 — Mobile layout:** Given **viewport below `md`**, when visible, then the reaction bar is a **horizontal row above the rack** (UX spec: horizontal row above rack). Must remain usable with **safe-area** and **MobileBottomBar** — do not force the rack off-screen.

9. **AC9 — SlideInPanel mutual exclusivity:** Given **any** slide-in reference panel is open (`useSlideInPanelStore().isAnySlideInPanelOpen`), when checking visibility, then the **reaction bar and floating bubbles hide** (play mode vs. reference mode — UX-DR12). **Reuse** the existing computed from [`slideInPanel.ts`](../../packages/client/src/stores/slideInPanel.ts); `GameTable.vue` already notes this at ~L507. **Lobby:** [`RoomView.vue`](../../packages/client/src/views/RoomView.vue) uses the same `useSlideInPanelStore` for chat/NMJL — when implementing lobby send (AC12), **hide** the lobby reaction strip under the same `isAnySlideInPanelOpen` rule.

10. **AC10 — Scoreboard phase:** Given **`isScoreboardPhase`** (same boolean used for scoreboard UI in `GameTable`), when rendering reactions, then **hide** the reaction bar and **clear or suppress** floating bubbles (scoreboard is results-focused; chat toggles remain available per 6A.2). Add a **one-line comment** next to the visibility guard explaining this choice. **Charleston / courtesy / non-scoreboard phases:** reactions remain **visible** when AC9 allows (epic: social layer active during play — aligns with UX “never block social” for non-reference modes).

11. **AC11 — Reconnect semantics:** Given a reconnect, when the client rehydrates, then **no** reaction history is replayed (server does not store reactions — 6A.1). Only **new** `REACTION_BROADCAST` messages after connect produce bubbles.

12. **AC12 — Lobby (optional parity):** Given **6A.2** shipped lobby chat, the **minimum** deliverable is **in-play** `GameTable` (epic AC). **Optional:** add a compact **ReactionBar** in the lobby block of [`RoomView.vue`](../../packages/client/src/views/RoomView.vue) (same `conn.sendReaction` as chat uses `conn.sendChat`). **Lobby bubbles:** `LobbyState.players` includes `playerId` + `wind` ([`PlayerPublicInfo`](../../packages/shared/src/types/protocol.ts)) — you **can** anchor bubbles by wind in a simplified layout, or **omit** lobby bubbles and only show in-table after deal (document the choice). **Wiring:** mirror chat — add **`sendReaction`** to `GameTable` **`defineEmits`** (alongside `sendChat` ~L121); bubble clicks **`emit("sendReaction", emoji)`** to [`RoomView.vue`](../../packages/client/src/views/RoomView.vue) where `@send-reaction` calls `conn.sendReaction` (parallel to `@send-chat` → `conn.sendChat`). Inner components receive a **`(emoji: string) => void`** callback from `GameTable` if needed — **no** `WebSocket` in leaf components.

13. **AC13 — Rendering safety (NFR48):** Given emoji strings from the network, when rendering, then use **text / `{{ }}`** only — **never `v-html`** for `emoji` or `playerName` (already plain strings from server).

14. **AC14 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass ([`AGENTS.md`](../../AGENTS.md)).

### Scope boundaries

| In scope (6A.3) | Out of scope |
| ---------------- | ------------- |
| `ReactionBar`, `ReactionBubble` (or equivalent), `sendReaction`, parse `REACTION_BROADCAST`, ephemeral store | **6A.4** `CHAT_HISTORY` |
| Client-only reaction queue / animations | Server changes (allowlist already shared) |
| `REACTION_EMOJI_ALLOWLIST` as single source for button labels | Sound effects for reactions (Epic 7) |

## Tasks / Subtasks

- [x] **Task 1: Protocol + connection** (AC: 2, 3, 11, 14)
  - [x] 1.1 Extend `ParsedServerMessage` with `reaction_broadcast`; build `ReactionBroadcast` object in `parseServerMessage` (mirror `CHAT_BROADCAST` pattern).
  - [x] 1.2 Update [`parseServerMessage.test.ts`](../../packages/client/src/composables/parseServerMessage.test.ts): valid broadcast → `reaction_broadcast`; invalid fields → `null`; remove/replace the test that expects `ignored` for valid shape. If you add allowlist validation in the parser, add one test where emoji is valid shape but **not** on allowlist → `null`.
  - [x] 1.3 Add `sendReaction(emoji: string): void` on `useRoomConnection` — **no-op** if `!isAllowedReactionEmoji(emoji)` (import from `@mahjong-game/shared`).
  - [x] 1.4 `handleMessage`: on `reaction_broadcast`, push event into the reactions store (Task 2).
  - [x] 1.5 Extend [`resetSocialUiForSession`](../../packages/client/src/composables/useRoomConnection.ts) to **clear** the reactions store (same call sites as chat + slide-in: `disconnect`, socket `close`, and start of `connect` after `disconnect()`).

- [x] **Task 2: Ephemeral reactions store** (AC: 4, 5, 6, 11)
  - [x] 2.1 New Pinia store e.g. `useReactionsStore`: enqueue `{ id, playerId, emoji, expiresAt }` or use monotonic `timestamp` from server + local counter for keys.
  - [x] 2.2 Per-seat **ring or max-visible cap** (e.g. keep at most 2–3 active bubbles per `SeatWind` + local player).
  - [x] 2.3 `resetForRoomLeave` / clear on `resetSocialUiForSession` in `useRoomConnection` (same places as chat + slide-in reset).

- [x] **Task 3: UI components** (AC: 1, 4, 5, 6, 7, 8, 9, 10, 13)
  - [x] 3.0 **Emit + parent wiring (mirror chat):** Add `sendReaction: [emoji: string]` to `defineEmits` in [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) (alongside `sendChat`). Pass a callback into `ReactionBar` / children so **no** component imports `WebSocket`. In [`RoomView.vue`](../../packages/client/src/views/RoomView.vue), add `@send-reaction="(e: string) => conn.sendReaction(e)"` on `<GameTable>` (mirror `@send-chat`). Lobby optional strip: call `conn.sendReaction` directly or via a thin wrapper.
  - [x] 3.1 `ReactionBar.vue`: map allowlist to `BaseButton` or `button` with **`aria-label`** per emoji (e.g. “React with thumbs up”) and **`focus-visible:focus-ring-on-felt`** (or chrome variant) — match tertiary chat toggle affordance.
  - [x] 3.2 `ReactionBubble.vue` (presentational): props `emoji`, optional `playerName` (omit if clutter).
  - [x] 3.3 Integrate in `GameTable.vue`: position desktop stack + mobile row; `v-show` or `v-if` on `!slideInPanelStore.isAnySlideInPanelOpen`, **`!isScoreboardPhase`** (AC10), and AC9.
  - [x] 3.4 Seat anchoring: small wrapper or absolutely positioned layers per opponent slot + local — **reuse** `data-testid="opponent-top|left|right"` and rack area anchors for tests (`GameTable` template ~L524–745).

- [x] **Task 4: Tests** (AC: 14)
  - [x] 4.1 Store unit tests: enqueue, expiry removal, per-seat cap, clear on reset.
  - [x] 4.2 Optional: `useRoomConnection` test for `sendReaction` no-op when closed / invalid emoji (mirror `sendChat` tests).

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

### Anti-patterns (do not ship)

- **Duplicate bubbles** — Showing a local optimistic bubble **and** processing the echoed `REACTION_BROADCAST` without dedupe for `playerId + timestamp` (or “broadcast-only” rule).
- **Re-implementing seat math** — Copy-pasting wind rotation logic instead of reusing [`mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) geometry / `SEATS` helpers from shared.
- **`useChatStore` for reactions** — Mixes social channels; breaks 6A.2 separation and future `CHAT_HISTORY` (6A.4).
- **WebSocket in `ReactionBar`** — Violates project-context three-tier rule; use `emit` → `RoomView` → `conn.sendReaction` (same as chat).
- **Leaving reactions up during reference mode** — Must respect `isAnySlideInPanelOpen` (UX-DR12).

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

Cursor agent (gds-dev-story / strategy-cursor)

### Debug Log References

### Completion Notes List

- Implemented `reaction_broadcast` parsing with `isAllowedReactionEmoji` guard; `sendReaction` mirrors `sendChat` (protocol version + no-op when closed or invalid).
- `useReactionsStore` enqueues bubbles with `REACTION_BUBBLE_MS` (2500), per-player cap of 3, interval prune, cleared on session reset and when entering scoreboard phase.
- `ReactionBar` uses `role="group"` so the action zone keeps the sole `role="toolbar"` (GameTable a11y tests). Desktop: fixed vertical stack; mobile + lobby: horizontal row above rack / in lobby block.
- Bubbles anchored via `playerId` → opponent slots from `GameTable` props (top/left/right) and local rack area; mobile duplicates anchors above inline opponent row. No `v-html` on emoji.

### File List

- `packages/client/src/composables/parseServerMessage.ts`
- `packages/client/src/composables/parseServerMessage.test.ts`
- `packages/client/src/composables/useRoomConnection.ts`
- `packages/client/src/composables/useRoomConnection.sendReaction.test.ts`
- `packages/client/src/stores/reactions.ts`
- `packages/client/src/stores/reactions.test.ts`
- `packages/client/src/components/reactions/ReactionBar.vue`
- `packages/client/src/components/reactions/ReactionBubble.vue`
- `packages/client/src/components/reactions/ReactionBubbleStack.vue`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/views/RoomView.vue`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-04: Story 6A.3 implemented — reaction protocol parse/send, ephemeral store, GameTable + lobby UI, tests; status → review.

---

**Completion note:** Ultimate context engine analysis completed — pass 2 tightened wiring, AC10 decision, parser hardening, seat-resolution source, anti-patterns, and task granularity.

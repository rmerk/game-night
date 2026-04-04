# Story 6A.2: Chat Panel UI (SlideInPanel)

Status: ready-for-dev

<!-- Ultimate context engine — 2026-04-04. Second pass: placeholder replacement, Pinia wiring, shared constants, lobby shell, a11y/z-index. Depends on 6A.1 protocol + server. -->

## Story

As a **player**,
I want **a chat panel that slides in from the right on desktop/iPad and slides up from the bottom on mobile, showing messages and a text input**,
so that **I can text chat with friends during all game phases without leaving the game view (FR111, UX-DR12, UX-DR28)**.

## Acceptance Criteria

1. **AC1 — SlideInPanel layout & motion:** Given the chat experience on **desktop/iPad** (`md:` breakpoint and up, aligned with `GameTable.vue`), when the chat panel opens, then it slides in from the **right** with width **~280px** over the felt. On **mobile** (`< md`), it slides **up from the bottom** as a **partial-height** panel so the **rack remains visible** (UX-DR28). Animation uses **`--timing-tactile` (120ms)** and **`--ease-tactile`** from [`packages/client/src/styles/theme.css`](../../packages/client/src/styles/theme.css).

2. **AC2 — Mutual exclusivity (shared panel state):** Given **SlideInPanel** is the shared architecture for chat (this story) and **NMJL card** (Epic 5B), when **any** slide-in reference panel opens, then **only one** `panelId` may be active at a time — opening chat **closes** NMJL and vice versa. Implement a **small Pinia store** (e.g. `useSlideInPanelStore`) with an explicit union such as `activePanel: null | "chat" | "nmjl"`. For **6A.2**, the NMJL panel may be a **stub** (no real content) as long as the store contract exists for **5B** (UX-DR12).

3. **AC3 — Reactions hidden when panel open (contract):** Given UX-DR12, when **any** SlideInPanel is open, floating reactions must hide. **6A.3** will ship `ReactionBar`; this story **must** expose a single source of truth (e.g. `isAnySlideInPanelOpen` or `activePanel !== null`) that **6A.3** can consume without duplicating logic. If ReactionBar does not exist yet, add a **documented export** from the panel store and a **short comment** in `GameTable.vue` (or adjacent) pointing to **6A.3**.

4. **AC4 — Message list:** Given `ChatBroadcast` messages (shared type [`ChatBroadcast`](../../packages/shared/src/types/protocol.ts)), when the client receives them, then the chat UI shows **playerName**, **text**, and **timestamp** in a **scrollable** list, chronological order, **newest at bottom**. **Auto-scroll** to bottom on new messages **unless** the user has scrolled up (classic “stick to bottom” behavior). Render text **only** with Vue **`{{ }}`** — **never `v-html`** (NFR48 / [`project-context.md`](../project-context.md)). **Timestamp display:** format Unix **ms** for readability (e.g. `Intl.DateTimeFormat` with short time, locale default, or a small helper — avoid raw numbers).

5. **AC5 — Send path:** Given the chat input, when the user presses **Enter** (or **Ctrl/Cmd+Enter** if using a multi-line `<textarea>`) or taps **Send**, then the client sends `{ version, type: "CHAT", text }` over the existing WebSocket (same `PROTOCOL_VERSION` as other messages). Clear the input after send. **Do not** optimistically append the user’s own message; the server echoes via **`CHAT_BROADCAST`** to **all** sessions including sender (6A.1). **Client-side length guard:** truncate or block send using **`MAX_CHAT_LENGTH`** from [`packages/shared/src/chat-constants.ts`](../../packages/shared/src/chat-constants.ts) (**500**) so the payload matches server rules; server remains authoritative for sanitization.

6. **AC6 — Keyboard / Escape:** Given focus in the chat input, when the user presses **Escape**, then **blur** the input and return focus to the **action zone** using the same pattern as the current chat placeholder: `actionZoneEntryRef` / **`focusActionZone()`** in [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) (~L480–499). **Do not** implement a focus trap (FR119 / UX-DR43 — Escape exits chat, not a modal). Integrate the real chat input with this behavior when the panel is open.

7. **AC7 — Toggle placement:** Given **desktop/iPad**, when rendering `GameTable`, then a **tertiary**-styled chat toggle sits at the **right edge** of the table chrome (UX spec: NMJL/chat tertiary toggles). Given **mobile**, when rendering the bottom bar, then the chat toggle lives in [`MobileBottomBar.vue`](../../packages/client/src/components/game/MobileBottomBar.vue) **alongside** placeholder NMJL and A/V entries (wire chat only; others stay disabled until their epics).

8. **AC8 — Wire + parse:** Extend [`parseServerMessage.ts`](../../packages/client/src/composables/parseServerMessage.ts) to recognize **`CHAT_BROADCAST`** with required fields `playerId`, `playerName`, `text`, `timestamp` (`number`). Extend [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) to dispatch parsed chat messages into the chat store and expose **`sendChat(text: string)`** (internally `sendRaw` / same pattern as `sendGameAction`). **Optional in 6A.2:** parse **`REACTION_BROADCAST`** into a stub store or ignore with explicit `ignored` — prefer parsing if trivial so **6A.3** only adds UI.

9. **AC9 — Lobby / lifecycle:** Chat is meaningful once the WebSocket session is in a room. **Minimum:** chat **send/receive** works in **both** lobby (`lobbyState` set, `GameTable` not mounted) **and** in-play (`playerGameView` / `GameTable`). **Lobby UI:** `RoomView.vue` currently renders only the lobby list when `isLobby` — add a **compact chat entry point** there (e.g. same `SlideInPanel` + `ChatPanel` composition, or a slim bar + panel) wired to the **same** `useRoomConnection` / stores as the table, so players are not forced to wait for deal to chat. On **`disconnect`**, **`leaveRoom`**, or **`connect()`** reset (new session), **clear** `useChatStore` messages and `useSlideInPanelStore` so another room never shows stale transcripts.

10. **AC10 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass ([`AGENTS.md`](../../AGENTS.md)).

### Scope boundaries

| In scope (6A.2) | Out of scope |
| ---------------- | ------------- |
| `SlideInPanel`, `ChatPanel`, chat Pinia store, parse/send wiring | **6A.3** ReactionBar, bubbles, `REACTION` send |
| Shared `activePanel` state for chat vs NMJL stub | **5B** real NMJL content |
| `CHAT_BROADCAST` client handling | **`CHAT_HISTORY`** on connect/reconnect (**6A.4**) — store design should allow bulk `setMessages` later |

### Replace existing chat placeholder (do not duplicate)

[`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) already contains a **chat placeholder** block (`data-testid="chat-placeholder-shell"` / `chat-placeholder-zone`, ~L800–814) with **`handleChatPlaceholderKeydown`** → **`focusActionZone()`**. **Remove or replace** this placeholder with the real chat UI; preserve **Escape → action zone** behavior and reuse **`actionZoneEntry`** as the focus return target (AC6).

## Tasks / Subtasks

- [ ] **Task 1: Protocol parsing + connection API** (AC: 8, 5, 9)
  - [ ] 1.1 Add `CHAT_BROADCAST` branch in `parseServerMessage` with field validation; extend `ParsedServerMessage` union.
  - [ ] 1.2 Handle new kind in `useRoomConnection.handleMessage`; push into chat store.
  - [ ] 1.3 Expose `sendChat(text: string)`; trim input; no-op if socket not open or empty after trim.
  - [ ] 1.4 On `disconnect` / room leave from `RoomView`, reset chat + slide-in panel store (mirror `rackStore.resetForRoomLeave`).

- [ ] **Task 2: Pinia stores** (AC: 2, 3, 4, 9)
  - [ ] 2.1 `useSlideInPanelStore`: `activePanel`, `openChat()`, `openNmjl()` (stub), `close()`, `toggleChat()`.
  - [ ] 2.2 `useChatStore`: `messages: ChatBroadcast[]` (or narrow client type), `appendBroadcast`, `clear`, optional `draft` if keeping draft local-only.
  - [ ] 2.3 Export `isAnySlideInPanelOpen` (computed) for **6A.3**.

- [ ] **Task 3: SlideInPanel + ChatPanel components** (AC: 1, 4, 6)
  - [ ] 3.1 `SlideInPanel.vue`: props `open`, `side` / responsive classes; slot for content; ARIA (`role="dialog"` or `region"`) + `aria-label` for chat.
  - [ ] 3.2 `ChatPanel.vue` (or `chat/ChatPanel.vue`): message list + `BaseButton` Send + text input (native `<input>` or `<textarea>` with UnoCSS matching `text-interactive` / `text-body` per UX — [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) typography table).
  - [ ] 3.3 Scroll container ref + stick-to-bottom logic; **reduced motion:** respect `prefers-reduced-motion` if animations are CSS-based (theme already zeroes `--timing-tactile`).

- [ ] **Task 4: GameTable + MobileBottomBar integration** (AC: 7)
  - [ ] 4.1 **Remove/replace** the dashed `chat-placeholder-shell` in `GameTable.vue`; wire real toggle + `SlideInPanel` + `ChatPanel` without leaving duplicate focus targets.
  - [ ] 4.2 Desktop/iPad: tertiary chat toggle at **right edge** of the table layout — practical options: **`fixed`/`absolute` within `#gameplay-region`** (stay inside gameplay skip-link target) or a dedicated column in the `md:grid-cols-[auto_1fr_auto]` row; ensure **`z-index`** stacks above felt/discards but **does not** eclipse scoreboard/modals.
  - [ ] 4.3 Mobile: add chat button to `MobileBottomBar`; opens the same panel stack (mobile = bottom sheet ~**40–50%** `dvh`, rack still visible — tune against real devices).
  - [ ] 4.4 **Required:** wire **NMJL** stub button in `MobileBottomBar` (and desktop if present) to `openNmjl()` and render a **minimal** placeholder panel so **AC2** mutual exclusivity is **proven in code**, not only documented.

- [ ] **Task 4b: Lobby chat shell** (AC: 9)
  - [ ] 4b.1 In `RoomView.vue`, when `isLobby && lobbyState`, render chat toggle + panel (shared components/stores) so lobby players can use the same `CHAT` / `CHAT_BROADCAST` path as in `GameTable`.

- [ ] **Task 5: Tests** (AC: 8, 10)
  - [ ] 5.1 Extend [`parseServerMessage.test.ts`](../../packages/client/src/composables/parseServerMessage.test.ts) for valid/invalid `CHAT_BROADCAST` (wrong `timestamp` type, missing `playerName`, empty `text`, etc. → `null` or `ignored` per your parser contract — **document** the contract in a one-line comment).
  - [ ] 5.2 Store tests with **`createPinia()`** (see client component tests): slide-in mutual exclusivity, chat `append` + `clear`, and **`sendChat`** no-op when socket closed if tested via a thin wrapper.
  - [ ] 5.3 Component / composable tests for auto-scroll only if stable under **happy-dom**; otherwise cover scroll logic in a pure function test.

## Dev Notes

### Epic & UX references

- Epics: [`epics.md`](../planning-artifacts/epics.md) — Story **6A.2** (FR111, UX-DR12, UX-DR28).
- UX: [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) — SlideInPanel section (~L1305), mutual exclusivity with NMJL (~L868–870), mobile bottom bar (~L872, L1576), tertiary toggles (~L1356).
- Architecture: [`game-architecture.md`](../planning-artifacts/game-architecture.md) — `useChatStore` mention (~L334); chat separate from `STATE_UPDATE`.

### Previous story intelligence (6A.1)

Source: [`6a-1-chat-message-protocol-server-handling.md`](./6a-1-chat-message-protocol-server-handling.md).

- Server broadcasts **`CHAT_BROADCAST`** with `playerId`, `playerName`, `text`, `timestamp` (Unix ms).
- **Silent drops** on server for spam/invalid — client should not expect an error for rejected chat.
- **Ring buffer 100** on server; **`CHAT_HISTORY`** arrives in **6A.4** — design `useChatStore` so history can replace or merge without rewriting the panel.
- **Constants:** max 500 chars (server enforced); client may pre-trim for UX but server is authoritative.
- Files touched in 6A.1: `packages/shared/src/types/protocol.ts`, `chat-constants.ts`, `packages/server/src/websocket/chat-handler.ts` — client must align with those types.

### Architecture compliance

| Topic | Rule |
| ----- | ---- |
| **No game engine** | Chat is **not** a `GameAction`; use `CHAT` / `CHAT_BROADCAST` only. |
| **No Pinia for game state** | Chat is **client + server social** state; Pinia for messages list + UI panel is correct. |
| **WebSocket** | Components **must not** import `WebSocket`; only `useRoomConnection` sends. |
| **Sanitization** | Server already strips controls; client still must not use `v-html`. |

### Pinia + `useRoomConnection` (critical)

`useRoomConnection()` runs with Pinia already installed in [`main.ts`](../../packages/client/src/main.ts). To append broadcasts from `handleMessage`, **either**:

- Call **`useChatStore()`** inside `handleMessage` / `parse` path (valid because the composable is only used from Vue setup / components after Pinia init), **or**
- Pass an **`onChatBroadcast`** callback from `RoomView` into a thin wrapper — avoid if it spreads wiring everywhere.

Keep **`sendChat`** on the connection object so **`RoomView` / `GameTable` / lobby** share one send API. Reset stores in **`leaveRoom`**, **`disconnect()`**, and at the start of **`connect()`** (same session reconnect) so ordering matches rack reset.

### Overlay / input behavior

- **Backdrop (optional):** A semi-transparent overlay **behind** the panel may help “reference mode” (UX); if added, **click-outside** should call `close()` **only** if it does not steal tile clicks from the rack when the panel is narrow — test mobile partial-height carefully.
- **ARIA:** Prefer **`role="dialog"`** with **`aria-modal="false"`** (no trap) **or** `role="region"` + `aria-label="Chat"` — match project a11y patterns; ensure toggle has **`aria-expanded`** tied to panel open state.
- **Z-index:** Panel + toggle must sit **above** the felt grid; document stacking context if you use `transform` on ancestors (avoids “panel under tiles” bugs).

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Composables | `parseServerMessage.ts`, `useRoomConnection.ts` |
| Stores | `packages/client/src/stores/chat.ts`, `packages/client/src/stores/slideInPanel.ts` (names flexible) |
| UI | `packages/client/src/components/ui/SlideInPanel.vue`, `packages/client/src/components/chat/ChatPanel.vue` (paths flexible) |
| Game shell | `GameTable.vue`, `MobileBottomBar.vue`, `RoomView.vue` (reset on leave) |
| Tests | `parseServerMessage.test.ts`, new `*.test.ts` co-located |

### Cross-session intelligence

- **3C.8** established `PlayerGameView` → `GameTable` mapping; chat sits **beside** that flow in `RoomView` / `GameTable`, not inside shared engine.
- **Injected claude-mem:** Epic **6A** chat/reaction work follows Charleston **disconnect** patterns for resilience — chat UI should not block on game phase.

### Git intelligence (recent)

- `feat(server): implement chat and reaction message handling` — protocol types and server path landed; client parse/send still missing.
- Prior client work: call confirmation + `useTileSelection` — follow same testing and composable style.

### Latest tech / versions

- Stack per [`project-context.md`](../project-context.md): Vue 3.5, Pinia 3, Vite 8, UnoCSS, `motion-v` optional for panel slide (CSS transitions preferred to match existing `theme.css` tokens).

### Project context reference

- [project-context.md](../project-context.md) — Three-tier state, WebSocket rules, **`v-html` ban**, `useChatStore` listed as future (this story implements it).

## Dev Agent Record

### Agent Model Used

_(filled by dev-story)_

### Debug Log References

### Completion Notes List

### File List

---

**Completion status:** Story context complete — **ready-for-dev** (second editorial pass: placeholder replacement, `MAX_CHAT_LENGTH`, lobby shell, Pinia wiring, NMJL stub required, overlay/a11y/z-index notes).

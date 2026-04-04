# Story 6A.2: Chat Panel UI (SlideInPanel)

Status: ready-for-dev

<!-- Ultimate context engine — 2026-04-04. Depends on 6A.1 protocol + server (review/done). -->

## Story

As a **player**,
I want **a chat panel that slides in from the right on desktop/iPad and slides up from the bottom on mobile, showing messages and a text input**,
so that **I can text chat with friends during all game phases without leaving the game view (FR111, UX-DR12, UX-DR28)**.

## Acceptance Criteria

1. **AC1 — SlideInPanel layout & motion:** Given the chat experience on **desktop/iPad** (`md:` breakpoint and up, aligned with `GameTable.vue`), when the chat panel opens, then it slides in from the **right** with width **~280px** over the felt. On **mobile** (`< md`), it slides **up from the bottom** as a **partial-height** panel so the **rack remains visible** (UX-DR28). Animation uses **`--timing-tactile` (120ms)** and **`--ease-tactile`** from [`packages/client/src/styles/theme.css`](../../packages/client/src/styles/theme.css).

2. **AC2 — Mutual exclusivity (shared panel state):** Given **SlideInPanel** is the shared architecture for chat (this story) and **NMJL card** (Epic 5B), when **any** slide-in reference panel opens, then **only one** `panelId` may be active at a time — opening chat **closes** NMJL and vice versa. Implement a **small Pinia store** (e.g. `useSlideInPanelStore`) with an explicit union such as `activePanel: null | "chat" | "nmjl"`. For **6A.2**, the NMJL panel may be a **stub** (no real content) as long as the store contract exists for **5B** (UX-DR12).

3. **AC3 — Reactions hidden when panel open (contract):** Given UX-DR12, when **any** SlideInPanel is open, floating reactions must hide. **6A.3** will ship `ReactionBar`; this story **must** expose a single source of truth (e.g. `isAnySlideInPanelOpen` or `activePanel !== null`) that **6A.3** can consume without duplicating logic. If ReactionBar does not exist yet, add a **documented export** from the panel store and a **short comment** in `GameTable.vue` (or adjacent) pointing to **6A.3**.

4. **AC4 — Message list:** Given `ChatBroadcast` messages (shared type [`ChatBroadcast`](../../packages/shared/src/types/protocol.ts)), when the client receives them, then the chat UI shows **playerName**, **text**, and **timestamp** in a **scrollable** list, chronological order, **newest at bottom**. **Auto-scroll** to bottom on new messages **unless** the user has scrolled up (classic “stick to bottom” behavior). Render text **only** with Vue **`{{ }}`** — **never `v-html`** (NFR48 / [`project-context.md`](../project-context.md)).

5. **AC5 — Send path:** Given the chat input, when the user presses **Enter** or taps **Send**, then the client sends `{ version, type: "CHAT", text }` over the existing WebSocket (same `PROTOCOL_VERSION` as other messages). Clear the input after send. **Do not** optimistically append the user’s own message; the server echoes via **`CHAT_BROADCAST`** to **all** sessions including sender (6A.1).

6. **AC6 — Keyboard / Escape:** Given focus in the chat input, when the user presses **Escape**, then **blur** the input and return focus to the game surface (no modal trap). Align with FR119 / UX-DR43; integrate with existing focus patterns (e.g. `MobileBottomBar` roving tabindex for bottom bar — chat toggle should participate when added).

7. **AC7 — Toggle placement:** Given **desktop/iPad**, when rendering `GameTable`, then a **tertiary**-styled chat toggle sits at the **right edge** of the table chrome (UX spec: NMJL/chat tertiary toggles). Given **mobile**, when rendering the bottom bar, then the chat toggle lives in [`MobileBottomBar.vue`](../../packages/client/src/components/game/MobileBottomBar.vue) **alongside** placeholder NMJL and A/V entries (wire chat only; others stay disabled until their epics).

8. **AC8 — Wire + parse:** Extend [`parseServerMessage.ts`](../../packages/client/src/composables/parseServerMessage.ts) to recognize **`CHAT_BROADCAST`** with required fields `playerId`, `playerName`, `text`, `timestamp` (`number`). Extend [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) to dispatch parsed chat messages into the chat store and expose **`sendChat(text: string)`** (internally `sendRaw` / same pattern as `sendGameAction`). **Optional in 6A.2:** parse **`REACTION_BROADCAST`** into a stub store or ignore with explicit `ignored` — prefer parsing if trivial so **6A.3** only adds UI.

9. **AC9 — Lobby / lifecycle:** Chat is meaningful once joined. **Minimum:** enable chat UI when `playerGameView` **or** `lobbyState` is active (players often socialize in lobby). On **`disconnect` / leave room**, **clear** chat messages and panel state so a new room does not leak prior conversation.

10. **AC10 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass ([`AGENTS.md`](../../AGENTS.md)).

### Scope boundaries

| In scope (6A.2) | Out of scope |
| ---------------- | ------------- |
| `SlideInPanel`, `ChatPanel`, chat Pinia store, parse/send wiring | **6A.3** ReactionBar, bubbles, `REACTION` send |
| Shared `activePanel` state for chat vs NMJL stub | **5B** real NMJL content |
| `CHAT_BROADCAST` client handling | **`CHAT_HISTORY`** on connect/reconnect (**6A.4**) — store design should allow bulk `setMessages` later |

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
  - [ ] 4.1 Desktop/iPad: tertiary chat toggle fixed or anchored to right edge of table grid.
  - [ ] 4.2 Mobile: add chat button to `MobileBottomBar`; opens same `ChatPanel` inside `SlideInPanel` (mobile variant = bottom sheet height ~40–50% viewport — tune so rack visible per UX).
  - [ ] 4.3 Optional: `NMJL` stub button sets `activePanel` to `nmjl` and shows empty placeholder panel to prove mutual exclusivity.

- [ ] **Task 5: Tests** (AC: 8, 10)
  - [ ] 5.1 Extend [`parseServerMessage.test.ts`](../../packages/client/src/composables/parseServerMessage.test.ts) for valid/invalid `CHAT_BROADCAST`.
  - [ ] 5.2 Store tests or component test: mutual exclusivity, append + clear, auto-scroll behavior if testable without flaky layout.

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

**Completion status:** Story context complete — **ready-for-dev**.

---
title: 'Game Architecture'
project: 'mahjong-game'
date: '2026-03-25'
author: 'Rchoi'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
engine: 'Vue 3 + Node.js (no game engine)'
platform: 'Web Browser (Desktop & Mobile)'

# Source Documents
gdd: '_bmad-output/gdd.md'
epics: '_bmad-output/epics.md'
brief: '_bmad-output/game-brief.md'
---

# Game Architecture

## Document Status

This architecture document is being created through the GDS Architecture Workflow.

**Steps Completed:** 9 of 9 (Complete)

---

## Executive Summary

Mahjong Night is a browser-based, real-time 4-player American Mahjong game built as a Vue 3 + TypeScript SPA communicating with a Node.js/Fastify/ws server via a JSON WebSocket protocol. The architecture uses a pnpm monorepo (shared/client/server) with a server-authoritative game state model, Action/State protocol (no optimistic updates), and a pure TypeScript game engine in the shared package consumed by both client and server. Key novel systems include the NMJL pattern matching engine for hand validation and a color-group-based card data schema supporting yearly card updates without code changes.

---

## Project Context

### Game Overview

**Mahjong Night** — A browser-based, real-time multiplayer American Mahjong game built around social connection. Four players create or join a private room via a shared link and play together with full NMJL rules, integrated voice/video/text communication, and zero-friction access (no downloads, no accounts required).

### Technical Scope

**Platform:** Web Browser (Desktop & Mobile responsive)
**Genre:** Tile-Based Multiplayer (American Mahjong)
**Project Level:** High complexity — real-time multiplayer with server-authoritative state, complex rule engine, WebRTC communication, and responsive SVG-based UI

### Core Systems

| System | Complexity | Description |
|---|---|---|
| Game State Machine | High | 152-tile set, command/action pattern, turn loop, seat rotation, wall management |
| NMJL Card / Pattern Matching Engine | High | ~50+ hand patterns, wildcard matching, Joker eligibility, scoring, hand guidance |
| Calling System | High | Priority resolution, call window freeze, confirmation/retraction, pattern-defined groups |
| Charleston | Moderate | 3-pass sequence with blind enforcement, optional second Charleston, courtesy pass |
| Room Management | Moderate | Room lifecycle (lobby → game → scoreboard → rematch), 4-player capacity enforcement, 5th player spectator overflow, host settings with between-game changes and notifications, host departure/migration |
| WebSocket Multiplayer | High | Server-authoritative state, real-time 4-player sync, networked turn and call window management |
| WebRTC Voice/Video | Moderate | Third-party SDK integration, TURN/STUN, permission handling, A/V reconnection |
| SVG Tile Rendering & UI | Moderate | CSS/SVG tiles, CSS custom property theming, responsive desktop/mobile layout, Three Moods visual state system (Arriving/Playing/Lingering), Celebration orchestration sequence |
| Social Systems | Moderate | Social Override (unanimous vote), Table Talk Report (majority vote), chat, reactions |
| Reconnection & Resilience | High | Phase-specific reconnection across all game states (Charleston, call window, turn), simultaneous disconnection with game pause, dead seat behavior with wall tile skipping, host migration, 5th player spectator fallback |
| Player Profiles & Stats | Low | Optional accounts (email/Google OAuth), localStorage guest tracking, stats |

**Build sequence:** The Epics document defines a phased dependency chain (Foundation → Playable Game → Complete Rules → Polish & Social) that constrains the order in which these systems are built. The architecture must respect this sequence — systems in later phases can depend on earlier ones, but not the reverse. Agents implementing any system should reference the Epics for dependency context.

### Technical Requirements

- **Browsers:** Chrome, Firefox, Safari, Edge (latest 2 versions), iOS Safari 16+, Android Chrome
- **Frame rate:** 60fps target, 30fps floor on low-end mobile with WebRTC active
- **Load time:** <3s broadband, <5s 3G; <2s room join to first interaction
- **Bundle size:** <5MB excluding WebRTC SDK; SVG tile set ~200KB
- **Latency:** 200ms round-trip acceptable for turn-based play
- **Networking:** WebSocket for game state, WebRTC (third-party SDK) for voice/video
- **Server model:** Authoritative game state in memory, no durable persistence for MVP
- **Rendering:** CSS/SVG-first, no heavy game engine. CSS transitions for animations
- **Accessibility:** Semantic HTML, ARIA labels, keyboard navigation, 44px tap targets, prefers-reduced-motion, WCAG AA target

### Architectural Constraints

1. **Command/Action pattern (hard requirement):** All game state mutations occur via validated action dispatch — never direct manipulation. This is foundational from Epic 1 and is what enables the server-authoritative model in Epic 4A without a rewrite. The client submits actions, the engine validates, and returns new state.

2. **Client-Server API layer separation (hard requirement):** The GDD explicitly mandates that game state management and the API layer are designed with client-server separation from day one to support a post-MVP native iOS client. The browser client must communicate with the game server through a clean, well-defined API boundary — not through tight coupling to browser-specific state or rendering. This constraint affects every system that touches client-server communication: game actions, room management, chat, and presence.

3. **Exhaustive pattern matching test suite (hard requirement):** The NMJL Pattern Matching Engine must ship with a dedicated test suite covering all ~50+ hand patterns, wildcard edge cases, Joker substitution at every eligible position, concealed/exposed mixing, and ambiguous pattern rulings. Rule accuracy is a zero-tolerance success criterion per the GDD — this test suite is an architectural requirement, not a QA nice-to-have.

4. **Deterministic state machine composition (hard requirement):** The game operates through at least three interacting state machines — game-level (lobby → Charleston → play → scoreboard → rematch), turn-level (draw → evaluate → discard → call window → resolve), and call window (open → freeze → confirm/retract → resolve). These overlap and interact (e.g., reconnection during a frozen call window). Given a specific game state, an action must always produce the same deterministic result. The architecture must support testing these state machines both in isolation and in composition — this is essential for correctness in a rules-zero-tolerance game.

### State Ownership

Server-authoritative state covers all game-critical data: wall contents, player racks (hidden from other clients), exposed groups, discard pools, scores, turn state, call window state, room state, and chat history. The server validates every action before applying it — clients cannot directly mutate game state.

Client-only state includes: rack tile arrangement (drag-and-drop ordering), UI preferences, NMJL card display position/scroll, chat message drafts, and hand guidance hint computation. **Client-only state does not survive reconnection** — this is an accepted trade-off. The Sort button provides a quick recovery path for rack arrangement after reconnect.

**Hand guidance computation runs on the client.** The pattern matching engine exists as a shared module used for Mahjong validation on the server and hand guidance on the client. Running hints client-side avoids per-player-per-turn server load and provides zero-latency feedback. The client has everything it needs: the player's rack and the card data.

**NMJL card data loads at game start, not mid-session.** A game in progress never sees the card change underneath it. New card data takes effect on the next game creation. This avoids mid-game validation inconsistencies.

### Deployment Model

**MVP targets single-server deployment.** All rooms run in a single server process. Expected concurrent load for soft launch is 5-10 rooms — well within the capacity of a single process handling small state objects with infrequent mutations (one action every few seconds per room). Room state is partitionable by room ID if horizontal scaling is needed post-MVP, but no scaling infrastructure is built for MVP.

### Protocol Design

**JSON over WebSocket.** For a turn-based game with small state deltas every few seconds, JSON's debuggability in browser devtools outweighs any size advantage of binary protocols. Essential for a solo developer's debugging workflow.

**Version field in every message from day one.** Costs nothing now, prevents a painful migration when the native iOS client arrives post-MVP. Messages with an unrecognized `version` value are rejected with `{ code: 'UNSUPPORTED_VERSION' }` — the server does not attempt to interpret unknown protocol versions. No formal protocol specification document — **shared TypeScript type definitions between client and server ARE the protocol spec.** This keeps the spec in sync with the implementation by construction.

**Message size limit:** WebSocket server configured with `maxPayload: 64KB`. Messages exceeding this are dropped by `ws` before reaching the handler. Prevents memory exhaustion from oversized payloads. Exception: `CHAT_HISTORY` messages on connect/reconnect may exceed 64KB — the server sends these on the raw `ws` instance before the payload limit middleware, or the limit is raised to 128KB to accommodate the history buffer. See Decision 2 chat history notes.

**Heartbeat:** Server sends WebSocket `ping` frames every 15 seconds. Clients respond with `pong` automatically (browser WebSocket and `ws` handle this at the protocol level — no application code needed on the client). If the server receives no `pong` within 30 seconds (2 missed pings), it considers the connection dead, closes the socket, and starts the grace period (Decision 7). This ensures dead connections (mobile network switch, laptop sleep, silent TCP death) are detected within 30 seconds rather than waiting for the next send attempt to fail.

### Security Model

The server-authoritative model with action validation provides inherent anti-cheat. Every client action is validated by the server before being applied to game state. Invalid actions are rejected — clients cannot manipulate the game.

**Information boundary:** Clients receive only their own hidden tiles and publicly visible game state (exposed groups, discard pools, wall count, scores, turn state). Opponent rack data is never transmitted to other clients. There is nothing to "cheat" by inspecting WebSocket traffic because the server never sends hidden information.

**Player identity enforcement:** The server always overwrites `playerId` on incoming actions with the session-authenticated player ID. Client-provided `playerId` fields are ignored — this prevents a client from spoofing actions on behalf of another player.

**Room access:** UUID-based room codes in the URL are sufficient for MVP. These are private games between friends — the room code is effectively a shared secret. No additional authentication layer for room access.

### Complexity Drivers

**High Complexity:**
1. **NMJL Pattern Matching Engine** — The single most complex system. Must validate ~50+ hand patterns with any-suit wildcards, mixed-tile groups (NEWS, Dragon sets), Joker eligibility per group position, and concealed/exposed requirements. Powers four subsystems: Mahjong validation, hand guidance hints, Joker exchange validation, and scoring.
2. **Calling System** — Simultaneous multi-player call resolution with window freeze mechanics, seat-position priority, Mahjong override, confirmation/retraction phases, and support for pattern-defined groups beyond standard same-tile groups.
3. **Server-Authoritative Multiplayer** — Real-time 4-player sync with room lifecycle, turn management over network, call window freeze/resolve synced across all clients, and reconnection with full game state restore across all game phases.
4. **Reconnection & Resilience** — Full state recovery system that must handle reconnection during every game phase (Charleston passes, call window, active turn), simultaneous multi-player disconnection with game pause, dead seat conversion with wall tile skipping, and host migration — each with distinct behavior and edge cases.

**UI Complexity Notes:**
- **Three Moods visual state system** — The UI manages three distinct visual environments (Arriving/Playing/Lingering) with gentle crossfade transitions, independent of game state transitions. The lobby, active game, and scoreboard are not just different screens — they are different visual atmospheres built from the same palette with different emphasis. This drives frontend state management decisions.
- **Celebration sequence** — A multi-step orchestrated sequence (dim other areas, held beat pause, hand fan-out animation, winner spotlight, scoring overlay) layered on top of the live game UI. This is effectively a mini cinematics system that must coordinate timing, opacity, layout changes, and audio — non-trivial UI orchestration.
- **NMJL Card Display** — Not a static reference panel. The card is an always-visible sidebar (desktop) or quick-toggle overlay (mobile) that re-computes on every draw/discard via the Pattern Matching Engine. The hand guidance system renders directly onto this component — highlighting achievable hands ranked by closeness, fading impossible ones, hiding eliminated ones. This is a live, reactive UI element with a direct dependency on the most complex backend system in the game.

**Novel Concepts Requiring Custom Patterns:**
1. **Updatable NMJL card system** — Runtime-loadable JSON card data, swappable yearly without code changes
2. **Hand guidance hint system** — Real-time pattern proximity ranking displayed on the card, auto-disabling after 3 completed games (localStorage-tracked)
3. **Social governance mechanics** — Social Override (unanimous vote undo) and Table Talk Report (majority vote dead hand) that digitize in-person social dynamics
4. **Blind pass enforcement** — Charleston UI must lock tile selection before revealing received tiles from the Across pass

### Technical Risks

1. **WebRTC cross-browser reliability** — Voice/video behavior varies significantly across browsers and devices, especially iOS Safari. Mitigated by using a proven third-party SDK and making WebRTC the explicit cut-line feature.
2. **NMJL card copyright** — Legal uncertainty around encoding copyrighted card hand data. May require a "bring your own card" input model.
3. **Solo developer scope** — Game engine + multiplayer + WebRTC + responsive UI is ambitious for one developer. Mitigated by phased delivery, Claude Code augmentation, and the WebRTC cut line.
4. **Target demographic friction** — Primary audience (40-70+, non-gamers) has low tolerance for technical issues. Browser permission handling for mic/camera must be carefully guided.
5. **No durable persistence** — Server restart loses all active games. Acceptable for MVP but creates fragility during early deployment. Additionally, ephemeral game state means **no replay or game log capability** — if a player reports a rule-accuracy bug in production, there is no server-side record to review. Consider lightweight action logging (even if not persisted durably) as a debugging aid.
6. **Call window network synchronization** — The call window system requires fairness guarantees across 4 networked clients with 50-200ms latency variance. The window must freeze for all players simultaneously when any call is clicked, confirmation must run within the frozen window, retraction must reopen for remaining time, and the server must resolve all calls at window close using seat position — not click timing. Ensuring deterministic, fair resolution when clients experience different network conditions is a real-time synchronization challenge that needs careful server-side design (server timestamps as source of truth, not client-reported timing).

---

## Engine & Framework

### Selected Engine

**No traditional game engine.** Mahjong Night is a web application with game logic, not a game rendered in a game engine. The GDD specifies CSS/SVG-first rendering with no heavy game engine. All rendering uses standard DOM/SVG elements with CSS transitions, providing browser-native accessibility (ARIA, keyboard nav, semantic HTML) for free.

**Rationale:** The game is tile cards on a table — DOM elements handle this beautifully with zero canvas overhead. A canvas-based engine (Phaser, PixiJS) would mean rebuilding accessibility from scratch and fighting the browser instead of leveraging it.

### Core Stack

*Library inventory — what we're using, what version, and why it was chosen.*

*Versions below are major version constraints. Patch versions are illustrative as of 2026-03-25 — let `package.json` pin exact versions at install time.*

| Layer | Library | Version | Rationale |
|---|---|---|---|
| Frontend framework | Vue 3 + TypeScript | ^3.5 | Reactive model fits live game UI; Composition API with `<script setup>` is clean, testable, and TypeScript-native |
| Build tool | Vite | ^8.0 | Rolldown-powered builds (10-30x faster), native TypeScript, excellent Vue integration |
| Client state | Pinia | ^3.0 | Lightweight, TypeScript-native, Vue-official. For UI-only state — rack arrangement, preferences, hint/audio settings |
| CSS | UnoCSS | ^66.0 | Utility-first, on-demand atomic CSS, ~100x faster than Tailwind in dev. CSS custom properties for theming/moods/dark mode |
| Composables | VueUse | ^14.0 | 200+ composables: useWebSocket, useLocalStorage, useMediaQuery, usePermission, useElementSize |
| Drag-and-drop | Vue DnD Kit | ^2.0 | Composable-based, zero dependencies, built-in keyboard/screen reader accessibility, Vue 3 native |
| Animation | Motion for Vue (motion-v) | ^2.0 | 5KB, declarative `<motion />` component, timeline/sequence API for orchestrated animations, springs, hardware-accelerated transforms, native prefers-reduced-motion support, MIT licensed |
| Client routing | Vue Router | ^4.0 | Minimal usage — `/room/:id` for URL-based room joining, lobby vs game view |
| Server runtime | Node.js 22 LTS | 22.x | Active LTS (maintenance until April 2027). Pinned via `.nvmrc` and `package.json` engines field. Node 20 enters maintenance April 2026 and EOL October 2026 — not suitable for a new project. |
| HTTP layer | Fastify | ^5.0 | Fast, TypeScript-native, for room creation endpoints and health checks |
| WebSocket | ws | ^8.0 | Lightweight, no magic, full protocol control. 28K+ dependents — battle-tested |
| Unit/integration testing | Vitest | ^4.0 | Vite-integrated, stable Browser Mode, Jest-compatible API |
| E2E testing | Playwright | ^1.58 | Multi-client browser testing for 4-player multiplayer flows |
| WebRTC SDK (cut-line) | LiveKit | ^2.18 (client) | Open-source, self-hostable, solid JS SDK. No Vue-specific SDK — build composables around livekit-client |
| Package manager | pnpm | latest | Fast, strict dependency resolution, workspace support |

### Project Structure

**pnpm workspace monorepo** with three packages:

```
mahjong-game/
  packages/
    shared/     # TypeScript types, game state machine, pattern matching engine, tile definitions
    client/     # Vue 3 SPA (Vite + UnoCSS + Pinia + Vue Router)
    server/     # Node.js + Fastify + ws
  .nvmrc        # Node 22 LTS
  pnpm-workspace.yaml
```

- **shared/** — All pure game logic lives here. No browser or Node.js API dependencies. Imported by both client and server. The pattern matching engine runs server-side for Mahjong validation and client-side for hand guidance hints. **Consumed via source imports — no build step.** Vite resolves workspace packages to TypeScript source directly for the client; the server runs via `tsx` which handles TypeScript transparently. Move to a pre-built strategy only if a concrete problem arises (e.g., server startup degradation). **Has its own `vitest.config.ts` and independently runnable test suite** — the pattern matching engine and game state machine are the most critical systems and must be testable in isolation, decoupled from any browser or server runtime.
- **client/** — Vue 3 SPA consuming game state via WebSocket. Pinia manages client-only UI state (rack arrangement, preferences, hint/audio settings). No SSR, no meta-framework.
- **server/** — Fastify for HTTP endpoints (room creation, health). ws for WebSocket game state sync. Server-authoritative — validates all actions before applying. Runs via `tsx` for native TypeScript execution.
- **Root-level testing:** `pnpm -r test` runs all three packages' test suites in sequence. CI pipeline uses this single command to catch failures in shared logic, client components, and server handlers.

**Why not a meta-framework (Nuxt)?** The app is a SPA connecting to a WebSocket server. No SEO, no SSR, no dynamic pages. The API layer separation constraint requires an independently deployable server for the future iOS client — coupling it to a frontend framework's server runtime creates exactly the tight binding we're avoiding.

### Client State Architecture

**Game state and UI state are separated by design:**

- **Game state** flows through a `useGameState` composable — not Pinia. This composable wraps VueUse's `useWebSocket`, parses incoming server messages, and exposes reactive game state via `ref`/`reactive`. Game state is transient server-pushed data that exists for the duration of a WebSocket connection and is replaced wholesale on every server update. It does not need store persistence, devtools inspection, or Pinia's patterns. **Data flow: server → WebSocket → useGameState composable → Vue components.** One-directional, no ambiguity.

- **UI state** lives in Pinia stores. This includes rack tile arrangement (drag-and-drop ordering), user preferences (font size, audio settings, dark mode override), hand guidance toggle, and any client-local state that needs to survive component unmounts. Pinia's devtools integration and persistence patterns serve this well.

This separation ensures implementing agents know exactly where data comes from: if it's game-critical, it's from the composable (and ultimately from the server). If it's UI-local, it's from Pinia.

### Engine-Provided Architecture

*Responsibility mapping — what problem each component solves and which library provides the solution.*

| Component | Solution | Provided By |
|---|---|---|
| Rendering | DOM/SVG + CSS transitions | Browser native |
| Reactivity | Vue 3 Composition API | Vue |
| Client routing | Vue Router (`/room/:id`) | Vue Router |
| Client state (UI) | Pinia stores | Pinia |
| Client state (game) | useGameState composable | Custom + VueUse |
| Styling | Utility classes + CSS custom properties | UnoCSS |
| Drag-and-drop | Composable-based DnD | Vue DnD Kit |
| WebSocket client | useWebSocket composable | VueUse |
| Animation (default) | `<motion />` component + CSS custom properties | Motion for Vue |
| Animation (Celebration) | Motion timeline/sequence API | Motion for Vue |
| Animation (Three Moods) | Motion layout animations with opacity/color shifts | Motion for Vue |
| HTTP server | Route handlers, validation, serialization | Fastify |
| WebSocket server | Raw WebSocket with custom room/message layer | ws |
| Testing (unit) | Component + logic testing with Browser Mode | Vitest |
| Testing (E2E) | Multi-browser, multi-client flows | Playwright |
| Accessibility | Semantic HTML, ARIA, keyboard nav | Browser native + Vue DnD Kit |

### Animation Architecture

Motion for Vue provides a unified animation approach across the entire project:

- **Default interactions** (tile draw, discard, rack snap, panel open/close) use the declarative `<motion />` component with CSS-driven values.
- **Celebration sequence** (dim → held beat → fan-out → spotlight → scoring overlay) uses Motion's timeline/sequence API for structured multi-step orchestration.
- **Three Moods transitions** (Arriving → Playing → Lingering) use Motion layout animations with opacity and color property shifts — not separate CSS crossfades. This keeps all animation logic in one system instead of splitting between Motion for interactions and raw CSS for mood transitions.
- **Reduced motion:** Motion for Vue respects `prefers-reduced-motion` natively — animations collapse to instant state changes without manual wiring.

The 5KB cost is justified by eliminating ad-hoc setTimeout/Promise chains and giving implementing agents a single, consistent animation API for every animation in the game.

### Remaining Architectural Decisions

The following decisions must be made explicitly (covered in subsequent steps):

1. **Game state machine design** — State shape, action types, reducer/handler pattern
2. **WebSocket protocol** — Message types, versioning, error handling (TypeScript types as spec)
3. **Room lifecycle** — Creation, joining, seat assignment, host migration, cleanup
4. **Session/identity management** — Session token strategy for mapping WebSocket connections to players. Required for reconnection (player rejoins with same token to resume their seat), for preventing duplicate sessions (one player, one seat, one connection), and as the foundation for the optional auth layer in Epic 8. Generated on room join, stored in sessionStorage, sent on WebSocket connect.
5. **NMJL card data schema** — JSON structure for ~50+ hand patterns
6. **Pattern matching algorithm** — How the engine validates hands against the card
7. **Call window synchronization** — Server-side timing, freeze/resolve across clients
8. **Reconnection strategy** — State snapshot, phase-specific resume, grace periods
9. **Project file structure** — Directory organization within each package
10. **Error handling patterns** — Client-server error flow, user-facing error UX
11. **Deployment architecture** — Hosting, CI/CD, environment management

---

## Architectural Decisions

### Decision Summary

*All decisions verified and documented with rationale as of 2026-03-25.*

| # | Category | Decision | Rationale |
|---|---|---|---|
| 1 | Game State Machine | Pure TypeScript engine in shared/ with action handlers + ~5-6 Pinia stores for client UI | Vue-native patterns, testable in isolation, clean separation of server-authoritative vs client-local state |
| 2 | WebSocket Protocol | Action/State — client sends actions, server broadcasts per-recipient filtered full state | Zero sync bugs, reconnection for free, trivial client implementation, spectator mode is just another view filter |
| 3 | Session Identity | Server-generated UUID in sessionStorage | Tab-scoped lifecycle matches game session, refresh preserves session, tab close = departure, clean auth upgrade path |
| 4 | Room Lifecycle | HTTP create (Fastify) + WebSocket join, short room codes | API layer separation, human-friendly codes for sharing, REST endpoint works for future native clients |
| 5 | NMJL Card Schema | JSON with color-group suit abstraction, value wildcards, per-group Joker/concealed encoding | Matches how the physical card works (colors = suit relationships), handles all pattern types, yearly swappable |
| 6 | Call Window Sync | Server-timed window with client freeze broadcast | Freeze is UX, not fairness — priority resolved by seat position server-side. Pass tracking for early close. |
| 7 | Reconnection | Session token + full state resend, phase-specific grace period fallbacks | Same protocol as initial join. Full-state model means no sync problem on reconnect. |

### Decision 1: Game State Machine

**Approach:** Pure TypeScript game engine in `shared/` package, consumed by both server and client.

**Engine design:**
- State object with a `gamePhase` discriminator that gates which actions are valid
- Action handler functions that validate, mutate state, and return a result: `handleAction(state, action) → ActionResult`
- `ActionResult` contains: `{ accepted: boolean, reason?: string, resolved?: ResolvedAction }` — enables clean test assertions without state snapshotting, and provides the rejection path for invalid actions
- Three composed state machines managed via phase discrimination:
  - **Game-level:** lobby → charleston → play → scoreboard → rematch
  - **Turn-level:** draw → evaluate → discard → callWindow → resolve
  - **Call window:** open → frozen → confirm/retract → resolve
- No framework dependency in shared/ — pure TypeScript, testable with plain Vitest

**Action handler convention — validate-then-mutate:**

Every action handler MUST follow this pattern: validate all preconditions (read-only) before any state mutation. If validation fails, return a rejection result with zero mutations applied. Mutations only execute after all validation passes.

```typescript
function handleDiscard(state: GameState, action: DiscardAction): ActionResult {
  // 1. Validate (read-only — no mutations above this line)
  if (state.currentTurn !== action.playerId) {
    return { accepted: false, reason: 'NOT_YOUR_TURN' }
  }
  if (!playerHasTile(state, action.playerId, action.tileId)) {
    return { accepted: false, reason: 'TILE_NOT_IN_RACK' }
  }

  // 2. Mutate (only reached if all validation passed)
  removeTileFromRack(state, action.playerId, action.tileId)
  addToDiscardPool(state, action.playerId, action.tileId)
  openCallWindow(state, action.tileId, action.playerId)

  // 3. Return result
  return {
    accepted: true,
    resolved: { type: 'DISCARD_TILE', playerId: action.playerId, tile: action.tileId }
  }
}
```

This convention ensures rejected actions never leave state in a partially mutated condition. No copy-on-write library needed — the validate-first pattern is enforced by developer discipline and verified by the test suite. If an action handler throws mid-mutation, that is a bug in the handler caught by testing, not an architectural gap.

**Concurrency model:** Node's single-threaded event loop guarantees that WebSocket messages for a given room are processed sequentially — one `handleAction` call completes before the next begins. Do not introduce worker threads, async operations between validation and mutation, or any pattern that breaks this sequential guarantee. If a future optimization requires async action handling, copy-on-write state must be introduced first.

**Client-side state architecture:**

| Store/Composable | Responsibility | Persistence |
|---|---|---|
| `useGameState` composable | Server-pushed game state via WebSocket. Reactive, replaced on each update. | None — transient |
| `usePreferencesStore` (Pinia) | Font size, audio volumes, dark mode override, hint toggle | localStorage |
| `useRackStore` (Pinia) | Tile arrangement order, sort state | None — lost on reconnect (Sort button recovery) |
| `useAudioStore` (Pinia) | Playback state, channel management, mute states | Partial (mute prefs to localStorage) |
| `useChatStore` (Pinia) | Messages, draft, panel open/closed state | None — chat history from server on reconnect |
| `useConnectionStore` (Pinia) | WebSocket status, session token, reconnection state | sessionStorage (token only) |
| `useHandGuidanceStore` (Pinia) | Computed hint results derived from game state + preferences | None — recomputed on change |

**Data flow:** Server → WebSocket → `useGameState` composable → Vue components read reactive state. Player actions flow back: component → action dispatch → WebSocket → server validates → new state broadcast.

### Decision 2: WebSocket Protocol

**Approach:** Action/State model. Clients send typed actions, server validates and broadcasts filtered state.

**Client → Server:**
```typescript
interface ClientMessage {
  version: 1
  type: 'ACTION' | 'CHAT' | 'REACTION'
  token: string
}

interface ActionMessage extends ClientMessage {
  type: 'ACTION'
  action: GameAction
}

interface ChatMessage extends ClientMessage {
  type: 'CHAT'
  text: string
}

interface ReactionMessage extends ClientMessage {
  type: 'REACTION'
  emoji: string
}

type GameAction =
  | { type: 'DRAW_TILE' }
  | { type: 'DISCARD_TILE'; tileId: string }
  | { type: 'CALL_PUNG'; tileIds: string[] }
  | { type: 'CALL_KONG'; tileIds: string[] }
  | { type: 'CALL_MAHJONG'; tileIds: string[] }
  | { type: 'PASS_CALL' }
  | { type: 'CONFIRM_CALL'; exposedTileIds: string[] }
  | { type: 'RETRACT_CALL' }
  | { type: 'DECLARE_MAHJONG' }
  | { type: 'CANCEL_MAHJONG' }
  | { type: 'CHARLESTON_PASS'; tileIds: string[] }
  | { type: 'CHARLESTON_VOTE'; accept: boolean }
  | { type: 'COURTESY_PASS'; count: number; tileIds: string[] }
  | { type: 'JOKER_EXCHANGE'; jokerGroupId: string; naturalTileId: string }
  | { type: 'START_GAME' }
  | { type: 'REMATCH' }
  | { type: 'SOCIAL_OVERRIDE_REQUEST'; description: string }
  | { type: 'SOCIAL_OVERRIDE_VOTE'; approve: boolean }
  | { type: 'TABLE_TALK_REPORT'; description: string }
  | { type: 'TABLE_TALK_VOTE'; approve: boolean }
  | { type: 'SHOW_HAND' }
```

**Server → Client:**
```typescript
type ServerMessage =
  | StateUpdate
  | ServerError
  | SystemEvent
  | ChatBroadcast
  | ReactionBroadcast
  | ChatHistory

interface StateUpdate {
  version: 1
  type: 'STATE_UPDATE'
  state: PlayerGameView
  resolvedAction?: ResolvedAction
}

type ResolvedAction =
  | { type: 'DRAW_TILE'; playerId: string }
  | { type: 'DISCARD_TILE'; playerId: string; tileId: string }
  | { type: 'CALL_PUNG'; playerId: string; calledTileId: string; exposedTileIds: string[]; fromPlayerId: string }
  | { type: 'CALL_KONG'; playerId: string; calledTileId: string; exposedTileIds: string[]; fromPlayerId: string }
  | { type: 'CALL_MAHJONG'; playerId: string; calledTileId: string; exposedTileIds: string[]; fromPlayerId: string }
  | { type: 'SELF_DRAWN_MAHJONG'; playerId: string }
  | { type: 'PASS_CALL'; playerId: string }
  | { type: 'CALL_WINDOW_OPENED'; discardedTileId: string; discarderId: string }
  | { type: 'CALL_WINDOW_FROZEN'; callerId: string }
  | { type: 'CALL_WINDOW_CLOSED' }
  | { type: 'CHARLESTON_PASS'; playerId: string; direction: 'right' | 'across' | 'left' }
  | { type: 'CHARLESTON_RECEIVED'; playerId: string; direction: 'right' | 'across' | 'left' }
  | { type: 'CHARLESTON_PHASE_COMPLETE'; phase: 1 | 2 | 'courtesy' }
  | { type: 'JOKER_EXCHANGE'; playerId: string; jokerGroupId: string; naturalTileId: string }
  | { type: 'GAME_STARTED' }
  | { type: 'MAHJONG_DECLARED'; winnerId: string; patternId: string; patternName: string; points: number; selfDrawn: boolean; discarderId?: string }
  | { type: 'WALL_GAME' }
  | { type: 'SHOW_HAND'; playerId: string }
  | { type: 'SOCIAL_OVERRIDE_APPROVED'; description: string }
  | { type: 'TABLE_TALK_DEAD_HAND'; playerId: string }
  | { type: 'PLAYER_JOINED'; playerId: string; playerName: string }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'PLAYER_RECONNECTED'; playerId: string }
  | { type: 'HOST_PROMOTED'; playerId: string }

interface ServerError {
  version: 1
  type: 'ERROR'
  code: string          // 'INVALID_ACTION' | 'NOT_YOUR_TURN' | 'INVALID_CALL' | etc.
  message: string       // human-readable description
  rejectedAction?: string // the action type that was rejected
}

interface ChatBroadcast {
  version: 1
  type: 'CHAT'
  playerId: string
  playerName: string
  text: string
  timestamp: number
}

interface ReactionBroadcast {
  version: 1
  type: 'REACTION'
  playerId: string
  emoji: string
  timestamp: number
}

interface ChatHistory {
  version: 1
  type: 'CHAT_HISTORY'
  messages: ChatBroadcast[]
}

interface PlayerGameView {
  roomId: string
  roomCode: string
  gamePhase: GamePhase
  players: PlayerPublicInfo[]
  myPlayerId: string
  myRack: Tile[]
  exposedGroups: ExposedGroup[][]
  discardPools: Tile[][]
  wallRemaining: number
  currentTurn: string
  callWindow?: CallWindowState
  charleston?: CharlestonState
  scores: Record<string, number>
  mahjongResult?: MahjongResult
}

interface MahjongResult {
  winnerId: string | null       // null = wall game (draw)
  winningHand: Tile[]           // empty array on draw
  patternId: string             // 'WALL_GAME' on draw
  patternName: string           // 'Wall Game' on draw
  points: number                // 0 on draw
  selfDrawn: boolean
  discarderId?: string
  payments: Record<string, number>  // all zeros on draw
}
```

**Type safety note:** `ResolvedAction` is a fully-specified discriminated union. Each variant carries only the fields relevant to that action type. The union above is the architectural contract — client components switch on `resolvedAction.type` to trigger animations, audio, and UI transitions. New action types may be added during implementation, but existing variants should not change shape without updating all consumers.

**Message channels:**
- **STATE_UPDATE** — Game state changes only. Triggered by game actions. Contains `resolvedAction` for animation context.
- **CHAT / REACTION** — Social messages. Separate channel, not embedded in state updates. Accumulate in `useChatStore` on the client.
- **CHAT_HISTORY** — Sent once on connect/reconnect. Full chat log for the session.
- **ERROR** — Sent only to the client that submitted an invalid action. Contains typed error code and human-readable message.

**Chat history:** Server retains the last 100 messages per room in memory (cap reduced from 200 to stay within the WebSocket `maxPayload` budget — 100 messages × 500 char max ≈ 50KB plus JSON overhead, safely under 64KB). On connect/reconnect, `CHAT_HISTORY` delivers this buffer. Older messages are discarded on insertion (ring buffer or shift). No pagination, no persistent storage. If the serialized `CHAT_HISTORY` message still exceeds `maxPayload` (e.g., many max-length messages with long display names), the server truncates from the oldest end until it fits.

**Reactions:** Fire-and-forget. Server broadcasts `REACTION` to connected clients immediately. No storage, no history, no replay on reconnect. A reconnecting player sees new reactions going forward only.

**View filtering:** Server builds per-recipient views before sending:
- `buildPlayerView(state, playerId)` — includes player's own rack, hides others
- `buildSpectatorView(state)` — public information only, no racks (post-MVP)

**View filtering test requirement (hard requirement):** `state-broadcaster.test.ts` must include explicit tests verifying the information boundary: for each player, assert that no other player's rack tiles appear in their `PlayerGameView`. This is the sole mechanism preventing data leakage — it must be tested directly, not assumed correct by construction.

**SHOW_HAND:** Valid only during scoreboard phase. When a player sends `SHOW_HAND`, the server broadcasts their full rack to all clients via `STATE_UPDATE`. This allows players to share their hands after a game ends — a common social ritual in Mahjong. No game state mutation; purely informational.

**Rejected action flow:** Server validates every action. If invalid, server sends `ERROR` to the offending client only — no state change, no broadcast to others. The client's error handling shows a subtle indicator (toast or sound) without modal interruption.

**No optimistic updates (hard rule):** The client renders game state ONLY from `STATE_UPDATE` messages — never from local prediction or optimistic UI. When a player clicks "Discard," the tile does not move until the server confirms. At <200ms latency with 15-30 second turns, the delay is imperceptible. This eliminates all client-server consistency bugs and simplifies every Vue component — they are pure renderers of server-confirmed state, never speculative. The only exception is client-only state in Pinia stores (rack arrangement, UI preferences) which is not server-authoritative by definition.

### Decision 3: Session Identity

**Approach:** Server-generated UUID token stored in sessionStorage.

**Flow:**
1. Player joins room → server generates UUID token → sends to client in first `STATE_UPDATE`
2. Client stores token in sessionStorage
3. All subsequent WebSocket connections include the token
4. Server maps token → playerId → seat

**Rules:**
- One active connection per token. Second connection with same token disconnects the first (handles tab duplication). The first connection receives a `SYSTEM_EVENT` with `{ type: 'SESSION_SUPERSEDED' }` before disconnect so the UI can show "Connected in another tab" rather than triggering reconnection.
- Token scoped to browser tab via sessionStorage. Tab close clears token = player departure.
- Browser refresh preserves sessionStorage = seamless reconnection.
- Token has no expiry — valid as long as the room exists. Room cleanup garbage-collects tokens.
- **Player IDs are stable per-room.** A reconnecting player receives their original `playerId` (e.g., `player-2`) via token lookup — never a new ID. Seat assignment is permanent for the room's lifetime.
- **Token delivery failure and recovery:** If the WebSocket drops before the client stores the token from the first `STATE_UPDATE`, the player must reconnect without a token. The server supports a **grace-period recovery mechanism**: when a tokenless client connects to a room where a seat is held in grace period, the server matches by `displayName + roomCode`. If exactly one disconnected seat matches, the server reissues the token and restores the player to their seat. If multiple seats match (unlikely — same display name), the server rejects and asks the player to retry after the ambiguity resolves. If the grace period has expired, the seat is released and the player joins as a new participant (if a seat is available). This prevents a network blip during initial connection from permanently locking a player out of a 4-seat game.

**Auth upgrade path (Epic 8):** When optional accounts exist, authenticated users receive a token tied to their account ID. Guest users continue to receive anonymous tokens. Same mechanism, different token origin.

### Decision 4: Room Lifecycle

**Approach:** HTTP for room creation and status checks, WebSocket for everything after joining.

**Endpoints:**
- `POST /api/rooms` — Creates room. Body: `{ hostName, settings? }`. Returns: `{ roomId, roomCode, roomUrl, hostToken }`.
- `GET /api/rooms/:code/status` — Returns room capacity and phase without WebSocket. Used by 5th player check.

**Room codes:** 6 alphanumeric characters (e.g., `MHJG7K`). Human-friendly for sharing over text/voice. Mapped to internal room ID on server.

**Lifecycle:**
```
POST /api/rooms → room created, host gets token + URL
Host shares URL
Players click URL → SPA loads → WebSocket connect(roomCode, displayName)
Server assigns seat → sends token + lobby state
  (repeat until 4 players)
Host sends START_GAME → Charleston phase begins
  ... game plays ...
Mahjong declared → scoreboard phase
Host sends REMATCH → dealer rotates, new game, same room
  OR all disconnect → room garbage collected
```

**Room cleanup triggers:**
- All players disconnected, no reconnection within 2 minutes
- Post-game idle (no rematch) for 5-10 minutes
- Abandoned room (host created but no one joined) after 30 minutes

**Host migration:** If the host disconnects permanently (grace period expires), the server assigns host to the next connected player in seat order. The new host receives `SYSTEM_EVENT` with `{ type: 'HOST_PROMOTED' }`. All clients receive updated `PlayerPublicInfo` reflecting the new host. The new host can change settings and start/rematch games.

**START_GAME preconditions:** Server validates before accepting: (1) sender is the host, (2) exactly 4 players are connected, (3) game phase is `lobby`. Violations return `{ accepted: false, reason: 'NOT_HOST' | 'NOT_ENOUGH_PLAYERS' | 'WRONG_PHASE' }`.

**REMATCH preconditions:** Server validates: (1) sender is the host, (2) all 4 seats have connected players, (3) game phase is `scoreboard`. If players left between games, the remaining players return to lobby phase to wait for a 4th.

**5th player:** `GET /api/rooms/:code/status` returns `{ full: true }` when 4 players are seated, or `{ error: 'ROOM_NOT_FOUND' }` (404) for unknown room codes. Client shows "This table is full" without attempting WebSocket. Spectator mode (post-MVP) connects WebSocket with `{ role: 'spectator' }` and receives `buildSpectatorView`.

### Decision 5: NMJL Card Data Schema

**Approach:** JSON schema with color-group suit abstraction matching how the physical NMJL card works.

**Core concepts:**
- **Color groups (A/B/C):** Same letter = same suit, different letter = different suit. Player chooses which actual suits (Bam/Crak/Dot) map to each letter.
- **Value wildcards:** `"N"` = any number (1-9). `"N+1"`, `"N+2"` = consecutive relative to N. Exact numbers where the card specifies them.
- **Non-suited tiles:** Flowers (`"category": "flower"`), Winds (`"category": "wind"`), Dragons (`"category": "dragon"`) exist outside the color-suit system.
- **Per-group encoding:** Each group specifies type (single/pair/pung/kong/quint/sextet/news/dragon_set), tile requirement, Joker eligibility, and concealed/exposed requirement.

**Schema types:**
```typescript
interface NMJLCard {
  year: number
  categories: CardCategory[]
}

interface CardCategory {
  name: string
  hands: HandPattern[]
}

interface HandPattern {
  id: string
  name?: string
  points: number
  exposure: 'X' | 'C'
  groups: GroupPattern[]
}

interface GroupPattern {
  type: 'single' | 'pair' | 'pung' | 'kong' | 'quint' | 'sextet' | 'news' | 'dragon_set'
  tile?: TileRequirement
  jokerEligible: boolean
  concealed?: boolean
}

interface TileRequirement {
  color?: string            // "A", "B", "C"
  value?: number | string   // exact number, or "N", "N+1", "N+2"
  category?: 'flower' | 'wind' | 'dragon'
  specific?: TileSpecific
}

type TileSpecific =
  | 'north' | 'south' | 'east' | 'west'       // specific wind
  | 'red' | 'green' | 'soap'                   // specific dragon
  | 'any'                                       // any tile in the category
  | `any_different:${number}`                   // Nth distinct tile (for mixed sets)
```

**Systems powered by this schema:**
1. **Mahjong validation** — Does a player's tiles match any hand on the card?
2. **Hand guidance hints** — Which hands are still achievable? Ranked by closeness.
3. **Joker exchange validation** — Can this natural tile replace a Joker in this exposed group?
4. **Scoring** — Point value lookup for the validated hand.

**Yearly update:** Developer encodes new card as JSON each April. Card data integrity test suite validates all hands. Card loaded at game start — never hot-reloaded mid-session.

### Decision 6: Call Window Synchronization

**Approach:** Server-timed window with client freeze broadcast. Freeze is a UX signal, not a fairness mechanism.

**Flow:**
```
Discard happens
  → Server starts window timer (3-5 seconds per host setting)
  → Server broadcasts CALL_WINDOW_OPEN to all clients
  → Clients show call buttons + countdown

Player clicks Call
  → Client sends CALL action to server
  → Server records call in buffer
  → Server broadcasts CALL_WINDOW_FROZEN to all clients
  → All clients show "Call in progress..." — no more call buttons
  → Any in-flight calls (sent before freeze received) still accepted into buffer

Calling player has 5 seconds to confirm
  → Selects tiles to expose, sends CONFIRM_CALL
  → Server validates the exposed group
  → Server resolves ALL buffered calls by priority:
      1. Mahjong always wins
      2. Multiple Mahjong calls: all callers must confirm; seat position
         (closest counterclockwise from discarder) breaks the tie
      3. Non-Mahjong: closest counterclockwise from discarder
  → Server broadcasts winning call result as STATE_UPDATE

  OR: Calling player sends RETRACT_CALL
  → If other calls remain in the buffer, server promotes the next
    highest-priority caller to the confirmation phase (5-second timer)
  → If no calls remain, server broadcasts CALL_WINDOW_RESUMED
    with remaining time; other players can now call

  OR: Confirm timer expires (5 seconds, no CONFIRM or RETRACT)
  → Server auto-retracts the call on the player's behalf
  → Same logic as RETRACT_CALL above (promote next caller or reopen window)

All players pass (or timer expires with no calls)
  → Server broadcasts CALL_WINDOW_CLOSED
  → Next player draws from wall
```

**Wall exhaustion (draw game):** If the wall is empty when a player would draw, the game ends as a draw — no winner, no payments. Server transitions to the scoreboard phase with a `MahjongResult` where `winnerId` is `null`. This is a standard outcome in American Mahjong ("wall game").

**Pass tracking:** Server tracks per-player pass status. Discarder auto-passed. Window closes immediately when all 3 non-discarders have responded. No waiting for timer when everyone has acted.

**Latency fairness:** Seat position priority means network speed provides zero advantage. The only theoretical risk — a call arriving after the server timer expires — is negligible at 3-5 second windows.

### Decision 7: Reconnection Strategy

**Approach:** Same protocol as initial join. Full-state model eliminates sync complexity.

**Reconnection flow:**
1. Connection drops → server marks player as `disconnecting`, starts grace period (~30 seconds)
2. Server broadcasts `PLAYER_RECONNECTING` to other clients
3. Player's browser refreshes → SPA loads → reads token from sessionStorage
4. Client connects WebSocket with `{ roomCode, token }`
5. Server recognizes token → maps to seat → cancels timer → sends full state + chat history
6. Server broadcasts `PLAYER_RECONNECTED` to other clients

**Phase-specific fallbacks (if grace period expires):**

| Phase | Fallback Action |
|---|---|
| Player's turn | Auto-discard most recently drawn tile |
| Call window | Forfeit — player's call opportunity lost |
| Charleston | Auto-pass 3 random non-Joker tiles |
| Not their turn | No action needed — game already continued |
| 2+ players disconnected simultaneously | Game pauses entirely — no turns advance, no timers run. If any player is still disconnected after 2 minutes, game auto-ends and transitions to scoreboard with session scores through the last completed game. Threshold: 2 or more seats without an active WebSocket connection at the same time. |

**Why this is simple:** The full-state protocol means reconnection is just "connect and receive state." No delta replay, no event log catchup, no state reconciliation.

### Deferred Decisions

The following decisions are best resolved during implementation rather than locked in architecture:

- **Project file structure** — Directory organization within each package. Evolves with the codebase.
- **Error handling patterns** — Client-server error flow and user-facing error UX. Shaped by real error scenarios during development.
- **Audio channel management** — Priority mixing and channel allocation. Shaped by actual sound asset integration in Epic 7.
- **No database for MVP.** All state is in-memory (server) or browser storage (client). No PostgreSQL, no SQLite, no ORM. Database selection is deferred to Epic 8 when optional accounts and persistent stats are added. Implementing agents should not set up any database infrastructure.
- **Deployment provider deferred.** The server requires persistent WebSocket connections and long-running processes, which rules out serverless platforms (AWS Lambda, Vercel Functions, Cloudflare Workers). Compatible targets include VPS (DigitalOcean, Hetzner), containers (Docker on any cloud), or PaaS (Railway, Render, Fly.io). Specific provider chosen at deploy time based on cost evaluation.
- **No authentication for MVP.** Players are identified by session tokens (Decision 3), not accounts. Authentication (email + Google OAuth) is Epic 8. The session token system is designed as the foundation that auth wraps around when accounts are added.

---

## Cross-cutting Concerns

These patterns apply to ALL systems and must be followed by every implementation. They are the "constitution" that ensures consistency across all AI agent implementations.

### Error Handling

**Strategy:** Three-tier error handling matching the monorepo structure. Result objects for game logic, structured responses for server, friendly UX for client.

**Tier 1 — Game Logic (shared/):**
Errors are expected outcomes, not exceptions. The validate-then-mutate pattern (Decision 1) returns `ActionResult` with `{ accepted: false, reason }` for rule violations. No try-catch for game rule enforcement. Exceptions are reserved for genuine bugs (null reference, impossible state) which the test suite should prevent.

```typescript
// CORRECT: Result object for expected game rule violation
if (state.currentTurn !== action.playerId) {
  return { accepted: false, reason: 'NOT_YOUR_TURN' }
}

// WRONG: Don't throw for game rules
throw new Error('Not your turn') // Never do this
```

**Tier 2 — Server (server/):**
- Fastify's built-in error handling for HTTP routes (room creation, status checks)
- Top-level try-catch per WebSocket message handler: log the error, send `ServerError` to client, continue running
- Malformed messages: log at WARN level, drop silently — no crash, no response
- Room-level error boundary: if a room's state corrupts despite the validate-then-mutate pattern, the room dies gracefully without affecting other rooms:
  1. Server catches unhandled exception within the room's action handler
  2. Server logs at ERROR level with full state snapshot for post-mortem debugging
  3. Server broadcasts `SYSTEM_EVENT` to all clients in the room: `{ type: 'ROOM_ERROR', message: 'Something went wrong. The game has ended.' }`
  4. Server cleans up the room — removes from active rooms map, closes all WebSocket connections for that room
  5. Clients show a friendly error screen with session scores through the last completed game

  This is the nuclear option — it should never fire if the test suite is doing its job. But documenting the recovery path ensures an implementing agent knows what to build rather than guessing.

**Tier 3 — Client (client/):**
- Vue `onErrorCaptured` for component-level error boundaries
- Global `app.config.errorHandler` logs to console and shows a non-intrusive toast
- WebSocket disconnects trigger the reconnection flow (Decision 7), not an error screen
- **No technical error messages to players.** The audience is 40-70+ non-gamers. Errors are either silently handled or shown as friendly language:
  - "Reconnecting..." not "WebSocket connection reset"
  - "Something went wrong, try again" not "TypeError: Cannot read property 'tiles' of undefined"
  - The gentle "nope" sound (from the GDD audio spec) for rejected actions
- **Component error boundary strategy:** Log and continue, with escalation for critical failures.
  - **Non-critical component errors** (chat panel, settings overlay, scoreboard detail): Log via Pino, keep the game running. Most Vue rendering errors are edge cases that resolve on the next `STATE_UPDATE` (arriving within seconds).
  - **Critical component errors** (rack, discard pool, call buttons, game table): Log via Pino, keep running. If the same critical component errors 3+ times within 10 seconds, trigger a page reload. The reconnection flow (Decision 7) handles recovery — SPA reloads, reads session token from sessionStorage, reconnects to server, receives full state. This matches the "It Just Works" reliability pillar from the GDD.
  - **Never show a "something crashed" fallback component** in place of the game table. A broken-looking game table is worse than a quick reload. The reload path is fast (cached assets, instant reconnect) and invisible to other players.

**Errors never pause the game.** The server is authoritative and keeps running. A client error affects only that client. A server error in one room doesn't affect others. The only "pause" is the reconnection grace period (Decision 7).

### Logging

**Framework: Pino v9.x** — Fastify's built-in logger. Used on server and client. Shared/ uses a Logger interface with dependency injection.

**Server (server/):**
Fastify initializes with Pino enabled. Child loggers carry room context.
```typescript
// Fastify setup
const app = fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })

// Per-room child logger
const roomLogger = app.log.child({ roomId: 'MHJG7K' })
roomLogger.info({ playerId: 'uuid-abc', action: 'DISCARD_TILE', tileId: 'bam-3-2' }, 'Player discarded 3-bam')
```

**Client (client/):**
Pino browser mode maps to `console.*` methods. Same API as server, browser-appropriate output.
```typescript
import pino from 'pino'
const logger = pino({ browser: { asObject: false }, level: import.meta.env.DEV ? 'debug' : 'warn' })
```

**Shared (shared/):**
Game engine accepts a `Logger` interface via dependency injection. Shared/ has zero runtime dependency on Pino — only the type interface. This keeps shared/ as pure TypeScript with no external dependencies.

```typescript
// shared/types/logger.ts
export interface Logger {
  info(obj: object, msg?: string): void
  warn(obj: object, msg?: string): void
  error(obj: object, msg?: string): void
  debug(obj: object, msg?: string): void
  child(bindings: object): Logger
}

// shared/engine.ts
import type { Logger } from './types/logger'

export function createGameEngine(logger: Logger) {
  return {
    handleAction(state: GameState, action: GameAction): ActionResult {
      logger.debug({ action: action.type, playerId: action.playerId }, 'Processing action')
      // ... validate and mutate
    }
  }
}
```
Server passes its Pino instance (which satisfies the `Logger` interface). Client passes the browser Pino instance. Tests pass `{ info() {}, warn() {}, error() {}, debug() {}, child() { return this } }` or `pino({ level: 'silent' })`.

**Log levels:**

| Level | When | Examples | Production? |
|---|---|---|---|
| **ERROR** | Something broke that shouldn't | Unhandled exception, corrupted room state, WebSocket server crash | Always on |
| **WARN** | Handled but unexpected | Malformed client message, rejected action from suspicious client, room timeout cleanup | Always on |
| **INFO** | Normal operation milestones | Room created, player joined/left/reconnected, game started, Mahjong declared, room cleaned up | Always on |
| **DEBUG** | Action-level detail | Every validated action, state transitions, call window timing, Charleston passes | Off in production, toggle via `LOG_LEVEL` env var |

**Always log (INFO):** Room lifecycle events, player join/leave/reconnect, game start/end, Mahjong declarations. This is the post-mortem trail for bug reports.

**Never log in production:** Player rack contents. Server logs shouldn't reveal tiles unless DEBUG is explicitly enabled for investigation.

### Configuration

**Approach:** Three tiers matching the monorepo. No YAML config files, no remote configuration, no feature flags. Constants in TypeScript files. Settings in game state. Preferences in localStorage. Environment in `.env`.

| Tier | What | Where | Mutable? |
|---|---|---|---|
| **Game constants** | Tile set (152 tiles), group sizes, turn order direction, max players (4), Joker count (8) | `shared/constants.ts` | Never — change requires code change |
| **Game defaults** | Call window duration (3-5s), grace period (30s), Charleston timeout (60s), chat history cap (100) | `shared/defaults.ts` | Overridable by host settings per room |
| **Host settings** | Timer mode, call window duration, Joker rules (standard/simplified), dealing style | Room state object, set via host settings panel, broadcast to all clients | Between games only |
| **Player preferences** | Font size, audio volumes, dark mode override, hand guidance toggle | Pinia `usePreferencesStore` → localStorage | Anytime |
| **Environment config** | Server port, WebSocket URL, TURN/STUN URLs, log level, debug mode | `.env` files — `process.env` on server, Vite `import.meta.env` on client | Deploy-time only |

```typescript
// shared/constants.ts — never changes
export const TILE_COUNT = 152
export const MAX_PLAYERS = 4
export const JOKER_COUNT = 8
export const SEATS = ['east', 'south', 'west', 'north'] as const

// shared/defaults.ts — overridable by host settings
export const DEFAULT_CALL_WINDOW_SECONDS = 5
export const DEFAULT_GRACE_PERIOD_SECONDS = 30
export const DEFAULT_CHARLESTON_TIMEOUT_SECONDS = 60
export const DEFAULT_CHAT_HISTORY_CAP = 100
```

**Why no feature flags:** This is a solo-developer MVP with a single deployment. Feature flags add indirection for a benefit (gradual rollout, A/B testing) that doesn't apply. If a feature isn't ready, don't deploy it.

**Environment file structure:**
```
mahjong-game/
  packages/
    client/.env           # VITE_* prefixed vars (WebSocket URL, feature toggles)
    client/.env.local     # Local overrides (gitignored)
    server/.env           # Server vars (PORT, LOG_LEVEL, DEBUG_ENDPOINTS)
    server/.env.local     # Local overrides (gitignored)
```

**Security boundary:** Vite only exposes variables prefixed with `VITE_` to the client bundle. Server environment variables (future auth secrets, database URLs, API keys) are never exposed to the browser. An implementing agent must never put sensitive values in `client/.env` or use the `VITE_` prefix for server-only secrets.

### Event System

**Pattern: No custom event system.** The architecture already provides typed communication paths for every scenario:

| Communication | Mechanism | Already Defined In |
|---|---|---|
| Client → Server | WebSocket `GameAction` typed union | Decision 2 |
| Server → Client | WebSocket `StateUpdate` + `ResolvedAction` | Decision 2 |
| Within client (state changes) | Vue reactivity — components watch `useGameState` and Pinia stores | Decision 1 |
| Within client (animations) | Watch `resolvedAction.type` on state updates, trigger Motion for Vue | Engine & Framework |
| Within server | Direct function calls — message handler → `handleAction` → broadcast | Decision 1 |

Adding an event bus or pub/sub layer would create a parallel communication path that duplicates what Vue reactivity and the WebSocket protocol already provide. It would give implementing agents two ways to do the same thing, making data flow harder to trace.

**Animation triggering example:**
```typescript
// In a Vue component or composable — no event bus needed
watch(
  () => gameState.resolvedAction,
  (action) => {
    if (!action) return
    switch (action.type) {
      case 'DISCARD_TILE':
        audioStore.play('tile-discard')
        // Motion for Vue handles the tile animation via reactive state
        break
      case 'DECLARE_MAHJONG':
        audioStore.play('mahjong-motif')
        // Celebration sequence triggered by gamePhase changing to 'scoreboard'
        break
    }
  }
)
```

**Sound triggering distinction:**
- **Game-event sounds** (tile discard clack, call snap, Mahjong motif) are triggered by watching `resolvedAction` on state updates — these correspond to server-confirmed game events.
- **UI-interaction sounds** (button hover, Pass click, tab navigation, chat pop) are triggered directly by Vue component event handlers (`@mouseenter`, `@click`) — these are pure client-side interactions with no server round trip. Both use `useAudioStore` for playback, but the trigger source differs.

### TypeScript Configuration

**`strict: true` in all three package tsconfigs — no exceptions.** This enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and all other strict checks. For a game where rule accuracy is a zero-tolerance success criterion, compile-time type safety is mandatory — it catches null references, implicit anys, and type mismatches before they become runtime bugs.

No `@ts-ignore` without an accompanying comment explaining why the suppression is necessary and what would need to change to remove it.

### Input Sanitization

**All user-provided strings are untrusted.** Chat messages, display names, and reaction content arrive from WebSocket clients and are broadcast to other players.

**Server-side:**
- Chat messages: capped at 500 characters, stripped of control characters
- Display names: capped at 30 characters, stripped of control characters
- Reactions: must match a predefined emoji allowlist — reject anything else

**Rate limiting:**
- Chat messages: max 10 messages per 10 seconds per player. Excess messages dropped silently (server-side). No error sent — the client's send function is not async, so there's no feedback path needed.
- Reactions: max 5 per 5 seconds per player. Same drop behavior.
- Game actions: not rate-limited — the game state machine inherently limits action frequency (one action per turn).

**Client-side:**
- **All user-provided strings rendered via Vue text interpolation (`{{ }}`) only — never `v-html`.** This is the primary XSS defense. Vue's text interpolation auto-escapes HTML entities.
- No `v-html` directive anywhere in the codebase unless rendering trusted, developer-authored content (e.g., a static help page). If `v-html` appears in a code review, it must be justified.

This isn't paranoia — one curious user with devtools open could craft a WebSocket message with a `<script>` tag that renders in other players' chat panels.

### ID Generation

Consistent ID schemes prevent collisions and confusion across implementing agents.

| ID Type | Format | Scope | Generator |
|---|---|---|---|
| **Session token** | UUID v4 | Globally unique | `crypto.randomUUID()` on server |
| **Room code** | 6 alphanumeric (e.g., `MHJG7K`) | Unique among active rooms | Custom generator, collision-checked against active rooms |
| **Room ID** | UUID v4 | Globally unique | `crypto.randomUUID()` on server (internal, never shown to users) |
| **Player ID** | `player-0` through `player-3` | Room-unique | Server-assigned sequentially on seat assignment |
| **Tile ID** | `{suit}-{value}-{copy}` (e.g., `bam-3-2`) | Room-unique | Deterministic from tile definition during wall creation |
| **Exposed group ID** | `{playerId}-group-{index}` (e.g., `player-2-group-0`) | Room-unique | Server-assigned on group exposure |

**Tile ID convention:** The `copy` suffix (1-4 for regular tiles, 1-8 for Jokers) distinguishes identical tiles. `bam-3-2` means "the second copy of 3-Bam." IDs are generated during wall creation and stable for the game's duration. The pattern matching engine and Joker exchange system reference tiles by these IDs.

### Debug & Development Tools

**Available tools:**

| Tool | What | Activation | Production? |
|---|---|---|---|
| **Debug panel** | Collapsible overlay: current game state (JSON), WebSocket message log (last 50), connection status/latency, game phase/turn info, action dispatch helper | `Ctrl+Shift+D` or URL param `?debug=true` | No — `import.meta.env.DEV` only |
| **Server debug endpoint** | `GET /api/debug/rooms/:code` returns full unfiltered room state | Env var `DEBUG_ENDPOINTS=true` | No — disabled by default |
| **Multi-seat testing mode** | One browser window controls all 4 seats for testing game loop without 4 browsers | Env var `VITE_DEV_MULTI_SEAT=true` | No — dev only |
| **Vue Devtools** | Pinia store inspection, component tree, reactivity tracking | Browser extension (auto-detected) | No — stripped in prod build |
| **Vitest UI** | Visual test runner with Browser Mode for component testing | `pnpm -r test --ui` | No — dev only |

**Production stripping:** All debug features gated behind `import.meta.env.DEV` (client) or env vars (server). Vite tree-shakes dev-only code from production bundles automatically. No debug code ships to players.

**Security notes:**
- The debug panel's action dispatch helper sends actions through the normal WebSocket path with normal server validation. There is no privileged debug path — the server treats debug-dispatched actions identically to player-dispatched actions. This prevents debug tools from masking validation bugs.
- The server debug endpoint (`GET /api/debug/rooms/:code`) intentionally violates the information boundary defined in the Security Model — it returns full unfiltered state including all players' racks. This endpoint MUST be disabled in production via the `DEBUG_ENDPOINTS` env var (default: false). It is the single intentional exception to the "clients never see other players' racks" rule.

**No cheat commands for MVP.** The debug panel + multi-seat mode + server debug endpoint + direct state inspection covers all development needs. Cheat commands (deal specific tiles, skip Charleston, force Mahjong) can be added if testing demands them.

---

## Project Structure

### Organization Pattern

**Feature-based within each package.** Files grouped by what they do, not by file type. Matches Vue ecosystem conventions and the three-package monorepo.

### Directory Structure

```
mahjong-game/
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── game-state.ts        # GameState, GamePhase, PlayerState
│   │   │   │   ├── actions.ts           # GameAction discriminated union
│   │   │   │   ├── protocol.ts          # ServerMessage, ClientMessage, StateUpdate, etc.
│   │   │   │   ├── tiles.ts             # Tile, TileId, TileSuit, TileCategory
│   │   │   │   ├── card.ts              # NMJLCard, HandPattern, GroupPattern, TileRequirement
│   │   │   │   ├── room.ts              # RoomState, RoomSettings, PlayerPublicInfo
│   │   │   │   └── logger.ts            # Logger interface
│   │   │   ├── engine/
│   │   │   │   ├── game-engine.ts        # createGameEngine(), handleAction()
│   │   │   │   ├── game-engine.test.ts
│   │   │   │   ├── actions/
│   │   │   │   │   ├── draw.ts
│   │   │   │   │   ├── draw.test.ts
│   │   │   │   │   ├── discard.ts
│   │   │   │   │   ├── discard.test.ts
│   │   │   │   │   ├── call.ts
│   │   │   │   │   ├── call.test.ts
│   │   │   │   │   ├── mahjong.ts
│   │   │   │   │   ├── mahjong.test.ts
│   │   │   │   │   ├── charleston.ts
│   │   │   │   │   ├── charleston.test.ts
│   │   │   │   │   ├── joker-exchange.ts
│   │   │   │   │   ├── joker-exchange.test.ts
│   │   │   │   │   ├── game-flow.ts
│   │   │   │   │   └── game-flow.test.ts
│   │   │   │   ├── state/
│   │   │   │   │   ├── create-game.ts
│   │   │   │   │   ├── wall.ts
│   │   │   │   │   ├── wall.test.ts
│   │   │   │   │   ├── dealing.ts
│   │   │   │   │   ├── dealing.test.ts
│   │   │   │   │   ├── scoring.ts
│   │   │   │   │   └── scoring.test.ts
│   │   │   │   └── validation/
│   │   │   │       ├── call-validation.ts
│   │   │   │       ├── call-validation.test.ts
│   │   │   │       ├── exposure-validation.ts
│   │   │   │       ├── exposure-validation.test.ts
│   │   │   │       ├── turn-validation.ts
│   │   │   │       └── turn-validation.test.ts
│   │   │   ├── card/
│   │   │   │   ├── pattern-matcher.ts
│   │   │   │   ├── pattern-matcher.test.ts  # Exhaustive — all 50+ hands
│   │   │   │   ├── hand-guidance.ts
│   │   │   │   ├── hand-guidance.test.ts
│   │   │   │   ├── joker-eligibility.ts
│   │   │   │   ├── joker-eligibility.test.ts
│   │   │   │   ├── card-loader.ts
│   │   │   │   ├── card-loader.test.ts
│   │   │   │   └── card-integrity.test.ts   # Card data validation suite
│   │   │   ├── testing/
│   │   │   │   ├── helpers.ts            # Test factories: createTestState, buildHand, generateWall
│   │   │   │   ├── fixtures.ts           # Pre-built game states for common scenarios
│   │   │   │   └── tile-builders.ts      # Convenience functions for tile/group creation
│   │   │   ├── constants.ts
│   │   │   ├── defaults.ts
│   │   │   └── index.ts                     # Public API — single barrel export
│   │   ├── data/
│   │   │   ├── cards/
│   │   │   │   ├── 2026.json
│   │   │   │   └── 2025.json               # Previous year (testing only)
│   │   │   └── card-schema.json
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── client/
│   │   ├── src/
│   │   │   ├── composables/
│   │   │   │   ├── useGameState.ts
│   │   │   │   ├── useGameState.test.ts
│   │   │   │   ├── useHandGuidance.ts
│   │   │   │   ├── useHandGuidance.test.ts
│   │   │   │   ├── useAudio.ts
│   │   │   │   └── useConnection.ts
│   │   │   ├── stores/
│   │   │   │   ├── preferences.ts
│   │   │   │   ├── rack.ts
│   │   │   │   ├── audio.ts
│   │   │   │   ├── chat.ts
│   │   │   │   ├── connection.ts
│   │   │   │   └── hand-guidance.ts
│   │   │   ├── components/
│   │   │   │   ├── game/
│   │   │   │   │   ├── GameTable.vue
│   │   │   │   │   ├── PlayerRack.vue
│   │   │   │   │   ├── OpponentArea.vue
│   │   │   │   │   ├── DiscardPool.vue
│   │   │   │   │   ├── ExposedGroups.vue
│   │   │   │   │   ├── WallCounter.vue
│   │   │   │   │   └── TurnIndicator.vue
│   │   │   │   ├── tiles/
│   │   │   │   │   ├── Tile.vue
│   │   │   │   │   ├── TileBack.vue
│   │   │   │   │   └── tile-assets/
│   │   │   │   │       ├── tiles.svg        # All 152 faces as <symbol> elements
│   │   │   │   │       └── tiles.css        # CSS custom properties for suit colors
│   │   │   │   ├── actions/
│   │   │   │   │   ├── CallButtons.vue
│   │   │   │   │   ├── DiscardConfirm.vue
│   │   │   │   │   ├── MahjongButton.vue
│   │   │   │   │   ├── JokerExchange.vue
│   │   │   │   │   └── CallWindow.vue
│   │   │   │   ├── charleston/
│   │   │   │   │   ├── CharlestonPhase.vue
│   │   │   │   │   ├── PassDirection.vue
│   │   │   │   │   └── CourtesyPass.vue
│   │   │   │   ├── card/
│   │   │   │   │   ├── NMJLCard.vue
│   │   │   │   │   └── HandHint.vue
│   │   │   │   ├── social/
│   │   │   │   │   ├── ChatPanel.vue
│   │   │   │   │   ├── ReactionBar.vue
│   │   │   │   │   ├── SocialOverride.vue
│   │   │   │   │   └── TableTalkReport.vue
│   │   │   │   ├── lobby/
│   │   │   │   │   ├── LobbyView.vue
│   │   │   │   │   ├── WaitingRoom.vue
│   │   │   │   │   └── PlayerSlot.vue
│   │   │   │   ├── scoreboard/
│   │   │   │   │   ├── Scoreboard.vue
│   │   │   │   │   ├── Celebration.vue      # Reactive orchestrator — dims via gamePhase, not DOM manipulation
│   │   │   │   │   ├── ShowHands.vue
│   │   │   │   │   └── SessionScores.vue
│   │   │   │   ├── settings/
│   │   │   │   │   ├── SettingsPanel.vue
│   │   │   │   │   └── HostSettings.vue
│   │   │   │   ├── presence/
│   │   │   │   │   ├── PlayerPresence.vue   # Post-MVP (WebRTC)
│   │   │   │   │   └── ConnectionStatus.vue
│   │   │   │   ├── dev/
│   │   │   │   │   ├── DebugPanel.vue       # State viewer, WS log, action dispatch (DEV only)
│   │   │   │   │   └── MultiSeatControls.vue # Control all 4 seats from one browser (DEV only)
│   │   │   │   └── ui/
│   │   │   │       ├── Toast.vue
│   │   │   │       └── FullTableMessage.vue
│   │   │   ├── views/
│   │   │   │   ├── HomeView.vue
│   │   │   │   └── RoomView.vue
│   │   │   ├── router/
│   │   │   │   └── index.ts
│   │   │   ├── assets/
│   │   │   │   ├── audio/
│   │   │   │   │   ├── tile-draw.mp3
│   │   │   │   │   ├── tile-discard.mp3
│   │   │   │   │   ├── call-snap.mp3
│   │   │   │   │   ├── mahjong-motif.mp3
│   │   │   │   │   ├── charleston-whoosh.mp3
│   │   │   │   │   ├── turn-notification.mp3
│   │   │   │   │   ├── call-alert.mp3
│   │   │   │   │   ├── chat-pop.mp3
│   │   │   │   │   ├── timer-warning.mp3
│   │   │   │   │   ├── error-nope.mp3
│   │   │   │   │   └── ambient-lofi.mp3
│   │   │   │   └── fonts/
│   │   │   ├── styles/
│   │   │   │   ├── theme.css               # CSS custom properties — colors, moods, dark mode
│   │   │   │   └── base.css               # Reset, typography, global styles
│   │   │   ├── App.vue
│   │   │   ├── main.ts
│   │   │   └── env.d.ts
│   │   ├── e2e/
│   │   │   ├── game-flow.spec.ts
│   │   │   ├── room-join.spec.ts
│   │   │   ├── charleston.spec.ts
│   │   │   └── reconnection.spec.ts
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── vitest.config.ts
│   │   ├── uno.config.ts
│   │   ├── tsconfig.json
│   │   ├── .env
│   │   └── package.json
│   │
│   └── server/
│       ├── src/
│       │   ├── rooms/
│       │   │   ├── room-manager.ts
│       │   │   ├── room-manager.test.ts
│       │   │   ├── room.ts
│       │   │   ├── room.test.ts
│       │   │   ├── room-code.ts
│       │   │   └── room-code.test.ts
│       │   ├── websocket/
│       │   │   ├── ws-server.ts
│       │   │   ├── message-handler.ts
│       │   │   ├── message-handler.test.ts
│       │   │   ├── state-broadcaster.ts
│       │   │   ├── state-broadcaster.test.ts
│       │   │   ├── connection-tracker.ts
│       │   │   └── connection-tracker.test.ts
│       │   ├── http/
│       │   │   ├── routes.ts
│       │   │   ├── routes.test.ts
│       │   │   └── debug-routes.ts
│       │   ├── utils/
│       │   │   ├── sanitize.ts
│       │   │   ├── sanitize.test.ts
│       │   │   └── timer.ts
│       │   └── index.ts
│       ├── vitest.config.ts
│       ├── tsconfig.json
│       ├── .env
│       └── package.json
│
├── .nvmrc                                    # Node 22 LTS
├── pnpm-workspace.yaml
├── tsconfig.base.json                        # Shared: strict: true, target, module, lib
├── playwright.config.ts
├── .gitignore
├── .env.example
└── package.json                              # Root scripts: "test": "pnpm -r test"
```

### Test Strategy

**Co-located tests:** Test files live next to their source files (`foo.ts` -> `foo.test.ts`). Vitest config: `include: ['src/**/*.test.ts']`. Tests are discoverable, never orphaned, and move with their source during refactors.

**Exception: E2E tests** live in `client/e2e/` with `.spec.ts` extension since they don't correspond to individual source files. Playwright runs these separately from Vitest.

### Import Strategy

**Minimal barrel exports.** Each package has ONE `index.ts` as its public API. External consumers (client/, server/) import from the barrel. Within a package, import directly from source files — never from barrels.

```typescript
// shared/src/index.ts — the single public API
export type { GameState, GameAction, ActionResult } from './types/game-state'
export type { NMJLCard, HandPattern } from './types/card'
export type { Tile, TileId } from './types/tiles'
export type { Logger } from './types/logger'
export { createGameEngine } from './engine/game-engine'
export { loadCard } from './card/card-loader'
export { TILE_COUNT, MAX_PLAYERS, SEATS } from './constants'
export { DEFAULT_CALL_WINDOW_SECONDS } from './defaults'

// Within shared/, import directly — NOT from barrel:
import { GameState } from '../types/game-state'  // CORRECT
import { GameState } from '..'                    // WRONG
```

### SVG Tile Assets

**Single SVG sprite sheet** containing all 152 tile faces as `<symbol>` elements. The `Tile.vue` component references tiles via `<use href="#bam-3">`.

```
tile-assets/
  tiles.svg    # All 152 faces: <symbol id="bam-1">...</symbol>, etc.
  tiles.css    # CSS custom properties for suit colors (theming hook)
```

One cacheable asset, resolution-independent. Organized by category within the sprite (suited, winds, dragons, flowers, jokers).

### System -> Location Mapping

| System | Package | Location | Key Files |
|---|---|---|---|
| Game State Machine | shared | `engine/` | `game-engine.ts`, `actions/*.ts` |
| NMJL Pattern Matching | shared | `card/` | `pattern-matcher.ts`, `hand-guidance.ts` |
| Call Validation | shared | `engine/validation/` | `call-validation.ts`, `exposure-validation.ts` |
| Charleston Logic | shared | `engine/actions/` | `charleston.ts` |
| Wall & Dealing | shared | `engine/state/` | `wall.ts`, `dealing.ts` |
| Scoring | shared | `engine/state/` | `scoring.ts` |
| Card Data | shared | `data/cards/` | `2026.json` |
| Test Utilities | shared | `testing/` | `helpers.ts`, `fixtures.ts` |
| Room Management | server | `rooms/` | `room-manager.ts`, `room.ts` |
| WebSocket Server | server | `websocket/` | `ws-server.ts`, `message-handler.ts` |
| State Broadcasting | server | `websocket/` | `state-broadcaster.ts` |
| HTTP API | server | `http/` | `routes.ts` |
| Game Table UI | client | `components/game/` | `GameTable.vue`, `PlayerRack.vue` |
| Tile Rendering | client | `components/tiles/` | `Tile.vue`, `tiles.svg` |
| Call/Discard Actions | client | `components/actions/` | `CallButtons.vue`, `DiscardConfirm.vue` |
| Charleston UI | client | `components/charleston/` | `CharlestonPhase.vue` |
| NMJL Card Display | client | `components/card/` | `NMJLCard.vue`, `HandHint.vue` |
| Chat & Social | client | `components/social/` | `ChatPanel.vue`, `ReactionBar.vue` |
| Lobby | client | `components/lobby/` | `LobbyView.vue`, `WaitingRoom.vue` |
| Scoreboard & Celebration | client | `components/scoreboard/` | `Scoreboard.vue`, `Celebration.vue` |
| Settings | client | `components/settings/` | `SettingsPanel.vue`, `HostSettings.vue` |
| Debug Tools | client | `components/dev/` | `DebugPanel.vue`, `MultiSeatControls.vue` |
| Game State Composable | client | `composables/` | `useGameState.ts` |
| Pinia Stores | client | `stores/` | `preferences.ts`, `rack.ts`, etc. |

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| TypeScript files | kebab-case | `game-engine.ts`, `pattern-matcher.ts` |
| Vue components | PascalCase | `PlayerRack.vue`, `CallButtons.vue` |
| Composables | camelCase with `use` prefix | `useGameState.ts`, `useHandGuidance.ts` |
| Pinia stores | camelCase with `use` + `Store` suffix | `usePreferencesStore`, `useRackStore` |
| Types/Interfaces | PascalCase | `GameState`, `HandPattern`, `TileRequirement` |
| Constants | UPPER_SNAKE_CASE | `TILE_COUNT`, `MAX_PLAYERS` |
| Functions | camelCase | `handleDiscard()`, `buildPlayerView()` |
| CSS custom properties | kebab-case with prefix | `--color-felt-teal`, `--mood-arriving-bg` |
| Test files | match source + `.test.ts` | `pattern-matcher.test.ts` |
| E2E tests | descriptive + `.spec.ts` | `game-flow.spec.ts` |
| SVG symbol IDs | kebab-case tile ID | `bam-3`, `wind-north`, `joker`, `flower-a` |

### Architectural Boundaries

1. **shared/ imports nothing from client/ or server/.** Enforced by TypeScript project references.
2. **shared/ has zero runtime dependencies.** Only `devDependencies` (Vitest). The `Logger` interface is the only external-facing type — implementations injected from consumers.
3. **client/ imports from shared/ (types + game logic).** Never imports from server/.
4. **server/ imports from shared/ (types + game engine).** Never imports from client/.
5. **No circular dependencies between packages.** Dependency graph: `shared <- client`, `shared <- server`. No other edges.
6. **No barrel imports within a package.** Direct file imports only. Barrels are public API boundaries between packages.

### TypeScript Project References

Boundary enforcement uses TypeScript project references. `tsc --build` compiles in dependency order and prevents illegal cross-package imports at compile time.

```json
// tsconfig.base.json — shared compiler options
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}

// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}

// packages/client/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "types": ["vite/client"] },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}

// packages/server/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "types": ["node"] },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

### Test Utilities

Shared test helpers live in `shared/src/testing/`. These provide factories for creating game states, building specific hands, and generating tile configurations used across all three packages' test suites.

```typescript
// shared/src/testing/helpers.ts
export function createTestState(overrides?: Partial<GameState>): GameState
export function buildHand(tiles: string[]): Tile[]
export function generateShuffledWall(seed?: number): Tile[]
```

Server and client tests import directly:
```typescript
import { createTestState, buildHand } from '@mahjong-game/shared/testing/helpers'
```

Vitest coverage config excludes `testing/` from production coverage metrics.

### Package Names

Scoped package names for the pnpm workspace:

| Package | Name | Import Example |
|---|---|---|
| shared | `@mahjong-game/shared` | `import { createGameEngine } from '@mahjong-game/shared'` |
| client | `@mahjong-game/client` | (not imported by other packages) |
| server | `@mahjong-game/server` | (not imported by other packages) |

### Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

Each package's `package.json` references shared via workspace protocol:
```json
// packages/client/package.json
{
  "dependencies": {
    "@mahjong-game/shared": "workspace:*"
  }
}

// packages/server/package.json
{
  "dependencies": {
    "@mahjong-game/shared": "workspace:*"
  }
}
```

---

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents.

### Novel Pattern: NMJL Pattern Matching Algorithm

**Purpose:** Determine which card hands a set of tiles matches (for Mahjong validation) and which hands are still achievable (for hand guidance).

**The challenge:** A player's 14 tiles must match one of ~50+ hand patterns. Each pattern uses color-group wildcards (A/B/C mapping to any suit), value wildcards (N/N+1/N+2), Joker substitution in groups of 3+, and concealed/exposed constraints. The matcher must handle all combinations efficiently.

**Algorithm approach: Constraint satisfaction with backtracking**

The pattern matcher works in two phases:

**Phase 1 — Filter impossible hands (fast):**
For each hand on the card, check basic feasibility:
- Does the player have enough tiles in the right categories? (suited, winds, dragons, flowers)
- Are exposed groups compatible with the hand's requirements?
- If the hand is concealed, has the player called any tiles?

This eliminates most hands cheaply before doing expensive matching.

**Phase 2 — Attempt assignment (per surviving hand):**
For each remaining hand pattern, try to assign the player's tiles to the pattern's groups:

```typescript
function matchHand(tiles: Tile[], exposed: ExposedGroup[], pattern: HandPattern): MatchResult | null {
  // 1. Build available tile pool (rack tiles + exposed groups)
  const pool = buildTilePool(tiles, exposed)

  // 2. Determine color-group assignments
  //    If pattern uses colors A, B, C — try all suit permutations
  //    e.g., A=Bam,B=Crak,C=Dot then A=Bam,B=Dot,C=Crak, etc.
  const suitPermutations = getSuitPermutations(pattern)

  for (const suitMapping of suitPermutations) {
    // 3. Determine value wildcard assignments
    //    If pattern uses N, try N=1 through N=9 (bounded by N+offset <= 9)
    const valueRanges = getValueRanges(pattern)

    for (const valueMapping of valueRanges) {
      // 4. Resolve all tile requirements to concrete tiles
      const concretePattern = resolvePattern(pattern, suitMapping, valueMapping)

      // 5. Attempt to fill each group from the pool
      //    Jokers can substitute in groups of 3+
      //    Pairs and singles must be exact matches
      const result = tryFillGroups(pool, concretePattern)

      if (result.success) {
        // 6. Validate concealed/exposed constraints
        if (validateExposureConstraints(result, exposed, pattern)) {
          return result
        }
      }
    }
  }

  return null // No valid assignment found
}
```

**Joker allocation:** When filling groups from the tile pool, Jokers can substitute for any tile in groups of 3+. The matcher must find the optimal distribution of available Jokers (0-8) across groups. This is solved by exhaustive search — try all valid Joker distributions across the hand's groups. With max 8 Jokers across ~5 groups, the combinatorial space is bounded and small enough for brute force. No optimization or heuristic needed.

**Performance considerations:**
- Phase 1 filtering eliminates 80-90% of hands before expensive matching
- Suit permutations: at most 6 (3! for three-suit hands), usually fewer
- Value ranges: at most 7 (N=1..7 for N+2 patterns), usually fewer
- Total worst case per hand: ~42 attempts (6 suits x 7 values). With ~10 hands surviving Phase 1 filtering, that's ~420 attempts — trivial for modern hardware
- Hand guidance runs this on every draw/discard. At sub-millisecond per attempt, the full computation is well under the 100ms target

**Hand guidance — full recompute:** Hand guidance runs the full matching algorithm from scratch on every draw/discard. No incremental state, no caching of previous results. The algorithm is fast enough (sub-millisecond total) that incremental computation would add cache invalidation complexity for an invisible performance gain. Stateless recomputation eliminates a class of bugs (stale cache after Joker exchange, call, or Charleston pass).

**For hand guidance (closeness ranking):**
Same algorithm but instead of requiring all groups filled, count how many tiles are missing:

```typescript
function handCloseness(tiles: Tile[], exposed: ExposedGroup[], pattern: HandPattern): number {
  // Returns minimum tiles needed to complete this hand (0 = valid Mahjong)
  // Uses the same assignment logic but tracks unfilled slots
  // Best result across all suit/value permutations wins
}
```

Rank all hands by closeness. Display on the NMJL card: 0 = Mahjong, 1-3 = highlighted, 4+ = faded, impossible = hidden.

### Standard Patterns

#### Action Handler Template

Every action handler in `shared/engine/actions/` follows this exact structure:

```typescript
// shared/engine/actions/discard.ts
import type { GameState, DiscardAction, ActionResult } from '../../types'
import type { Logger } from '../../types/logger'

export function handleDiscard(
  state: GameState,
  action: DiscardAction,
  logger: Logger
): ActionResult {
  // -- 1. VALIDATE (read-only) --
  if (state.gamePhase !== 'play') {
    return { accepted: false, reason: 'WRONG_PHASE' }
  }
  if (state.currentTurn !== action.playerId) {
    return { accepted: false, reason: 'NOT_YOUR_TURN' }
  }
  if (state.turnState !== 'discard') {
    return { accepted: false, reason: 'MUST_DRAW_FIRST' }
  }
  const player = state.players[action.playerId]
  const tileIndex = player.rack.findIndex(t => t.id === action.tileId)
  if (tileIndex === -1) {
    return { accepted: false, reason: 'TILE_NOT_IN_RACK' }
  }

  // -- 2. MUTATE (only if all validation passed) --
  const [tile] = player.rack.splice(tileIndex, 1)
  player.discardPool.push(tile)
  state.lastDiscard = { tile, discarderId: action.playerId }
  state.turnState = 'callWindow'
  state.callWindow = {
    status: 'open',
    discard: tile,
    discarderId: action.playerId,
    calls: [],
    passes: [action.playerId],
    expiresAt: Date.now() + (state.settings.callWindowSeconds * 1000)
  }

  // -- 3. LOG --
  logger.debug({ playerId: action.playerId, tileId: tile.id }, 'Tile discarded')

  // -- 4. RETURN RESULT --
  return {
    accepted: true,
    resolved: {
      type: 'DISCARD_TILE',
      playerId: action.playerId,
      tile
    }
  }
}
```

**Rules:**
- Sections always in this order: validate, mutate, log, return
- All validation before any mutation — no exceptions
- Logger injected, not imported
- Return typed `ActionResult` always

#### Vue Component Pattern

Components follow these conventions:

```vue
<!-- components/game/DiscardPool.vue -->
<script setup lang="ts">
// 1. Imports
import { computed } from 'vue'
import type { Tile } from '@mahjong-game/shared'
import TileComponent from '../tiles/Tile.vue'

// 2. Props and emits
const props = defineProps<{
  tiles: Tile[]
  playerId: string
  isCurrentPlayer: boolean
}>()

// 3. Composables and stores (if needed)
// const audioStore = useAudioStore()

// 4. Computed properties
const rows = computed(() => {
  const result: Tile[][] = []
  for (let i = 0; i < props.tiles.length; i += 6) {
    result.push(props.tiles.slice(i, i + 6))
  }
  return result
})

// 5. Methods (if needed)
</script>

<template>
  <div class="discard-pool" :class="{ 'is-current': isCurrentPlayer }">
    <div v-for="(row, i) in rows" :key="i" class="discard-row">
      <TileComponent
        v-for="tile in row"
        :key="tile.id"
        :tile="tile"
        :size="'small'"
      />
    </div>
  </div>
</template>
```

#### Injection Keys

All provide/inject uses typed `InjectionKey<T>` for compile-time safety. Keys defined in a single file:

```typescript
// client/src/injection-keys.ts
import type { InjectionKey } from 'vue'
import type { GameStateReturn } from './composables/useGameState'

export const gameStateKey: InjectionKey<GameStateReturn> = Symbol('gameState')
```

#### State Access Conventions

Game state flows through Vue's provide/inject to avoid deep prop drilling:

```typescript
// views/RoomView.vue — the single provider
import { provide } from 'vue'
import { useGameState } from '../composables/useGameState'
import { gameStateKey } from '../injection-keys'

const gameState = useGameState(roomCode)
provide(gameStateKey, gameState)
```

```typescript
// Any descendant component — inject game state
import { inject } from 'vue'
import { gameStateKey } from '../injection-keys'

const gameState = inject(gameStateKey)!
```

| Data | Access Method | Example |
|---|---|---|
| Game state (server-authoritative) | `inject(gameStateKey)` — provided by `RoomView` | Current turn, racks, discard pools, scores |
| Component-specific data | Props from parent | Which tile to render, which player's area |
| Client-local state | Direct Pinia store access | `usePreferencesStore()`, `useRackStore()` |

**Component rules:**
- Always `<script setup lang="ts">` — no Options API
- Props typed via `defineProps<{}>()` — no runtime prop validation
- Section order in `<script setup>`: imports, props/emits, inject, composables/stores, computed, methods
- Game state via inject, component-specific data via props, client state via Pinia
- Template before style, UnoCSS utility classes preferred
- Keep components under ~150 lines — extract child components or composables if exceeding

#### useGameState Contract

The `useGameState` composable is the contract between the WebSocket connection and every component:

```typescript
// client/src/composables/useGameState.ts
interface GameStateReturn {
  // Reactive state from server — read-only, replaced on each STATE_UPDATE
  state: Readonly<Ref<PlayerGameView | null>>
  resolvedAction: Readonly<Ref<ResolvedAction | null>>

  // Connection status
  connected: Readonly<Ref<boolean>>
  reconnecting: Readonly<Ref<boolean>>

  // Send game actions to server — fire and forget
  dispatch: (action: GameAction) => void

  // Separate chat/reaction channel
  sendChat: (text: string) => void
  sendReaction: (emoji: string) => void
}
```

**Design rules:**
- `state` is `Readonly<Ref>` — components read, never mutate. Enforces no-optimistic-updates at the type level.
- `dispatch` is synchronous fire-and-forget — not async, no return value. The server's response comes as the next `STATE_UPDATE` which replaces `state`.
- `null` state means not yet connected. Components gate rendering on `state !== null`.
- Chat and reactions are separate methods matching the separate WebSocket message channels (Decision 2).

#### WebSocket Message Handler Pattern

Server-side pattern for processing incoming WebSocket messages:

```typescript
// server/src/websocket/message-handler.ts
import type { ClientMessage, ActionMessage, ChatMessage } from '@mahjong-game/shared'
import type { Logger } from 'pino'

export function createMessageHandler(roomManager: RoomManager, logger: Logger) {
  return function handleMessage(ws: WebSocket, raw: string, token: string) {
    // 1. Parse
    let message: ClientMessage
    try {
      message = JSON.parse(raw)
    } catch {
      logger.warn({ token }, 'Malformed WebSocket message — dropped')
      return
    }

    // 2. Validate structure
    if (!message.version || !message.type) {
      logger.warn({ token, message }, 'Invalid message structure — dropped')
      return
    }

    // 3. Resolve room and player
    const session = roomManager.getSession(token)
    if (!session) {
      sendError(ws, 'INVALID_SESSION', 'Session not found')
      return
    }

    // 4. Dispatch by message type
    switch (message.type) {
      case 'ACTION':
        handleGameAction(session, message as ActionMessage, logger)
        break
      case 'CHAT':
        handleChat(session, message as ChatMessage, logger)
        break
      case 'REACTION':
        handleReaction(session, message, logger)
        break
      default:
        logger.warn({ token, type: message.type }, 'Unknown message type — dropped')
    }
  }
}

function handleGameAction(session: PlayerSession, message: ActionMessage, logger: Logger) {
  const { room, playerId } = session
  // Always use session-authenticated playerId — never trust client-provided value
  const result = room.engine.handleAction(room.state, { ...message.action, playerId })

  if (result.accepted) {
    room.broadcastState(result.resolved)
  } else {
    sendError(session.ws, 'INVALID_ACTION', result.reason, message.action.type)
  }
}
```

**Rules:**
- Parse -> validate structure -> resolve session -> dispatch. Always this order.
- Malformed messages logged and dropped — never crash
- Game actions go through the shared engine — server never mutates state directly
- Errors sent only to the offending client
- State broadcast after every accepted action

#### State Broadcasting Pattern

```typescript
// server/src/websocket/state-broadcaster.ts
export function broadcastState(room: Room, resolvedAction?: ResolvedAction) {
  for (const [playerId, session] of room.sessions) {
    if (session.ws.readyState !== WebSocket.OPEN) continue  // skip closed/closing connections
    const view = buildPlayerView(room.state, playerId)
    const message: StateUpdate = {
      version: 1,
      type: 'STATE_UPDATE',
      state: view,
      resolvedAction
    }
    session.ws.send(JSON.stringify(message))
  }

  for (const session of room.spectators) {
    if (session.ws.readyState !== WebSocket.OPEN) continue
    const view = buildSpectatorView(room.state)
    const message: StateUpdate = {
      version: 1,
      type: 'STATE_UPDATE',
      state: view,
      resolvedAction
    }
    session.ws.send(JSON.stringify(message))
  }
}
```

#### Timer Pattern

**Client-side: VueUse composables.** No custom timer code on the client.

```typescript
import { useTimeoutFn, useIntervalFn } from '@vueuse/core'

// Call window countdown display
const { start: startCountdown, stop: stopCountdown } = useIntervalFn(() => {
  remainingSeconds.value = Math.max(0, remainingSeconds.value - 1)
}, 1000, { immediate: false })

// Grace period UI indicator
const { start: startGrace, stop: cancelGrace } = useTimeoutFn(() => {
  showReconnectingMessage.value = false
  showDisconnectedMessage.value = true
}, gracePeriodMs, { immediate: false })
```

**Server-side: Thin GameTimer wrapper** around `setTimeout` with cancel and room-scoped cleanup.

```typescript
// server/src/utils/timer.ts
export class GameTimer {
  private handle: NodeJS.Timeout | null = null

  start(ms: number, onExpire: () => void): void {
    this.cancel()
    this.handle = setTimeout(onExpire, ms)
  }

  cancel(): void {
    if (this.handle) {
      clearTimeout(this.handle)
      this.handle = null
    }
  }

  get active(): boolean {
    return this.handle !== null
  }
}
```

Each room holds its own timer instances (call window timer, grace period timer, cleanup timer). Room destruction cancels all timers. Testable by mocking `setTimeout` in Vitest.

### Consistency Rules

| Pattern | Convention | Enforcement |
|---|---|---|
| Action handlers | Validate -> mutate -> log -> return | Code review, template in architecture doc |
| Vue components | `<script setup lang="ts">`, props typed via generics | TypeScript strict mode, Oxlint |
| State access (game) | Via `inject(gameStateKey)` — never direct WebSocket | Architecture boundary — no WebSocket API in components |
| State access (UI) | Via Pinia stores — `usePreferencesStore`, `useRackStore`, etc. | Pinia as single source for client-local state |
| Props vs. inject vs. stores | Game state via inject. Component data via props. Client state via stores. | Architecture doc, code review |
| Error responses | `ServerError` to offending client only — never broadcast | Message handler pattern |
| Logging | Pino via injection (shared/), direct Pino (server/client) | Logger interface in shared/, no `console.*` in shared/ |
| No optimistic updates | Client renders ONLY from STATE_UPDATE — never local prediction | Architecture hard rule, `Readonly<Ref>` enforcement |
| Input sanitization | All user strings via `{{ }}` — never `v-html` | eslint-plugin-vue `vue/no-v-html` set to error |
| Tile references | By tile ID (`bam-3-2`) — never by index or object reference | Tile ID system (Cross-cutting) |
| Linting | Oxlint (primary) + ESLint with eslint-plugin-vue (supplementary until Oxlint Vue template support Q2 2026) | CI runs both; eslint-plugin-oxlint prevents duplicate rules |
| No v-html | eslint-plugin-vue `vue/no-v-html` rule set to error | Blocks any use of v-html without explicit disable comment |

---

## Architecture Validation

### Validation Summary

| Check | Result | Notes |
|---|---|---|
| Decision Compatibility | PASS | All stack choices compatible, no conflicts between decisions |
| GDD Coverage | PASS | All 11 core systems and all technical requirements addressed |
| Pattern Completeness | PASS | 10 scenarios covered with concrete code examples |
| Epic Mapping | PASS | All 13 epics mapped to locations and patterns |
| Document Completeness | PASS | All required sections present, no placeholders |

### Coverage Report

- **Systems Covered:** 11/11
- **Patterns Defined:** 10 (1 novel + 9 standard)
- **Decisions Made:** 7 critical/important (6 deferred with rationale)
- **Consistency Rules:** 12

### Document Quality Score

- **Architecture Completeness:** Complete
- **Version Specificity:** All Verified (web search verified 2026-03-25)
- **Pattern Clarity:** Crystal Clear (concrete TypeScript examples for every pattern)
- **AI Agent Readiness:** Ready

### Validation Date

2026-03-26

---

## Development Environment

### Prerequisites

- **Node.js 22 LTS** (pinned via `.nvmrc`)
- **pnpm** (latest — `corepack enable && corepack prepare pnpm@latest --activate`)
- **Git**
- **Modern browser** (Chrome/Firefox/Safari/Edge for development and testing)

### Setup Commands

```bash
# Initialize monorepo
mkdir mahjong-game && cd mahjong-game
git init
echo "22" > .nvmrc
nvm use
corepack enable
pnpm init

# Create workspace structure
mkdir -p packages/shared/src packages/client/src packages/server/src
echo 'packages:\n  - "packages/*"' > pnpm-workspace.yaml

# Install shared dependencies
pnpm --filter @mahjong-game/shared add -D vitest typescript
pnpm --filter @mahjong-game/client add vue vue-router pinia @vueuse/core motion-v @vue-dnd-kit/core
pnpm --filter @mahjong-game/client add -D vite @vitejs/plugin-vue unocss vitest typescript oxlint eslint eslint-plugin-vue eslint-plugin-oxlint
pnpm --filter @mahjong-game/server add fastify ws pino
pnpm --filter @mahjong-game/server add -D tsx vitest typescript @types/ws @types/node

# Verify
pnpm -r test
```

### First Steps

1. Initialize the monorepo with `pnpm-workspace.yaml` and all three `package.json` files
2. Set up `tsconfig.base.json` with `strict: true` and package-level tsconfigs with project references
3. Create `shared/src/types/` with initial type definitions (GameState, GameAction, Tile)
4. Create `shared/src/constants.ts` and `shared/src/defaults.ts`
5. Build the tile set definition and wall generation (Epic 1, Story 1)

### AI Tooling

No engine-specific MCP servers selected. Context7 is already available for documentation lookup. Playwright MCP can be added for E2E test development when needed.

---

## Document Information

**Document:** Mahjong Night - Game Architecture
**Version:** 1.0
**Created:** 2026-03-25
**Author:** Rchoi
**Status:** Complete

### Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-26 | Initial architecture complete |

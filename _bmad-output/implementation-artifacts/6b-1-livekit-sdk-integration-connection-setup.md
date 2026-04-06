# Story 6B.1: LiveKit SDK Integration & Connection Setup

Status: done

## Story

As a **developer**,
I want **the LiveKit client SDK integrated and connecting players to a voice/video room when they join a game room**,
So that **the WebRTC infrastructure is ready for audio and video streams (FR113, FR114)**.

## Acceptance Criteria

1. **Given** a player joins a game room, **When** the WebSocket connection is established and A/V permissions are granted, **Then** the LiveKit client connects to a LiveKit room mapped to the game room, establishing WebRTC peer connections

2. **Given** the LiveKit SDK, **When** integrated into the client, **Then** it is loaded separately from the core bundle (not counted toward the 5MB bundle target), and connection is initialized via a `useLiveKit` composable wrapping `livekit-client` (no Vue-specific SDK exists)

3. **Given** a LiveKit room, **When** checking room mapping, **Then** each game room has a corresponding LiveKit room; the server generates a LiveKit access token when a player joins, sent to the client for authentication

4. **Given** the LiveKit connection, **When** checking fallback behavior, **Then** if LiveKit connection fails, the game continues with text chat only — WebRTC failure never affects game state or playability (NFR23)

5. **Given** the LiveKit server infrastructure, **When** checking deployment requirements, **Then** TURN/STUN server configuration is documented for production deployment (NFR45)

## Tasks / Subtasks

- [x] Task 1: Add LiveKit dependencies (AC: #2, #3)
  - [x] 1.1 Add `livekit-server-sdk` (^2.15) to `packages/server/package.json`
  - [x] 1.2 Add `livekit-client` (^2.18) to `packages/client/package.json`
  - [x] 1.3 Run `vp install` to install and verify lockfile
  - [x] 1.4 Verify `livekit-client` is NOT bundled into the main chunk — add it to Vite's `build.rollupOptions.output.manualChunks` in client `vite.config.ts` as a separate `livekit` chunk

- [x] Task 2: Add LiveKit environment configuration (AC: #3, #5)
  - [x] 2.1 Add server env vars to `packages/server/.env.example`: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
  - [x] 2.2 Add client env var to `packages/client/.env.example`: `VITE_LIVEKIT_URL`
  - [x] 2.3 Create `packages/server/src/config/livekit.ts` that reads env vars and exports a typed config object (with validation — throw on missing vars in production, warn in dev)
  - [x] 2.4 Add `VITE_LIVEKIT_URL` resolution in a new `packages/client/src/composables/liveKitUrl.ts` (follow `wsUrl.ts` / `apiBaseUrl.ts` pattern — env var with fallback)

- [x] Task 3: Server-side LiveKit token generation (AC: #3)
  - [x] 3.1 Create `packages/server/src/websocket/livekit-handler.ts`
  - [x] 3.2 Implement `handleLiveKitTokenRequest(ws, parsed, room, playerId, logger)` handler function following the existing handler signature pattern (see `join-handler.ts`, `chat-handler.ts`)
  - [x] 3.3 Token generation: use `AccessToken` from `livekit-server-sdk` — set `identity` to `playerId`, `room` to `room.roomCode`, grant `roomJoin: true`, `canPublish: true`, `canSubscribe: true`
  - [x] 3.4 `toJwt()` is **async** in v2.x — must `await` it
  - [x] 3.5 Send token to client via new message type `LIVEKIT_TOKEN` with `{ version: 1, type: "LIVEKIT_TOKEN", token: string, url: string }`
  - [x] 3.6 Guard: only generate token if player is seated (not spectator) and room has an active game or lobby

- [x] Task 4: Define protocol messages in shared types (AC: #1, #3)
  - [x] 4.1 Add to `packages/shared/src/types/protocol.ts`:
    - `RequestLiveKitTokenMessage`: `{ version: 1, type: "REQUEST_LIVEKIT_TOKEN" }`
    - `LiveKitTokenMessage`: `{ version: 1, type: "LIVEKIT_TOKEN", token: string, url: string }`
  - [x] 4.2 Add `"REQUEST_LIVEKIT_TOKEN"` and `"LIVEKIT_TOKEN"` to the appropriate message type unions
  - [x] 4.3 Export from `packages/shared/src/index.ts` barrel

- [x] Task 5: Wire message dispatch in WebSocket server (AC: #3)
  - [x] 5.1 Add `case "REQUEST_LIVEKIT_TOKEN":` to the switch in `packages/server/src/websocket/ws-server.ts` (lines 100-329)
  - [x] 5.2 Route to `handleLiveKitTokenRequest()` from `livekit-handler.ts`
  - [x] 5.3 Import the handler at the top of `ws-server.ts`

- [x] Task 6: Client-side `useLiveKit` composable (AC: #1, #2, #4)
  - [x] 6.1 Create `packages/client/src/composables/useLiveKit.ts`
  - [x] 6.2 Import `Room`, `RoomEvent`, `ConnectionState`, `RemoteParticipant`, `Track` from `livekit-client`
  - [x] 6.3 Expose reactive state:
    - `connectionStatus: ref<"idle" | "connecting" | "connected" | "failed" | "disconnected">`
    - `room: shallowRef<Room | null>` (shallow — Room is a complex SDK object, not deeply reactive)
    - `remoteParticipants: ref<Map<string, RemoteParticipant>>`
    - `error: ref<string | null>`
  - [x] 6.4 Implement `connect(token: string, url: string)`:
    - Create `new Room({ adaptiveStream: true, dynacast: true })` 
    - Register event handlers BEFORE `room.connect()`
    - Handle `RoomEvent.ParticipantConnected`, `ParticipantDisconnected`, `Disconnected`, `Reconnecting`, `Reconnected`
    - Wrap `room.connect()` in try/catch — on failure, set status to `"failed"`, set error message, log warning (not error — A/V failure is expected graceful degradation)
  - [x] 6.5 Implement `disconnect()`: call `room.disconnect()`, reset state to idle
  - [x] 6.6 Implement `cleanup()` for `onUnmounted` — disconnect and nullify room ref
  - [x] 6.7 **Fallback behavior:** On any connection error, the composable sets `connectionStatus = "failed"` and the game continues normally — NO error modals, NO game-state impact

- [x] Task 7: Create `useLiveKitStore` Pinia store (AC: #1, #4)
  - [x] 7.1 Create `packages/client/src/stores/liveKit.ts`
  - [x] 7.2 Store state: `connectionStatus`, `token: string | null`, `liveKitUrl: string | null`
  - [x] 7.3 Actions: `setToken(token, url)`, `setConnectionStatus(status)`, `resetForRoomLeave()`
  - [x] 7.4 Wire `resetForRoomLeave()` into `resetSocialUiForSession()` in `useRoomConnection.ts` (same pattern as `reactionsStore`, `chatStore`, `activityTickerStore`)
  - [x] 7.5 Write co-located unit tests in `liveKit.test.ts`

- [x] Task 8: Integration — request token on room join (AC: #1, #3)
  - [x] 8.1 In `useRoomConnection.ts`, after receiving `STATE_UPDATE` with successful join (existing handler around the `parseServerMessage` dispatch):
    - Send `{ version: 1, type: "REQUEST_LIVEKIT_TOKEN" }` via WebSocket
  - [x] 8.2 Add handler for incoming `LIVEKIT_TOKEN` message in `parseServerMessage.ts`:
    - Store token/url in `useLiveKitStore`
    - Trigger `useLiveKit().connect(token, url)` (or emit event for the composable to pick up)
  - [x] 8.3 On disconnect/room leave, call `useLiveKit().disconnect()` and `liveKitStore.resetForRoomLeave()`

- [x] Task 9: TURN/STUN documentation (AC: #5)
  - [x] 9.1 Create `docs/livekit-deployment.md` documenting:
    - LiveKit Cloud setup (managed option)
    - Self-hosted LiveKit server requirements (ports: 7880, 7881, 50000-60000 UDP)
    - TURN/STUN configuration for NAT traversal
    - Environment variable reference
    - SSL requirements (self-signed certs do not work)
  - [x] 9.2 Add link to deployment doc from project README or CLAUDE.md

- [x] Task 10: Server-side tests (AC: #3, #4)
  - [x] 10.1 Create `packages/server/src/websocket/livekit-handler.test.ts`
  - [x] 10.2 Test: seated player requests token → receives `LIVEKIT_TOKEN` with valid JWT and URL
  - [x] 10.3 Test: unseated/spectator player requests token → receives `ERROR` response
  - [x] 10.4 Test: missing LiveKit config (no env vars) → graceful error, game continues
  - [x] 10.5 Mock `livekit-server-sdk` `AccessToken` class — don't call real LiveKit in tests

- [x] Task 11: Client-side tests (AC: #1, #2, #4)
  - [x] 11.1 Create `packages/client/src/composables/useLiveKit.test.ts`
  - [x] 11.2 Test: `connect()` with valid token → status transitions idle → connecting → connected
  - [x] 11.3 Test: `connect()` with invalid token → status transitions to failed, error message set
  - [x] 11.4 Test: `disconnect()` → status returns to idle, room nullified
  - [x] 11.5 Test: participant events update `remoteParticipants` map
  - [x] 11.6 Mock `livekit-client` `Room` class entirely — no real WebRTC in unit tests
  - [x] 11.7 Create `packages/client/src/stores/liveKit.test.ts` for store unit tests

- [x] Task 12: Backpressure gate (all ACs)
  - [x] 12.1 Run `pnpm test && pnpm run typecheck && vp lint` — all must pass

## Dev Notes

### Architecture & Data Flow

This story adds a **parallel communication channel** alongside the existing WebSocket connection. The WebSocket remains the authoritative game-state channel; LiveKit handles A/V streams independently.

**Token flow:** Client joins room via WebSocket → sends `REQUEST_LIVEKIT_TOKEN` → server generates JWT with `livekit-server-sdk` → sends `LIVEKIT_TOKEN` message → client's `useLiveKit` composable connects to LiveKit room.

**Critical invariant:** LiveKit failure NEVER impacts game state. The `useLiveKit` composable treats all connection failures as non-fatal — log a warning, set status to "failed", and the game continues with text chat only.

### Server Handler Pattern

Follow the exact pattern from existing handlers. Key reference: `packages/server/src/websocket/chat-handler.ts` and `join-handler.ts`.

Handler signature:
```typescript
export function handleLiveKitTokenRequest(
  ws: WebSocket,
  parsed: Record<string, unknown>,
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger
): void
```

Use `trySendJson(ws, payload, logger, "livekit-token")` for all responses (from `packages/server/src/websocket/ws-utils.ts`). This checks `readyState` before sending.

### Client Composable Pattern

The `useLiveKit` composable wraps the `livekit-client` SDK's `Room` class. It is NOT a Pinia store — it manages the LiveKit Room instance lifecycle. The Pinia store (`useLiveKitStore`) holds serializable state (token, URL, connection status) for reactivity across components.

**Why `shallowRef` for Room:** The LiveKit `Room` object is a complex class with internal state, event emitters, and WebRTC connections. Deep reactivity would be expensive and unnecessary — we only need to know when the Room instance changes (connected/disconnected), not track its internal mutations.

**Reference composables:** `useRoomConnection.ts` for WebSocket lifecycle, `wsUrl.ts` for URL resolution pattern.

### Bundle Separation (AC #2)

LiveKit SDK (~200-300KB gzipped) must NOT be in the main bundle. Add to Vite config:

```typescript
// packages/client/vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        livekit: ['livekit-client'],
      },
    },
  },
}
```

This ensures the SDK is loaded as a separate chunk, only fetched when A/V is used. The 5MB core bundle target (NFR6) excludes this chunk.

### LiveKit SDK Key APIs (v2.18)

**Server token generation:**
```typescript
import { AccessToken } from 'livekit-server-sdk';

const at = new AccessToken(apiKey, apiSecret, { identity: playerId });
at.addGrant({ roomJoin: true, room: roomCode, canPublish: true, canSubscribe: true });
const token = await at.toJwt(); // ASYNC in v2.x — must await
```

**Client connection:**
```typescript
import { Room, RoomEvent } from 'livekit-client';

const room = new Room({ adaptiveStream: true, dynacast: true });
room.on(RoomEvent.ParticipantConnected, (p) => { /* update state */ });
room.on(RoomEvent.Disconnected, (reason) => { /* handle gracefully */ });
await room.connect(url, token, { autoSubscribe: true });
```

**Important v2.x notes:**
- `toJwt()` is async (requires `await`)
- Register event handlers BEFORE calling `room.connect()`
- `Room` constructor accepts `RoomOptions` (adaptiveStream, dynacast, videoCaptureDefaults, audioCaptureDefaults)
- Use `room.disconnect()` for cleanup — always call in `onUnmounted`
- Key events: `RoomEvent.ParticipantConnected`, `ParticipantDisconnected`, `TrackSubscribed`, `TrackUnsubscribed`, `Disconnected`, `Reconnecting`, `Reconnected`, `ActiveSpeakersChanged`

### Environment Variables

**Server (`packages/server/.env`):**
```
LIVEKIT_URL=wss://your-project.livekit.cloud  # or self-hosted URL
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

**Client (`packages/client/.env`):**
```
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
```

The API key/secret are SERVER-ONLY — never expose to the client. The client only needs the LiveKit server URL (to connect after receiving a token).

If env vars are missing, the server should log a warning and return an error to the client when a token is requested — the game continues without A/V.

### Room Mapping Strategy

Use the game room's `roomCode` (6-char alphanumeric, e.g., `MHJG7K`) as the LiveKit room name. This is deterministic — all 4 players requesting tokens for the same room get tokens for the same LiveKit room. No separate LiveKit room creation step needed; LiveKit auto-creates rooms on first join.

### resetSocialUiForSession Integration

`resetSocialUiForSession()` in `useRoomConnection.ts` is the central cleanup hook called on disconnect/room leave. It currently resets: `chatStore`, `reactionsStore`, `activityTickerStore`. Add `liveKitStore.resetForRoomLeave()` here.

### Error Handling Philosophy

From architecture: "No technical error messages to players. The audience is 40-70+ non-gamers." If LiveKit fails:
- Log to console/pino (dev visibility)
- Set `connectionStatus = "failed"` (UI can optionally show friendly indicator)
- Game continues — text chat and reactions remain fully functional
- **NO error modals, NO "WebRTC connection failed" messages to players**

Story 6B.5 will add the "Reconnect A/V" button for manual retry. For 6B.1, just fail silently and degrade.

### Anti-Patterns to Avoid

1. **DO NOT make A/V a blocking dependency** — game must work if LiveKit is completely unavailable
2. **DO NOT store LiveKit API credentials in client env** — server-only, never sent to browser
3. **DO NOT deeply watch the LiveKit Room object** — use `shallowRef`, it's a complex SDK class
4. **DO NOT create a custom TURN/STUN server** — document how to configure LiveKit's built-in support
5. **DO NOT add LiveKit connection logic to `useRoomConnection.ts`** — keep it in a separate `useLiveKit` composable to maintain separation of concerns
6. **DO NOT import from `vitest`** — use `vite-plus/test` for test utilities
7. **DO NOT use `pnpm install`** — use `vp install` per project tooling
8. **DO NOT use `@/` import aliases** — use relative imports or `@mahjong-game/shared`

### Testing Standards

- Co-located test files next to source: `livekit-handler.test.ts`, `useLiveKit.test.ts`, `liveKit.test.ts`
- `import { ... } from "vite-plus/test"` (not `vitest`)
- `setActivePinia(createPinia())` in `beforeEach` for store tests
- happy-dom environment for client tests
- Mock the LiveKit SDK classes entirely — no real WebRTC connections in tests
- Server tests: use the existing test infrastructure pattern from `join-handler.test.ts` (dynamic port, `app.inject()` for HTTP, WebSocket client for WS)

### Cross-Story Context (6B.2-6B.5)

This story establishes the foundation that subsequent stories build on:
- **6B.2** (Video Thumbnails) will use `useLiveKit().remoteParticipants` to render video at seat positions
- **6B.3** (A/V Controls) will call `room.localParticipant.setCameraEnabled()` / `setMicrophoneEnabled()` through the composable
- **6B.4** (Speaking Indicator) will use `RoomEvent.ActiveSpeakersChanged` from the composable
- **6B.5** (Reconnection) will extend the composable's `connect()` to support auto-reconnect on WebSocket restore

Design the `useLiveKit` composable API with these future needs in mind — expose the `room` ref so downstream stories can access `localParticipant` and track events.

### Cross-Session Intelligence

- Room state was recently refactored (commit `e079dd7`) to use nested sub-objects (`room.turnTimer`, `room.votes`, `room.sessions`). Any new Room properties for LiveKit state should follow this nested pattern
- `trySendJson` helper established in 4B stories — use it for all outbound WebSocket messages
- `resetSocialUiForSession` is the canonical cleanup point — established across epics 6A, 4B, 5B
- The `broadcastStateToRoom` function from `state-broadcaster.ts` handles per-viewer state broadcasts — LiveKit tokens are NOT broadcast (they're per-player), so use direct `trySendJson` to the requesting player

### Project Structure Notes

- Handler: `packages/server/src/websocket/livekit-handler.ts` (alongside `join-handler.ts`, `chat-handler.ts`)
- Handler test: `packages/server/src/websocket/livekit-handler.test.ts`
- Server config: `packages/server/src/config/livekit.ts`
- Protocol types: `packages/shared/src/types/protocol.ts` (extend existing)
- Client composable: `packages/client/src/composables/useLiveKit.ts`
- Client composable test: `packages/client/src/composables/useLiveKit.test.ts`
- Client URL resolver: `packages/client/src/composables/liveKitUrl.ts`
- Pinia store: `packages/client/src/stores/liveKit.ts`
- Store test: `packages/client/src/stores/liveKit.test.ts`
- Deployment docs: `docs/livekit-deployment.md`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 6B: Voice & Video (WebRTC)]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — WebRTC SDK: LiveKit ^2.18 (client)]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Error Handling Tier 3: friendly language]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR23: PlayerPresence video frames]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR46: Friendly A/V permission prompts]
- [Source: packages/server/src/websocket/ws-server.ts — Message dispatch switch (lines 100-329)]
- [Source: packages/server/src/websocket/chat-handler.ts — Handler function pattern]
- [Source: packages/client/src/composables/useRoomConnection.ts — WebSocket lifecycle + resetSocialUiForSession]
- [Source: packages/client/src/composables/wsUrl.ts — URL resolution pattern]
- [Source: packages/shared/src/types/protocol.ts — Message type definitions]
- [Source: LiveKit JS SDK docs — livekit-client v2.18, livekit-server-sdk v2.15]

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation session)

### Debug Log References

### Completion Notes List

- LiveKit server token path: `REQUEST_LIVEKIT_TOKEN` → `handleLiveKitTokenRequest` → `LIVEKIT_TOKEN` with JWT + `LIVEKIT_URL`.
- Client: first `STATE_UPDATE` after join sends one token request per WebSocket session (`liveKitTokenRequested` dedupe).
- LiveKit WebSocket errors with codes `LIVEKIT_*` do not populate `lastErrorMessage` (silent degrade).
- Production boot: `validateLiveKitEnvOnBoot` requires all three `LIVEKIT_*` vars when `NODE_ENV=production`.

**Definition of Done (gds-dev-story checklist, follow-up pass 2026-04-06): PASS** — Story context and ACs satisfied; tests and gates current; `parseServerMessage` now includes `LIVEKIT_TOKEN` unit tests; README links deployment doc; implementation deltas below documented for reviewers.

**Story subtask vs implementation (intentional):**

- **4.2 unions:** `RequestLiveKitTokenMessage` / `LiveKitTokenMessage` are exported interfaces; there is no single shared discriminated union for all wire messages (N/A for this story).
- **6.2 / 6.3:** `useLiveKit` imports `Room`, `RoomEvent` from `livekit-client`; public API uses `unknown` for `room` / `remoteParticipants` refs where needed for portable `.d.ts` emit (not `ConnectionState` / `RemoteParticipant` / `Track` imports).
- **6.6:** `cleanup()` is exported; teardown is invoked from `useRoomConnection` (`resetSocialUiForSession` / disconnect), not `onUnmounted` inside `useLiveKit`.

### File List

- packages/server/package.json
- packages/client/package.json
- packages/client/vite.config.ts
- packages/server/.env.example
- packages/client/.env.example
- packages/server/src/config/livekit.ts
- packages/server/src/index.ts
- packages/server/src/websocket/livekit-handler.ts
- packages/server/src/websocket/livekit-handler.test.ts
- packages/server/src/websocket/ws-server.ts
- packages/server/src/websocket/ws-utils.ts (new — extracted shared trySendJson)
- packages/shared/src/types/protocol.ts
- packages/shared/src/index.ts
- packages/client/src/composables/useLiveKit.ts
- packages/client/src/composables/useLiveKit.test.ts
- packages/client/src/composables/useRoomConnection.ts
- packages/client/src/composables/parseServerMessage.ts
- packages/client/src/composables/parseServerMessage.test.ts
- packages/client/src/stores/liveKit.ts
- packages/client/src/stores/liveKit.test.ts
- docs/livekit-deployment.md
- CLAUDE.md
- README.md

### Change Log

- 2026-04-06: Implemented Story 6B.1 — LiveKit SDK, token protocol, `useLiveKit` + store, WS integration, docs, tests; backpressure gate passed.
- 2026-04-06: Follow-up pass — DoD checklist PASS; `LIVEKIT_TOKEN` parse tests; README link to LiveKit deployment doc; completion notes for subtask deltas.
- 2026-04-06: Code review fixes — [H1] added missing connect-failure test (Task 11.3); [M1] removed dead `liveKitUrl.ts` composable; [M2] extracted `trySendJson` to `ws-utils.ts`, eliminating duplication in ws-server.ts and livekit-handler.ts.

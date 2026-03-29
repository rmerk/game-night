# Story 4A.2: WebSocket Server & Connection Management

Status: done

## Story

As a **developer**,
I want **a WebSocket server running alongside Fastify that manages connections, enforces message size limits, and detects dead connections via heartbeat**,
So that **real-time communication infrastructure is ready for game state sync (AR4, AR30)**.

## Acceptance Criteria

1. **Given** the server is running **When** a WebSocket client connects **Then** the connection is accepted and tracked by the connection manager

2. **Given** the WebSocket server configuration **When** checking settings **Then** `maxPayload` is set to 64KB, and messages exceeding this are dropped before reaching the handler (AR30)

3. **Given** a connected client **When** 15 seconds pass **Then** the server sends a WebSocket `ping` frame; if no `pong` is received within 30 seconds (2 missed pings), the connection is considered dead and closed (AR30)

4. **Given** a malformed WebSocket message (not valid JSON, missing `version` field) **When** the server receives it **Then** it logs at WARN level and drops the message silently — no crash, no response (AR12)

5. **Given** a message with an unrecognized `version` value **When** the server receives it **Then** it responds with `{ type: 'ERROR', code: 'UNSUPPORTED_VERSION' }` and does not process the message (AR4)

## Tasks / Subtasks

- [x] Task 1: Create WebSocket server module (AC: #1, #2)
  - [x] 1.1 Create `packages/server/src/websocket/ws-server.ts` — initialize `ws.WebSocketServer` attached to Fastify's underlying HTTP server
  - [x] 1.2 Configure `maxPayload: 65536` (64KB) on the WebSocket server
  - [x] 1.3 Register the WebSocket server setup in `packages/server/src/index.ts` via `createApp()`
  - [x] 1.4 Write `ws-server.test.ts` — verify server accepts connections, verify maxPayload rejection

- [x] Task 2: Create connection tracker (AC: #1)
  - [x] 2.1 Create `packages/server/src/websocket/connection-tracker.ts` — track active WebSocket connections with metadata (connected timestamp, alive flag for heartbeat)
  - [x] 2.2 Implement `addConnection(ws)`, `removeConnection(ws)`, `getConnectionCount()`, `getAllConnections()`
  - [x] 2.3 Handle `close` event to auto-remove connections
  - [x] 2.4 Write `connection-tracker.test.ts` — verify add/remove/count lifecycle

- [x] Task 3: Implement heartbeat mechanism (AC: #3)
  - [x] 3.1 Add heartbeat interval (15 seconds) in ws-server that iterates all connections
  - [x] 3.2 For each connection: if `alive === false` → terminate; else set `alive = false` and send `ping`
  - [x] 3.3 On `pong` received → set `alive = true`
  - [x] 3.4 Clear heartbeat interval on server shutdown
  - [x] 3.5 Write heartbeat tests — verify ping/pong cycle, verify dead connection termination after 2 missed pings, verify connection survives when pong is received

- [x] Task 4: Create message handler with validation (AC: #4, #5)
  - [x] 4.1 Create `packages/server/src/websocket/message-handler.ts` — parse incoming messages
  - [x] 4.2 Implement JSON parse with try/catch — malformed JSON → WARN log + drop silently
  - [x] 4.3 Validate `version` field exists — missing → WARN log + drop silently
  - [x] 4.4 Validate `version` value is supported (currently only `1`) — unsupported → respond with `{ version: 1, type: 'ERROR', code: 'UNSUPPORTED_VERSION' }` + do not process
  - [x] 4.5 Wire message handler to WebSocket `message` event in ws-server
  - [x] 4.6 Write `message-handler.test.ts` — verify all validation paths: valid JSON parsed, invalid JSON dropped, missing version dropped, unsupported version gets error response

- [x] Task 5: Integrate with existing Fastify server (AC: #1)
  - [x] 5.1 Update `createApp()` in `index.ts` to accept and expose the WebSocket server
  - [x] 5.2 Ensure graceful shutdown: close all WebSocket connections and clear heartbeat interval when Fastify closes
  - [x] 5.3 Add integration test: start server, connect WebSocket client, send valid message, verify tracking

## Dev Notes

### Architecture Compliance

**Server-Authoritative Model (HARD RULE):**
- This story creates the WebSocket transport layer ONLY. No game logic dispatching yet (that's 4a-5).
- Message handler validates structure but does NOT route to game engine yet. Future stories will add action dispatching.
- The connection tracker is a foundation — 4a-3 will add room-scoped tracking and seat assignment.

**Concurrency Model (CRITICAL):**
- Node's single-threaded event loop guarantees sequential message processing per room.
- Do NOT introduce worker threads, async operations between validation and mutation, or any pattern that breaks the sequential guarantee.

**No Optimistic Updates (HARD RULE):**
- This story is server-side only, but the transport must support the full-state broadcast model. No delta/diff protocol.

### Technical Requirements

**Library:** `ws` ^8.20.0 (already in server package.json from 4a-1 setup)
- Use `ws.WebSocketServer`, NOT `ws.Server` (deprecated alias)
- Attach to Fastify's underlying `server` property: `new WebSocketServer({ server: fastify.server })`
- Do NOT use `@fastify/websocket` — the architecture specifies raw `ws` for full protocol control

**Heartbeat Implementation Pattern (from `ws` docs):**
```typescript
// Standard ws heartbeat pattern
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 15_000);

wss.on('close', () => clearInterval(interval));

// On each connection:
ws.isAlive = true;
ws.on('pong', () => { ws.isAlive = true; });
```

**Message Protocol Types (from shared/src/types/protocol.ts):**
- Check if `protocol.ts` exists in shared types. If not, create the minimal types needed:
  - `ServerErrorMessage { version: 1; type: 'ERROR'; code: string; message: string }`
  - Version constant: `PROTOCOL_VERSION = 1`
- Do NOT create the full `ClientMessage`, `ActionMessage`, `StateUpdate` types yet — those come in 4a-5

**Error Response Format:**
```json
{ "version": 1, "type": "ERROR", "code": "UNSUPPORTED_VERSION", "message": "Protocol version not supported" }
```

**Logging Requirements:**
- Use Fastify's built-in Pino logger, NOT a separate Pino instance
- Create child logger for WebSocket module: `logger.child({ module: 'websocket' })`
- Log levels:
  - INFO: WebSocket server started, connection opened, connection closed
  - WARN: Malformed message received, missing version field
  - DEBUG: Heartbeat ping sent, pong received
- Never log message payloads at INFO level (could contain sensitive data in future)

### File Structure Requirements

Create these new files:
```
packages/server/src/websocket/
  ws-server.ts              # WebSocket server setup, heartbeat, shutdown
  ws-server.test.ts         # Server lifecycle, heartbeat, maxPayload tests
  connection-tracker.ts     # Connection tracking (add, remove, count)
  connection-tracker.test.ts # Tracker unit tests
  message-handler.ts        # Parse, validate structure, version check
  message-handler.test.ts   # All validation paths
```

Modify these existing files:
```
packages/server/src/index.ts  # Wire WebSocket server into createApp()
```

### Testing Requirements

**Framework:** Vitest (already configured in `packages/server/vite.config.ts`)
- Config: `restoreMocks: true`, `clearMocks: true`, `unstubEnvs: true`, `unstubGlobals: true`

**Test Patterns (replicate from 4a-1):**
- Use `vi.useFakeTimers()` for heartbeat interval tests
- Use `ws` client library for integration tests (connect real WebSocket to test server)
- Use `app.inject()` pattern cannot test WebSocket — use actual port binding for WS integration tests
- Mock logger via `createMockLogger()` pattern from 4a-1 (see `routes.test.ts`)

**WebSocket Test Client Pattern:**
```typescript
import WebSocket from 'ws';

// Start server on random port for tests
const address = await fastify.listen({ port: 0 });
const wsUrl = address.replace('http', 'ws');
const client = new WebSocket(wsUrl);
await new Promise((resolve) => client.on('open', resolve));
// ... test interactions
client.close();
await fastify.close();
```

**Required Test Cases:**
1. WebSocket server accepts connections
2. maxPayload rejects oversized messages (send >64KB, verify connection not crashed)
3. Heartbeat sends ping after 15s (fake timers)
4. Dead connection terminated after missed pongs (advance timers by 45s+)
5. Pong resets alive flag (connection survives heartbeat cycle)
6. Malformed JSON → logged at WARN, no response sent
7. Missing `version` field → logged at WARN, no response sent
8. Unsupported `version` value → ERROR response with code `UNSUPPORTED_VERSION`
9. Valid message with `version: 1` → parsed successfully (not dropped)
10. Server shutdown closes all connections and clears heartbeat interval
11. Connection close event removes from tracker

### Previous Story Intelligence (4a-1)

**Patterns to replicate:**
- `createApp()` factory pattern — extend it, don't replace it
- Fastify plugin registration pattern for modular setup
- Child logger pattern: `logger.child({ context })` for scoped logging
- Test pattern: use real Fastify instance, not mocks, for integration tests

**Key decisions from 4a-1:**
- Node crypto for ID generation (use same for any IDs if needed)
- No database abstraction — in-memory data structures
- `createMockLogger()` helper — reuse this pattern for WebSocket tests

**Files to be aware of (do NOT modify unless necessary):**
- `packages/server/src/rooms/room-manager.ts` — Room CRUD. WebSocket server will need room manager reference in future stories (4a-3+), but NOT in this story.
- `packages/server/src/rooms/room.ts` — Room & PlayerInfo types. May need to import types later.
- `packages/server/src/http/routes.ts` — HTTP routes. Leave untouched.

**Code review findings from 4a-1 to avoid:**
- H1: Modular bias in random generation — use `crypto` properly if generating any random values
- Use `FastifyBaseLogger` type from fastify, not `pino.Logger`

### Anti-Patterns to Avoid

1. **Do NOT use `@fastify/websocket`** — architecture requires raw `ws` for full protocol control
2. **Do NOT add room-scoped logic** — this story is connection-level only. Room join is 4a-3
3. **Do NOT add session/token handling** — that's 4a-4
4. **Do NOT dispatch actions to game engine** — that's 4a-5
5. **Do NOT add state broadcasting** — that's 4a-5/4a-6
6. **Do NOT add reconnection logic** — that's Epic 4B
7. **Do NOT crash on malformed messages** — wrap all parsing in try/catch, log and drop
8. **Do NOT send responses for malformed JSON** — only respond for known-structure messages with wrong version
9. **Do NOT use `ws.Server`** — use `ws.WebSocketServer` (the current, non-deprecated name)
10. **Do NOT create a separate HTTP server** — attach to Fastify's `server` property

### Project Structure Notes

- Alignment: New `websocket/` directory follows the architecture's server folder structure exactly
- The `websocket/` directory will grow in future stories (4a-3 adds room-scoped tracking, 4a-5 adds state broadcaster)
- Connection tracker is intentionally simple now — it will be extended with room-scoping in 4a-3

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4A, Story 4A.2]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — WebSocket Server section, Heartbeat section, Message Protocol section]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Error Handling Three Tiers, Concurrency Model]
- [Source: _bmad-output/project-context.md — WebSocket Protocol, Input Sanitization, Information Boundary]
- [Source: _bmad-output/implementation-artifacts/4a-1-http-room-creation-room-codes.md — Dev Notes, Code Patterns]
- [Source: ws library docs — Heartbeat pattern, WebSocketServer API]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed EADDRINUSE in tests by guarding `start()` with `process.env.VITEST` check
- Fixed unhandled `MaxPayload` error by adding `ws.on("error")` handler on server connections
- Fixed all oxlint errors (no-base-to-string, unbound-method, no-named-as-default, no-unnecessary-boolean-literal-compare)

### Completion Notes List

- Created WebSocket server (`ws.WebSocketServer`) attached to Fastify's HTTP server with `maxPayload: 65536` (64KB)
- Created `ConnectionTracker` class: tracks connections with metadata, auto-removes on close event
- Implemented heartbeat: 15-second `ping` interval, terminates connections after 2 missed pongs, clears on shutdown
- Created message handler: validates JSON structure, version field presence, and version value; drops malformed messages silently, responds with `UNSUPPORTED_VERSION` error for wrong version
- Integrated WebSocket server into `createApp()` via `onReady` hook with `wsContext` exposed on FastifyInstance
- Graceful shutdown: Fastify `onClose` hook terminates all connections and clears heartbeat interval
- Created minimal `PROTOCOL_VERSION` and `ServerErrorMessage` types in `shared/src/types/protocol.ts`
- All 60 server tests pass (28 new + 32 existing), 0 lint errors, 0 regressions in shared (571 tests)

### Change Log

- 2026-03-28: Implemented all 5 tasks for WebSocket server & connection management
- 2026-03-28: Code review fixes — converted heartbeat tests to fake timers (80s→<1s), removed redundant removeConnection call in heartbeat termination path

### File List

New files:
- packages/shared/src/types/protocol.ts
- packages/server/src/websocket/ws-server.ts
- packages/server/src/websocket/ws-server.test.ts
- packages/server/src/websocket/connection-tracker.ts
- packages/server/src/websocket/connection-tracker.test.ts
- packages/server/src/websocket/message-handler.ts
- packages/server/src/websocket/message-handler.test.ts

Modified files:
- packages/shared/src/index.ts (added protocol type exports)
- packages/server/src/index.ts (added WebSocket server setup, VITEST guard for start())

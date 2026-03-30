# Epic 4A Adversarial Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the 6 highest-impact findings from the Epic 4A adversarial review: rate limiting, grace period security, state resync, E2E integration test, view filtering test gaps, and maxPayload validation.

**Architecture:** Each task is independent and can be implemented in any order. Rate limiting uses Fastify plugin for HTTP and a custom per-IP tracker for WebSocket. State resync adds a new REQUEST_STATE message type to the protocol. The grace period fix removes displayName-based recovery entirely (token-only reconnection). Tests are additive — no existing behavior changes.

**Tech Stack:** Fastify, ws (WebSocket), @fastify/rate-limit, Vitest, TypeScript

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/server/src/http/routes.ts` | Add rate limit plugin registration |
| `packages/server/src/websocket/ws-server.ts` | Add per-IP connection throttle |
| `packages/server/src/websocket/connection-tracker.ts` | Extend with IP tracking |
| `packages/server/src/websocket/join-handler.ts` | Remove `tryGracePeriodRecovery`, add REQUEST_STATE handling |
| `packages/server/src/websocket/message-handler.ts` | Route REQUEST_STATE messages |
| `packages/shared/src/types/protocol.ts` | Add RequestStateMessage type |
| `packages/server/src/http/routes.test.ts` | Rate limit tests |
| `packages/server/src/websocket/ws-server.test.ts` | Connection throttle tests |
| `packages/server/src/websocket/join-handler.test.ts` | Remove grace period recovery tests, add REQUEST_STATE tests |
| `packages/server/src/websocket/state-broadcaster.test.ts` | Sensitive field filtering tests |
| `packages/server/src/integration/full-game-flow.test.ts` | E2E integration test |

---

### Task 1: HTTP Rate Limiting

**Files:**
- Modify: `packages/server/package.json`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/http/routes.ts`
- Test: `packages/server/src/http/routes.test.ts`

- [ ] **Step 1: Install @fastify/rate-limit**

```bash
cd packages/server && pnpm add @fastify/rate-limit
```

- [ ] **Step 2: Write the failing test for room creation rate limiting**

Add to `packages/server/src/http/routes.test.ts`:

```typescript
describe("rate limiting", () => {
  it("rejects room creation after exceeding rate limit", async () => {
    const app = createApp();
    await app.ready();

    // Send 11 requests (limit is 10 per minute)
    const responses = [];
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { hostName: `Host${i}` },
      });
      responses.push(res);
    }

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      expect(responses[i].statusCode).toBe(201);
    }

    // 11th should be rate limited
    expect(responses[10].statusCode).toBe(429);

    await app.close();
  });

  it("does not rate limit health checks", async () => {
    const app = createApp();
    await app.ready();

    for (let i = 0; i < 20; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/health",
      });
      expect(res.statusCode).toBe(200);
    }

    await app.close();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/server && pnpm vitest run src/http/routes.test.ts --reporter=verbose`
Expected: FAIL — no rate limiting configured

- [ ] **Step 4: Register rate limit plugin in createApp**

In `packages/server/src/index.ts`, add the import and register it:

```typescript
import fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { RoomManager } from "./rooms/room-manager";
import { roomRoutes } from "./http/routes";
import { setupWebSocketServer, type WsServerContext } from "./websocket/ws-server";

declare module "fastify" {
  interface FastifyInstance {
    wsContext?: WsServerContext;
    roomManager: RoomManager;
  }
}

export function createApp(): FastifyInstance {
  const app = fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  const roomManager = new RoomManager();

  app.register(rateLimit, {
    max: 10,
    timeWindow: "1 minute",
    allowList: (req) => req.url === "/health",
  });

  app.decorate("roomManager", roomManager);
  app.register(roomRoutes, { roomManager });

  app.addHook("onReady", async () => {
    app.wsContext = setupWebSocketServer(app, roomManager);
  });

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/server && pnpm vitest run src/http/routes.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `cd packages/server && pnpm vitest run --reporter=verbose`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/server/package.json packages/server/src/index.ts packages/server/src/http/routes.test.ts pnpm-lock.yaml
git commit -m "feat(server): add HTTP rate limiting for room creation

Addresses adversarial review finding #4: no rate limiting on endpoints.
Limits POST /api/rooms to 10 requests/minute per IP. Health endpoint exempt."
```

---

### Task 2: WebSocket Connection Throttle

**Files:**
- Modify: `packages/server/src/websocket/connection-tracker.ts`
- Modify: `packages/server/src/websocket/ws-server.ts`
- Test: `packages/server/src/websocket/connection-tracker.test.ts`
- Test: `packages/server/src/websocket/ws-server.test.ts`

- [ ] **Step 1: Write the failing test for per-IP connection limiting**

Add to `packages/server/src/websocket/connection-tracker.test.ts`:

```typescript
describe("per-IP tracking", () => {
  it("tracks connection count per IP", () => {
    const tracker = new ConnectionTracker();
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    tracker.addConnection(ws1, "192.168.1.1");
    tracker.addConnection(ws2, "192.168.1.1");

    expect(tracker.getConnectionCountByIp("192.168.1.1")).toBe(2);
  });

  it("decrements count when connection closes", () => {
    const tracker = new ConnectionTracker();
    const ws = createMockWs();

    tracker.addConnection(ws, "192.168.1.1");
    expect(tracker.getConnectionCountByIp("192.168.1.1")).toBe(1);

    // Simulate close
    tracker.removeConnection(ws);
    expect(tracker.getConnectionCountByIp("192.168.1.1")).toBe(0);
  });

  it("rejects connections exceeding per-IP limit", () => {
    const tracker = new ConnectionTracker({ maxConnectionsPerIp: 5 });
    const ip = "10.0.0.1";

    for (let i = 0; i < 5; i++) {
      expect(tracker.canConnect(ip)).toBe(true);
      tracker.addConnection(createMockWs(), ip);
    }

    expect(tracker.canConnect(ip)).toBe(false);
  });

  it("allows connections from different IPs independently", () => {
    const tracker = new ConnectionTracker({ maxConnectionsPerIp: 2 });

    tracker.addConnection(createMockWs(), "10.0.0.1");
    tracker.addConnection(createMockWs(), "10.0.0.1");
    tracker.addConnection(createMockWs(), "10.0.0.2");

    expect(tracker.canConnect("10.0.0.1")).toBe(false);
    expect(tracker.canConnect("10.0.0.2")).toBe(true);
  });
});
```

Where `createMockWs` is a helper that returns a mock WebSocket with an `on` method (matching the existing test pattern).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && pnpm vitest run src/websocket/connection-tracker.test.ts --reporter=verbose`
Expected: FAIL — `addConnection` doesn't accept IP, `canConnect` doesn't exist

- [ ] **Step 3: Implement per-IP tracking in ConnectionTracker**

Replace `packages/server/src/websocket/connection-tracker.ts`:

```typescript
import type { WebSocket } from "ws";

export interface TrackedConnection {
  ws: WebSocket;
  ip: string;
  connectedAt: number;
}

export interface ConnectionTrackerOptions {
  maxConnectionsPerIp?: number;
}

const DEFAULT_MAX_CONNECTIONS_PER_IP = 10;

export class ConnectionTracker {
  private connections = new Map<WebSocket, TrackedConnection>();
  private ipCounts = new Map<string, number>();
  private maxConnectionsPerIp: number;

  constructor(options: ConnectionTrackerOptions = {}) {
    this.maxConnectionsPerIp = options.maxConnectionsPerIp ?? DEFAULT_MAX_CONNECTIONS_PER_IP;
  }

  canConnect(ip: string): boolean {
    return (this.ipCounts.get(ip) ?? 0) < this.maxConnectionsPerIp;
  }

  addConnection(ws: WebSocket, ip: string): void {
    const tracked: TrackedConnection = {
      ws,
      ip,
      connectedAt: Date.now(),
    };
    this.connections.set(ws, tracked);
    this.ipCounts.set(ip, (this.ipCounts.get(ip) ?? 0) + 1);

    ws.on("close", () => {
      this.removeConnection(ws);
    });
  }

  removeConnection(ws: WebSocket): void {
    const tracked = this.connections.get(ws);
    if (tracked) {
      const count = (this.ipCounts.get(tracked.ip) ?? 1) - 1;
      if (count <= 0) {
        this.ipCounts.delete(tracked.ip);
      } else {
        this.ipCounts.set(tracked.ip, count);
      }
    }
    this.connections.delete(ws);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnectionCountByIp(ip: string): number {
    return this.ipCounts.get(ip) ?? 0;
  }

  getAllConnections(): ReadonlyMap<WebSocket, TrackedConnection> {
    return this.connections;
  }
}
```

- [ ] **Step 4: Run connection-tracker tests to verify they pass**

Run: `cd packages/server && pnpm vitest run src/websocket/connection-tracker.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Update ws-server.ts to enforce per-IP limit**

In `packages/server/src/websocket/ws-server.ts`, update the connection handler to extract IP and check the limit:

```typescript
wss.on("connection", (ws: WebSocket, req) => {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  if (!connectionTracker.canConnect(ip)) {
    logger.warn({ ip }, "Connection rejected: per-IP limit exceeded");
    ws.close(4029, "TOO_MANY_CONNECTIONS");
    return;
  }

  ws.isAlive = true;
  connectionTracker.addConnection(ws, ip);
  logger.info({ ip }, "WebSocket connection opened");

  // ... rest of existing handler unchanged
```

- [ ] **Step 6: Fix existing ws-server tests that call addConnection without IP**

Update any existing test that creates a ConnectionTracker or calls `addConnection` to pass an IP string. The mock pattern is:

```typescript
connectionTracker.addConnection(ws, "127.0.0.1");
```

- [ ] **Step 7: Run full server test suite**

Run: `cd packages/server && pnpm vitest run --reporter=verbose`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/websocket/connection-tracker.ts packages/server/src/websocket/connection-tracker.test.ts packages/server/src/websocket/ws-server.ts packages/server/src/websocket/ws-server.test.ts
git commit -m "feat(server): add per-IP WebSocket connection throttle

Addresses adversarial review finding #4: no WebSocket abuse protection.
ConnectionTracker now tracks per-IP counts (default limit: 10).
Connections exceeding the limit are closed with 4029 TOO_MANY_CONNECTIONS."
```

---

### Task 3: Remove Grace Period DisplayName Recovery (Security Fix)

**Files:**
- Modify: `packages/server/src/websocket/join-handler.ts`
- Test: `packages/server/src/websocket/join-handler.test.ts`

- [ ] **Step 1: Identify and read the existing grace period recovery tests**

Read `packages/server/src/websocket/join-handler.test.ts` and find all tests related to `tryGracePeriodRecovery` or "grace period recovery" or "displayName" recovery. Note their test names and line numbers.

- [ ] **Step 2: Write a test proving displayName-only recovery no longer works**

Add to `packages/server/src/websocket/join-handler.test.ts`:

```typescript
it("does not recover seat via displayName alone (token required)", async () => {
  // Player joins, disconnects (enters grace period), new WS connects with same displayName but no token
  // Expected: treated as NEW player, gets a new seat — does NOT recover the old seat
  const app = createApp();
  await app.ready();
  const address = await app.listen({ port: 0 });
  const wsUrl = address.replace("http", "ws");

  // Create room
  const roomRes = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: { hostName: "Alice" },
  });
  const { roomCode } = roomRes.json();

  // Player 1 joins
  const ws1 = new WebSocket(wsUrl);
  await waitForOpen(ws1);
  ws1.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }));
  const msg1 = await waitForMessage(ws1);
  const playerId1 = msg1.state.myPlayerId;

  // Player 1 disconnects
  ws1.close();
  await waitForClose(ws1);

  // New connection with same displayName but no token
  const ws2 = new WebSocket(wsUrl);
  await waitForOpen(ws2);
  ws2.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }));
  const msg2 = await waitForMessage(ws2);

  // Should get a DIFFERENT playerId (new seat, not recovered)
  expect(msg2.state.myPlayerId).not.toBe(playerId1);

  ws2.close();
  await app.close();
});
```

- [ ] **Step 3: Run test to verify it fails (current code recovers via displayName)**

Run: `cd packages/server && pnpm vitest run src/websocket/join-handler.test.ts -t "does not recover seat via displayName" --reporter=verbose`
Expected: FAIL — current code returns the same playerId

- [ ] **Step 4: Remove tryGracePeriodRecovery function and its call site**

In `packages/server/src/websocket/join-handler.ts`:

1. Delete the entire `tryGracePeriodRecovery` function (lines ~142-211)
2. Delete the call site in `handleJoinRoom` (line ~319):

```typescript
// DELETE THIS BLOCK:
// Grace period recovery: tokenless client with matching displayName
if (!token && tryGracePeriodRecovery(ws, room, sanitizedName, logger, roomManager)) {
  return;
}
```

- [ ] **Step 5: Remove or update existing grace period recovery tests**

In `packages/server/src/websocket/join-handler.test.ts`, find and remove tests that assert displayName-based recovery works. These tests are now testing removed behavior.

- [ ] **Step 6: Run test to verify the new test passes**

Run: `cd packages/server && pnpm vitest run src/websocket/join-handler.test.ts --reporter=verbose`
Expected: PASS — all tests pass, new test confirms no displayName recovery

- [ ] **Step 7: Run full server test suite**

Run: `cd packages/server && pnpm vitest run --reporter=verbose`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/websocket/join-handler.ts packages/server/src/websocket/join-handler.test.ts
git commit -m "fix(server): remove displayName-based grace period recovery

Addresses adversarial review finding #3: grace period recovery using
displayName matching is trivially spoofable. Reconnection now requires
the session token. Players who lose their token get a new seat."
```

---

### Task 4: State Resync Mechanism (REQUEST_STATE)

**Files:**
- Modify: `packages/shared/src/types/protocol.ts`
- Modify: `packages/shared/src/index.ts` (if RequestStateMessage needs export)
- Modify: `packages/server/src/websocket/ws-server.ts`
- Modify: `packages/server/src/websocket/state-broadcaster.ts`
- Test: `packages/server/src/websocket/ws-server.test.ts`

- [ ] **Step 1: Add RequestStateMessage to protocol types**

In `packages/shared/src/types/protocol.ts`, add:

```typescript
/** Client → Server: request full state resync (e.g., after suspected missed update) */
export interface RequestStateMessage {
  version: typeof PROTOCOL_VERSION;
  type: "REQUEST_STATE";
}
```

Export it from `packages/shared/src/index.ts` if the barrel file re-exports protocol types.

- [ ] **Step 2: Write the failing test for REQUEST_STATE handling**

Add to `packages/server/src/websocket/ws-server.test.ts` (or create a new test file if more appropriate):

```typescript
describe("REQUEST_STATE", () => {
  it("responds with current lobby state when in lobby", async () => {
    // Setup: create room, join player, send REQUEST_STATE
    // Assert: receives STATE_UPDATE with LobbyState
    const app = createApp();
    await app.ready();
    const address = await app.listen({ port: 0 });
    const wsUrl = address.replace("http", "ws");

    const roomRes = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "Alice" },
    });
    const { roomCode } = roomRes.json();

    const ws = new WebSocket(wsUrl);
    await waitForOpen(ws);
    ws.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }));
    await waitForMessage(ws); // Initial STATE_UPDATE

    // Request resync
    ws.send(JSON.stringify({ version: 1, type: "REQUEST_STATE" }));
    const resync = await waitForMessage(ws);

    expect(resync.type).toBe("STATE_UPDATE");
    expect(resync.state.gamePhase).toBe("lobby");
    expect(resync.state.myPlayerId).toBeDefined();

    ws.close();
    await app.close();
  });

  it("responds with filtered game state when game is in progress", async () => {
    const app = createApp();
    await app.ready();
    const address = await app.listen({ port: 0 });
    const wsUrl = address.replace("http", "ws");

    const roomRes = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "Alice" },
    });
    const { roomCode } = roomRes.json();

    // Join 4 players
    const players: { ws: WebSocket; playerId: string }[] = [];
    for (const name of ["Alice", "Bob", "Carol", "Dave"]) {
      const ws = new WebSocket(wsUrl);
      await waitForOpen(ws);
      ws.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: name }));
      const msg = await waitForMessage(ws);
      players.push({ ws, playerId: msg.state.myPlayerId });
    }

    // Drain PLAYER_JOINED broadcasts
    for (let i = 0; i < 3; i++) await waitForMessage(players[0].ws);
    for (let i = 0; i < 2; i++) await waitForMessage(players[1].ws);
    await waitForMessage(players[2].ws);

    // Host starts game
    players[0].ws.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    for (const p of players) await waitForMessage(p.ws); // Consume game start STATE_UPDATE

    // Player 0 requests resync
    players[0].ws.send(JSON.stringify({ version: 1, type: "REQUEST_STATE" }));
    const resync = await waitForMessage(players[0].ws);

    expect(resync.type).toBe("STATE_UPDATE");
    expect(resync.state.gamePhase).toBe("play");
    expect(resync.state.myPlayerId).toBe(players[0].playerId);
    expect(resync.state.myRack.length).toBeGreaterThan(0);

    // Verify no opponent rack data in resync response
    expect("wall" in resync.state).toBe(false);
    expect("card" in resync.state).toBe(false);

    for (const p of players) p.ws.close();
    await app.close();
  });

  it("rejects REQUEST_STATE from unauthenticated connection", async () => {
    const app = createApp();
    await app.ready();
    const address = await app.listen({ port: 0 });
    const wsUrl = address.replace("http", "ws");

    const ws = new WebSocket(wsUrl);
    await waitForOpen(ws);

    // Send REQUEST_STATE without joining a room
    ws.send(JSON.stringify({ version: 1, type: "REQUEST_STATE" }));
    const msg = await waitForMessage(ws);

    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("NOT_IN_ROOM");

    ws.close();
    await app.close();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/server && pnpm vitest run src/websocket/ws-server.test.ts -t "REQUEST_STATE" --reporter=verbose`
Expected: FAIL — REQUEST_STATE is not handled

- [ ] **Step 4: Add a sendCurrentState helper to state-broadcaster.ts**

In `packages/server/src/websocket/state-broadcaster.ts`, add:

```typescript
import { buildLobbyState } from "./join-handler";

/**
 * Send the current state to a single player (for resync).
 * Sends lobby state if no game is active, or filtered game view if game is in progress.
 */
export function sendCurrentState(room: Room, playerId: string, ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  let state: LobbyState | PlayerGameView;
  if (room.gameState) {
    state = buildPlayerView(room, room.gameState, playerId);
  } else {
    // Build lobby state inline (same as join-handler's buildLobbyState)
    const players = Array.from(room.players.values()).map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      wind: p.wind,
      isHost: p.isHost,
      connected: p.connected,
    }));
    state = {
      roomId: room.roomId,
      roomCode: room.roomCode,
      gamePhase: "lobby" as const,
      players,
      myPlayerId: playerId,
    };
  }

  const message: StateUpdateMessage = {
    version: PROTOCOL_VERSION,
    type: "STATE_UPDATE",
    state,
  };
  ws.send(JSON.stringify(message));
}
```

Note: You may need to either export `buildLobbyState` from join-handler.ts, or inline the lobby state construction. Inlining is simpler and avoids a circular dependency risk.

- [ ] **Step 5: Handle REQUEST_STATE in ws-server.ts message routing**

In `packages/server/src/websocket/ws-server.ts`, add a case for REQUEST_STATE in the message handler:

```typescript
} else if (parsed.type === "REQUEST_STATE") {
  const session = roomManager.findSessionByWs(ws);
  if (!session) {
    ws.send(
      JSON.stringify({
        version: 1,
        type: "ERROR",
        code: "NOT_IN_ROOM",
        message: "You must join a room before requesting state",
      }),
    );
    return;
  }
  sendCurrentState(session.room, session.playerId, ws);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/server && pnpm vitest run src/websocket/ws-server.test.ts -t "REQUEST_STATE" --reporter=verbose`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `cd packages/server && pnpm vitest run --reporter=verbose`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/types/protocol.ts packages/server/src/websocket/ws-server.ts packages/server/src/websocket/state-broadcaster.ts packages/server/src/websocket/ws-server.test.ts
git commit -m "feat(server): add REQUEST_STATE message for client state resync

Addresses adversarial review finding #6: no mechanism for clients to
recover from missed STATE_UPDATE messages. Clients can now send
REQUEST_STATE to get their current filtered view re-sent."
```

---

### Task 5: Exhaustive buildPlayerView Filtering Tests

**Files:**
- Test: `packages/server/src/websocket/state-broadcaster.test.ts`

- [ ] **Step 1: Write tests for call window state filtering**

Add to `packages/server/src/websocket/state-broadcaster.test.ts`:

```typescript
describe("sensitive field filtering", () => {
  it("callWindow state is identical for all players (no hidden data leaked)", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
      createTestPlayer("player-2", "west"),
      createTestPlayer("player-3", "north"),
    ];
    const wsList = players.map(() => createMockWs());
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    // Set up active call window with calls from specific players
    gameState.callWindow = {
      status: "frozen",
      discardedTile: { id: "dot-5-1", category: "suited", suit: "dot", value: 5, copy: 1 },
      discarderId: "player-0",
      passes: ["player-2"],
      calls: [
        { callType: "pung", playerId: "player-1", tileIds: ["crak-5-1", "crak-5-2"] },
        { callType: "kong", playerId: "player-3", tileIds: ["bam-7-1", "bam-7-2", "bam-7-3"] },
      ],
      openedAt: Date.now(),
      confirmingPlayerId: null,
      confirmationExpiresAt: null,
      remainingCallers: [],
      winningCall: null,
    };

    // Build views for all 4 players
    const view0 = buildPlayerView(room, gameState, "player-0");
    const view1 = buildPlayerView(room, gameState, "player-1");
    const view2 = buildPlayerView(room, gameState, "player-2");
    const view3 = buildPlayerView(room, gameState, "player-3");

    // Call window should be identical for all players — no per-player filtering
    expect(view0.callWindow).toEqual(view1.callWindow);
    expect(view1.callWindow).toEqual(view2.callWindow);
    expect(view2.callWindow).toEqual(view3.callWindow);

    // Verify call window data is present (not stripped)
    expect(view0.callWindow?.calls).toHaveLength(2);
    expect(view0.callWindow?.passes).toEqual(["player-2"]);
  });

  it("pendingMahjong state is identical for all players", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
      createTestPlayer("player-2", "west"),
      createTestPlayer("player-3", "north"),
    ];
    const wsList = players.map(() => createMockWs());
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    gameState.pendingMahjong = {
      playerId: "player-1",
      path: "self-drawn",
      previousTurnPhase: "draw",
      previousCallWindow: null,
    };

    const views = players.map((p) => buildPlayerView(room, gameState, p.playerId));

    // All players see the same pendingMahjong state
    for (let i = 1; i < views.length; i++) {
      expect(views[i].pendingMahjong).toEqual(views[0].pendingMahjong);
    }
  });

  it("challengeState is identical for all players", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
      createTestPlayer("player-2", "west"),
      createTestPlayer("player-3", "north"),
    ];
    const wsList = players.map(() => createMockWs());
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    gameState.challengeState = {
      challengerId: "player-2",
      winnerId: "player-1",
      votes: { "player-0": "valid", "player-3": "invalid" },
      challengeExpiresAt: Date.now() + 30000,
      originalGameResult: {
        winnerId: "player-1",
        patternId: "test-pattern",
        patternName: "Test Pattern",
        points: 25,
        selfDrawn: false,
        discarderId: "player-0",
        payments: { "player-0": -50, "player-1": 75, "player-2": -25, "player-3": 0 },
      },
      calledTile: null,
    };

    const views = players.map((p) => buildPlayerView(room, gameState, p.playerId));

    for (let i = 1; i < views.length; i++) {
      expect(views[i].challengeState).toEqual(views[0].challengeState);
    }
  });

  it("gameState.card (NMJL card data) is NOT included in PlayerGameView", () => {
    const players = [createTestPlayer("player-0", "east", true)];
    const wsList = [createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    // card is internal server state — should never appear in view
    gameState.card = { year: 2024, sections: [], patterns: [] } as any;

    const view = buildPlayerView(room, gameState, "player-0");

    // PlayerGameView type does not have a `card` field
    expect("card" in view).toBe(false);
  });

  it("gameState.wall (tile draw pile) is NOT included in PlayerGameView", () => {
    const players = [createTestPlayer("player-0", "east", true)];
    const wsList = [createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    gameState.wall = [
      { id: "bam-9-1", category: "suited", suit: "bam", value: 9, copy: 1 },
    ];

    const view = buildPlayerView(room, gameState, "player-0");

    // Only wallRemaining (count) is exposed, not the actual tiles
    expect("wall" in view).toBe(false);
    expect(view.wallRemaining).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd packages/server && pnpm vitest run src/websocket/state-broadcaster.test.ts -t "sensitive field filtering" --reporter=verbose`
Expected: PASS — these are verifying existing correct behavior

- [ ] **Step 3: If any test fails, investigate and fix the production code**

If `card` or `wall` leaks into the view, update `buildPlayerView` in `state-broadcaster.ts` to exclude them. Based on code review, `buildPlayerView` explicitly constructs the return object and does NOT include `card` or `wall`, so these tests should pass as-is.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/websocket/state-broadcaster.test.ts
git commit -m "test(server): add exhaustive view filtering tests for sensitive fields

Addresses adversarial review finding #13: buildPlayerView was only tested
for rack isolation. Now also verifies callWindow, pendingMahjong,
challengeState consistency across players, and confirms card/wall
never leak into PlayerGameView."
```

---

### Task 6: MaxPayload Validation Test

**Files:**
- Test: `packages/server/src/websocket/ws-server.test.ts`

- [ ] **Step 1: Write test verifying maxPayload enforcement**

Add to `packages/server/src/websocket/ws-server.test.ts`:

```typescript
describe("maxPayload", () => {
  it("closes connection when message exceeds 64KB", async () => {
    const app = createApp();
    await app.ready();
    const address = await app.listen({ port: 0 });
    const wsUrl = address.replace("http", "ws");

    const ws = new WebSocket(wsUrl, { maxPayload: 0 }); // Client allows any size
    await waitForOpen(ws);

    // Send a message larger than 64KB (65,536 bytes)
    const oversizedPayload = JSON.stringify({
      version: 1,
      type: "JOIN_ROOM",
      roomCode: "TEST01",
      displayName: "A".repeat(70_000),
    });

    const closePromise = new Promise<{ code: number }>((resolve) => {
      ws.on("close", (code) => resolve({ code }));
    });

    ws.send(oversizedPayload);
    const { code } = await closePromise;

    // WebSocket library closes with 1009 (message too big) or 1006 (abnormal)
    expect([1006, 1009]).toContain(code);

    await app.close();
  });

  it("accepts messages under 64KB", async () => {
    const app = createApp();
    await app.ready();
    const address = await app.listen({ port: 0 });
    const wsUrl = address.replace("http", "ws");

    // Create a room first
    const roomRes = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "Alice" },
    });
    const { roomCode } = roomRes.json();

    const ws = new WebSocket(wsUrl);
    await waitForOpen(ws);

    // Send a normal-sized JOIN_ROOM
    ws.send(JSON.stringify({
      version: 1,
      type: "JOIN_ROOM",
      roomCode,
      displayName: "Alice",
    }));

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("STATE_UPDATE");

    ws.close();
    await app.close();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd packages/server && pnpm vitest run src/websocket/ws-server.test.ts -t "maxPayload" --reporter=verbose`
Expected: PASS — the ws library enforces maxPayload already, this just proves it

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/websocket/ws-server.test.ts
git commit -m "test(server): add maxPayload enforcement tests

Addresses adversarial review finding #7: 64KB maxPayload was set but
never tested. Verifies oversized messages cause connection close and
normal messages work correctly."
```

---

### Task 7: End-to-End Integration Test

**Files:**
- Create: `packages/server/src/integration/full-game-flow.test.ts`

- [ ] **Step 1: Create the integration test directory**

```bash
mkdir -p packages/server/src/integration
```

- [ ] **Step 2: Write the full game flow integration test**

Create `packages/server/src/integration/full-game-flow.test.ts`:

```typescript
import { describe, expect, it, afterEach } from "vitest";
import { WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import { createApp } from "../index";

/**
 * End-to-end integration test: room creation → 4 players join → game start → action → cleanup.
 * Addresses adversarial review finding #9: no test validates the full integrated flow.
 */

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.on("open", resolve);
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    ws.once("message", (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

function waitForClose(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on("close", () => resolve());
  });
}

describe("Full Game Flow Integration", () => {
  let app: FastifyInstance;
  let wsUrl: string;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    sockets.length = 0;
    if (app) await app.close();
  });

  function createWs(): WebSocket {
    const ws = new WebSocket(wsUrl);
    sockets.push(ws);
    return ws;
  }

  async function joinPlayer(roomCode: string, name: string): Promise<{ ws: WebSocket; playerId: string; token: string }> {
    const ws = createWs();
    await waitForOpen(ws);
    ws.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: name }));
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe("STATE_UPDATE");
    return { ws, playerId: msg.state.myPlayerId, token: msg.token };
  }

  it("room creation → 4 players join → game start → discard → room cleanup", async () => {
    app = createApp();
    await app.ready();
    const address = await app.listen({ port: 0 });
    wsUrl = address.replace("http", "ws");

    // 1. Create room via HTTP
    const roomRes = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "Alice" },
    });
    expect(roomRes.statusCode).toBe(201);
    const { roomCode } = roomRes.json();

    // 2. Verify room status
    const statusRes = await app.inject({
      method: "GET",
      url: `/api/rooms/${roomCode}/status`,
    });
    expect(statusRes.json().playerCount).toBe(0);
    expect(statusRes.json().phase).toBe("lobby");

    // 3. Four players join via WebSocket
    const alice = await joinPlayer(roomCode, "Alice");
    const bob = await joinPlayer(roomCode, "Bob");
    const carol = await joinPlayer(roomCode, "Carol");
    const dave = await joinPlayer(roomCode, "Dave");

    // Consume PLAYER_JOINED broadcasts (Alice gets 3, Bob gets 2, Carol gets 1)
    for (let i = 0; i < 3; i++) await waitForMessage(alice.ws);
    for (let i = 0; i < 2; i++) await waitForMessage(bob.ws);
    await waitForMessage(carol.ws);

    // 4. Verify room is full
    const fullStatus = await app.inject({
      method: "GET",
      url: `/api/rooms/${roomCode}/status`,
    });
    expect(fullStatus.json().playerCount).toBe(4);
    expect(fullStatus.json().full).toBe(true);

    // 5. Non-host tries to start → rejected
    bob.ws.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    const rejectMsg = await waitForMessage(bob.ws);
    expect(rejectMsg.type).toBe("ERROR");
    expect(rejectMsg.code).toBe("NOT_HOST");

    // 6. Host starts game
    alice.ws.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));

    // All 4 players receive STATE_UPDATE with game state
    const aliceState = await waitForMessage(alice.ws);
    const bobState = await waitForMessage(bob.ws);
    const carolState = await waitForMessage(carol.ws);
    const daveState = await waitForMessage(dave.ws);

    expect(aliceState.type).toBe("STATE_UPDATE");
    expect(aliceState.state.gamePhase).toBe("play");

    // 7. Verify per-player filtering — each player sees only their own rack
    expect(aliceState.state.myRack.length).toBeGreaterThan(0);
    expect(bobState.state.myRack.length).toBeGreaterThan(0);

    // Verify racks are different (different players have different tiles)
    const aliceRackIds = aliceState.state.myRack.map((t: any) => t.id).sort();
    const bobRackIds = bobState.state.myRack.map((t: any) => t.id).sort();
    expect(aliceRackIds).not.toEqual(bobRackIds);

    // 8. Verify no opponent racks leaked
    const aliceStr = JSON.stringify(aliceState.state);
    for (const id of bobRackIds) {
      expect(aliceStr).not.toContain(id);
    }

    // 9. East player (player-0) has 14 tiles, others have 13
    const eastPlayer = [
      { id: alice.playerId, rack: aliceState.state.myRack },
      { id: bob.playerId, rack: bobState.state.myRack },
      { id: carol.playerId, rack: carolState.state.myRack },
      { id: dave.playerId, rack: daveState.state.myRack },
    ].find((p) => p.id === "player-0");
    expect(eastPlayer?.rack.length).toBe(14);

    // 10. East player discards a tile (they have 14, must discard)
    const eastWs = [alice, bob, carol, dave].find((p) => p.playerId === "player-0")!;
    const tileToDiscard = eastPlayer!.rack[0];
    eastWs.ws.send(
      JSON.stringify({
        version: 1,
        type: "ACTION",
        action: { type: "DISCARD_TILE", playerId: eastWs.playerId, tileId: tileToDiscard.id },
      }),
    );

    // All players should get STATE_UPDATE after discard
    const postDiscard = await waitForMessage(eastWs.ws);
    expect(postDiscard.type).toBe("STATE_UPDATE");

    // 11. Verify room status shows game in progress
    const playStatus = await app.inject({
      method: "GET",
      url: `/api/rooms/${roomCode}/status`,
    });
    expect(playStatus.json().phase).toBe("play");

    // 12. Token-based reconnection works
    const aliceToken = alice.token;
    alice.ws.close();
    await waitForClose(alice.ws);

    const aliceReconnect = createWs();
    await waitForOpen(aliceReconnect);
    aliceReconnect.send(
      JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice", token: aliceToken }),
    );
    const reconnectMsg = await waitForMessage(aliceReconnect);
    expect(reconnectMsg.type).toBe("STATE_UPDATE");
    expect(reconnectMsg.state.myPlayerId).toBe(alice.playerId);
  });
});
```

- [ ] **Step 3: Run the integration test**

Run: `cd packages/server && pnpm vitest run src/integration/full-game-flow.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 4: If any step fails, debug and fix**

Common issues:
- Timing: may need small delays between join messages
- Message ordering: PLAYER_JOINED broadcasts may interleave with STATE_UPDATE
- Port conflicts: ensure dynamic port allocation via `{ port: 0 }`

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `cd packages/server && pnpm vitest run --reporter=verbose`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/integration/full-game-flow.test.ts
git commit -m "test(server): add end-to-end integration test for full game flow

Addresses adversarial review finding #9: no single test validated the
integrated system from room creation through game play. Tests room
creation, 4-player join, host controls, game start, per-player
filtering, discard action, and token-based reconnection."
```

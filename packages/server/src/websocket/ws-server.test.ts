import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket, type RawData } from "ws";
import { createApp } from "../index";
import type { FastifyInstance } from "fastify";

function wsDataToString(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf-8");
  return Buffer.from(data).toString("utf-8");
}

let app: FastifyInstance;
let wsUrl: string;

async function startServer(): Promise<void> {
  app = createApp();
  const address = await app.listen({ port: 0 });
  wsUrl = address.replace("http", "ws");
}

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(wsUrl);
    client.on("open", () => resolve(client));
    client.on("error", reject);
  });
}

function waitForMessage(client: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    client.once("message", (data: RawData) => {
      resolve(wsDataToString(data));
    });
  });
}

function waitForParsedMessage(client: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    client.once("message", (data: RawData) => {
      resolve(JSON.parse(wsDataToString(data)));
    });
  });
}

async function closeClient(client: WebSocket): Promise<void> {
  if (client.readyState === WebSocket.OPEN) {
    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  }
}

describe("WebSocket Server", () => {
  beforeEach(async () => {
    await startServer();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("connection acceptance", () => {
    it("accepts a WebSocket connection", async () => {
      const client = await connectClient();
      expect(client.readyState).toBe(WebSocket.OPEN);
      await closeClient(client);
    });

    it("tracks connections via connection tracker", async () => {
      const client1 = await connectClient();
      const client2 = await connectClient();

      // Give a moment for connections to be tracked
      await new Promise((r) => setTimeout(r, 50));

      expect(app.wsContext!.connectionTracker.getConnectionCount()).toBe(2);

      await closeClient(client1);
      await closeClient(client2);
    });
  });

  describe("maxPayload enforcement", () => {
    it("disconnects client sending message exceeding 64KB", async () => {
      const client = await connectClient();

      // Suppress client-side error from maxPayload rejection
      client.on("error", () => {});

      const closePromise = new Promise<void>((resolve) => {
        client.on("close", () => resolve());
      });

      // Send a message larger than 64KB
      const oversized = JSON.stringify({ version: 1, type: "ACTION", data: "x".repeat(70_000) });
      client.send(oversized);

      await closePromise;
      expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it("closes connection when message exceeds 64KB with close code 1006 or 1009", async () => {
      const localApp = createApp();
      await localApp.ready();
      const address = await localApp.listen({ port: 0 });
      const localWsUrl = address.replace("http", "ws");

      const ws = new WebSocket(localWsUrl, { maxPayload: 0 }); // Client allows any size
      await new Promise((resolve) => ws.on("open", resolve));

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

      expect([1006, 1009]).toContain(code);

      await localApp.close();
    });

    it("accepts messages under 64KB", async () => {
      const roomRes = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { hostName: "Alice" },
      });
      const { roomCode } = roomRes.json();

      const client = await connectClient();

      client.send(
        JSON.stringify({
          version: 1,
          type: "JOIN_ROOM",
          roomCode,
          displayName: "Alice",
        }),
      );

      const msg = JSON.parse(await waitForMessage(client));
      expect(msg.type).toBe("STATE_UPDATE");

      await closeClient(client);
    });
  });

  describe("message handling", () => {
    it("drops malformed JSON silently (no response)", async () => {
      const client = await connectClient();

      // Set up a message listener to catch any unexpected responses
      const messages: string[] = [];
      client.on("message", (data: RawData) => messages.push(wsDataToString(data)));

      client.send("not valid json{{{");

      // Wait a bit to ensure no response comes
      await new Promise((r) => setTimeout(r, 100));
      expect(messages).toHaveLength(0);

      await closeClient(client);
    });

    it("drops message with missing version field silently", async () => {
      const client = await connectClient();

      const messages: string[] = [];
      client.on("message", (data: RawData) => messages.push(wsDataToString(data)));

      client.send(JSON.stringify({ type: "ACTION" }));

      await new Promise((r) => setTimeout(r, 100));
      expect(messages).toHaveLength(0);

      await closeClient(client);
    });

    it("responds with ERROR for unsupported version", async () => {
      const client = await connectClient();
      const msgPromise = waitForMessage(client);

      client.send(JSON.stringify({ version: 999, type: "ACTION" }));

      const response = JSON.parse(await msgPromise);
      expect(response).toEqual({
        version: 1,
        type: "ERROR",
        code: "UNSUPPORTED_VERSION",
        message: "Protocol version not supported",
      });

      await closeClient(client);
    });

    it("accepts valid message with version 1 and routes to handler", async () => {
      const client = await connectClient();

      const messages: string[] = [];
      client.on("message", (data: RawData) => messages.push(wsDataToString(data)));

      // ACTION messages from unauthenticated connections now receive an error
      client.send(JSON.stringify({ version: 1, type: "ACTION" }));

      await new Promise((r) => setTimeout(r, 100));
      expect(messages).toHaveLength(1);
      const response = JSON.parse(messages[0]);
      expect(response.type).toBe("ERROR");
      expect(response.code).toBe("NOT_IN_ROOM");

      await closeClient(client);
    });
  });

  describe("connection close tracking", () => {
    it("removes connection from tracker on close", async () => {
      const client = await connectClient();
      await new Promise((r) => setTimeout(r, 50));
      expect(app.wsContext!.connectionTracker.getConnectionCount()).toBe(1);

      await closeClient(client);
      await new Promise((r) => setTimeout(r, 50));
      expect(app.wsContext!.connectionTracker.getConnectionCount()).toBe(0);
    });
  });

  describe("graceful shutdown", () => {
    it("closes all connections when server shuts down", async () => {
      const client = await connectClient();

      const closePromise = new Promise<void>((resolve) => {
        client.on("close", () => resolve());
      });

      await app.close();
      await closePromise;

      expect(client.readyState).toBe(WebSocket.CLOSED);
    });
  });
});

describe("REQUEST_STATE", () => {
  beforeEach(async () => {
    await startServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it("responds with current lobby state when in lobby", async () => {
    const roomRes = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "Alice" },
    });
    const { roomCode } = roomRes.json();

    const client = await connectClient();
    const joinPromise = waitForParsedMessage(client);
    client.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }));
    await joinPromise;

    const resyncPromise = waitForParsedMessage(client);
    client.send(JSON.stringify({ version: 1, type: "REQUEST_STATE" }));
    const resync = await resyncPromise;

    expect(resync.type).toBe("STATE_UPDATE");
    expect((resync.state as Record<string, unknown>).gamePhase).toBe("lobby");
    expect((resync.state as Record<string, unknown>).myPlayerId).toBeDefined();

    await closeClient(client);
  });

  it("responds with filtered game state when game is in progress", async () => {
    const roomRes = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "Alice" },
    });
    const { roomCode } = roomRes.json();

    const players: { ws: WebSocket; playerId: string }[] = [];
    for (const name of ["Alice", "Bob", "Carol", "Dave"]) {
      const ws = await connectClient();
      // Set up promise BEFORE sending to avoid race
      const broadcastPromises = players.map((p) => waitForParsedMessage(p.ws));
      const joinPromise = waitForParsedMessage(ws);
      ws.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: name }));
      const msg = await joinPromise;
      players.push({ ws, playerId: (msg.state as Record<string, unknown>).myPlayerId as string });
      // Drain broadcasts to existing players
      await Promise.all(broadcastPromises);
    }

    // Host starts game — set up listeners BEFORE sending
    const startPromises = players.map((p) => waitForParsedMessage(p.ws));
    players[0].ws.send(
      JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }),
    );
    await Promise.all(startPromises);

    // Player 0 requests resync
    const resyncPromise = waitForParsedMessage(players[0].ws);
    players[0].ws.send(JSON.stringify({ version: 1, type: "REQUEST_STATE" }));
    const resync = await resyncPromise;

    const state = resync.state as Record<string, unknown>;
    expect(resync.type).toBe("STATE_UPDATE");
    expect(state.gamePhase).toBe("play");
    expect(state.myPlayerId).toBe(players[0].playerId);
    expect((state.myRack as unknown[]).length).toBeGreaterThan(0);

    // Ensure secret server state is not leaked
    expect("wall" in state).toBe(false);
    expect("card" in state).toBe(false);

    for (const p of players) await closeClient(p.ws);
  });

  it("rejects REQUEST_STATE from unauthenticated connection", async () => {
    const client = await connectClient();

    const msgPromise = waitForParsedMessage(client);
    client.send(JSON.stringify({ version: 1, type: "REQUEST_STATE" }));
    const msg = await msgPromise;

    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("NOT_IN_ROOM");

    await closeClient(client);
  });
});

describe("WebSocket Heartbeat", () => {
  let testApp: FastifyInstance;
  let testWsUrl: string;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    testApp = createApp();
    const address = await testApp.listen({ port: 0 });
    testWsUrl = address.replace("http", "ws");
  });

  afterEach(async () => {
    vi.useRealTimers();
    await testApp.close();
  });

  it("sends ping after 15 seconds", async () => {
    const client = new WebSocket(testWsUrl);
    await new Promise((resolve) => client.on("open", resolve));

    const pingPromise = new Promise<void>((resolve) => {
      client.on("ping", () => resolve());
    });

    await vi.advanceTimersByTimeAsync(15_000);

    await pingPromise;
    client.close();
  });

  it("keeps connection alive when pong is received (survives 2 cycles)", async () => {
    const client = new WebSocket(testWsUrl);
    await new Promise((resolve) => client.on("open", resolve));

    // ws client automatically responds to pings with pongs
    let pingCount = 0;
    client.on("ping", () => {
      pingCount++;
    });

    // Advance through 2 heartbeat cycles with event-loop yields for pong round-trip
    await vi.advanceTimersByTimeAsync(15_000);
    // Yield to event loop so pong response is received before next cycle
    await new Promise((r) => setImmediate(r));
    await vi.advanceTimersByTimeAsync(15_000);
    await new Promise((r) => setImmediate(r));

    expect(pingCount).toBeGreaterThanOrEqual(2);
    expect(client.readyState).toBe(WebSocket.OPEN);

    client.close();
  });

  it("terminates dead connection after missed pongs", async () => {
    const client = new WebSocket(testWsUrl);
    await new Promise((resolve) => client.on("open", resolve));

    // Disable automatic pong responses so the server thinks the client is dead
    client.pong = () => {};

    const closePromise = new Promise<void>((resolve) => {
      client.on("close", () => resolve());
    });

    // First cycle: sets isAlive=false, sends ping (no pong back)
    await vi.advanceTimersByTimeAsync(15_000);
    // Second cycle: isAlive still false → terminate
    await vi.advanceTimersByTimeAsync(15_000);

    await closePromise;
    expect(client.readyState).toBe(WebSocket.CLOSED);
  });
});

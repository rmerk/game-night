import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../index";
import type { FastifyInstance } from "fastify";
import { setGracePeriodMs, DEFAULT_GRACE_PERIOD_MS } from "../rooms/session-manager";

let app: FastifyInstance;
let wsUrl: string;

async function createRoom(hostName = "TestHost"): Promise<{ roomCode: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: { hostName },
  });
  return JSON.parse(res.body);
}

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once("message", (data: Buffer) => {
      resolve(JSON.parse(Buffer.from(data).toString("utf-8")));
    });
  });
}

function sendJoin(ws: WebSocket, roomCode: string, displayName: string, token?: string): void {
  const msg: Record<string, unknown> = {
    version: 1,
    type: "JOIN_ROOM",
    roomCode,
    displayName,
  };
  if (token) msg.token = token;
  ws.send(JSON.stringify(msg));
}

function sendJoinWithToken(ws: WebSocket, roomCode: string, token: string): void {
  ws.send(
    JSON.stringify({
      version: 1,
      type: "JOIN_ROOM",
      roomCode,
      token,
    }),
  );
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.on("close", (code: number, reason: Buffer) => {
      resolve({ code, reason: reason.toString() });
    });
  });
}

beforeEach(async () => {
  app = createApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  wsUrl = `ws://127.0.0.1:${port}`;
});

afterEach(async () => {
  await app.close();
});

describe("handleJoinRoom", () => {
  it("assigns player-0 with east wind to first joiner and returns lobby state", async () => {
    const { roomCode } = await createRoom();
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    sendJoin(ws, roomCode, "Alice");

    const msg = await msgPromise;
    expect(msg.type).toBe("STATE_UPDATE");
    const state = msg.state as Record<string, unknown>;
    expect(state.gamePhase).toBe("lobby");
    expect(state.roomCode).toBe(roomCode);
    expect(state.myPlayerId).toBe("player-0");

    const players = state.players as Array<Record<string, unknown>>;
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      playerId: "player-0",
      displayName: "Alice",
      wind: "east",
      isHost: true,
      connected: true,
    });

    ws.close();
  });

  it("rejects join with ROOM_NOT_FOUND for invalid room code", async () => {
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    sendJoin(ws, "BADCODE", "Alice");

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("ROOM_NOT_FOUND");

    ws.close();
  });

  it("rejects join with MISSING_ROOM_CODE when roomCode is missing", async () => {
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    ws.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", displayName: "Alice" }));

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("MISSING_ROOM_CODE");

    ws.close();
  });

  it("rejects join with INVALID_DISPLAY_NAME when displayName field is missing", async () => {
    const { roomCode } = await createRoom();
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    ws.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode }));

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_DISPLAY_NAME");

    ws.close();
  });

  it("rejects join with INVALID_DISPLAY_NAME when displayName is empty", async () => {
    const { roomCode } = await createRoom();
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    sendJoin(ws, roomCode, "   ");

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_DISPLAY_NAME");

    ws.close();
  });

  it("rejects 5th player with ROOM_FULL", async () => {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];

    // Join 4 players
    for (let i = 0; i < 4; i++) {
      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      await msgPromise;
      clients.push(ws);
    }

    // 5th player should be rejected
    const ws5 = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws5);
    sendJoin(ws5, roomCode, "Player5");
    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("ROOM_FULL");

    for (const c of clients) c.close();
    ws5.close();
  });

  it("assigns sequential player IDs and winds for 4 players", async () => {
    const { roomCode } = await createRoom();
    const expectedWinds = ["east", "south", "west", "north"];
    const clients: WebSocket[] = [];

    for (let i = 0; i < 4; i++) {
      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      const msg = await msgPromise;
      const state = msg.state as Record<string, unknown>;
      expect(state.myPlayerId).toBe(`player-${i}`);

      const players = state.players as Array<Record<string, unknown>>;
      expect(players[i]).toMatchObject({
        playerId: `player-${i}`,
        wind: expectedWinds[i],
      });
      clients.push(ws);
    }

    for (const c of clients) c.close();
  });

  it("first joiner is host, subsequent joiners are not", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Host");
    const msg1 = await msg1Promise;
    const state1 = msg1.state as Record<string, unknown>;
    const players1 = state1.players as Array<Record<string, unknown>>;
    expect(players1[0]?.isHost).toBe(true);

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Guest");
    const msg2 = await msg2Promise;
    const state2 = msg2.state as Record<string, unknown>;
    const players2 = state2.players as Array<Record<string, unknown>>;
    expect(players2[1]?.isHost).toBe(false);

    ws1.close();
    ws2.close();
  });

  it("broadcasts PLAYER_JOINED to existing players when new player joins", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    await msg1Promise;

    // Listen for broadcast on ws1 when ws2 joins
    const broadcastPromise = waitForMessage(ws1);

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Bob");
    await msg2Promise;

    const broadcast = await broadcastPromise;
    expect(broadcast.type).toBe("STATE_UPDATE");
    expect(broadcast.resolvedAction).toMatchObject({
      type: "PLAYER_JOINED",
      playerId: "player-1",
      playerName: "Bob",
    });

    // Broadcast should include updated player list
    const state = broadcast.state as Record<string, unknown>;
    const players = state.players as Array<Record<string, unknown>>;
    expect(players).toHaveLength(2);
    expect(state.myPlayerId).toBe("player-0");

    ws1.close();
    ws2.close();
  });

  it("marks player as disconnected when WebSocket closes", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    await msg1Promise;

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Bob");
    await msg2Promise;

    // Consume the PLAYER_JOINED broadcast on ws1
    await waitForMessage(ws1);

    // Now listen for disconnect broadcast on ws1
    const disconnectBroadcast = waitForMessage(ws1);

    // Disconnect ws2
    ws2.close();

    const msg = await disconnectBroadcast;
    expect(msg.type).toBe("STATE_UPDATE");
    const state = msg.state as Record<string, unknown>;
    const players = state.players as Array<Record<string, unknown>>;
    const bob = players.find((p) => p.playerId === "player-1");
    expect(bob?.connected).toBe(false);

    // Alice should still show as connected
    const alice = players.find((p) => p.playerId === "player-0");
    expect(alice?.connected).toBe(true);

    ws1.close();
  });

  it("sanitizes display name by stripping control characters and trimming", async () => {
    const { roomCode } = await createRoom();
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    sendJoin(ws, roomCode, "  \x00Alice\x1F  ");

    const msg = await msgPromise;
    const state = msg.state as Record<string, unknown>;
    const players = state.players as Array<Record<string, unknown>>;
    expect(players[0]?.displayName).toBe("Alice");

    ws.close();
  });

  it("truncates display name to 30 characters", async () => {
    const { roomCode } = await createRoom();
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    const longName = "A".repeat(50);
    sendJoin(ws, roomCode, longName);

    const msg = await msgPromise;
    const state = msg.state as Record<string, unknown>;
    const players = state.players as Array<Record<string, unknown>>;
    expect(players[0]?.displayName).toHaveLength(30);

    ws.close();
  });
});

describe("session token delivery", () => {
  it("includes a UUID token in STATE_UPDATE for new player join", async () => {
    const { roomCode } = await createRoom();
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    sendJoin(ws, roomCode, "Alice");

    const msg = await msgPromise;
    expect(msg.type).toBe("STATE_UPDATE");
    expect(msg.token).toBeDefined();
    expect(typeof msg.token).toBe("string");
    expect(msg.token).toMatch(/^[0-9a-f-]{36}$/);

    ws.close();
  });

  it("does NOT include token in broadcast STATE_UPDATE to other players", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    await msg1Promise;

    // Listen for broadcast on ws1 when ws2 joins
    const broadcastPromise = waitForMessage(ws1);

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Bob");

    // ws2 should get a token
    const msg2 = await msg2Promise;
    expect(msg2.token).toBeDefined();

    // ws1's broadcast should NOT have a token
    const broadcast = await broadcastPromise;
    expect(broadcast.type).toBe("STATE_UPDATE");
    expect(broadcast.token).toBeUndefined();

    ws1.close();
    ws2.close();
  });

  it("gives different tokens to different players", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    const msg1 = await msg1Promise;

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Bob");
    const msg2 = await msg2Promise;

    expect(msg1.token).not.toBe(msg2.token);

    ws1.close();
    ws2.close();
  });
});

describe("token-based reconnection", () => {
  it("reconnects to same seat with valid token", async () => {
    const { roomCode } = await createRoom();

    // Player joins and gets token
    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    const msg1 = await msg1Promise;
    const token = msg1.token as string;
    const originalPlayerId = (msg1.state as Record<string, unknown>).myPlayerId;

    // Disconnect
    ws1.close();
    await new Promise((r) => setTimeout(r, 50));

    // Reconnect with token
    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoinWithToken(ws2, roomCode, token);
    const msg2 = await msg2Promise;

    expect(msg2.type).toBe("STATE_UPDATE");
    const state2 = msg2.state as Record<string, unknown>;
    expect(state2.myPlayerId).toBe(originalPlayerId);
    expect(msg2.token).toBe(token);

    const players = state2.players as Array<Record<string, unknown>>;
    const alice = players.find((p) => p.playerId === originalPlayerId);
    expect(alice?.connected).toBe(true);
    expect(alice?.displayName).toBe("Alice");

    ws2.close();
  });

  it("treats invalid token as new player join", async () => {
    const { roomCode } = await createRoom();

    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);
    sendJoin(ws, roomCode, "Alice", "invalid-token-12345678-1234-1234-1234");

    const msg = await msgPromise;
    expect(msg.type).toBe("STATE_UPDATE");
    const state = msg.state as Record<string, unknown>;
    expect(state.myPlayerId).toBe("player-0");
    expect(msg.token).toBeDefined();
    expect(msg.token).not.toBe("invalid-token-12345678-1234-1234-1234");

    ws.close();
  });

  it("broadcasts PLAYER_RECONNECTED to other players on reconnection", async () => {
    const { roomCode } = await createRoom();

    // Two players join
    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    const msg1 = await msg1Promise;
    const tokenAlice = msg1.token as string;

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Bob");
    await msg2Promise;

    // Consume the PLAYER_JOINED broadcast on ws1
    await waitForMessage(ws1);

    // Alice disconnects
    ws1.close();
    // Consume disconnection broadcast on ws2
    await waitForMessage(ws2);

    await new Promise((r) => setTimeout(r, 50));

    // Listen for reconnection broadcast on ws2
    const reconnectBroadcast = waitForMessage(ws2);

    // Alice reconnects
    const ws1r = await connectWs(wsUrl);
    const reconnectMsg = waitForMessage(ws1r);
    sendJoinWithToken(ws1r, roomCode, tokenAlice);
    await reconnectMsg;

    const broadcast = await reconnectBroadcast;
    expect(broadcast.type).toBe("STATE_UPDATE");
    expect(broadcast.resolvedAction).toMatchObject({
      type: "PLAYER_RECONNECTED",
      playerId: "player-0",
      playerName: "Alice",
    });

    ws1r.close();
    ws2.close();
  });
});

describe("session supersession", () => {
  it("disconnects first connection when second uses same token", async () => {
    const { roomCode } = await createRoom();

    // Player joins
    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    const msg1 = await msg1Promise;
    const token = msg1.token as string;

    // Listen for SESSION_SUPERSEDED on ws1
    const supersededPromise = waitForMessage(ws1);
    const closePromise = waitForClose(ws1);

    // Second connection with same token
    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoinWithToken(ws2, roomCode, token);

    // First connection should get SESSION_SUPERSEDED
    const supersededMsg = await supersededPromise;
    expect(supersededMsg.type).toBe("SYSTEM_EVENT");
    expect(supersededMsg.event).toBe("SESSION_SUPERSEDED");

    // First connection should be closed
    const closeEvent = await closePromise;
    expect(closeEvent.code).toBe(4001);

    // Second connection should get full state
    const msg2 = await msg2Promise;
    expect(msg2.type).toBe("STATE_UPDATE");
    const state2 = msg2.state as Record<string, unknown>;
    expect(state2.myPlayerId).toBe("player-0");

    ws2.close();
  });
});

describe("grace period recovery", () => {
  const SHORT_GRACE_MS = 200;

  beforeEach(() => {
    setGracePeriodMs(SHORT_GRACE_MS);
  });

  afterEach(() => {
    setGracePeriodMs(DEFAULT_GRACE_PERIOD_MS);
  });

  it("does not recover seat via displayName alone (token required)", async () => {
    const { roomCode } = await createRoom();

    // Player joins
    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    const msg1 = await msg1Promise;
    const playerId1 = (msg1.state as Record<string, unknown>).myPlayerId;

    // Player disconnects
    ws1.close();
    await new Promise((r) => setTimeout(r, 50));

    // New connection with same displayName but no token
    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Alice");
    const msg2 = await msg2Promise;

    // Should get a DIFFERENT playerId (new seat, not recovered)
    expect((msg2.state as Record<string, unknown>).myPlayerId).not.toBe(playerId1);

    ws2.close();
  });

  it("releases seat after grace period expires", async () => {
    const { roomCode } = await createRoom();

    // Player joins
    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    await msg1Promise;

    // Disconnect
    ws1.close();
    await new Promise((r) => setTimeout(r, 50));

    // Wait for grace period to expire
    await new Promise((r) => setTimeout(r, SHORT_GRACE_MS + 100));

    // New player should get player-0 (seat was released)
    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Bob");
    const msg2 = await msg2Promise;

    const state2 = msg2.state as Record<string, unknown>;
    expect(state2.myPlayerId).toBe("player-0");
    const players = state2.players as Array<Record<string, unknown>>;
    expect(players).toHaveLength(1);
    expect(players[0]?.displayName).toBe("Bob");

    ws2.close();
  });

  it("rejects tokenless connection to full room during grace period", async () => {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];

    // Join players one at a time, draining broadcasts between joins
    for (let i = 0; i < 4; i++) {
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      await msgPromise;
      clients.push(ws);

      await Promise.all(broadcastPromises);
    }

    // 5th player should be rejected
    const ws5 = await connectWs(wsUrl);
    const msg5Promise = waitForMessage(ws5);
    sendJoin(ws5, roomCode, "NewPlayer");
    const msg5 = await msg5Promise;
    expect(msg5.type).toBe("ERROR");
    expect(msg5.code).toBe("ROOM_FULL");

    for (const c of clients) c.close();
    ws5.close();
  });
});

describe("comprehensive lifecycle", () => {
  it("full lifecycle: join → disconnect → reconnect with token → same seat", async () => {
    const { roomCode } = await createRoom();

    // Join
    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    const msg1 = await msg1Promise;
    const token = msg1.token as string;

    // Disconnect
    ws1.close();
    await new Promise((r) => setTimeout(r, 50));

    // Reconnect with token
    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoinWithToken(ws2, roomCode, token);
    const msg2 = await msg2Promise;

    expect(msg2.type).toBe("STATE_UPDATE");
    const state = msg2.state as Record<string, unknown>;
    expect(state.myPlayerId).toBe("player-0");
    const players = state.players as Array<Record<string, unknown>>;
    expect(players[0]).toMatchObject({
      playerId: "player-0",
      displayName: "Alice",
      connected: true,
    });

    ws2.close();
  });

  it("4 players join, 1 disconnects and reconnects with token, original seat preserved", async () => {
    const { roomCode } = await createRoom();
    const tokens: string[] = [];
    const clients: WebSocket[] = [];

    // Join players one at a time, draining all broadcasts between each join
    for (let i = 0; i < 4; i++) {
      // Set up listeners for existing clients BEFORE sending join
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      const msg = await msgPromise;
      tokens.push(msg.token as string);
      clients.push(ws);

      // Wait for all broadcasts to existing clients
      await Promise.all(broadcastPromises);
    }

    // Player2 disconnects — set up listeners for disconnect broadcast
    const disconnectBroadcasts = [0, 1, 3].map((i) => waitForMessage(clients[i]));
    clients[2].close();
    await Promise.all(disconnectBroadcasts);

    await new Promise((r) => setTimeout(r, 50));

    // Player2 reconnects — set up listeners for reconnect broadcast
    const reconnectBroadcasts = [0, 1, 3].map((i) => waitForMessage(clients[i]));
    const ws2r = await connectWs(wsUrl);
    const msg2rPromise = waitForMessage(ws2r);
    sendJoinWithToken(ws2r, roomCode, tokens[2]);
    const msg2r = await msg2rPromise;

    const state = msg2r.state as Record<string, unknown>;
    expect(state.myPlayerId).toBe("player-2");
    const players = state.players as Array<Record<string, unknown>>;
    expect(players.find((p) => p.playerId === "player-2")).toMatchObject({
      displayName: "Player2",
      connected: true,
      wind: "west",
    });

    // Others should get PLAYER_RECONNECTED
    const broadcasts = await Promise.all(reconnectBroadcasts);
    for (const broadcast of broadcasts) {
      expect(broadcast.resolvedAction).toMatchObject({
        type: "PLAYER_RECONNECTED",
        playerId: "player-2",
      });
    }

    for (const c of clients.filter((_, i) => i !== 2)) c.close();
    ws2r.close();
  });

  it("invalid token + full room = rejected", async () => {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];

    // Join players one at a time, draining broadcasts between each join
    for (let i = 0; i < 4; i++) {
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      await msgPromise;
      clients.push(ws);

      await Promise.all(broadcastPromises);
    }

    // Try to join with invalid token — should fail since room is full
    const ws5 = await connectWs(wsUrl);
    const msg5Promise = waitForMessage(ws5);
    sendJoin(ws5, roomCode, "Imposter", "invalid-token-00000000-0000-0000-0000");
    const msg5 = await msg5Promise;
    expect(msg5.type).toBe("ERROR");
    expect(msg5.code).toBe("ROOM_FULL");

    for (const c of clients) c.close();
    ws5.close();
  });
});

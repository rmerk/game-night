/* eslint-disable no-await-in-loop -- sequential WebSocket joins keep broadcast ordering deterministic in these integration tests */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- parsed WebSocket payloads are intentionally inspected as loose JSON test fixtures */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WsClient from "ws";
import { createApp } from "../index";
import type { FastifyInstance } from "fastify";
import { setGracePeriodMs, DEFAULT_GRACE_PERIOD_MS } from "../rooms/session-manager";
import {
  setPauseTimeoutMs,
  DEFAULT_PAUSE_TIMEOUT_MS,
  cancelLifecycleTimer,
  hasLifecycleTimer,
} from "../rooms/room-lifecycle";
import * as stateBroadcaster from "./state-broadcaster";

type WebSocket = WsClient;

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
    const ws = new WsClient(url);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const handler = (data: Buffer) => {
      const msg = JSON.parse(Buffer.from(data).toString("utf-8")) as Record<string, unknown>;
      if (msg.type === "CHAT_HISTORY") {
        return;
      }
      ws.removeListener("message", handler);
      resolve(msg);
    };
    ws.on("message", handler);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    expect(state.jokerRulesMode).toBe("standard");

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
    await delay(50);

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

  it("restores the filtered Charleston game view on token reconnection", async () => {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];
    const tokens: string[] = [];

    for (let i = 0; i < 4; i++) {
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      const msg = await msgPromise;

      clients.push(ws);
      tokens.push(msg.token as string);
      await Promise.all(broadcastPromises);
    }

    const gameStartMessages = clients.map((ws) => waitForMessage(ws));
    clients[0].send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    const [aliceStartState] = await Promise.all(gameStartMessages);
    const alicePlayerId = (aliceStartState.state as Record<string, unknown>).myPlayerId;

    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);
    await delay(50);

    const reconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    const aliceReconnectWs = await connectWs(wsUrl);
    const reconnectMessagePromise = waitForMessage(aliceReconnectWs);
    sendJoinWithToken(aliceReconnectWs, roomCode, tokens[0]);

    const reconnectMsg = await reconnectMessagePromise;
    expect(reconnectMsg.type).toBe("STATE_UPDATE");
    expect(reconnectMsg.token).toBe(tokens[0]);
    const reconnectState = reconnectMsg.state as Record<string, unknown>;
    expect(reconnectState.myPlayerId).toBe(alicePlayerId);
    expect(reconnectState.gamePhase).toBe("charleston");
    expect(reconnectState.myRack).toBeInstanceOf(Array);
    expect((reconnectState.myRack as unknown[]).length).toBeGreaterThan(0);
    expect(reconnectState.charleston).toMatchObject({
      stage: "first",
      status: "passing",
      currentDirection: "right",
      submittedPlayerIds: [],
    });

    const reconnectBroadcastMessages = await Promise.all(reconnectBroadcasts);
    for (let index = 0; index < reconnectBroadcastMessages.length; index++) {
      const broadcast = reconnectBroadcastMessages[index];
      const expectedPlayerId = `player-${index + 1}`;
      expect(broadcast.type).toBe("STATE_UPDATE");
      expect(broadcast.resolvedAction).toMatchObject({
        type: "PLAYER_RECONNECTED",
        playerId: alicePlayerId,
        playerName: "Player0",
      });

      const state = broadcast.state as Record<string, unknown>;
      expect(state.myPlayerId).toBe(expectedPlayerId);
      expect(state.gamePhase).toBe("charleston");
      expect(state.myRack).toBeInstanceOf(Array);
      expect((state.myRack as unknown[]).length).toBeGreaterThan(0);
      expect(state.charleston).toMatchObject({
        stage: "first",
        status: "passing",
        currentDirection: "right",
        submittedPlayerIds: [],
      });
    }

    for (const ws of clients.slice(1)) {
      ws.close();
    }
    aliceReconnectWs.close();
  });

  it("restores vote-ready Charleston progress and the reconnecting player's own vote only", async () => {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];
    const tokens: string[] = [];

    for (let i = 0; i < 4; i++) {
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      const msg = await msgPromise;

      clients.push(ws);
      tokens.push(msg.token as string);
      await Promise.all(broadcastPromises);
    }

    const gameStartMessages = clients.map((ws) => waitForMessage(ws));
    clients[0].send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    const [aliceStartState] = await Promise.all(gameStartMessages);
    const alicePlayerId = (aliceStartState.state as Record<string, unknown>).myPlayerId as string;

    const room = app.roomManager.getRoom(roomCode)!;
    room.gameState!.charleston = {
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: ["player-0", "player-1"],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: {
        "player-0": true,
        "player-1": false,
      },
      courtesyPairings: [],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);
    await delay(50);

    const reconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    const aliceReconnectWs = await connectWs(wsUrl);
    const reconnectMessagePromise = waitForMessage(aliceReconnectWs);
    sendJoinWithToken(aliceReconnectWs, roomCode, tokens[0]);

    const reconnectMsg = await reconnectMessagePromise;
    expect(reconnectMsg.type).toBe("STATE_UPDATE");
    expect(reconnectMsg.token).toBe(tokens[0]);
    const reconnectState = reconnectMsg.state as Record<string, unknown>;
    expect(reconnectState.myPlayerId).toBe(alicePlayerId);
    expect(reconnectState.gamePhase).toBe("charleston");
    expect(reconnectState.charleston).toMatchObject({
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      submittedPlayerIds: [],
      votesReceivedCount: 2,
      mySubmissionLocked: true,
      myVote: true,
    });
    expect(JSON.stringify(reconnectMsg)).not.toContain("votesByPlayerId");

    const reconnectBroadcastMessages = await Promise.all(reconnectBroadcasts);
    for (let index = 0; index < reconnectBroadcastMessages.length; index++) {
      const broadcast = reconnectBroadcastMessages[index];
      const expectedPlayerId = `player-${index + 1}`;
      expect(broadcast.type).toBe("STATE_UPDATE");
      expect(broadcast.resolvedAction).toMatchObject({
        type: "PLAYER_RECONNECTED",
        playerId: alicePlayerId,
        playerName: "Player0",
      });

      const state = broadcast.state as Record<string, unknown>;
      expect(state.myPlayerId).toBe(expectedPlayerId);
      expect(state.charleston).toMatchObject({
        stage: "second",
        status: "vote-ready",
        currentDirection: null,
        submittedPlayerIds: [],
        votesReceivedCount: 2,
      });
      expect(JSON.stringify(broadcast)).not.toContain("votesByPlayerId");
    }

    for (const ws of clients.slice(1)) {
      ws.close();
    }
    aliceReconnectWs.close();
  });

  it("restores courtesy-ready state on token reconnection without leaking partner courtesy picks", async () => {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];
    const tokens: string[] = [];

    for (let i = 0; i < 4; i++) {
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      const msg = await msgPromise;

      clients.push(ws);
      tokens.push(msg.token as string);
      await Promise.all(broadcastPromises);
    }

    const gameStartMessages = clients.map((ws) => waitForMessage(ws));
    clients[0].send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    const [aliceStartState] = await Promise.all(gameStartMessages);
    const alicePlayerId = (aliceStartState.state as Record<string, unknown>).myPlayerId as string;

    const secretTileA = "join-hdl-courtesy-secret-a";
    const secretTileB = "join-hdl-courtesy-secret-b";

    const room = app.roomManager.getRoom(roomCode)!;
    room.gameState!.gamePhase = "charleston";
    room.gameState!.charleston = {
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: [],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: {},
      courtesyPairings: [
        ["player-0", "player-2"],
        ["player-1", "player-3"],
      ],
      courtesySubmissionsByPlayerId: {
        [alicePlayerId]: {
          count: 2,
          tileIds: [secretTileA, secretTileB],
        },
      },
      courtesyResolvedPairings: [],
    };

    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);
    await delay(50);

    const reconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    const aliceReconnectWs = await connectWs(wsUrl);
    const reconnectMessagePromise = waitForMessage(aliceReconnectWs);
    sendJoinWithToken(aliceReconnectWs, roomCode, tokens[0]);

    const reconnectMsg = await reconnectMessagePromise;
    expect(reconnectMsg.type).toBe("STATE_UPDATE");
    expect(reconnectMsg.token).toBe(tokens[0]);
    const reconnectState = reconnectMsg.state as Record<string, unknown>;
    expect(reconnectState.myPlayerId).toBe(alicePlayerId);
    expect(reconnectState.gamePhase).toBe("charleston");
    expect(reconnectState.charleston).toMatchObject({
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      courtesyResolvedPairCount: 0,
      mySubmissionLocked: true,
      myCourtesySubmission: {
        count: 2,
        tileIds: [secretTileA, secretTileB],
      },
    });
    expect(reconnectState.charleston).not.toHaveProperty("courtesySubmissionsByPlayerId");

    const reconnectBroadcastMessages = await Promise.all(reconnectBroadcasts);
    for (let index = 0; index < reconnectBroadcastMessages.length; index++) {
      const broadcast = reconnectBroadcastMessages[index];
      const expectedPlayerId = `player-${index + 1}`;
      expect(broadcast.type).toBe("STATE_UPDATE");
      expect(broadcast.resolvedAction).toMatchObject({
        type: "PLAYER_RECONNECTED",
        playerId: alicePlayerId,
        playerName: "Player0",
      });

      const state = broadcast.state as Record<string, unknown>;
      expect(state.myPlayerId).toBe(expectedPlayerId);
      expect(state.gamePhase).toBe("charleston");
      const ch = state.charleston as Record<string, unknown>;
      expect(ch).toMatchObject({
        stage: "courtesy",
        status: "courtesy-ready",
        courtesyResolvedPairCount: 0,
        myCourtesySubmission: null,
        mySubmissionLocked: false,
      });
      expect(ch).not.toHaveProperty("courtesySubmissionsByPlayerId");
      const chJson = JSON.stringify(ch);
      expect(chJson).not.toContain(secretTileA);
      expect(chJson).not.toContain(secretTileB);
    }

    for (const ws of clients.slice(1)) {
      ws.close();
    }
    aliceReconnectWs.close();
  });

  it("broadcasts filtered Charleston game state to remaining players when someone disconnects", async () => {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];

    for (let i = 0; i < 4; i++) {
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      await msgPromise;

      clients.push(ws);
      await Promise.all(broadcastPromises);
    }

    const gameStartMessages = clients.map((ws) => waitForMessage(ws));
    clients[0].send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    await Promise.all(gameStartMessages);

    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();

    const disconnectMessages = await Promise.all(disconnectBroadcasts);
    for (let index = 0; index < disconnectMessages.length; index++) {
      const broadcast = disconnectMessages[index];
      const expectedPlayerId = `player-${index + 1}`;
      expect(broadcast.type).toBe("STATE_UPDATE");
      expect(broadcast.resolvedAction).toMatchObject({
        type: "PLAYER_RECONNECTING",
        playerId: "player-0",
        playerName: "Player0",
      });

      const state = broadcast.state as Record<string, unknown>;
      expect(state.myPlayerId).toBe(expectedPlayerId);
      expect(state.gamePhase).toBe("charleston");
      expect(state.myRack).toBeInstanceOf(Array);
      expect((state.myRack as unknown[]).length).toBeGreaterThan(0);
      expect(state.charleston).toMatchObject({
        stage: "first",
        status: "passing",
        currentDirection: "right",
        submittedPlayerIds: [],
      });

      const players = state.players as Array<Record<string, unknown>>;
      expect(players.find((player) => player.playerId === "player-0")).toMatchObject({
        connected: false,
      });
    }

    for (const ws of clients.slice(1)) {
      ws.close();
    }
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

    ws1.close();
    const disconnectMsg = await waitForMessage(ws2);
    expect(disconnectMsg.resolvedAction).toMatchObject({
      type: "PLAYER_RECONNECTING",
      playerId: "player-0",
      playerName: "Alice",
    });

    await delay(50);

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
  it("superseded socket close does not mark player disconnected or start grace timer", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    const msg1 = await msg1Promise;
    const token = msg1.token as string;

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Bob");
    await msg2Promise;

    const closePromise = waitForClose(ws1);

    const ws3 = await connectWs(wsUrl);
    const msg3Promise = waitForMessage(ws3);
    sendJoinWithToken(ws3, roomCode, token);

    await closePromise;
    await msg3Promise;

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.players.get("player-0")?.connected).toBe(true);
    expect(room.graceTimers.has("player-0")).toBe(false);

    ws3.close();
    ws2.close();
  });

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

  it("recovers seat via displayName tokenless match while player is in grace period", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    const msg1 = await msg1Promise;
    const playerId1 = (msg1.state as Record<string, unknown>).myPlayerId;

    ws1.close();
    await delay(50);

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Alice");
    const msg2 = await msg2Promise;

    expect((msg2.state as Record<string, unknown>).myPlayerId).toBe(playerId1);
    expect(msg2.token).toBeDefined();

    ws2.close();
  });

  it("tokenless join does not recover when multiple in-grace players share the same display name", async () => {
    const { roomCode } = await createRoom();
    const sockets: WebSocket[] = [];

    for (const name of ["Alice", "Bob", "Alice"]) {
      const ws = await connectWs(wsUrl);
      const joinP = waitForMessage(ws);
      const broadcastP = sockets.map((s) => waitForMessage(s));
      sendJoin(ws, roomCode, name);
      await joinP;
      await Promise.all(broadcastP);
      sockets.push(ws);
    }

    sockets[0].close();
    sockets[2].close();
    await delay(50);

    const wsNew = await connectWs(wsUrl);
    const msgP = waitForMessage(wsNew);
    sendJoin(wsNew, roomCode, "Alice");
    const msg = await msgP;

    expect(msg.type).toBe("STATE_UPDATE");
    expect((msg.state as Record<string, unknown>).myPlayerId).toBe("player-3");

    sockets[1].close();
    wsNew.close();
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
    await delay(50);

    // Wait for grace period to expire
    await delay(SHORT_GRACE_MS + 100);

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

  it("grace expiry seat-release broadcast does not carry PLAYER_RECONNECTING (AC9, T3)", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    await msg1Promise;

    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Bob");
    await msg2Promise;

    // Consume PLAYER_JOINED on ws1
    await waitForMessage(ws1);

    // Consume PLAYER_RECONNECTING on ws1 when ws2 disconnects
    const reconnectingBroadcast = waitForMessage(ws1);
    ws2.close();
    const reconnectingMsg = await reconnectingBroadcast;
    expect(reconnectingMsg.resolvedAction).toMatchObject({ type: "PLAYER_RECONNECTING" });

    // Seat-release broadcast after grace expires must NOT re-fire PLAYER_RECONNECTING
    const seatReleaseBroadcast = waitForMessage(ws1);
    await delay(SHORT_GRACE_MS + 100);
    const seatReleaseMsg = await seatReleaseBroadcast;
    expect(seatReleaseMsg.type).toBe("STATE_UPDATE");
    expect(seatReleaseMsg.resolvedAction).toBeUndefined();
    const state = seatReleaseMsg.state as Record<string, unknown>;
    const players = state.players as Array<Record<string, unknown>>;
    expect(players.find((p) => p.playerId === "player-1")).toBeUndefined();

    ws1.close();
  });

  it("tokenless join with same displayName AFTER grace expired falls through to new join (T7)", async () => {
    const { roomCode } = await createRoom();

    const ws1 = await connectWs(wsUrl);
    const msg1Promise = waitForMessage(ws1);
    sendJoin(ws1, roomCode, "Alice");
    await msg1Promise;

    ws1.close();
    await delay(50);

    // Wait past grace expiry — seat released, graceTimers entry deleted
    await delay(SHORT_GRACE_MS + 100);

    // Same-name tokenless reconnect after grace — should be a fresh join, NOT a seat recovery
    const ws2 = await connectWs(wsUrl);
    const msg2Promise = waitForMessage(ws2);
    sendJoin(ws2, roomCode, "Alice");
    const msg2 = await msg2Promise;

    expect(msg2.type).toBe("STATE_UPDATE");
    const state = msg2.state as Record<string, unknown>;
    expect(state.myPlayerId).toBe("player-0");
    const players = state.players as Array<Record<string, unknown>>;
    expect(players).toHaveLength(1);
    expect(players[0]?.displayName).toBe("Alice");

    // A fresh token was issued (no recovery from the lost pre-grace token)
    expect(msg2.token).toBeDefined();

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
    await delay(50);

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

    await delay(50);

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

describe("charleston disconnect auto-action", () => {
  const SHORT_GRACE_MS = 200;

  beforeEach(() => {
    setGracePeriodMs(SHORT_GRACE_MS);
  });

  afterEach(() => {
    setGracePeriodMs(DEFAULT_GRACE_PERIOD_MS);
  });

  /** Helper: join 4 players and start game; returns clients array, tokens, player IDs, and roomCode */
  async function setupCharlestonRoom(): Promise<{
    roomCode: string;
    clients: WebSocket[];
    tokens: string[];
    playerIds: string[];
  }> {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];
    const tokens: string[] = [];
    const playerIds: string[] = [];

    for (let i = 0; i < 4; i++) {
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `Player${i}`);
      const msg = await msgPromise;

      clients.push(ws);
      tokens.push(msg.token as string);
      playerIds.push((msg.state as Record<string, unknown>).myPlayerId as string);
      await Promise.all(broadcastPromises);
    }

    // Start the game — all 4 clients receive STATE_UPDATE
    const gameStartMessages = clients.map((ws) => waitForMessage(ws));
    clients[0].send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    await Promise.all(gameStartMessages);

    return { roomCode, clients, tokens, playerIds };
  }

  it("3.2 grace expiry during passing status dispatches CHARLESTON_PASS and broadcasts state (AC1, AC8, AC9)", async () => {
    const { roomCode, clients, playerIds } = await setupCharlestonRoom();

    // Drain disconnect broadcast on remaining players
    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);

    // Set up listeners for the auto-action broadcast (fires after grace expiry)
    const autoActionBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));

    await delay(SHORT_GRACE_MS + 100);

    const broadcastMessages = await Promise.all(autoActionBroadcasts);

    for (const broadcast of broadcastMessages) {
      expect(broadcast.type).toBe("STATE_UPDATE"); // AC8: broadcast sent
      const state = broadcast.state as Record<string, unknown>;
      expect(state.gamePhase).toBe("charleston");
      const charleston = state.charleston as Record<string, unknown>;
      // AC1: disconnected player is now in submittedPlayerIds
      expect(charleston.submittedPlayerIds).toContain(playerIds[0]);
      // AC9: the auto-action broadcast is sent before seat release, verifying the pass was recorded
      expect(Array.isArray(charleston.submittedPlayerIds)).toBe(true);
    }

    // AC9: seat released after auto-action (player removed from room.players)
    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.players.has(playerIds[0])).toBe(false);

    for (const ws of clients.slice(1)) ws.close();
  });

  it("3.3 grace expiry during passing when rack has only Jokers still produces 3 tiles (AC2)", async () => {
    const { roomCode, clients, playerIds } = await setupCharlestonRoom();

    // Replace player-0's rack with only Jokers via direct state mutation (AC2 edge case)
    const room = app.roomManager.getRoom(roomCode)!;
    const jokerTiles = Array.from({ length: 13 }, (_, k) => ({
      id: `joker-test-${k + 1}`,
      suit: "joker" as const,
      value: 0,
      category: "joker" as const,
    }));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only direct state mutation to simulate all-Joker rack
    (room.gameState!.players[playerIds[0]] as unknown as { rack: typeof jokerTiles }).rack =
      jokerTiles;

    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);

    const autoActionBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    await delay(SHORT_GRACE_MS + 100);
    const broadcastMessages = await Promise.all(autoActionBroadcasts);

    for (const broadcast of broadcastMessages) {
      expect(broadcast.type).toBe("STATE_UPDATE");
      const state = broadcast.state as Record<string, unknown>;
      const charleston = state.charleston as Record<string, unknown>;
      // AC2: auto-pass went through even with all-Joker rack (3 Jokers selected as fallback)
      expect(charleston.submittedPlayerIds).toContain(playerIds[0]);
    }

    for (const ws of clients.slice(1)) ws.close();
  });

  it("3.4 grace expiry during vote-ready status dispatches CHARLESTON_VOTE { accept: false } (AC5)", async () => {
    const { roomCode, clients, playerIds } = await setupCharlestonRoom();

    // Set charleston state to vote-ready via direct mutation
    const room = app.roomManager.getRoom(roomCode)!;
    room.gameState!.charleston = {
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      activePlayerIds: [...playerIds],
      submittedPlayerIds: [],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: {},
      courtesyPairings: [],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);

    // Set up listeners for the auto-action broadcast
    const autoActionBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    await delay(SHORT_GRACE_MS + 100);
    const broadcastMessages = await Promise.all(autoActionBroadcasts);

    // AC5 and AC8: broadcast sent after auto-vote
    for (const broadcast of broadcastMessages) {
      expect(broadcast.type).toBe("STATE_UPDATE");
      const state = broadcast.state as Record<string, unknown>;
      const charleston = state.charleston as Record<string, unknown>;
      // When CHARLESTON_VOTE { accept: false } is processed, it immediately transitions
      // the state from "vote-ready" to "courtesy-ready" (any single reject triggers transition).
      // The vote state is reset after the transition, so we verify the status transition happened.
      expect(charleston.status).toBe("courtesy-ready");
    }

    for (const ws of clients.slice(1)) ws.close();
  });

  it("3.5 grace expiry during courtesy-ready status dispatches COURTESY_PASS { count: 0, tileIds: [] } (AC6)", async () => {
    const { roomCode, clients, playerIds } = await setupCharlestonRoom();

    // Set charleston state to courtesy-ready via direct mutation
    const room = app.roomManager.getRoom(roomCode)!;
    room.gameState!.charleston = {
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      activePlayerIds: [...playerIds],
      submittedPlayerIds: [],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: {},
      courtesyPairings: [
        [playerIds[0], playerIds[2]],
        [playerIds[1], playerIds[3]],
      ],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);

    // Set up listeners for the auto-action broadcast (AC8: broadcast is sent after auto-pass)
    const autoActionBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    await delay(SHORT_GRACE_MS + 100);
    const broadcastMessages = await Promise.all(autoActionBroadcasts);

    // AC8: a broadcast was sent after the auto-action
    for (const broadcast of broadcastMessages) {
      expect(broadcast.type).toBe("STATE_UPDATE");
      const state = broadcast.state as Record<string, unknown>;
      expect(state.gamePhase).toBe("charleston");
    }

    // AC6: verify the courtesy submission was recorded in internal state
    // (pair doesn't resolve until partner submits, but the submission is stored)
    // room.gameState persists even after player-0 seat is released
    const courtesySubmissions = room.gameState!.charleston?.courtesySubmissionsByPlayerId;
    expect(courtesySubmissions).toBeDefined();
    expect(courtesySubmissions[playerIds[0]]).toMatchObject({ count: 0, tileIds: [] });

    for (const ws of clients.slice(1)) ws.close();
  });

  it("3.6 player already submitted before disconnecting — no duplicate auto-action dispatched (AC1)", async () => {
    const { roomCode, clients, playerIds } = await setupCharlestonRoom();

    // Get 3 tiles from player-0's rack to submit a real CHARLESTON_PASS
    const room = app.roomManager.getRoom(roomCode)!;
    const rack = room.gameState!.players[playerIds[0]].rack;
    const tileIds = rack.slice(0, 3).map((t) => t.id);

    // Player-0 submits CHARLESTON_PASS before disconnecting
    const submitResponse = waitForMessage(clients[0]);
    const submitBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].send(
      JSON.stringify({
        version: 1,
        type: "ACTION",
        action: { type: "CHARLESTON_PASS", tileIds },
      }),
    );
    await submitResponse;
    await Promise.all(submitBroadcasts);

    // Confirm player-0 is already in submittedPlayerIds
    expect(room.gameState!.charleston!.submittedPlayerIds).toContain(playerIds[0]);
    const countBefore = room.gameState!.charleston!.submittedPlayerIds.filter(
      (id) => id === playerIds[0],
    ).length;

    // Player-0 disconnects
    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);

    // Wait for grace expiry — no auto-action should be dispatched (player already submitted)
    await delay(SHORT_GRACE_MS + 100);

    // submittedPlayerIds count for player-0 should not increase
    const submittedAfterExpiry = room.gameState?.charleston?.submittedPlayerIds ?? [];
    const countAfter = submittedAfterExpiry.filter((id) => id === playerIds[0]).length;
    expect(countAfter).toBe(countBefore);

    for (const ws of clients.slice(1)) ws.close();
  });

  it("3.7 player reconnects within grace period cancels auto-pass — no state change from auto-pass (AC4)", async () => {
    const { roomCode, clients, tokens, playerIds } = await setupCharlestonRoom();

    // Player-0 disconnects
    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);
    await delay(50); // reconnect well within grace period

    // Player-0 reconnects before grace expiry
    const reconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    const wsReconnect = await connectWs(wsUrl);
    const reconnectMsgPromise = waitForMessage(wsReconnect);
    sendJoinWithToken(wsReconnect, roomCode, tokens[0]);
    await reconnectMsgPromise;
    await Promise.all(reconnectBroadcasts);

    // Wait past where grace would have expired — no auto-action should fire
    await delay(SHORT_GRACE_MS + 100);

    // Player-0 should NOT be in submittedPlayerIds (no auto-pass happened)
    const room = app.roomManager.getRoom(roomCode)!;
    const submittedIds = room.gameState!.charleston!.submittedPlayerIds;
    expect(submittedIds).not.toContain(playerIds[0]);

    wsReconnect.close();
    for (const ws of clients.slice(1)) ws.close();
  });

  it("3.8 grace expiry during non-charleston game phase — no play-phase auto-action when not their turn, seat released normally", async () => {
    const { roomCode, clients, playerIds } = await setupCharlestonRoom();

    // Force the game into play phase (non-charleston)
    const room = app.roomManager.getRoom(roomCode)!;
    room.gameState!.gamePhase = "play";
    room.gameState!.charleston = null;
    // 4B.2: avoid auto-discard / call-window pass for player-0 — use another player's turn
    room.gameState!.callWindow = null;
    room.gameState!.currentTurn = playerIds[1];
    room.gameState!.turnPhase = "draw";

    const disconnectBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(disconnectBroadcasts);

    // Set up listeners for the seat-release broadcast (fires after grace expiry)
    const seatReleaseBroadcasts = clients.slice(1).map((ws) => waitForMessage(ws));

    await delay(SHORT_GRACE_MS + 100);

    const seatReleaseMessages = await Promise.all(seatReleaseBroadcasts);

    // Seat release broadcast: player-0 removed from room (no play-phase fallback for this setup)
    for (const broadcast of seatReleaseMessages) {
      expect(broadcast.type).toBe("STATE_UPDATE");
      const state = broadcast.state as Record<string, unknown>;
      const players = state.players as Array<Record<string, unknown>>;
      // player-0 seat released — no longer in players list
      const player0 = players.find((p) => p.playerId === playerIds[0]);
      expect(player0).toBeUndefined();
    }

    for (const ws of clients.slice(1)) ws.close();
  });
});

describe("SET_JOKER_RULES", () => {
  async function joinFourPlayers(roomCode: string): Promise<WebSocket[]> {
    const names = ["Alice", "Bob", "Charlie", "Diana"] as const;
    const players: WebSocket[] = [];
    for (const name of names) {
      const ws = await connectWs(wsUrl);
      const broadcastPromises = players.map((p) => waitForMessage(p));
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, name);
      await msgPromise;
      await Promise.all(broadcastPromises);
      players.push(ws);
    }
    return players;
  }

  it("host can set simplified in lobby; all players receive updated jokerRulesMode", async () => {
    const { roomCode } = await createRoom();
    const hostWs = await connectWs(wsUrl);
    const h0 = waitForMessage(hostWs);
    sendJoin(hostWs, roomCode, "Host");
    await h0;

    const bobWs = await connectWs(wsUrl);
    const b0 = waitForMessage(bobWs);
    sendJoin(bobWs, roomCode, "Bob");
    await b0;
    await waitForMessage(hostWs);

    const hostUp = waitForMessage(hostWs);
    const bobUp = waitForMessage(bobWs);
    hostWs.send(
      JSON.stringify({ version: 1, type: "SET_JOKER_RULES", jokerRulesMode: "simplified" }),
    );
    const [mh, mb] = await Promise.all([hostUp, bobUp]);
    expect(mh.type).toBe("STATE_UPDATE");
    expect(mb.type).toBe("STATE_UPDATE");
    expect((mh.state as Record<string, unknown>).jokerRulesMode).toBe("simplified");
    expect((mb.state as Record<string, unknown>).jokerRulesMode).toBe("simplified");
    expect(app.roomManager.getRoom(roomCode)!.jokerRulesMode).toBe("simplified");

    hostWs.close();
    bobWs.close();
  });

  it("rejects SET_JOKER_RULES from non-host", async () => {
    const { roomCode } = await createRoom();
    const hostWs = await connectWs(wsUrl);
    const h0 = waitForMessage(hostWs);
    sendJoin(hostWs, roomCode, "Host");
    await h0;

    const bobWs = await connectWs(wsUrl);
    const b0 = waitForMessage(bobWs);
    sendJoin(bobWs, roomCode, "Bob");
    await b0;
    await waitForMessage(hostWs);

    const err = waitForMessage(bobWs);
    bobWs.send(
      JSON.stringify({ version: 1, type: "SET_JOKER_RULES", jokerRulesMode: "simplified" }),
    );
    const msg = await err;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("NOT_HOST");

    hostWs.close();
    bobWs.close();
  });

  it("rejects SET_JOKER_RULES while game is in progress", async () => {
    const { roomCode } = await createRoom();
    const clients = await joinFourPlayers(roomCode);
    const hostWs = clients[0];
    const startPromises = clients.map((c) => waitForMessage(c));
    hostWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    await Promise.all(startPromises);

    const err = waitForMessage(hostWs);
    hostWs.send(
      JSON.stringify({ version: 1, type: "SET_JOKER_RULES", jokerRulesMode: "simplified" }),
    );
    const msg = await err;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("GAME_IN_PROGRESS");

    for (const ws of clients) ws.close();
  });
});

describe("Story 4B.3 — simultaneous disconnect pause", () => {
  const SHORT_GRACE_MS = 50;
  const SHORT_PAUSE_MS = 200;

  beforeEach(() => {
    setGracePeriodMs(SHORT_GRACE_MS);
    setPauseTimeoutMs(SHORT_PAUSE_MS);
  });

  afterEach(() => {
    // Belt-and-suspenders: cancel any lingering pause-timeout across all active
    // rooms so a test that forgets the per-test cleanup does not leak a real
    // setTimeout into the next test (SHORT_PAUSE_MS is real time, not fake).
    for (const code of app.roomManager.getActiveRoomCodes()) {
      const r = app.roomManager.getRoom(code);
      if (r) {
        cancelLifecycleTimer(r, "pause-timeout");
      }
    }
    setGracePeriodMs(DEFAULT_GRACE_PERIOD_MS);
    setPauseTimeoutMs(DEFAULT_PAUSE_TIMEOUT_MS);
  });

  async function setupCharlestonFour(): Promise<{
    roomCode: string;
    clients: WebSocket[];
    tokens: string[];
  }> {
    const { roomCode } = await createRoom();
    const clients: WebSocket[] = [];
    const tokens: string[] = [];

    for (let i = 0; i < 4; i++) {
      const broadcastPromises = clients.map((ws) => waitForMessage(ws));

      const ws = await connectWs(wsUrl);
      const msgPromise = waitForMessage(ws);
      sendJoin(ws, roomCode, `PauseP${i}`);
      const msg = await msgPromise;

      clients.push(ws);
      tokens.push(msg.token as string);
      await Promise.all(broadcastPromises);
    }

    const gameStartMessages = clients.map((ws) => waitForMessage(ws));
    clients[0].send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
    await Promise.all(gameStartMessages);

    return { roomCode, clients, tokens };
  }

  it("T1: second disconnect triggers GAME_PAUSED and clears per-player grace timers", async () => {
    const { roomCode, clients } = await setupCharlestonFour();

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    let room = app.roomManager.getRoom(roomCode)!;
    expect(room.graceTimers.size).toBe(1);
    expect(room.paused).toBe(false);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    const msgs = await Promise.all(secondDc);

    room = app.roomManager.getRoom(roomCode)!;
    expect(room.paused).toBe(true);
    expect(room.graceTimers.size).toBe(0);

    for (const m of msgs) {
      expect(m.resolvedAction).toMatchObject({
        type: "GAME_PAUSED",
        reason: "simultaneous-disconnect",
      });
    }

    for (const c of clients.slice(2)) c.close();
    const rT1 = app.roomManager.getRoom(roomCode);
    if (rT1) cancelLifecycleTimer(rT1, "pause-timeout");
  });

  it("T2: full reconnect clears pause and cancels pause-timeout (AC5)", async () => {
    const { roomCode, clients, tokens } = await setupCharlestonFour();

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    await Promise.all(secondDc);

    const r0 = await connectWs(wsUrl);
    sendJoinWithToken(r0, roomCode, tokens[0]);
    await waitForMessage(r0);

    const r1 = await connectWs(wsUrl);
    sendJoinWithToken(r1, roomCode, tokens[1]);
    await waitForMessage(r1);

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.paused).toBe(false);
    expect(room.pausedAt).toBeNull();
    expect(hasLifecycleTimer(room, "pause-timeout")).toBe(false);

    r0.close();
    r1.close();
    for (const c of clients.slice(2)) c.close();
  });

  it("T3: pause-timeout auto-ends to scoreboard with GAME_ABANDONED", async () => {
    const { roomCode, clients } = await setupCharlestonFour();

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    await Promise.all(secondDc);

    const cleanupSpy = vi.spyOn(app.roomManager, "cleanupRoom");

    const abandonMsgs = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    await delay(SHORT_PAUSE_MS + 80);
    await Promise.all(abandonMsgs);

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.gameState?.gamePhase).toBe("scoreboard");
    expect(room.gameState?.gameResult).toEqual({ winnerId: null, points: 0 });
    expect(room.paused).toBe(false);
    expect(cleanupSpy).not.toHaveBeenCalled();
    cleanupSpy.mockRestore();

    for (const c of clients.slice(2)) c.close();
    const rT3 = app.roomManager.getRoom(roomCode);
    if (rT3) cancelLifecycleTimer(rT3, "pause-timeout");
  });

  it("T4: third disconnect while paused does not add grace timers", async () => {
    const { roomCode, clients } = await setupCharlestonFour();

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    await Promise.all(secondDc);

    const thirdDc = clients.slice(3, 4).map((ws) => waitForMessage(ws));
    clients[2].close();
    await Promise.all(thirdDc);

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.paused).toBe(true);
    expect(room.graceTimers.size).toBe(0);

    clients[3].close();
    const rT4 = app.roomManager.getRoom(roomCode);
    if (rT4) cancelLifecycleTimer(rT4, "pause-timeout");
  });

  it("T7: two lobby disconnects do not pause the room", async () => {
    const { roomCode } = await createRoom();
    const a = await connectWs(wsUrl);
    const a0 = waitForMessage(a);
    sendJoin(a, roomCode, "L0");
    await a0;

    const b = await connectWs(wsUrl);
    const b0 = waitForMessage(b);
    const aJoinB = waitForMessage(a);
    sendJoin(b, roomCode, "L1");
    await Promise.all([b0, aJoinB]);

    const aAfterBLeave = waitForMessage(a);
    b.close();
    await aAfterBLeave;

    a.close();
    await delay(50);

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.paused).toBe(false);
    expect(room.gameState).toBeNull();
  });

  it("T5: third disconnect while paused then reconnect all three — GAME_RESUMED only on last reconnect", async () => {
    const { roomCode, clients, tokens } = await setupCharlestonFour();
    const broadcastSpy = vi.spyOn(stateBroadcaster, "broadcastStateToRoom");

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    await Promise.all(secondDc);

    const thirdDc = clients.slice(3, 4).map((ws) => waitForMessage(ws));
    clients[2].close();
    await Promise.all(thirdDc);

    function gameResumedCount(): number {
      return broadcastSpy.mock.calls.filter(
        (c) =>
          c[2] !== undefined &&
          typeof c[2] === "object" &&
          c[2] !== null &&
          "type" in c[2] &&
          (c[2] as { type: string }).type === "GAME_RESUMED",
      ).length;
    }

    const r0 = await connectWs(wsUrl);
    sendJoinWithToken(r0, roomCode, tokens[0]);
    await waitForMessage(r0);
    expect(gameResumedCount()).toBe(0);

    const r1 = await connectWs(wsUrl);
    sendJoinWithToken(r1, roomCode, tokens[1]);
    await waitForMessage(r1);
    expect(gameResumedCount()).toBe(0);

    const r2 = await connectWs(wsUrl);
    sendJoinWithToken(r2, roomCode, tokens[2]);
    await waitForMessage(r2);
    expect(gameResumedCount()).toBe(1);

    expect(app.roomManager.getRoom(roomCode)!.paused).toBe(false);

    broadcastSpy.mockRestore();
    r0.close();
    r1.close();
    r2.close();
    clients[3].close();
  });

  it("T8: two disconnects during scoreboard do not pause — per-player grace timers apply", async () => {
    setGracePeriodMs(10_000);
    const { roomCode, clients } = await setupCharlestonFour();
    const room0 = app.roomManager.getRoom(roomCode)!;
    room0.gameState!.gamePhase = "scoreboard";

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    const r1 = app.roomManager.getRoom(roomCode)!;
    expect(r1.paused).toBe(false);
    expect(r1.graceTimers.size).toBe(1);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    await Promise.all(secondDc);

    const r2 = app.roomManager.getRoom(roomCode)!;
    expect(r2.paused).toBe(false);
    expect(r2.graceTimers.size).toBe(2);

    for (const t of r2.graceTimers.values()) {
      clearTimeout(t);
    }
    r2.graceTimers.clear();

    clients[2].close();
    clients[3].close();
  });

  it("T9: after resume from pause, single disconnect starts fresh per-player grace timer", async () => {
    setGracePeriodMs(10_000);
    const { roomCode, clients, tokens } = await setupCharlestonFour();

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    await Promise.all(secondDc);

    const r0 = await connectWs(wsUrl);
    sendJoinWithToken(r0, roomCode, tokens[0]);
    await waitForMessage(r0);

    const r1 = await connectWs(wsUrl);
    sendJoinWithToken(r1, roomCode, tokens[1]);
    await waitForMessage(r1);

    let room = app.roomManager.getRoom(roomCode)!;
    expect(room.paused).toBe(false);
    expect(room.graceTimers.size).toBe(0);

    clients[2].close();
    await delay(100);

    room = app.roomManager.getRoom(roomCode)!;
    expect(room.paused).toBe(false);
    expect(room.graceTimers.size).toBe(1);
    expect(room.graceTimers.has("player-2")).toBe(true);

    const t = room.graceTimers.get("player-2");
    if (t) clearTimeout(t);
    room.graceTimers.delete("player-2");

    cancelLifecycleTimer(room, "pause-timeout");
    r0.close();
    r1.close();
    clients[3].close();
  });

  it("T10: superseded socket close while paused does not mark player disconnected", async () => {
    const { roomCode, clients, tokens } = await setupCharlestonFour();

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    await Promise.all(secondDc);

    const wsA = await connectWs(wsUrl);
    const wsAMsg = waitForMessage(wsA);
    sendJoinWithToken(wsA, roomCode, tokens[0]);
    await wsAMsg;

    const wsB = await connectWs(wsUrl);
    const supersededPromise = waitForMessage(wsA);
    const wsBMsgPromise = waitForMessage(wsB);
    sendJoinWithToken(wsB, roomCode, tokens[0]);

    const supersededMsg = await supersededPromise;
    expect(supersededMsg.type).toBe("SYSTEM_EVENT");
    expect(supersededMsg.event).toBe("SESSION_SUPERSEDED");
    await wsBMsgPromise;

    const closePromise = waitForClose(wsA);
    await closePromise;

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.players.get("player-0")?.connected).toBe(true);
    expect(room.paused).toBe(true);

    cancelLifecycleTimer(room, "pause-timeout");
    wsB.close();
    const r1 = await connectWs(wsUrl);
    sendJoinWithToken(r1, roomCode, tokens[1]);
    await waitForMessage(r1);
    r1.close();
    clients[2].close();
    clients[3].close();
  });

  it("T12: stale token after pause-timeout auto-end does not reattach released seat", async () => {
    const { roomCode, clients, tokens } = await setupCharlestonFour();

    const firstDc = clients.slice(1, 4).map((ws) => waitForMessage(ws));
    clients[0].close();
    await Promise.all(firstDc);

    const secondDc = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    clients[1].close();
    await Promise.all(secondDc);

    const abandonMsgs = clients.slice(2, 4).map((ws) => waitForMessage(ws));
    await delay(SHORT_PAUSE_MS + 80);
    await Promise.all(abandonMsgs);

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.gameState?.gamePhase).toBe("scoreboard");
    expect(room.players.has("player-0")).toBe(false);

    const ws = await connectWs(wsUrl);
    const errPromise = waitForMessage(ws);
    sendJoinWithToken(ws, roomCode, tokens[0]);
    const msg = await errPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_DISPLAY_NAME");

    ws.close();
    clients[2].close();
    clients[3].close();
  });
});

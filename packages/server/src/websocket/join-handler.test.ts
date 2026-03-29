import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../index";
import type { FastifyInstance } from "fastify";

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

function sendJoin(ws: WebSocket, roomCode: string, displayName: string): void {
  ws.send(
    JSON.stringify({
      version: 1,
      type: "JOIN_ROOM",
      roomCode,
      displayName,
    }),
  );
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

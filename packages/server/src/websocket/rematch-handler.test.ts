/**
 * Integration tests for `handleRematch` (Story 4B.7) — REMATCH gates, waiting-for-players fallback,
 * idle-timeout cancellation on successful rematch (5B.4), and `handleEndSession` (5B.4).
 */
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import WsClient from "ws";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { createApp } from "../index";
import type { FastifyInstance } from "fastify";
import { hasLifecycleTimer, startLifecycleTimer } from "../rooms/room-lifecycle";

type WebSocket = WsClient;

let app: FastifyInstance;
let wsUrl: string;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseWsJsonMessage(data: Buffer): Record<string, unknown> {
  const raw: unknown = JSON.parse(Buffer.from(data).toString("utf-8"));
  if (!isPlainObject(raw)) {
    throw new Error("WebSocket message must be a JSON object");
  }
  return raw;
}

async function createRoom(hostName = "TestHost"): Promise<{ roomCode: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: { hostName },
  });
  expect(res.statusCode).toBe(201);
  const raw: unknown = JSON.parse(res.body);
  if (!isPlainObject(raw) || typeof raw.roomCode !== "string") {
    throw new Error("Invalid create room response");
  }
  return { roomCode: raw.roomCode };
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
    ws.once("message", (data: Buffer) => {
      resolve(parseWsJsonMessage(data));
    });
  });
}

function sendJoin(ws: WebSocket, roomCode: string, displayName: string): void {
  ws.send(
    JSON.stringify({
      version: PROTOCOL_VERSION,
      type: "JOIN_ROOM",
      roomCode,
      displayName,
    }),
  );
}

function isStateUpdateWithToken(msg: Record<string, unknown>): msg is Record<string, unknown> & {
  token: string;
  state: Record<string, unknown> & { myPlayerId: string };
} {
  if (msg.type !== "STATE_UPDATE" || typeof msg.token !== "string" || !isPlainObject(msg.state)) {
    return false;
  }
  return typeof msg.state.myPlayerId === "string";
}

async function joinPlayer(
  roomCode: string,
  displayName: string,
): Promise<{ ws: WebSocket; token: string; playerId: string }> {
  const ws = await connectWs(wsUrl);
  const msgPromise = waitForMessage(ws);
  sendJoin(ws, roomCode, displayName);
  const msg = await msgPromise;
  if (!isStateUpdateWithToken(msg)) {
    throw new Error(`Expected join STATE_UPDATE with token, got ${JSON.stringify(msg)}`);
  }
  return {
    ws,
    token: msg.token,
    playerId: msg.state.myPlayerId,
  };
}

type JoinedPlayer = { ws: WebSocket; token: string; playerId: string };

async function setupLobbyWithPlayers(
  count: number,
): Promise<{ roomCode: string; players: JoinedPlayer[] }> {
  const { roomCode } = await createRoom();
  const players: JoinedPlayer[] = [];
  for (let i = 0; i < count; i++) {
    const broadcastPromises = players.map((p) => waitForMessage(p.ws));
    const p = await joinPlayer(roomCode, `P${i}`);
    players.push(p);
    if (broadcastPromises.length > 0) {
      await Promise.all(broadcastPromises);
    }
  }
  return { roomCode, players };
}

async function waitForResolvedAction(
  ws: WebSocket,
  actionType: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener("message", onMessage);
      reject(new Error(`timeout waiting for resolvedAction ${actionType}`));
    }, 15_000);

    function onMessage(data: Buffer) {
      let msg: Record<string, unknown>;
      try {
        msg = parseWsJsonMessage(data);
      } catch {
        return;
      }
      if (msg.type === "CHAT_HISTORY") return;
      if (msg.type === "STATE_UPDATE") {
        const ra = msg.resolvedAction;
        if (isPlainObject(ra) && ra.type === actionType) {
          clearTimeout(timer);
          ws.removeListener("message", onMessage);
          resolve(msg);
        }
      }
    }
    ws.on("message", onMessage);
  });
}

function waitForError(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener("message", onMessage);
      reject(new Error("timeout waiting for ERROR"));
    }, 15_000);

    function onMessage(data: Buffer) {
      let msg: Record<string, unknown>;
      try {
        msg = parseWsJsonMessage(data);
      } catch {
        return;
      }
      if (msg.type === "CHAT_HISTORY") return;
      if (msg.type === "ERROR") {
        clearTimeout(timer);
        ws.removeListener("message", onMessage);
        resolve(msg);
      }
    }
    ws.on("message", onMessage);
  });
}

function sendRematch(ws: WebSocket): void {
  ws.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "REMATCH" }));
}

function sendEndSession(ws: WebSocket): void {
  ws.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "END_SESSION" }));
}

function sendLeaveRoom(ws: WebSocket): void {
  ws.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "LEAVE_ROOM" }));
}

function sendStartGame(ws: WebSocket): void {
  ws.send(
    JSON.stringify({
      version: PROTOCOL_VERSION,
      type: "ACTION",
      action: { type: "START_GAME" },
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

describe("handleRematch (4B.7)", () => {
  it("T17: scoreboard with 4 seats — REMATCH starts a new game; settings unchanged", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(4);
    const room = app.roomManager.getRoom(roomCode)!;
    const hostWs = players[0].ws;

    const startPromises = players.map((p) => waitForMessage(p.ws));
    sendStartGame(hostWs);
    await Promise.all(startPromises);

    room.settings = { ...room.settings, jokerRulesMode: "simplified" };
    room.jokerRulesMode = "simplified";

    room.gameState!.gamePhase = "scoreboard";
    room.gameState!.gameResult = { winnerId: null, points: 0 };

    const jokerBefore = room.settings.jokerRulesMode;

    startLifecycleTimer(room, "idle-timeout", () => {});
    expect(hasLifecycleTimer(room, "idle-timeout")).toBe(true);

    const rematchPromises = players.map((p) => waitForMessage(p.ws));
    sendRematch(hostWs);
    await Promise.all(rematchPromises);

    expect(hasLifecycleTimer(room, "idle-timeout")).toBe(false);
    expect(room.gameState?.gamePhase).toBe("charleston");
    expect(room.settings.jokerRulesMode).toBe(jokerBefore);
    expect(room.jokerRulesMode).toBe(jokerBefore);

    for (const p of players) p.ws.close();
  });

  it("T18: scoreboard with 3 seats — REMATCH_WAITING_FOR_PLAYERS and lobby reset", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(4);
    const room = app.roomManager.getRoom(roomCode)!;
    const hostWs = players[0].ws;

    const startPromises = players.map((p) => waitForMessage(p.ws));
    sendStartGame(hostWs);
    await Promise.all(startPromises);

    room.gameState!.gamePhase = "scoreboard";
    room.gameState!.gameResult = { winnerId: null, points: 0 };

    // Remaining seats (0–2) receive departure broadcast; leaver's socket may close before a message.
    const leavePromises = players.slice(0, 3).map((p) => waitForMessage(p.ws));
    sendLeaveRoom(players[3].ws);
    await Promise.all(leavePromises);

    expect(room.players.size).toBe(3);

    const wait = waitForResolvedAction(hostWs, "REMATCH_WAITING_FOR_PLAYERS");
    sendRematch(hostWs);
    const msg = await wait;
    const ra = msg.resolvedAction as Record<string, unknown>;
    expect(ra.type).toBe("REMATCH_WAITING_FOR_PLAYERS");
    expect(ra.missingSeats).toBe(1);
    expect(room.gameState).toBeNull();

    // AC11 / Task 5.4: settings persist across the fallback-to-lobby path
    expect(room.settings.timerMode).toBe("timed");
    expect(room.settings.turnDurationMs).toBe(20_000);
    expect(room.jokerRulesMode).toBe(room.settings.jokerRulesMode);
    expect(room.turnTimer.config.mode).toBe(room.settings.timerMode);
    expect(room.turnTimer.config.durationMs).toBe(room.settings.turnDurationMs);

    const status = app.roomManager.getRoomStatus(roomCode);
    expect(status?.phase).toBe("lobby");

    for (const p of players.slice(0, 3)) p.ws.close();
  });

  it("T19: 4 connected + dead seat — waiting path", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(4);
    const room = app.roomManager.getRoom(roomCode)!;
    const hostWs = players[0].ws;

    const startPromises = players.map((p) => waitForMessage(p.ws));
    sendStartGame(hostWs);
    await Promise.all(startPromises);

    room.gameState!.gamePhase = "scoreboard";
    room.gameState!.gameResult = { winnerId: null, points: 0 };
    room.seatStatus.deadSeatPlayerIds.add(players[3].playerId);

    const wait = waitForResolvedAction(hostWs, "REMATCH_WAITING_FOR_PLAYERS");
    sendRematch(hostWs);
    await wait;
    expect(room.gameState).toBeNull();

    for (const p of players) p.ws.close();
  });

  it("T20: non-host REMATCH — NOT_HOST", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(4);
    const room = app.roomManager.getRoom(roomCode)!;

    const startPromises = players.map((p) => waitForMessage(p.ws));
    sendStartGame(players[0].ws);
    await Promise.all(startPromises);

    room.gameState!.gamePhase = "scoreboard";
    room.gameState!.gameResult = { winnerId: null, points: 0 };

    const errP = waitForError(players[1].ws);
    sendRematch(players[1].ws);
    const err = await errP;
    expect(err.code).toBe("NOT_HOST");

    for (const p of players) p.ws.close();
  });

  it("T21: play phase REMATCH — NOT_BETWEEN_GAMES", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(4);
    const room = app.roomManager.getRoom(roomCode)!;

    const startPromises = players.map((p) => waitForMessage(p.ws));
    sendStartGame(players[0].ws);
    await Promise.all(startPromises);

    expect(room.gameState?.gamePhase).toBe("charleston");

    const errP = waitForError(players[0].ws);
    sendRematch(players[0].ws);
    const err = await errP;
    expect(err.code).toBe("NOT_BETWEEN_GAMES");

    for (const p of players) p.ws.close();
  });

  it("T22: lobby with no game — NOT_BETWEEN_GAMES", async () => {
    const { players } = await setupLobbyWithPlayers(4);
    const errP = waitForError(players[0].ws);
    sendRematch(players[0].ws);
    const err = await errP;
    expect(err.code).toBe("NOT_BETWEEN_GAMES");

    for (const p of players) p.ws.close();
  });
});

describe("handleEndSession (5B.4)", () => {
  it("host END_SESSION from scoreboard — SESSION_ENDED with session totals and history, lobby", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(4);
    const room = app.roomManager.getRoom(roomCode)!;
    const hostWs = players[0].ws;

    const startPromises = players.map((p) => waitForMessage(p.ws));
    sendStartGame(hostWs);
    await Promise.all(startPromises);

    const gs = room.gameState!;
    gs.gamePhase = "scoreboard";
    gs.gameResult = { winnerId: null, points: 0 };
    const ids = Object.keys(gs.players).sort();
    gs.scores = {
      [ids[0]]: 12,
      [ids[1]]: -4,
      [ids[2]]: -4,
      [ids[3]]: -4,
    };

    const wait = waitForResolvedAction(hostWs, "SESSION_ENDED");
    sendEndSession(hostWs);
    const msg = await wait;
    const ra = msg.resolvedAction as Record<string, unknown>;
    expect(ra.type).toBe("SESSION_ENDED");
    expect(ra.sessionTotals).toEqual(gs.scores);
    const hist = ra.sessionGameHistory as Array<{ gameNumber: number }>;
    expect(hist).toHaveLength(1);
    expect(hist[0]?.gameNumber).toBe(1);

    expect(room.gameState).toBeNull();
    expect(room.sessionHistory.scoresFromPriorGames).toEqual({});
    expect(room.sessionHistory.gameHistory).toEqual([]);

    const status = app.roomManager.getRoomStatus(roomCode);
    expect(status?.phase).toBe("lobby");

    for (const p of players) p.ws.close();
  });

  it("non-host END_SESSION — NOT_HOST", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(4);
    const room = app.roomManager.getRoom(roomCode)!;

    const startPromises = players.map((p) => waitForMessage(p.ws));
    sendStartGame(players[0].ws);
    await Promise.all(startPromises);

    room.gameState!.gamePhase = "scoreboard";
    room.gameState!.gameResult = { winnerId: null, points: 0 };

    const errP = waitForError(players[1].ws);
    sendEndSession(players[1].ws);
    const err = await errP;
    expect(err.code).toBe("NOT_HOST");

    for (const p of players) p.ws.close();
  });
});

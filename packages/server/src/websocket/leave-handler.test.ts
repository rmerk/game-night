/* eslint-disable no-await-in-loop -- sequential WebSocket steps keep ordering deterministic */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- parsed WebSocket payloads are intentionally inspected as loose JSON test fixtures */
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import WsClient from "ws";
import { createLobbyState, handleAction } from "@mahjong-game/shared";
import { createApp } from "../index";
import type { FastifyInstance } from "fastify";
import {
  DEFAULT_DEPARTURE_VOTE_TIMEOUT_MS,
  setDepartureVoteTimeoutMs,
} from "../rooms/room-lifecycle";
import { resetTurnTimerStateOnGameEnd } from "./turn-timer";

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

function isStateUpdateWithToken(msg: Record<string, unknown>): msg is Record<string, unknown> & {
  token: string;
  state: Record<string, unknown> & { myPlayerId: string };
} {
  if (msg.type !== "STATE_UPDATE" || typeof msg.token !== "string" || !isPlainObject(msg.state)) {
    return false;
  }
  return typeof msg.state.myPlayerId === "string";
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
      version: 1,
      type: "JOIN_ROOM",
      roomCode,
      displayName,
    }),
  );
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

async function setupGameInProgress(): Promise<{
  roomCode: string;
  players: JoinedPlayer[];
}> {
  const { roomCode, players } = await setupLobbyWithPlayers(4);
  const room = app.roomManager.getRoom(roomCode)!;

  const gameState = createLobbyState();
  const playerIds = players.map((p) => p.playerId);
  const startResult = handleAction(gameState, {
    type: "START_GAME",
    playerIds,
    seed: 42,
  });
  expect(startResult.accepted).toBe(true);
  gameState.gamePhase = "play";
  gameState.charleston = null;
  room.gameState = gameState;

  return { roomCode, players };
}

function sendLeaveRoom(ws: WebSocket): void {
  ws.send(JSON.stringify({ version: 1, type: "LEAVE_ROOM" }));
}

function sendDepartureVote(
  ws: WebSocket,
  targetPlayerId: string,
  choice: "dead_seat" | "end_game",
): void {
  ws.send(
    JSON.stringify({
      version: 1,
      type: "DEPARTURE_VOTE_CAST",
      targetPlayerId,
      choice,
    }),
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait until a STATE_UPDATE carries the given resolvedAction.type (skips CHAT_HISTORY). */
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

async function waitForError(ws: WebSocket): Promise<Record<string, unknown>> {
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

function sendDepartureVoteRaw(ws: WebSocket, payload: Record<string, unknown>): void {
  ws.send(JSON.stringify({ version: 1, type: "DEPARTURE_VOTE_CAST", ...payload }));
}

beforeEach(async () => {
  setDepartureVoteTimeoutMs(100);
  app = createApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  wsUrl = `ws://127.0.0.1:${port}`;
});

afterEach(async () => {
  setDepartureVoteTimeoutMs(DEFAULT_DEPARTURE_VOTE_TIMEOUT_MS);
  await app.close();
});

describe("leave-handler integration (Story 4B.5)", () => {
  it("T1: lobby leave releases seat — PLAYER_DEPARTED, no departure vote", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(2);
    const [a, b] = players;

    sendLeaveRoom(a.ws);
    await waitForResolvedAction(b.ws, "PLAYER_DEPARTED");

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.players.size).toBe(1);
    expect(room.departureVoteState).toBeNull();
  });

  it("T2: mid-game LEAVE_ROOM starts departure vote", async () => {
    const { players } = await setupGameInProgress();
    const [, bob, ,] = players;

    sendLeaveRoom(players[0].ws);
    const msg = await waitForResolvedAction(bob.ws, "DEPARTURE_VOTE_STARTED");
    const ra = msg.resolvedAction as Record<string, unknown>;
    expect(ra.targetPlayerId).toBe(players[0].playerId);
  });

  it("T3: two dead_seat votes convert to dead seat", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const targetId = players[0].playerId;
    sendLeaveRoom(players[0].ws);

    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    sendDepartureVote(players[1].ws, targetId, "dead_seat");
    await waitForResolvedAction(players[2].ws, "DEPARTURE_VOTE_CAST");

    sendDepartureVote(players[2].ws, targetId, "dead_seat");
    await waitForResolvedAction(players[3].ws, "DEPARTURE_VOTE_RESOLVED");

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.deadSeatPlayerIds.has(targetId)).toBe(true);
    expect(room.departureVoteState).toBeNull();
  });

  it("T4: two end_game votes auto-end", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const targetId = players[0].playerId;
    sendLeaveRoom(players[0].ws);

    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    sendDepartureVote(players[1].ws, targetId, "end_game");
    await waitForResolvedAction(players[2].ws, "DEPARTURE_VOTE_CAST");

    const hostPromotedP3 = waitForResolvedAction(players[3].ws, "HOST_PROMOTED");
    const abandonedP3 = waitForResolvedAction(players[3].ws, "GAME_ABANDONED");
    sendDepartureVote(players[2].ws, targetId, "end_game");
    await hostPromotedP3;
    const msg = await abandonedP3;
    const ra = msg.resolvedAction as Record<string, unknown>;
    expect(ra.reason).toBe("player-departure");

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.gameState?.gamePhase).toBe("scoreboard");
    expect(room.players.get(players[1].playerId)?.isHost).toBe(true);
  });

  it("T5: vote timeout with no quorum ends game", async () => {
    const { roomCode, players } = await setupGameInProgress();
    sendLeaveRoom(players[0].ws);
    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    await delay(200);

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.gameState?.gamePhase).toBe("scoreboard");
    expect(room.departureVoteState).toBeNull();
  });

  it("T6: conflicting votes stay open until timeout", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const targetId = players[0].playerId;
    sendLeaveRoom(players[0].ws);
    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    sendDepartureVote(players[1].ws, targetId, "dead_seat");
    await waitForResolvedAction(players[2].ws, "DEPARTURE_VOTE_CAST");

    sendDepartureVote(players[2].ws, targetId, "end_game");
    await waitForResolvedAction(players[3].ws, "DEPARTURE_VOTE_CAST");

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.departureVoteState).not.toBeNull();

    await delay(200);
    const roomAfter = app.roomManager.getRoom(roomCode)!;
    expect(roomAfter.gameState?.gamePhase).toBe("scoreboard");
  });

  it("T7: second departure before vote resolves cancels vote and auto-ends", async () => {
    const { players } = await setupGameInProgress();
    sendLeaveRoom(players[0].ws);
    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    const hostPromotedP2 = waitForResolvedAction(players[2].ws, "HOST_PROMOTED");
    const abandonedP2 = waitForResolvedAction(players[2].ws, "GAME_ABANDONED");
    sendLeaveRoom(players[1].ws);
    await hostPromotedP2;
    const msg = await abandonedP2;
    const ra = msg.resolvedAction as Record<string, unknown>;
    expect(ra.reason).toBe("player-departure");
  });

  it("T11: departed player cannot rejoin with token", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const alice = players[0];
    const token = alice.token;

    sendLeaveRoom(alice.ws);
    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    const wsReconnect = await connectWs(wsUrl);
    const msgPromise = waitForMessage(wsReconnect);
    wsReconnect.send(
      JSON.stringify({
        version: 1,
        type: "JOIN_ROOM",
        roomCode,
        token,
      }),
    );
    const err = await msgPromise;
    expect(err.type).toBe("ERROR");
    expect(err.code).toBe("PLAYER_DEPARTED");
    wsReconnect.close();
  });

  it("T14: simultaneous disconnect cancels departure vote", async () => {
    const { players } = await setupGameInProgress();
    sendLeaveRoom(players[0].ws);
    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    const p3 = players[3];
    const voteDone = waitForResolvedAction(p3.ws, "DEPARTURE_VOTE_RESOLVED");
    const pauseDone = waitForResolvedAction(p3.ws, "GAME_PAUSED");
    players[1].ws.close();
    players[2].ws.close();
    const r1 = await voteDone;
    expect((r1.resolvedAction as { outcome: string }).outcome).toBe("cancelled");
    await pauseDone;
  });

  it("T12: lobby host leave migrates host then PLAYER_DEPARTED — no departure vote", async () => {
    const { roomCode, players } = await setupLobbyWithPlayers(4);
    const room = app.roomManager.getRoom(roomCode)!;
    const host = players[0];
    expect(room.players.get(host.playerId)?.isHost).toBe(true);

    const others = players.slice(1);
    const promoted = waitForResolvedAction(others[0].ws, "HOST_PROMOTED");
    const departedPromises = others.map((p) => waitForResolvedAction(p.ws, "PLAYER_DEPARTED"));
    sendLeaveRoom(host.ws);
    const hp = await promoted;
    const hpRa = hp.resolvedAction as Record<string, unknown>;
    expect(hpRa.previousHostId).toBe(host.playerId);
    expect(hpRa.newHostId).toBe(players[1].playerId);
    await Promise.all(departedPromises);

    const after = app.roomManager.getRoom(roomCode)!;
    expect(after.players.size).toBe(3);
    expect(after.players.get(players[1].playerId)?.isHost).toBe(true);
    expect(after.departureVoteState).toBeNull();
    for (const p of players) p.ws.close();
  });

  it("T13: mid-game host LEAVE_ROOM still starts departure vote", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.players.get(players[0].playerId)?.isHost).toBe(true);

    sendLeaveRoom(players[0].ws);
    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");
    for (const p of players) p.ws.close();
  });

  it("T14b: after pause, resume restarts departure vote (resumeDepartureVoteIfNeeded)", async () => {
    const { roomCode, players } = await setupGameInProgress();
    sendLeaveRoom(players[0].ws);
    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    const p1Token = players[1].token;
    const p2Token = players[2].token;

    const voteCancelled = waitForResolvedAction(players[3].ws, "DEPARTURE_VOTE_RESOLVED");
    const paused = waitForResolvedAction(players[3].ws, "GAME_PAUSED");
    players[1].ws.close();
    players[2].ws.close();
    await voteCancelled;
    await paused;

    const gameResumedP3 = waitForResolvedAction(players[3].ws, "GAME_RESUMED");
    const voteRestartP3 = waitForResolvedAction(players[3].ws, "DEPARTURE_VOTE_STARTED");

    const ws1 = await connectWs(wsUrl);
    const ws2 = await connectWs(wsUrl);
    ws1.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, token: p1Token }));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, token: p2Token }));
    await waitForMessage(ws2);

    await gameResumedP3;
    await voteRestartP3;

    ws1.close();
    ws2.close();
    players[3].ws.close();
  }, 30_000);

  it("T17: DEPARTURE_VOTE_CAST target equals voter → CANNOT_VOTE_ON_DEPARTED", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const targetId = players[0].playerId;
    room.departureVoteState = {
      targetPlayerId: targetId,
      targetPlayerName: "Alice",
      startedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      votes: new Map(),
    };

    const errPromise = waitForError(players[0].ws);
    sendDepartureVoteRaw(players[0].ws, { targetPlayerId: targetId, choice: "dead_seat" });
    const err = await errPromise;
    expect(err.code).toBe("CANNOT_VOTE_ON_DEPARTED");

    for (const p of players) p.ws.close();
  });

  it("T18: DEPARTURE_VOTE_CAST with no active vote → NO_ACTIVE_DEPARTURE_VOTE", async () => {
    const { players } = await setupGameInProgress();
    const errPromise = waitForError(players[1].ws);
    sendDepartureVoteRaw(players[1].ws, {
      targetPlayerId: players[0].playerId,
      choice: "dead_seat",
    });
    const err = await errPromise;
    expect(err.code).toBe("NO_ACTIVE_DEPARTURE_VOTE");
    for (const p of players) p.ws.close();
  });

  it("T19: DEPARTURE_VOTE_CAST stale target → INVALID_DEPARTURE_VOTE_TARGET", async () => {
    const { players } = await setupGameInProgress();
    sendLeaveRoom(players[0].ws);
    await waitForResolvedAction(players[1].ws, "DEPARTURE_VOTE_STARTED");

    const errPromise = waitForError(players[1].ws);
    sendDepartureVoteRaw(players[1].ws, {
      targetPlayerId: "wrong-player-id",
      choice: "dead_seat",
    });
    const err = await errPromise;
    expect(err.code).toBe("INVALID_DEPARTURE_VOTE_TARGET");
    for (const p of players) p.ws.close();
  });

  it("T20: LEAVE_ROOM during scoreboard migrates host then PLAYER_DEPARTED — no departure vote", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const gs = room.gameState!;
    gs.gamePhase = "scoreboard";
    gs.gameResult = { winnerId: null, points: 0 };

    const other = players[1];
    const promoted = waitForResolvedAction(other.ws, "HOST_PROMOTED");
    const departedPromise = waitForResolvedAction(other.ws, "PLAYER_DEPARTED");
    sendLeaveRoom(players[0].ws);
    await promoted;
    await departedPromise;

    expect(room.departureVoteState).toBeNull();
    expect(room.players.size).toBe(3);
    expect(room.players.get(players[1].playerId)?.isHost).toBe(true);

    for (const p of players) p.ws.close();
  });

  /**
   * T21 (AC15): Any path to `resetTurnTimerStateOnGameEnd` (e.g. DECLARE_MAHJONG → scoreboard) must cancel
   * an open departure vote and broadcast `cancelled`, while `deadSeatPlayerIds` persists until `START_GAME`.
   */
  it("T21: resetTurnTimerStateOnGameEnd clears departure vote; dead seat flag persists", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const deadId = players[0].playerId;

    room.deadSeatPlayerIds.add(deadId);
    room.departureVoteState = {
      targetPlayerId: players[2].playerId,
      targetPlayerName: "P2",
      startedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      votes: new Map(),
    };

    const resolvedPromise = waitForResolvedAction(players[3].ws, "DEPARTURE_VOTE_RESOLVED");
    resetTurnTimerStateOnGameEnd(room, app.log);
    const msg = await resolvedPromise;
    const ra = msg.resolvedAction as Record<string, unknown>;
    expect(ra.outcome).toBe("cancelled");

    expect(room.departureVoteState).toBeNull();
    expect(room.deadSeatPlayerIds.has(deadId)).toBe(true);

    for (const p of players) p.ws.close();
  });

  /**
   * T23: Dead-seat players are removed from `departedPlayerIds` at conversion (AC7). A later `LEAVE_ROOM`
   * from another live player therefore has `departedPlayerIds.size === 1` — FR97 multi-departure auto-end
   * applies only when two players are simultaneously in `departedPlayerIds` before resolution (see T7).
   */
  it("T23: after first player is dead seat, second LEAVE_ROOM starts a new departure vote", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const [p0, p1, p2, p3] = players;
    const targetId = p0.playerId;

    sendLeaveRoom(p0.ws);
    await waitForResolvedAction(p1.ws, "DEPARTURE_VOTE_STARTED");

    sendDepartureVote(p1.ws, targetId, "dead_seat");
    await waitForResolvedAction(p2.ws, "DEPARTURE_VOTE_CAST");

    const hostPromotedP3 = waitForResolvedAction(p3.ws, "HOST_PROMOTED");
    sendDepartureVote(p2.ws, targetId, "dead_seat");
    await waitForResolvedAction(p3.ws, "PLAYER_CONVERTED_TO_DEAD_SEAT");
    const hp = await hostPromotedP3;
    const hpRa = hp.resolvedAction as Record<string, unknown>;
    expect(hpRa.newHostId).toBe(p1.playerId);

    const room = app.roomManager.getRoom(roomCode)!;
    expect(room.deadSeatPlayerIds.has(targetId)).toBe(true);
    expect(room.departedPlayerIds.size).toBe(0);

    sendLeaveRoom(p1.ws);
    const voteMsg = await waitForResolvedAction(p2.ws, "DEPARTURE_VOTE_STARTED");
    const ra = voteMsg.resolvedAction as Record<string, unknown>;
    expect(ra.targetPlayerId).toBe(p1.playerId);

    expect(app.roomManager.getRoom(roomCode)!.gameState?.gamePhase).toBe("play");

    for (const p of players) p.ws.close();
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import WsClient from "ws";
import { createApp } from "../index";
import type { FastifyInstance } from "fastify";
import { createLobbyState, handleAction } from "@mahjong-game/shared";

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

function expectMessageState(msg: Record<string, unknown>): Record<string, unknown> {
  if (!isPlainObject(msg.state)) {
    throw new Error(`Expected message.state object, got ${JSON.stringify(msg)}`);
  }
  return msg.state;
}

function resolvedActionRecord(msg: Record<string, unknown>): Record<string, unknown> | undefined {
  const ra = msg.resolvedAction;
  return isPlainObject(ra) ? ra : undefined;
}

function isTileRefList(x: unknown): x is Array<{ id: string }> {
  return Array.isArray(x) && x.every((item) => isPlainObject(item) && typeof item.id === "string");
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

function sendAction(ws: WebSocket, action: Record<string, unknown>): void {
  ws.send(
    JSON.stringify({
      version: 1,
      type: "ACTION",
      action,
    }),
  );
}

/** Join a player and return their connection info */
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

/** Set up a room with 4 players (lobby phase, no game started) */
async function setupGameRoom(): Promise<{
  roomCode: string;
  players: JoinedPlayer[];
}> {
  const { roomCode } = await createRoom();
  const names = ["Alice", "Bob", "Charlie", "Diana"] as const;
  const players = await names.reduce(
    async (prevPlayersPromise, name) => {
      const playersSoFar = await prevPlayersPromise;
      const broadcastPromises = playersSoFar.map((p) => waitForMessage(p.ws));
      const p = await joinPlayer(roomCode, name);
      const next = [...playersSoFar, p];
      if (broadcastPromises.length > 0) {
        await Promise.all(broadcastPromises);
      }
      return next;
    },
    Promise.resolve([] as JoinedPlayer[]),
  );
  return { roomCode, players };
}

/** Set up a room with 4 players and a play-phase game using a test-only fast-forward. */
async function setupGameInProgress(): Promise<{
  roomCode: string;
  players: Array<{ ws: WebSocket; token: string; playerId: string }>;
}> {
  const { roomCode, players } = await setupGameRoom();
  const room = app.roomManager.getRoom(roomCode)!;

  // Create a real game state and start the game
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

describe("handleActionMessage", () => {
  it("rejects action from a connection not in any room", async () => {
    const ws = await connectWs(wsUrl);
    const msgPromise = waitForMessage(ws);

    sendAction(ws, { type: "DRAW_TILE", playerId: "player-0" });

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("NOT_IN_ROOM");

    ws.close();
  });

  it("rejects action when no game is active (gameState is null)", async () => {
    const { players } = await setupGameRoom();
    const msgPromise = waitForMessage(players[0].ws);

    sendAction(players[0].ws, { type: "DRAW_TILE", playerId: players[0].playerId });

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("GAME_NOT_STARTED");

    for (const p of players) p.ws.close();
  });

  it("rejects game actions when room is paused (AC3)", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    room.paused = true;

    const tileId = room.gameState!.players[players[0].playerId].rack[0].id;

    const discardPromise = waitForMessage(players[0].ws);
    sendAction(players[0].ws, { type: "DISCARD_TILE", playerId: players[0].playerId, tileId });
    const discardMsg = await discardPromise;
    expect(discardMsg.type).toBe("ERROR");
    expect(discardMsg.code).toBe("ROOM_PAUSED");

    room.paused = false;
    room.gameState = null;
    room.paused = true;
    const startPromise = waitForMessage(players[0].ws);
    sendAction(players[0].ws, { type: "START_GAME", playerIds: [] });
    const startMsg = await startPromise;
    expect(startMsg.type).toBe("ERROR");
    expect(startMsg.code).toBe("ROOM_PAUSED");

    room.paused = true;
    const charlestonPassPromise = waitForMessage(players[0].ws);
    sendAction(players[0].ws, {
      type: "CHARLESTON_PASS",
      playerId: players[0].playerId,
      tileIds: ["x", "y", "z"],
    });
    const charlestonPassMsg = await charlestonPassPromise;
    expect(charlestonPassMsg.type).toBe("ERROR");
    expect(charlestonPassMsg.code).toBe("ROOM_PAUSED");

    room.paused = true;
    const callPungPromise = waitForMessage(players[0].ws);
    sendAction(players[0].ws, {
      type: "CALL_PUNG",
      playerId: players[0].playerId,
      tileIds: ["t0"],
    });
    const callPungMsg = await callPungPromise;
    expect(callPungMsg.type).toBe("ERROR");
    expect(callPungMsg.code).toBe("ROOM_PAUSED");

    room.paused = false;
    for (const p of players) p.ws.close();
  });

  it("broadcasts STATE_UPDATE to all players on valid action", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const gameState = room.gameState!;
    const currentTurnPlayerId = gameState.currentTurn;
    const currentPlayer = players.find((p) => p.playerId === currentTurnPlayerId)!;

    // After START_GAME, turnPhase is "discard" (East already has tiles dealt)
    expect(gameState.turnPhase).toBe("discard");
    const rack = gameState.players[currentTurnPlayerId].rack;
    const tileToDiscard = rack[rack.length - 1];

    const messagePromises = players.map((p) => waitForMessage(p.ws));
    sendAction(currentPlayer.ws, {
      type: "DISCARD_TILE",
      playerId: "fake-id-should-be-overwritten",
      tileId: tileToDiscard.id,
    });

    const messages = await Promise.all(messagePromises);

    // All players should receive STATE_UPDATE
    for (const msg of messages) {
      expect(msg.type).toBe("STATE_UPDATE");
      expect(msg.version).toBe(1);
      const state = expectMessageState(msg);
      expect(state.gamePhase).toBe("play");
    }

    // Verify each player's view has their own myPlayerId
    for (let i = 0; i < players.length; i++) {
      const state = expectMessageState(messages[i]);
      expect(state.myPlayerId).toBe(players[i].playerId);
    }

    for (const p of players) p.ws.close();
  });

  it("overwrites playerId with authenticated identity (security)", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const gameState = room.gameState!;
    const currentTurnPlayerId = gameState.currentTurn;
    const currentPlayer = players.find((p) => p.playerId === currentTurnPlayerId)!;
    const rack = gameState.players[currentTurnPlayerId].rack;
    const tileToDiscard = rack[rack.length - 1];

    // Send action with fake playerId — server should overwrite it
    const messagePromises = players.map((p) => waitForMessage(p.ws));
    sendAction(currentPlayer.ws, {
      type: "DISCARD_TILE",
      playerId: "FAKE_HACKER_ID",
      tileId: tileToDiscard.id,
    });

    const messages = await Promise.all(messagePromises);

    // Action should be accepted (playerId was overwritten to the real one)
    for (const msg of messages) {
      expect(msg.type).toBe("STATE_UPDATE");
    }

    // The resolved action should reference the real player, not the fake one
    const resolvedAction = resolvedActionRecord(messages[0]);
    expect(resolvedAction).toBeDefined();
    expect(resolvedAction?.playerId).toBe(currentTurnPlayerId);

    for (const p of players) p.ws.close();
  });

  it("overwrites playerId for COURTESY_PASS (authenticated seat binding)", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const gameState = room.gameState!;

    gameState.gamePhase = "charleston";
    gameState.charleston = {
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: [],
      lockedTileIdsByPlayerId: {},
      votesByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      courtesyPairings: [
        ["player-0", "player-2"],
        ["player-1", "player-3"],
      ],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const alice = players.find((p) => p.playerId === "player-0")!;
    const firstRackTile = gameState.players["player-0"].rack[0];
    expect(firstRackTile).toBeDefined();
    const tileId = firstRackTile.id;

    const messagePromises = players.map((p) => waitForMessage(p.ws));
    sendAction(alice.ws, {
      type: "COURTESY_PASS",
      playerId: "FAKE_HACKER_ID",
      count: 1,
      tileIds: [tileId],
    });

    const messages = await Promise.all(messagePromises);
    for (const msg of messages) {
      expect(msg.type).toBe("STATE_UPDATE");
    }

    const resolvedAction = resolvedActionRecord(messages[0]);
    expect(resolvedAction).toMatchObject({
      type: "COURTESY_PASS_LOCKED",
      playerId: "player-0",
      pairing: ["player-0", "player-2"],
    });

    for (const p of players) p.ws.close();
  });

  it("overwrites playerId for CHARLESTON_PASS (authenticated seat binding)", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const gameState = room.gameState!;

    gameState.gamePhase = "charleston";
    gameState.charleston = {
      stage: "first",
      status: "passing",
      currentDirection: "right",
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: [],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: {},
      courtesyPairings: [],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const alice = players.find((p) => p.playerId === "player-0")!;
    const rack = gameState.players["player-0"].rack;
    const tileIds = rack.slice(0, 3).map((t) => t.id);

    const messagePromises = players.map((p) => waitForMessage(p.ws));
    sendAction(alice.ws, {
      type: "CHARLESTON_PASS",
      playerId: "FAKE_HACKER_ID",
      tileIds,
    });

    await Promise.all(messagePromises);

    expect(gameState.charleston.lockedTileIdsByPlayerId["player-0"]).toEqual(tileIds);
    expect(gameState.charleston.lockedTileIdsByPlayerId.FAKE_HACKER_ID).toBeUndefined();

    for (const p of players) p.ws.close();
  });

  it("sends ERROR only to offending client on invalid action", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const currentTurnPlayerId = room.gameState!.currentTurn;

    // Find a player who is NOT the current turn player
    const offendingPlayer = players.find((p) => p.playerId !== currentTurnPlayerId)!;

    // Send discard from wrong player — should be rejected
    const errorPromise = waitForMessage(offendingPlayer.ws);

    sendAction(offendingPlayer.ws, {
      type: "DISCARD_TILE",
      playerId: offendingPlayer.playerId,
      tileId: "fake-tile",
    });

    const errorMsg = await errorPromise;
    expect(errorMsg.type).toBe("ERROR");
    expect(errorMsg.code).toBe("ACTION_REJECTED");
    expect(errorMsg.version).toBe(1);

    // Other players should NOT have received any message
    const otherPlayers = players.filter((p) => p.playerId !== offendingPlayer.playerId);

    const noMessageReceived = await Promise.race([
      new Promise<boolean>((resolve) => {
        let received = false;
        for (const p of otherPlayers) {
          p.ws.once("message", () => {
            received = true;
            resolve(false);
          });
        }
        setTimeout(() => {
          if (!received) resolve(true);
        }, 200);
      }),
    ]);
    expect(noMessageReceived).toBe(true);

    for (const p of players) p.ws.close();
  });

  it("includes version field in all outgoing messages", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const gameState = room.gameState!;
    const currentTurnPlayerId = gameState.currentTurn;
    const currentPlayer = players.find((p) => p.playerId === currentTurnPlayerId)!;
    const rack = gameState.players[currentTurnPlayerId].rack;
    const tileToDiscard = rack[rack.length - 1];

    const messagePromises = players.map((p) => waitForMessage(p.ws));
    sendAction(currentPlayer.ws, {
      type: "DISCARD_TILE",
      playerId: currentPlayer.playerId,
      tileId: tileToDiscard.id,
    });

    const messages = await Promise.all(messagePromises);
    for (const msg of messages) {
      expect(msg.version).toBe(1);
    }

    for (const p of players) p.ws.close();
  });

  it("filters per-player views so opponents cannot see each other's racks", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const gameState = room.gameState!;
    const currentTurnPlayerId = gameState.currentTurn;
    const currentPlayer = players.find((p) => p.playerId === currentTurnPlayerId)!;
    const rack = gameState.players[currentTurnPlayerId].rack;
    const tileToDiscard = rack[rack.length - 1];

    const messagePromises = players.map((p) => waitForMessage(p.ws));
    sendAction(currentPlayer.ws, {
      type: "DISCARD_TILE",
      playerId: currentPlayer.playerId,
      tileId: tileToDiscard.id,
    });

    const messages = await Promise.all(messagePromises);

    // Each player should only see their own rack
    for (let i = 0; i < players.length; i++) {
      const state = expectMessageState(messages[i]);
      const myRack = state.myRack;
      expect(isTileRefList(myRack)).toBe(true);
      if (!isTileRefList(myRack)) {
        throw new Error("Expected myRack tile list");
      }

      // Verify no opponent rack data leaks
      const stateStr = JSON.stringify(state);
      for (let j = 0; j < players.length; j++) {
        if (i === j) continue;
        const otherPlayerState = gameState.players[players[j].playerId];
        if (otherPlayerState) {
          for (const tile of otherPlayerState.rack) {
            expect(stateStr).not.toContain(tile.id);
          }
        }
      }
    }

    for (const p of players) p.ws.close();
  });

  it("rejects action with missing action payload", async () => {
    const { roomCode, players } = await setupGameRoom();
    const room = app.roomManager.getRoom(roomCode)!;

    // Set up gameState so we get past that check
    const gameState = createLobbyState();
    handleAction(gameState, {
      type: "START_GAME",
      playerIds: players.map((p) => p.playerId),
      seed: 42,
    });
    room.gameState = gameState;

    const msgPromise = waitForMessage(players[0].ws);

    // Send message with type ACTION but no action field
    players[0].ws.send(JSON.stringify({ version: 1, type: "ACTION" }));

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");

    for (const p of players) p.ws.close();
  });

  it("rejects ACTION when action payload is an array (not a plain object)", async () => {
    const { players } = await setupGameInProgress();
    const msgPromise = waitForMessage(players[0].ws);
    players[0].ws.send(
      JSON.stringify({
        version: 1,
        type: "ACTION",
        action: [{ type: "DRAW_TILE" }],
      }),
    );
    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");
    for (const p of players) p.ws.close();
  });

  it("rejects START_GAME in lobby when seed is not a finite number", async () => {
    const { players } = await setupGameRoom();
    const host = players[0];
    const msgPromise = waitForMessage(host.ws);
    sendAction(host.ws, { type: "START_GAME", seed: "42" });
    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");
    expect(String(msg.message)).toContain("START_GAME seed");
    for (const p of players) p.ws.close();
  });

  it.each([
    { seed: Number.NaN, label: "NaN" },
    { seed: Number.POSITIVE_INFINITY, label: "Infinity" },
  ] as const)("rejects START_GAME in lobby when seed is $label", async ({ seed }) => {
    const { players } = await setupGameRoom();
    const host = players[0];
    const msgPromise = waitForMessage(host.ws);
    sendAction(host.ws, { type: "START_GAME", seed });
    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");
    expect(String(msg.message)).toContain("START_GAME seed");
    for (const p of players) p.ws.close();
  });

  it("rejects START_GAME in lobby when playerIds is not string[]", async () => {
    const { players } = await setupGameRoom();
    const host = players[0];
    const msgPromise = waitForMessage(host.ws);
    sendAction(host.ws, { type: "START_GAME", playerIds: ["a", 1, "c"] });
    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");
    expect(String(msg.message)).toContain("playerIds");
    for (const p of players) p.ws.close();
  });

  it("rejects CALL_PUNG with empty tileIds", async () => {
    const { players } = await setupGameInProgress();
    const offender = players[0];
    const msgPromise = waitForMessage(offender.ws);
    sendAction(offender.ws, { type: "CALL_PUNG", playerId: offender.playerId, tileIds: [] });
    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");
    expect(String(msg.message)).toContain("at least one tileId");
    for (const p of players) p.ws.close();
  });

  it("rejects CONFIRM_CALL with duplicate tileIds", async () => {
    const { players } = await setupGameInProgress();
    const offender = players[0];
    const msgPromise = waitForMessage(offender.ws);
    sendAction(offender.ws, {
      type: "CONFIRM_CALL",
      playerId: offender.playerId,
      tileIds: ["t-1", "t-1"],
    });
    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");
    expect(String(msg.message)).toContain("unique");
    for (const p of players) p.ws.close();
  });

  it("rejects malformed COURTESY_PASS when tileIds is null", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;

    room.gameState!.gamePhase = "charleston";
    room.gameState!.charleston = {
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: [],
      lockedTileIdsByPlayerId: {},
      votesByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      courtesyPairings: [
        ["player-0", "player-2"],
        ["player-1", "player-3"],
      ],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const offender = players.find((p) => p.playerId === "player-0")!;
    const msgPromise = waitForMessage(offender.ws);
    sendAction(offender.ws, {
      type: "COURTESY_PASS",
      playerId: offender.playerId,
      count: 1,
      tileIds: null,
    });

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");

    for (const p of players) p.ws.close();
  });

  it("rejects unknown action types before engine dispatch", async () => {
    const { players } = await setupGameInProgress();
    const offender = players[0];
    const msgPromise = waitForMessage(offender.ws);

    sendAction(offender.ws, {
      type: "DOES_NOT_EXIST",
      playerId: offender.playerId,
    });

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");
    expect(msg.message).toContain("Unsupported action type");

    for (const p of players) p.ws.close();
  });

  it("rejects malformed CHARLESTON_PASS when tileIds length is not 3", async () => {
    const { players } = await setupGameInProgress();
    const offender = players[0];
    const msgPromise = waitForMessage(offender.ws);

    sendAction(offender.ws, {
      type: "CHARLESTON_PASS",
      playerId: offender.playerId,
      tileIds: [],
    });

    const msg = await msgPromise;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("INVALID_ACTION");
    expect(msg.message).toContain("CHARLESTON_PASS requires exactly 3 tileIds");

    for (const p of players) p.ws.close();
  });

  describe("START_GAME action (4a-7)", () => {
    it("host can start game with 4 connected players", async () => {
      const { roomCode, players } = await setupGameRoom();

      // Host is player-0 (first to join)
      const host = players[0];

      // All 4 players listen for messages
      const messagePromises = players.map((p) => waitForMessage(p.ws));

      sendAction(host.ws, { type: "START_GAME" });

      const messages = await Promise.all(messagePromises);

      // All players should receive STATE_UPDATE
      for (const msg of messages) {
        expect(msg.type).toBe("STATE_UPDATE");
        expect(msg.version).toBe(1);
      }

      // All views should have gamePhase = "charleston"
      for (const msg of messages) {
        const state = expectMessageState(msg);
        expect(state.gamePhase).toBe("charleston");
        expect(state.charleston).toMatchObject({
          currentDirection: "right",
          status: "passing",
          stage: "first",
        });
      }

      // resolvedAction should be GAME_STARTED for all
      for (const msg of messages) {
        const resolved = resolvedActionRecord(msg);
        expect(resolved).toBeDefined();
        expect(resolved?.type).toBe("GAME_STARTED");
      }

      // room.gameState should now exist
      const room = app.roomManager.getRoom(roomCode)!;
      expect(room.gameState).not.toBeNull();
      expect(room.gameState!.gamePhase).toBe("charleston");
      expect(room.gameState!.charleston).toMatchObject({
        currentDirection: "right",
        status: "passing",
        stage: "first",
      });

      for (const p of players) p.ws.close();
    });

    it("START_GAME copies room jokerRulesMode into GameState", async () => {
      const { roomCode, players } = await setupGameRoom();
      const host = players[0];
      const setPromises = players.map((p) => waitForMessage(p.ws));
      host.ws.send(
        JSON.stringify({ version: 1, type: "SET_JOKER_RULES", jokerRulesMode: "simplified" }),
      );
      await Promise.all(setPromises);

      const startPromises = players.map((p) => waitForMessage(p.ws));
      sendAction(host.ws, { type: "START_GAME" });
      await Promise.all(startPromises);

      const room = app.roomManager.getRoom(roomCode)!;
      expect(room.gameState?.jokerRulesMode).toBe("simplified");

      for (const p of players) p.ws.close();
    });

    it("each player receives correctly filtered view with their own rack only", async () => {
      const { roomCode, players } = await setupGameRoom();
      const host = players[0];

      const messagePromises = players.map((p) => waitForMessage(p.ws));
      sendAction(host.ws, { type: "START_GAME" });
      const messages = await Promise.all(messagePromises);

      const room = app.roomManager.getRoom(roomCode)!;
      const gameState = room.gameState!;

      for (let i = 0; i < players.length; i++) {
        const state = expectMessageState(messages[i]);
        const myRack = state.myRack;
        expect(isTileRefList(myRack)).toBe(true);
        if (!isTileRefList(myRack)) {
          throw new Error("Expected myRack tile list");
        }

        // Each player sees their own rack
        expect(myRack.length).toBeGreaterThan(0);
        expect(state.myPlayerId).toBe(players[i].playerId);

        // No opponent rack data in their view
        const stateStr = JSON.stringify(state);
        for (let j = 0; j < players.length; j++) {
          if (i === j) continue;
          const otherRack = gameState.players[players[j].playerId].rack;
          for (const tile of otherRack) {
            expect(stateStr).not.toContain(tile.id);
          }
        }
      }

      for (const p of players) p.ws.close();
    });

    it("deals tiles correctly — East gets 14, others get 13, wall has 99", async () => {
      const { roomCode, players } = await setupGameRoom();
      const host = players[0];

      const messagePromises = players.map((p) => waitForMessage(p.ws));
      sendAction(host.ws, { type: "START_GAME" });
      await Promise.all(messagePromises);

      const room = app.roomManager.getRoom(roomCode)!;
      const gameState = room.gameState!;

      // East (player-0) gets 14 tiles, others get 13
      expect(gameState.players["player-0"].rack).toHaveLength(14);
      expect(gameState.players["player-1"].rack).toHaveLength(13);
      expect(gameState.players["player-2"].rack).toHaveLength(13);
      expect(gameState.players["player-3"].rack).toHaveLength(13);
      expect(gameState.wallRemaining).toBe(99);

      // currentTurn is East, turnPhase is discard
      expect(gameState.currentTurn).toBe("player-0");
      expect(gameState.turnPhase).toBe("discard");

      for (const p of players) p.ws.close();
    });

    it("rejects START_GAME from non-host player", async () => {
      const { players } = await setupGameRoom();

      // player-1 is NOT the host
      const nonHost = players[1];

      const msgPromise = waitForMessage(nonHost.ws);
      sendAction(nonHost.ws, { type: "START_GAME" });

      const msg = await msgPromise;
      expect(msg.type).toBe("ERROR");
      expect(msg.code).toBe("NOT_HOST");

      for (const p of players) p.ws.close();
    });

    it("rejects START_GAME with fewer than 4 connected players", async () => {
      const { roomCode } = await createRoom();
      const partialNames = ["Alice", "Bob", "Charlie"] as const;
      const players = await partialNames.reduce(
        async (prevPlayersPromise, name) => {
          const playersSoFar = await prevPlayersPromise;
          const broadcastPromises = playersSoFar.map((p) => waitForMessage(p.ws));
          const p = await joinPlayer(roomCode, name);
          const next = [...playersSoFar, p];
          if (broadcastPromises.length > 0) {
            await Promise.all(broadcastPromises);
          }
          return next;
        },
        Promise.resolve([] as JoinedPlayer[]),
      );

      const host = players[0];
      const msgPromise = waitForMessage(host.ws);
      sendAction(host.ws, { type: "START_GAME" });

      const msg = await msgPromise;
      expect(msg.type).toBe("ERROR");
      expect(msg.code).toBe("NOT_ENOUGH_PLAYERS");

      for (const p of players) p.ws.close();
    });

    it("rejects START_GAME when game is already in progress", async () => {
      const { players } = await setupGameRoom();
      const host = players[0];

      // Start the game first
      const firstStartPromises = players.map((p) => waitForMessage(p.ws));
      sendAction(host.ws, { type: "START_GAME" });
      await Promise.all(firstStartPromises);

      // Try to start again
      const msgPromise = waitForMessage(host.ws);
      sendAction(host.ws, { type: "START_GAME" });

      const msg = await msgPromise;
      expect(msg.type).toBe("ERROR");
      expect(msg.code).toBe("ACTION_REJECTED");

      for (const p of players) p.ws.close();
    });

    it("does not broadcast error to other players on rejected START_GAME", async () => {
      const { players } = await setupGameRoom();
      const nonHost = players[1];

      const errorPromise = waitForMessage(nonHost.ws);
      sendAction(nonHost.ws, { type: "START_GAME" });

      const errorMsg = await errorPromise;
      expect(errorMsg.type).toBe("ERROR");

      // Other players should NOT receive any message
      const otherPlayers = players.filter((p) => p.playerId !== nonHost.playerId);
      const noMessageReceived = await Promise.race([
        new Promise<boolean>((resolve) => {
          let received = false;
          for (const p of otherPlayers) {
            p.ws.once("message", () => {
              received = true;
              resolve(false);
            });
          }
          setTimeout(() => {
            if (!received) resolve(true);
          }, 200);
        }),
      ]);
      expect(noMessageReceived).toBe(true);

      for (const p of players) p.ws.close();
    });
  });

  it("handles discard that triggers call window — all players see callWindow in state", async () => {
    const { roomCode, players } = await setupGameInProgress();
    const room = app.roomManager.getRoom(roomCode)!;
    const gameState = room.gameState!;
    const currentTurnPlayerId = gameState.currentTurn;
    const currentPlayer = players.find((p) => p.playerId === currentTurnPlayerId)!;

    // After START_GAME, turnPhase is "discard" — discard triggers call window
    const rack = gameState.players[currentTurnPlayerId].rack;
    const tileToDiscard = rack[rack.length - 1];

    const messagePromises = players.map((p) => waitForMessage(p.ws));
    sendAction(currentPlayer.ws, {
      type: "DISCARD_TILE",
      playerId: currentPlayer.playerId,
      tileId: tileToDiscard.id,
    });

    const messages = await Promise.all(messagePromises);

    // All players should receive STATE_UPDATE with callWindow field present (AC #5)
    for (const msg of messages) {
      expect(msg.type).toBe("STATE_UPDATE");
      const state = expectMessageState(msg);
      expect(state.gamePhase).toBe("play");
      // callWindow must always be present in the view (null or object)
      expect(state).toHaveProperty("callWindow");
      // If a call window opened, verify its structure
      if (state.callWindow !== null && isPlainObject(state.callWindow)) {
        const cw = state.callWindow;
        expect(cw).toHaveProperty("status");
        expect(cw).toHaveProperty("discardedTile");
        expect(cw).toHaveProperty("discarderId");
      }
    }

    for (const p of players) p.ws.close();
  });
});

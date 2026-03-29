import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../index";
import type { FastifyInstance } from "fastify";
import { createLobbyState, handleAction } from "@mahjong-game/shared";

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
  const state = msg.state as Record<string, unknown>;
  return {
    ws,
    token: msg.token as string,
    playerId: state.myPlayerId as string,
  };
}

/** Set up a room with 4 players (lobby phase, no game started) */
async function setupGameRoom(): Promise<{
  roomCode: string;
  players: Array<{ ws: WebSocket; token: string; playerId: string }>;
}> {
  const { roomCode } = await createRoom();
  const players: Array<{ ws: WebSocket; token: string; playerId: string }> = [];

  for (const name of ["Alice", "Bob", "Charlie", "Diana"]) {
    // Set up message listeners for existing players BEFORE new player joins
    const broadcastPromises = players.map((p) => waitForMessage(p.ws));

    const p = await joinPlayer(roomCode, name);
    players.push(p);

    // Drain broadcast messages sent to existing players
    if (broadcastPromises.length > 0) {
      await Promise.all(broadcastPromises);
    }
  }

  return { roomCode, players };
}

/** Set up a room with 4 players and an active game (play phase) */
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
      const state = msg.state as Record<string, unknown>;
      expect(state.gamePhase).toBe("play");
    }

    // Verify each player's view has their own myPlayerId
    for (let i = 0; i < players.length; i++) {
      const state = messages[i].state as Record<string, unknown>;
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
    const resolvedAction = messages[0].resolvedAction as Record<string, unknown>;
    expect(resolvedAction).toBeDefined();
    expect(resolvedAction.playerId).toBe(currentTurnPlayerId);

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
      const state = messages[i].state as Record<string, unknown>;
      const myRack = state.myRack as Array<{ id: string }>;
      expect(myRack).toBeDefined();
      expect(Array.isArray(myRack)).toBe(true);

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
      const state = msg.state as Record<string, unknown>;
      expect(state.gamePhase).toBe("play");
      // callWindow must always be present in the view (null or object)
      expect(state).toHaveProperty("callWindow");
      // If a call window opened, verify its structure
      if (state.callWindow !== null) {
        const cw = state.callWindow as Record<string, unknown>;
        expect(cw).toHaveProperty("status");
        expect(cw).toHaveProperty("discardedTile");
        expect(cw).toHaveProperty("discarderId");
      }
    }

    for (const p of players) p.ws.close();
  });
});

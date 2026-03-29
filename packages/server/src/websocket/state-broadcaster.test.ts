import { describe, expect, it, vi, type Mock } from "vitest";
import { WebSocket } from "ws";
import type { GameState, SeatWind } from "@mahjong-game/shared";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";
import type { FastifyBaseLogger } from "fastify";
import { buildPlayerView, broadcastGameState } from "./state-broadcaster";

/** Extract the mock send function from a mock WebSocket */
function mockSend(ws: WebSocket): Mock {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- accessing vi.fn() mock, not a real WebSocket method
  return ws.send as unknown as Mock;
}

/** Parse the first message sent via a mock WebSocket's send */
function parseSentMessage(ws: WebSocket): Record<string, unknown> {
  const calls = mockSend(ws).mock.calls;
  return JSON.parse(calls[0][0] as string) as Record<string, unknown>;
}

function createMockLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as FastifyBaseLogger;
}

function createTestPlayer(id: string, wind: SeatWind, isHost = false): PlayerInfo {
  return {
    playerId: id,
    displayName: `Player ${id}`,
    wind,
    isHost,
    connected: true,
    connectedAt: Date.now(),
  };
}

function createMockWs(readyState: number = WebSocket.OPEN): WebSocket {
  return {
    readyState,
    send: vi.fn(),
  } as unknown as WebSocket;
}

function createTestRoom(players: PlayerInfo[], wsList: WebSocket[]): Room {
  const room: Room = {
    roomId: "test-room-id",
    roomCode: "TEST01",
    hostToken: "host-token",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    gameState: null,
    gamePhase: "lobby",
    createdAt: Date.now(),
    logger: createMockLogger(),
  };

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    room.players.set(player.playerId, player);
    const session: PlayerSession = {
      player,
      roomCode: room.roomCode,
      ws: wsList[i],
    };
    room.sessions.set(player.playerId, session);
  }

  return room;
}

function createTestGameState(): GameState {
  return {
    gamePhase: "play",
    players: {
      "player-0": {
        id: "player-0",
        seatWind: "east",
        rack: [
          { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 },
          { id: "bam-2-1", category: "suited", suit: "bam", value: 2, copy: 1 },
        ],
        exposedGroups: [],
        discardPool: [{ id: "dot-5-1", category: "suited", suit: "dot", value: 5, copy: 1 }],
        deadHand: false,
      },
      "player-1": {
        id: "player-1",
        seatWind: "south",
        rack: [
          { id: "crak-3-1", category: "suited", suit: "crak", value: 3, copy: 1 },
          { id: "crak-4-1", category: "suited", suit: "crak", value: 4, copy: 1 },
        ],
        exposedGroups: [],
        discardPool: [],
        deadHand: false,
      },
    },
    wall: [],
    wallRemaining: 100,
    currentTurn: "player-0",
    turnPhase: "discard",
    lastDiscard: null,
    callWindow: null,
    scores: { "player-0": 0, "player-1": 0 },
    gameResult: null,
    card: null,
    pendingMahjong: null,
    challengeState: null,
  };
}

describe("buildPlayerView", () => {
  it("includes the requesting player's own rack", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view = buildPlayerView(room, gameState, "player-0");

    expect(view.myRack).toHaveLength(2);
    expect(view.myRack[0].id).toBe("bam-1-1");
    expect(view.myRack[1].id).toBe("bam-2-1");
    expect(view.myPlayerId).toBe("player-0");
  });

  it("does NOT include opponent rack data in the view", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view0 = buildPlayerView(room, gameState, "player-0");
    const view1 = buildPlayerView(room, gameState, "player-1");

    // player-0's view should NOT contain player-1's rack tiles
    const view0Str = JSON.stringify(view0);
    expect(view0Str).not.toContain("crak-3-1");
    expect(view0Str).not.toContain("crak-4-1");

    // player-1's view should NOT contain player-0's rack tiles
    const view1Str = JSON.stringify(view1);
    expect(view1Str).not.toContain("bam-1-1");
    expect(view1Str).not.toContain("bam-2-1");

    // Each sees their own rack
    expect(view0.myRack).toHaveLength(2);
    expect(view1.myRack).toHaveLength(2);
  });

  it("includes all public state fields", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view = buildPlayerView(room, gameState, "player-0");

    expect(view.roomId).toBe("test-room-id");
    expect(view.roomCode).toBe("TEST01");
    expect(view.gamePhase).toBe("play");
    expect(view.wallRemaining).toBe(100);
    expect(view.currentTurn).toBe("player-0");
    expect(view.turnPhase).toBe("discard");
    expect(view.callWindow).toBeNull();
    expect(view.scores).toEqual({ "player-0": 0, "player-1": 0 });
    expect(view.lastDiscard).toBeNull();
    expect(view.gameResult).toBeNull();
    expect(view.pendingMahjong).toBeNull();
    expect(view.challengeState).toBeNull();
  });

  it("includes all players' exposed groups and discard pools", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view = buildPlayerView(room, gameState, "player-0");

    expect(view.exposedGroups).toHaveProperty("player-0");
    expect(view.exposedGroups).toHaveProperty("player-1");
    expect(view.discardPools).toHaveProperty("player-0");
    expect(view.discardPools).toHaveProperty("player-1");
    expect(view.discardPools["player-0"]).toHaveLength(1);
  });

  it("includes player public info with connection status", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view = buildPlayerView(room, gameState, "player-0");

    expect(view.players).toHaveLength(2);
    expect(view.players[0]).toMatchObject({
      playerId: "player-0",
      displayName: "Player player-0",
      wind: "east",
      isHost: true,
      connected: true,
    });
  });

  it("includes call window state when present", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();
    gameState.callWindow = {
      status: "open",
      discardedTile: { id: "dot-5-1", category: "suited", suit: "dot", value: 5, copy: 1 },
      discarderId: "player-0",
      passes: [],
      calls: [],
      openedAt: Date.now(),
      confirmingPlayerId: null,
      confirmationExpiresAt: null,
      remainingCallers: [],
      winningCall: null,
    };

    const view = buildPlayerView(room, gameState, "player-1");

    expect(view.callWindow).not.toBeNull();
    expect(view.callWindow!.status).toBe("open");
    expect(view.callWindow!.discarderId).toBe("player-0");
  });
});

describe("broadcastGameState", () => {
  it("sends STATE_UPDATE to all connected players with filtered views", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    broadcastGameState(room, gameState);

    // Both players should receive messages
    expect(mockSend(wsList[0])).toHaveBeenCalledOnce();
    expect(mockSend(wsList[1])).toHaveBeenCalledOnce();

    // Parse the messages
    const msg0 = parseSentMessage(wsList[0]);
    const msg1 = parseSentMessage(wsList[1]);
    const state0 = msg0.state as Record<string, unknown>;
    const state1 = msg1.state as Record<string, unknown>;

    expect(msg0.type).toBe("STATE_UPDATE");
    expect(msg0.version).toBe(1);
    expect(state0.myPlayerId).toBe("player-0");
    expect(state0.myRack).toHaveLength(2);
    expect((state0.myRack as Array<Record<string, unknown>>)[0].id).toBe("bam-1-1");

    expect(msg1.type).toBe("STATE_UPDATE");
    expect(state1.myPlayerId).toBe("player-1");
    expect(state1.myRack).toHaveLength(2);
    expect((state1.myRack as Array<Record<string, unknown>>)[0].id).toBe("crak-3-1");

    // Cross-check: player-0 must not see player-1's rack
    const msg0Str = JSON.stringify(msg0);
    expect(msg0Str).not.toContain("crak-3-1");

    // Cross-check: player-1 must not see player-0's rack
    const msg1Str = JSON.stringify(msg1);
    expect(msg1Str).not.toContain("bam-1-1");
  });

  it("includes resolvedAction in broadcast", () => {
    const players = [createTestPlayer("player-0", "east", true)];
    const wsList = [createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    broadcastGameState(room, gameState, {
      type: "DISCARD_TILE",
      playerId: "player-0",
      tileId: "dot-5-1",
    });

    const msg = parseSentMessage(wsList[0]);
    expect(msg.resolvedAction).toEqual({
      type: "DISCARD_TILE",
      playerId: "player-0",
      tileId: "dot-5-1",
    });
  });

  it("skips players with closed WebSocket connections", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs(WebSocket.CLOSED)];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    broadcastGameState(room, gameState);

    expect(mockSend(wsList[0])).toHaveBeenCalledOnce();
    expect(mockSend(wsList[1])).not.toHaveBeenCalled();
  });
});

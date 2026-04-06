import { describe, expect, it, vi } from "vite-plus/test";
import { WebSocket } from "ws";
import { DEFAULT_ROOM_SETTINGS, handleAction, type GameState } from "@mahjong-game/shared";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";
import type { FastifyBaseLogger } from "fastify";
import { createTestState, getPlayerBySeat } from "../../../shared/src/testing/helpers";
import { handlePauseTimeout, releaseSeat } from "./pause-handlers";
import * as stateBroadcaster from "./state-broadcaster";

function createMockLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as FastifyBaseLogger;
}

function createMockWs(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
  } as unknown as WebSocket;
}

function createTestPlayer(id: string, wind: PlayerInfo["wind"], connected: boolean): PlayerInfo {
  return {
    playerId: id,
    displayName: `Player ${id}`,
    wind,
    isHost: id === "p1",
    connected,
    connectedAt: Date.now(),
  };
}

function createTestRoom(players: PlayerInfo[], gameState: GameState | null, paused: boolean): Room {
  const wsList = players.map(() => createMockWs());
  const room: Room = {
    roomId: "test-room-id",
    roomCode: "TEST01",
    hostToken: "host-token",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    lifecycleTimers: new Map(),
    socialOverrideTimer: null,
    tableTalkReportTimer: null,
    gameState,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    jokerRulesMode: "standard",
    chatHistory: [],
    chatRateTimestamps: new Map(),
    reactionRateTimestamps: new Map(),
    paused,
    pausedAt: paused ? Date.now() : null,
    turnTimerConfig: { mode: "timed", durationMs: 20_000 },
    turnTimerHandle: null,
    turnTimerStage: null,
    turnTimerPlayerId: null,
    consecutiveTurnTimeouts: new Map(),
    afkVoteState: null,
    afkVoteCooldownPlayerIds: new Set(),
    deadSeatPlayerIds: new Set(),
    departedPlayerIds: new Set(),
    departureVoteState: null,
    createdAt: Date.now(),
    logger: createMockLogger(),
    sessionScoresFromPriorGames: {},
    sessionGameHistory: [],
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

describe("releaseSeat", () => {
  it("removes player tokens, session, and rate-limit maps", () => {
    const gs = createTestState(undefined, 42);
    const players = [createTestPlayer("p1", "east", true), createTestPlayer("p2", "south", true)];
    const room = createTestRoom(players, gs, false);
    room.tokenMap.set("tok", "p2");
    room.playerTokens.set("p2", "tok");

    releaseSeat(room, "p2");

    expect(room.players.has("p2")).toBe(false);
    expect(room.sessions.has("p2")).toBe(false);
    expect(room.tokenMap.has("tok")).toBe(false);
    expect(room.playerTokens.has("p2")).toBe(false);
  });
});

describe("handlePauseTimeout", () => {
  it("transitions play phase to scoreboard with wall-game result and broadcasts GAME_ABANDONED", () => {
    const gs = createTestState(undefined, 42);
    const east = getPlayerBySeat(gs, "east");
    if (gs.turnPhase === "draw") {
      handleAction(gs, { type: "DRAW_TILE", playerId: east });
    }
    expect(gs.gamePhase).toBe("play");

    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south", false),
      createTestPlayer("p3", "west", false),
      createTestPlayer("p4", "north", true),
    ];
    const room = createTestRoom(players, gs, true);

    const broadcastSpy = vi
      .spyOn(stateBroadcaster, "broadcastStateToRoom")
      .mockImplementation(() => {});

    handlePauseTimeout(room, undefined, room.logger);

    expect(gs.gamePhase).toBe("scoreboard");
    expect(gs.gameResult).toEqual({ winnerId: null, points: 0 });
    expect(room.paused).toBe(false);
    expect(room.players.has("p2")).toBe(false);
    expect(room.players.has("p3")).toBe(false);
    expect(broadcastSpy).toHaveBeenCalledWith(
      room,
      undefined,
      expect.objectContaining({ type: "GAME_ABANDONED", reason: "pause-timeout" }),
    );

    broadcastSpy.mockRestore();
  });

  it("does not mutate game phase when already scoreboard", () => {
    const gs = createTestState(undefined, 42);
    gs.gamePhase = "scoreboard";
    gs.gameResult = { winnerId: null, points: 0 };

    const players = [createTestPlayer("p1", "east", false)];
    const room = createTestRoom(players, gs, true);

    const broadcastSpy = vi
      .spyOn(stateBroadcaster, "broadcastStateToRoom")
      .mockImplementation(() => {});

    handlePauseTimeout(room, undefined, room.logger);

    expect(gs.gamePhase).toBe("scoreboard");
    expect(gs.gameResult).toEqual({ winnerId: null, points: 0 });

    broadcastSpy.mockRestore();
  });

  it("arms idle-timeout when ≥2 players remain after auto-end (AC7)", () => {
    const gs = createTestState(undefined, 42);
    const east = getPlayerBySeat(gs, "east");
    if (gs.turnPhase === "draw") {
      handleAction(gs, { type: "DRAW_TILE", playerId: east });
    }
    expect(gs.gamePhase).toBe("play");

    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south", true),
      createTestPlayer("p3", "west", false),
      createTestPlayer("p4", "north", false),
    ];
    const room = createTestRoom(players, gs, true);

    const fakeRoomManager = {
      cleanupRoom: vi.fn(),
    } as unknown as import("../rooms/room-manager").RoomManager;

    const broadcastSpy = vi
      .spyOn(stateBroadcaster, "broadcastStateToRoom")
      .mockImplementation(() => {});

    handlePauseTimeout(room, fakeRoomManager, room.logger);

    expect(room.lifecycleTimers.has("idle-timeout")).toBe(true);
    expect(room.lifecycleTimers.has("abandoned-timeout")).toBe(false);

    for (const t of room.lifecycleTimers.values()) clearTimeout(t);
    room.lifecycleTimers.clear();
    broadcastSpy.mockRestore();
  });

  it("arms abandoned-timeout when ≤1 player remains after auto-end", () => {
    const gs = createTestState(undefined, 42);
    const east = getPlayerBySeat(gs, "east");
    if (gs.turnPhase === "draw") {
      handleAction(gs, { type: "DRAW_TILE", playerId: east });
    }

    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south", false),
      createTestPlayer("p3", "west", false),
      createTestPlayer("p4", "north", false),
    ];
    const room = createTestRoom(players, gs, true);

    const fakeRoomManager = {
      cleanupRoom: vi.fn(),
    } as unknown as import("../rooms/room-manager").RoomManager;

    const broadcastSpy = vi
      .spyOn(stateBroadcaster, "broadcastStateToRoom")
      .mockImplementation(() => {});

    handlePauseTimeout(room, fakeRoomManager, room.logger);

    expect(room.players.size).toBe(1);
    expect(room.lifecycleTimers.has("abandoned-timeout")).toBe(true);
    expect(room.lifecycleTimers.has("idle-timeout")).toBe(false);

    for (const t of room.lifecycleTimers.values()) clearTimeout(t);
    room.lifecycleTimers.clear();
    broadcastSpy.mockRestore();
  });

  it("no-ops when room is not paused", () => {
    const gs = createTestState(undefined, 42);
    const players = [createTestPlayer("p1", "east", true)];
    const room = createTestRoom(players, gs, false);

    const broadcastSpy = vi
      .spyOn(stateBroadcaster, "broadcastStateToRoom")
      .mockImplementation(() => {});

    handlePauseTimeout(room, undefined, room.logger);

    expect(broadcastSpy).not.toHaveBeenCalled();
    broadcastSpy.mockRestore();
  });
});

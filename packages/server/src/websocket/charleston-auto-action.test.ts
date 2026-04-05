import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";
import type { WebSocket } from "ws";
import { createGame, DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";
import type { GameState } from "@mahjong-game/shared";
import type { Room, PlayerInfo } from "../rooms/room";
import { createSilentTestLogger } from "../testing/silent-logger";
import * as stateBroadcaster from "./state-broadcaster";
import {
  applyCharlestonAutoAction,
  charlestonPlayerNeedsAutoAdvance,
  drainCharlestonForDeadSeats,
} from "./charleston-auto-action";

function createMockWs(): WebSocket {
  return { readyState: 1, send: vi.fn() } as unknown as WebSocket;
}

function createTestPlayer(id: string, wind: "east" | "south" | "west" | "north"): PlayerInfo {
  return {
    playerId: id,
    displayName: id,
    wind,
    isHost: id === "p1",
    connected: true,
    connectedAt: Date.now(),
  };
}

function createTestRoom(players: PlayerInfo[], gameState: GameState): Room {
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
    paused: false,
    pausedAt: null,
    turnTimerConfig: { mode: "none", durationMs: 20_000 },
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
    logger: createSilentTestLogger(),
  };
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    room.players.set(player.playerId, player);
    room.sessions.set(player.playerId, {
      player,
      roomCode: room.roomCode,
      ws: wsList[i],
    });
  }
  return room;
}

describe("charleston-auto-action (Story 4B.5 dead seat)", () => {
  beforeEach(() => {
    vi.spyOn(stateBroadcaster, "broadcastGameState").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("charlestonPlayerNeedsAutoAdvance is true for active charleston passer", () => {
    const gs = createGame(["p1", "p2", "p3", "p4"], 42);
    const players = [
      createTestPlayer("p1", "east"),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, gs);
    expect(charlestonPlayerNeedsAutoAdvance(room, "p1")).toBe(true);
  });

  it("applyCharlestonAutoAction advances charleston for dead_seat reason", () => {
    const gs = createGame(["p1", "p2", "p3", "p4"], 42);
    const players = [
      createTestPlayer("p1", "east"),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, gs);
    room.deadSeatPlayerIds.add("p1");
    applyCharlestonAutoAction(room, "p1", room.logger, undefined, "dead_seat");
    expect(gs.charleston?.submittedPlayerIds).toContain("p1");
  });

  it("drainCharlestonForDeadSeats chains when two dead seats owe passes", () => {
    const gs = createGame(["p1", "p2", "p3", "p4"], 42);
    const players = [
      createTestPlayer("p1", "east"),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, gs);
    room.deadSeatPlayerIds.add("p1");
    room.deadSeatPlayerIds.add("p2");
    drainCharlestonForDeadSeats(room, room.logger, undefined);
    expect(gs.charleston?.submittedPlayerIds).toContain("p1");
    expect(gs.charleston?.submittedPlayerIds).toContain("p2");
  });
});

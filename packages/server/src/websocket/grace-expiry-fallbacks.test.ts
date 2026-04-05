import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import {
  DEFAULT_ROOM_SETTINGS,
  handleAction,
  type GameState,
  type SeatWind,
} from "@mahjong-game/shared";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";
import type { FastifyBaseLogger } from "fastify";
import { createTestState, getPlayerBySeat } from "../../../shared/src/testing/helpers";
import { applyGraceExpiryGameActions } from "./grace-expiry-fallbacks";

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

function createMockWs(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
  } as unknown as WebSocket;
}

function createTestRoom(players: PlayerInfo[], gameState: GameState | null): Room {
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

function playStateAtDiscard(seed = 42): { state: GameState; discarderId: string; tileId: string } {
  const gs = createTestState(undefined, seed);

  const east = getPlayerBySeat(gs, "east");
  expect(gs.currentTurn).toBe(east);
  if (gs.turnPhase === "draw") {
    const dr = handleAction(gs, { type: "DRAW_TILE", playerId: east });
    expect(dr.accepted).toBe(true);
  }
  expect(gs.turnPhase).toBe("discard");

  const rack = gs.players[east].rack;
  const lastNonJoker = [...rack].reverse().find((t) => t.category !== "joker");
  expect(lastNonJoker).toBeDefined();

  return { state: gs, discarderId: east, tileId: lastNonJoker!.id };
}

describe("applyGraceExpiryGameActions", () => {
  it("auto-discards last non-joker when current player is in discard step", () => {
    const { state, discarderId, tileId } = playStateAtDiscard();
    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, state);

    applyGraceExpiryGameActions(room, discarderId, room.logger);

    expect(state.turnPhase).toBe("callWindow");
    expect(state.callWindow).not.toBeNull();
    expect(state.lastDiscard?.discarderId).toBe(discarderId);
    expect(state.lastDiscard?.tile.id).toBe(tileId);
  });

  it("auto-passes call window for disconnected non-discarder", () => {
    const { state, discarderId } = playStateAtDiscard();
    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, state);

    const tileId = state.players[discarderId].rack.find((t) => t.category !== "joker")!.id;
    const d1 = handleAction(state, { type: "DISCARD_TILE", playerId: discarderId, tileId });
    expect(d1.accepted).toBe(true);
    expect(state.turnPhase).toBe("callWindow");

    const south = getPlayerBySeat(state, "south");
    expect(state.callWindow?.discarderId).toBe(discarderId);

    applyGraceExpiryGameActions(room, south, room.logger);

    expect(state.callWindow?.passes).toContain(south);
  });

  it("no-ops on scoreboard phase", () => {
    const { state, discarderId } = playStateAtDiscard();
    const savedTurnPhase = state.turnPhase;
    state.gamePhase = "scoreboard";
    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, state);

    applyGraceExpiryGameActions(room, discarderId, room.logger);

    expect(state.turnPhase).toBe(savedTurnPhase);
    expect(state.gamePhase).toBe("scoreboard");
  });

  it("no-ops on rematch phase (AC4)", () => {
    const { state, discarderId } = playStateAtDiscard();
    const savedTurnPhase = state.turnPhase;
    state.gamePhase = "rematch";
    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, state);

    applyGraceExpiryGameActions(room, discarderId, room.logger);

    expect(state.turnPhase).toBe(savedTurnPhase);
    expect(state.gamePhase).toBe("rematch");
  });

  it("no-ops when play phase but not current player's turn and no call-window obligation (AC5)", () => {
    const { state, discarderId } = playStateAtDiscard();
    // Move turn away from the disconnecting player; clear any call window.
    const south = getPlayerBySeat(state, "south");
    state.currentTurn = south;
    state.turnPhase = "draw";
    state.callWindow = null;
    const savedTurnPhase = state.turnPhase;
    const savedCurrentTurn = state.currentTurn;
    const savedLastDiscard = state.lastDiscard;

    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, state);

    applyGraceExpiryGameActions(room, discarderId, room.logger);

    expect(state.turnPhase).toBe(savedTurnPhase);
    expect(state.currentTurn).toBe(savedCurrentTurn);
    expect(state.lastDiscard).toBe(savedLastDiscard);
  });

  it("does not mutate consecutiveTurnTimeouts (Story 4B.4 AC9)", () => {
    const { state, discarderId } = playStateAtDiscard();
    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, state);
    room.consecutiveTurnTimeouts.set(discarderId, 7);

    applyGraceExpiryGameActions(room, discarderId, room.logger);

    expect(room.consecutiveTurnTimeouts.get(discarderId)).toBe(7);
  });

  it("early-returns when room is paused (AC4)", () => {
    const { state, discarderId } = playStateAtDiscard();
    const savedTurnPhase = state.turnPhase;
    const players = [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
    const room = createTestRoom(players, state);
    room.paused = true;

    applyGraceExpiryGameActions(room, discarderId, room.logger);

    expect(state.turnPhase).toBe(savedTurnPhase);
  });
});

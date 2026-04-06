import { describe, expect, it, beforeEach, afterEach, vi } from "vite-plus/test";
import type { WebSocket } from "ws";
import {
  DEFAULT_ROOM_SETTINGS,
  type GameState,
  type SeatWind,
  type Tile,
} from "@mahjong-game/shared";
import { handleAction } from "@mahjong-game/shared";
import type { RoomManager } from "../rooms/room-manager";
import type { Room, PlayerInfo } from "../rooms/room";
import {
  DEFAULT_TURN_TIMER_CONFIG,
  advancePastDeadSeats,
  autoPassCallWindowForDeadSeats,
  getDefaultTurnTimerConfig,
  pickAutoDiscardTileId,
  setDefaultTurnTimerConfig,
  syncTurnTimer,
  handleAfkVoteCastMessage,
  cancelAfkVote,
  cancelTurnTimer,
  handleAfkVoteTimeoutExpiry,
} from "./turn-timer";
import {
  setAfkVoteTimeoutMs,
  DEFAULT_AFK_VOTE_TIMEOUT_MS,
  startLifecycleTimer,
} from "../rooms/room-lifecycle";
import * as stateBroadcaster from "./state-broadcaster";
import { createTestState, getPlayerBySeat } from "../../../shared/src/testing/helpers";
import { createSilentTestLogger } from "../testing/silent-logger";
import { createTestRoomWithSessions } from "../testing";

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as import("fastify").FastifyBaseLogger;
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
    readyState: 1,
    send: vi.fn(),
  } as unknown as WebSocket;
}

function wsSendMock(ws: WebSocket): ReturnType<typeof vi.fn> {
  // WebSocket is a test mock — `send` is always `vi.fn()`, not a bound method.
  // eslint-disable-next-line @typescript-eslint/unbound-method -- test double
  return ws.send as ReturnType<typeof vi.fn>;
}

function createTestRoom(players: PlayerInfo[], gameState: GameState | null): Room {
  const wsList = players.map(() => createMockWs());
  return createTestRoomWithSessions(players, wsList, {
    gameState,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    logger: createMockLogger(),
  });
}

function playStateAtDiscard(seed = 42): GameState {
  const gs = createTestState(undefined, seed);
  const east = getPlayerBySeat(gs, "east");
  expect(gs.currentTurn).toBe(east);
  if (gs.turnPhase === "draw") {
    const dr = handleAction(gs, { type: "DRAW_TILE", playerId: east });
    expect(dr.accepted).toBe(true);
  }
  expect(gs.turnPhase).toBe("discard");
  return gs;
}

describe("turn-timer helpers", () => {
  beforeEach(() => {
    setDefaultTurnTimerConfig({ ...DEFAULT_TURN_TIMER_CONFIG });
    setAfkVoteTimeoutMs(DEFAULT_AFK_VOTE_TIMEOUT_MS);
  });

  afterEach(() => {
    setDefaultTurnTimerConfig({ ...DEFAULT_TURN_TIMER_CONFIG });
    setAfkVoteTimeoutMs(DEFAULT_AFK_VOTE_TIMEOUT_MS);
  });

  it("pickAutoDiscardTileId returns last non-joker from rack", () => {
    const rack: Tile[] = [
      { id: "j1", category: "joker", copy: 1 },
      { id: "bam-2-1", category: "suited", suit: "bam", value: 2, copy: 1 },
      { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 },
    ];
    expect(pickAutoDiscardTileId(rack)).toBe("bam-1-1");
  });

  it("pickAutoDiscardTileId returns null when only jokers", () => {
    const rack: Tile[] = [{ id: "j1", category: "joker", copy: 1 }];
    expect(pickAutoDiscardTileId(rack)).toBeNull();
  });

  it("getDefaultTurnTimerConfig reflects setDefaultTurnTimerConfig", () => {
    setDefaultTurnTimerConfig({ mode: "timed", durationMs: 50 });
    expect(getDefaultTurnTimerConfig().durationMs).toBe(50);
  });

  it("syncTurnTimer no-ops when room has no game state", () => {
    const logger = createSilentTestLogger();
    const room = {
      turnTimer: {
        config: getDefaultTurnTimerConfig(),
        handle: null,
        stage: null,
        playerId: null,
        consecutiveTimeouts: new Map(),
        afkVoteCooldownPlayerIds: new Set(),
      },
      votes: {
        afk: null,
        departure: null,
        socialOverrideTimer: null,
        tableTalkReportTimer: null,
      },
      seatStatus: {
        deadSeatPlayerIds: new Set(),
        departedPlayerIds: new Set(),
      },
      pause: { paused: false, pausedAt: null },
      gameState: null,
      players: new Map(),
      roomCode: "X",
      logger,
    } as unknown as Room;
    syncTurnTimer(room, logger);
    expect(room.turnTimer.handle).toBeNull();
  });
});

describe("Story 4B.4 — turn timer & AFK (fake timers)", () => {
  let broadcastRoomActions: unknown[];
  let broadcastGameCalls: number;

  beforeEach(() => {
    vi.useFakeTimers();
    setDefaultTurnTimerConfig({ mode: "timed", durationMs: 50 });
    setAfkVoteTimeoutMs(100);
    broadcastRoomActions = [];
    broadcastGameCalls = 0;
    vi.spyOn(stateBroadcaster, "broadcastStateToRoom").mockImplementation(
      (_room, _ex, resolvedAction) => {
        if (resolvedAction !== undefined) {
          broadcastRoomActions.push(resolvedAction);
        }
      },
    );
    vi.spyOn(stateBroadcaster, "broadcastGameState").mockImplementation(() => {
      broadcastGameCalls++;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setDefaultTurnTimerConfig({ ...DEFAULT_TURN_TIMER_CONFIG });
    setAfkVoteTimeoutMs(DEFAULT_AFK_VOTE_TIMEOUT_MS);
  });

  function fourPlayers(): PlayerInfo[] {
    return [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
  }

  /** `syncTurnTimer` reads duration from `room.turnTimer.config`, not the module default. */
  function shortTimedRoom(gs: GameState): Room {
    const room = createTestRoom(fourPlayers(), gs);
    room.turnTimer.config = { mode: "timed", durationMs: 50 };
    return room;
  }

  it("T2: initial expiry emits TURN_TIMER_NUDGE and re-arms extended (counter not incremented)", () => {
    const gs = playStateAtDiscard();
    const room = shortTimedRoom(gs);
    const east = getPlayerBySeat(gs, "east");
    syncTurnTimer(room, room.logger);
    expect(room.turnTimer.stage).toBe("initial");
    vi.advanceTimersByTime(50);
    const nudge = broadcastRoomActions.find(
      (a) =>
        typeof a === "object" && a !== null && (a as { type: string }).type === "TURN_TIMER_NUDGE",
    ) as { type: string; playerId: string } | undefined;
    expect(nudge?.type).toBe("TURN_TIMER_NUDGE");
    expect(nudge?.playerId).toBe(east);
    expect(room.turnTimer.consecutiveTimeouts.get(east)).toBeUndefined();
    expect(room.turnTimer.stage).toBe("extended");
  });

  it("T3: extended expiry increments counter, auto-discards, advances turn", () => {
    const gs = playStateAtDiscard();
    const room = shortTimedRoom(gs);
    const east = getPlayerBySeat(gs, "east");
    syncTurnTimer(room, room.logger);
    vi.advanceTimersByTime(50);
    broadcastRoomActions.length = 0;
    vi.advanceTimersByTime(50);
    expect(room.turnTimer.consecutiveTimeouts.get(east)).toBe(1);
    expect(
      broadcastRoomActions.some(
        (a) =>
          typeof a === "object" &&
          a !== null &&
          (a as { type: string }).type === "TURN_TIMEOUT_AUTO_DISCARD",
      ),
    ).toBe(true);
    expect(broadcastGameCalls).toBeGreaterThan(0);
    expect(gs.turnPhase === "callWindow" || gs.currentTurn !== east).toBe(true);
  });

  it("T4: third consecutive stuck turn (counter 2→3) starts AFK vote + auto-discard", () => {
    const gs = playStateAtDiscard();
    const room = shortTimedRoom(gs);
    const east = getPlayerBySeat(gs, "east");
    room.turnTimer.consecutiveTimeouts.set(east, 2);
    syncTurnTimer(room, room.logger);
    vi.advanceTimersByTime(50);
    vi.advanceTimersByTime(50);
    expect(
      broadcastRoomActions.some(
        (a) =>
          typeof a === "object" &&
          a !== null &&
          (a as { type: string }).type === "AFK_VOTE_STARTED",
      ),
    ).toBe(true);
    expect(room.turnTimer.consecutiveTimeouts.get(east)).toBe(3);
    expect(room.votes.afk?.targetPlayerId).toBe(east);
  });

  it("T10: mode none never arms timer", () => {
    const gs = playStateAtDiscard();
    const room = shortTimedRoom(gs);
    room.turnTimer.config = { mode: "none", durationMs: 50 };
    syncTurnTimer(room, room.logger);
    expect(room.turnTimer.handle).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(
      broadcastRoomActions.filter((a) => (a as { type: string }).type === "TURN_TIMER_NUDGE"),
    ).toHaveLength(0);
  });

  it("T19: dead-seat turn-skip advances past draw/discard (4B.5)", () => {
    const gs = playStateAtDiscard();
    const room = shortTimedRoom(gs);
    const east = getPlayerBySeat(gs, "east");
    room.seatStatus.deadSeatPlayerIds.add(east);
    syncTurnTimer(room, room.logger);
    expect(
      broadcastRoomActions.some(
        (a) =>
          typeof a === "object" &&
          a !== null &&
          (a as { type: string }).type === "TURN_SKIPPED_DEAD_SEAT",
      ),
    ).toBe(true);
    expect(gs.currentTurn !== east).toBe(true);
    expect(gs.turnPhase).toBe("draw");
  });

  it("T5: two approves pass vote — dead seat + resolved", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    const east = getPlayerBySeat(gs, "east");
    room.votes.afk = { targetPlayerId: east, startedAt: Date.now(), votes: new Map() };
    startLifecycleTimer(room, "afk-vote-timeout", () => {
      handleAfkVoteTimeoutExpiry(room, room.logger);
    });
    const p2 = room.sessions.get("p2")!;
    const p3 = room.sessions.get("p3")!;
    handleAfkVoteCastMessage(
      p2.ws,
      p2,
      room,
      { targetPlayerId: east, vote: "approve" },
      room.logger,
    );
    handleAfkVoteCastMessage(
      p3.ws,
      p3,
      room,
      { targetPlayerId: east, vote: "approve" },
      room.logger,
    );
    expect(room.seatStatus.deadSeatPlayerIds.has(east)).toBe(true);
    expect(room.votes.afk).toBeNull();
    expect(
      broadcastRoomActions.some(
        (a) =>
          typeof a === "object" &&
          a !== null &&
          (a as { type: string; outcome?: string }).type === "AFK_VOTE_RESOLVED" &&
          (a as { outcome: string }).outcome === "passed",
      ),
    ).toBe(true);
  });

  it("T6: two denies fail vote — cooldown, no dead seat", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    const east = getPlayerBySeat(gs, "east");
    room.votes.afk = { targetPlayerId: east, startedAt: Date.now(), votes: new Map() };
    startLifecycleTimer(room, "afk-vote-timeout", () => {});
    const p2 = room.sessions.get("p2")!;
    const p3 = room.sessions.get("p3")!;
    handleAfkVoteCastMessage(p2.ws, p2, room, { targetPlayerId: east, vote: "deny" }, room.logger);
    handleAfkVoteCastMessage(p3.ws, p3, room, { targetPlayerId: east, vote: "deny" }, room.logger);
    expect(room.turnTimer.afkVoteCooldownPlayerIds.has(east)).toBe(true);
    expect(room.seatStatus.deadSeatPlayerIds.has(east)).toBe(false);
  });

  it("T7: vote times out with no quorum → failed", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    const east = getPlayerBySeat(gs, "east");
    room.votes.afk = { targetPlayerId: east, startedAt: Date.now(), votes: new Map() };
    startLifecycleTimer(room, "afk-vote-timeout", () => {
      handleAfkVoteTimeoutExpiry(room, room.logger);
    });
    const p2 = room.sessions.get("p2")!;
    handleAfkVoteCastMessage(
      p2.ws,
      p2,
      room,
      { targetPlayerId: east, vote: "approve" },
      room.logger,
    );
    vi.advanceTimersByTime(100);
    expect(room.votes.afk).toBeNull();
    expect(room.turnTimer.afkVoteCooldownPlayerIds.has(east)).toBe(true);
  });

  it("T8: cancelAfkVote target_active clears vote without cooldown", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    const east = getPlayerBySeat(gs, "east");
    room.votes.afk = { targetPlayerId: east, startedAt: Date.now(), votes: new Map() };
    startLifecycleTimer(room, "afk-vote-timeout", () => {});
    cancelAfkVote(room, room.logger, "target_active");
    expect(room.votes.afk).toBeNull();
    expect(room.turnTimer.afkVoteCooldownPlayerIds.has(east)).toBe(false);
  });

  it("T16: CANNOT_VOTE_ON_SELF", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    const east = getPlayerBySeat(gs, "east");
    room.votes.afk = { targetPlayerId: east, startedAt: Date.now(), votes: new Map() };
    const eastSession = room.sessions.get(east)!;
    handleAfkVoteCastMessage(
      eastSession.ws,
      eastSession,
      room,
      { targetPlayerId: east, vote: "approve" },
      room.logger,
    );
    const eastSend = wsSendMock(eastSession.ws);
    expect(eastSend).toHaveBeenCalled();
    const raw0 = eastSend.mock.calls[0][0];
    if (typeof raw0 !== "string") throw new Error("expected JSON string from ERROR send");
    const sent = JSON.parse(raw0) as { code?: string };
    expect(sent.code).toBe("CANNOT_VOTE_ON_SELF");
  });

  it("T17: NO_ACTIVE_VOTE", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    const east = getPlayerBySeat(gs, "east");
    const p2 = room.sessions.get("p2")!;
    handleAfkVoteCastMessage(
      p2.ws,
      p2,
      room,
      { targetPlayerId: east, vote: "approve" },
      room.logger,
    );
    const raw1 = wsSendMock(p2.ws).mock.calls[0][0];
    if (typeof raw1 !== "string") throw new Error("expected JSON string from ERROR send");
    const sent = JSON.parse(raw1) as { code?: string };
    expect(sent.code).toBe("NO_ACTIVE_VOTE");
  });

  it("T18: INVALID_VOTE_TARGET", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    const east = getPlayerBySeat(gs, "east");
    room.votes.afk = { targetPlayerId: east, startedAt: Date.now(), votes: new Map() };
    const p2 = room.sessions.get("p2")!;
    handleAfkVoteCastMessage(
      p2.ws,
      p2,
      room,
      { targetPlayerId: "wrong-id", vote: "approve" },
      room.logger,
    );
    const raw2 = wsSendMock(p2.ws).mock.calls[0][0];
    if (typeof raw2 !== "string") throw new Error("expected JSON string from ERROR send");
    const sent = JSON.parse(raw2) as { code?: string };
    expect(sent.code).toBe("INVALID_VOTE_TARGET");
  });

  it("T20: single voter flips approve→deny — two AFK_VOTE_CAST broadcasts, vote stays open (no quorum)", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    const east = getPlayerBySeat(gs, "east");
    room.votes.afk = { targetPlayerId: east, startedAt: Date.now(), votes: new Map() };
    startLifecycleTimer(room, "afk-vote-timeout", () => {});
    broadcastRoomActions.length = 0;
    const p2 = room.sessions.get("p2")!;
    handleAfkVoteCastMessage(
      p2.ws,
      p2,
      room,
      { targetPlayerId: east, vote: "approve" },
      room.logger,
    );
    handleAfkVoteCastMessage(p2.ws, p2, room, { targetPlayerId: east, vote: "deny" }, room.logger);
    const casts = broadcastRoomActions.filter(
      (a) =>
        typeof a === "object" && a !== null && (a as { type: string }).type === "AFK_VOTE_CAST",
    );
    expect(casts.length).toBe(2);
    expect(room.votes.afk).not.toBeNull();
  });

  it("cancelTurnTimer clears handle", () => {
    const gs = playStateAtDiscard();
    const room = createTestRoom(fourPlayers(), gs);
    syncTurnTimer(room, room.logger);
    expect(room.turnTimer.handle).not.toBeNull();
    cancelTurnTimer(room, room.logger);
    expect(room.turnTimer.handle).toBeNull();
  });

  // Regression for H2 (post-review fix): the extended-stage expiry must not
  // increment the counter or broadcast an auto-discard when the current player
  // has disconnected between arming and expiry. Grace-expiry owns that path.
  it("AC9: extended expiry no-ops when current player is disconnected", () => {
    const gs = playStateAtDiscard();
    const room = shortTimedRoom(gs);
    const east = getPlayerBySeat(gs, "east");
    syncTurnTimer(room, room.logger);
    // initial stage armed; advance past initial to set up extended stage.
    vi.advanceTimersByTime(50);
    expect(room.turnTimer.stage).toBe("extended");
    // Simulate disconnect without going through close handler — timer is still
    // armed from before the disconnect.
    const eastPlayer = room.players.get(east)!;
    eastPlayer.connected = false;
    broadcastRoomActions.length = 0;
    vi.advanceTimersByTime(50);
    expect(room.turnTimer.consecutiveTimeouts.get(east)).toBeUndefined();
    expect(
      broadcastRoomActions.some(
        (a) =>
          typeof a === "object" &&
          a !== null &&
          (a as { type: string }).type === "TURN_TIMEOUT_AUTO_DISCARD",
      ),
    ).toBe(false);
  });

  // Regression for L3: defensive guard in startAfkVote against offline target.
  it("AC9: startAfkVote path does not fire for disconnected target at counter 3", () => {
    const gs = playStateAtDiscard();
    const room = shortTimedRoom(gs);
    const east = getPlayerBySeat(gs, "east");
    room.turnTimer.consecutiveTimeouts.set(east, 2);
    // Arm the timer while connected, then mark disconnected before expiry.
    syncTurnTimer(room, room.logger);
    room.players.get(east)!.connected = false;
    vi.advanceTimersByTime(50);
    vi.advanceTimersByTime(50);
    expect(room.votes.afk).toBeNull();
  });
});

describe("Story 4B.5 — dead-seat helpers (fake timers)", () => {
  let broadcastRoomActions: unknown[];
  let broadcastGameCalls: number;

  beforeEach(() => {
    vi.useFakeTimers();
    setDefaultTurnTimerConfig({ mode: "timed", durationMs: 50 });
    broadcastRoomActions = [];
    broadcastGameCalls = 0;
    vi.spyOn(stateBroadcaster, "broadcastStateToRoom").mockImplementation(
      (_room, _ex, resolvedAction) => {
        if (resolvedAction !== undefined) {
          broadcastRoomActions.push(resolvedAction);
        }
      },
    );
    vi.spyOn(stateBroadcaster, "broadcastGameState").mockImplementation(() => {
      broadcastGameCalls++;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setDefaultTurnTimerConfig({ ...DEFAULT_TURN_TIMER_CONFIG });
  });

  function fourPlayers(): PlayerInfo[] {
    return [
      createTestPlayer("p1", "east", true),
      createTestPlayer("p2", "south"),
      createTestPlayer("p3", "west"),
      createTestPlayer("p4", "north"),
    ];
  }

  function shortTimedRoom(gs: GameState): Room {
    const room = createTestRoom(fourPlayers(), gs);
    room.turnTimer.config = { mode: "timed", durationMs: 50 };
    return room;
  }

  it("T8 (4B.5): skips two consecutive dead seats in seat order", () => {
    const gs = playStateAtDiscard();
    const east = getPlayerBySeat(gs, "east");
    const south = getPlayerBySeat(gs, "south");
    const west = getPlayerBySeat(gs, "west");
    const room = shortTimedRoom(gs);
    room.seatStatus.deadSeatPlayerIds.add(east);
    room.seatStatus.deadSeatPlayerIds.add(south);
    syncTurnTimer(room, room.logger);
    const skips = broadcastRoomActions.filter(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        (a as { type: string }).type === "TURN_SKIPPED_DEAD_SEAT",
    );
    expect(skips).toHaveLength(2);
    expect(gs.currentTurn).toBe(west);
    expect(gs.turnPhase).toBe("draw");
  });

  it("T9 (4B.5): auto-passes call window for dead-seat player", () => {
    const gs = playStateAtDiscard();
    const discarderId = getPlayerBySeat(gs, "east");
    const south = getPlayerBySeat(gs, "south");
    const tileId = gs.players[discarderId].rack.find((t) => t.category !== "joker")!.id;
    const dr = handleAction(gs, { type: "DISCARD_TILE", playerId: discarderId, tileId });
    expect(dr.accepted).toBe(true);
    expect(gs.turnPhase).toBe("callWindow");

    const room = shortTimedRoom(gs);
    room.seatStatus.deadSeatPlayerIds.add(south);
    broadcastGameCalls = 0;
    const progressed = autoPassCallWindowForDeadSeats(room, room.logger);
    expect(progressed).toBe(true);
    expect(broadcastGameCalls).toBeGreaterThan(0);
    expect(gs.callWindow?.passes).toContain(south);
  });

  it("T24 (4B.5): all engine seats dead-seat triggers auto-end", () => {
    const gs = playStateAtDiscard();
    const room = shortTimedRoom(gs);
    for (const id of Object.keys(gs.players)) {
      room.seatStatus.deadSeatPlayerIds.add(id);
    }
    const roomManager = { cleanupRoom: vi.fn() } as unknown as RoomManager;
    advancePastDeadSeats(room, room.logger, roomManager);
    expect(
      broadcastRoomActions.some(
        (a) =>
          typeof a === "object" &&
          a !== null &&
          (a as { type: string }).type === "GAME_ABANDONED" &&
          (a as { reason?: string }).reason === "player-departure",
      ),
    ).toBe(true);
    expect(gs.gamePhase).toBe("scoreboard");
  });
});

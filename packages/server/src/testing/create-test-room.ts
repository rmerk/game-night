import type { FastifyBaseLogger } from "fastify";
import { WebSocket } from "ws";
import { DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";
import type { SeatWind } from "@mahjong-game/shared";
import type {
  PlayerInfo,
  PlayerSession,
  Room,
  SessionHistory,
  TurnTimerState,
  VoteState,
  SeatStatus,
  PauseState,
  RateLimits,
} from "../rooms/room";
import { createSilentTestLogger } from "./silent-logger";

export function createMockWs(readyState: number = WebSocket.OPEN): WebSocket {
  return {
    readyState,
    send: () => {},
    close: () => {},
  } as unknown as WebSocket;
}

export function createTestPlayer(id: string, wind: SeatWind, isHost = false): PlayerInfo {
  return {
    playerId: id,
    displayName: `Player ${id}`,
    wind,
    isHost,
    connected: true,
    connectedAt: Date.now(),
  };
}

function mergeTurnTimer(base: TurnTimerState, patch?: Partial<TurnTimerState>): TurnTimerState {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    config: patch.config ? { ...base.config, ...patch.config } : base.config,
    consecutiveTimeouts: patch.consecutiveTimeouts ?? new Map(base.consecutiveTimeouts),
    afkVoteCooldownPlayerIds:
      patch.afkVoteCooldownPlayerIds ?? new Set(base.afkVoteCooldownPlayerIds),
  };
}

function mergeVotes(base: VoteState, patch?: Partial<VoteState>): VoteState {
  if (!patch) return base;
  return {
    afk: patch.afk !== undefined ? patch.afk : base.afk,
    departure: patch.departure !== undefined ? patch.departure : base.departure,
    socialOverrideTimer:
      patch.socialOverrideTimer !== undefined
        ? patch.socialOverrideTimer
        : base.socialOverrideTimer,
    tableTalkReportTimer:
      patch.tableTalkReportTimer !== undefined
        ? patch.tableTalkReportTimer
        : base.tableTalkReportTimer,
  };
}

function mergeSeatStatus(base: SeatStatus, patch?: Partial<SeatStatus>): SeatStatus {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    deadSeatPlayerIds: patch.deadSeatPlayerIds ?? new Set(base.deadSeatPlayerIds),
    departedPlayerIds: patch.departedPlayerIds ?? new Set(base.departedPlayerIds),
  };
}

function mergePause(base: PauseState, patch?: Partial<PauseState>): PauseState {
  if (!patch) return base;
  return { ...base, ...patch };
}

function mergeSessionHistory(
  base: SessionHistory,
  patch?: Partial<SessionHistory>,
): SessionHistory {
  if (!patch) return base;
  return {
    scoresFromPriorGames: patch.scoresFromPriorGames ?? { ...base.scoresFromPriorGames },
    gameHistory: patch.gameHistory ?? [...base.gameHistory],
  };
}

function mergeRateLimits(base: RateLimits, patch?: Partial<RateLimits>): RateLimits {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    chatRateTimestamps: patch.chatRateTimestamps ?? new Map(base.chatRateTimestamps),
    reactionRateTimestamps: patch.reactionRateTimestamps ?? new Map(base.reactionRateTimestamps),
  };
}

function defaultRoom(logger: FastifyBaseLogger): Room {
  return {
    roomId: "test-room-id",
    roomCode: "TEST01",
    hostToken: "host-token",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    lifecycleTimers: new Map(),
    gameState: null,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    jokerRulesMode: DEFAULT_ROOM_SETTINGS.jokerRulesMode,
    chatHistory: [],
    turnTimer: {
      config: {
        mode: DEFAULT_ROOM_SETTINGS.timerMode,
        durationMs: DEFAULT_ROOM_SETTINGS.turnDurationMs,
      },
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
    pause: {
      paused: false,
      pausedAt: null,
    },
    sessionHistory: {
      scoresFromPriorGames: {},
      gameHistory: [],
    },
    rateLimits: {
      chatRateTimestamps: new Map(),
      reactionRateTimestamps: new Map(),
    },
    createdAt: Date.now(),
    logger,
  };
}

/** Overrides for tests — nested keys are partial (e.g. `turnTimer: { config: {...} }`). */
export type CreateTestRoomOverrides = Partial<
  Omit<Room, "turnTimer" | "votes" | "seatStatus" | "pause" | "sessionHistory" | "rateLimits">
> & {
  turnTimer?: Partial<TurnTimerState>;
  votes?: Partial<VoteState>;
  seatStatus?: Partial<SeatStatus>;
  pause?: Partial<PauseState>;
  sessionHistory?: Partial<SessionHistory>;
  rateLimits?: Partial<RateLimits>;
};

/**
 * Test fixture: full `Room` with nested defaults; shallow-merge top-level, deep-merge sub-objects.
 */
export function createTestRoom(
  overrides?: CreateTestRoomOverrides,
  logger?: FastifyBaseLogger,
): Room {
  const base = defaultRoom(logger ?? createSilentTestLogger());
  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    turnTimer: mergeTurnTimer(base.turnTimer, overrides.turnTimer),
    votes: mergeVotes(base.votes, overrides.votes),
    seatStatus: mergeSeatStatus(base.seatStatus, overrides.seatStatus),
    pause: mergePause(base.pause, overrides.pause),
    sessionHistory: mergeSessionHistory(base.sessionHistory, overrides.sessionHistory),
    rateLimits: mergeRateLimits(base.rateLimits, overrides.rateLimits),
    players: overrides.players ?? base.players,
    sessions: overrides.sessions ?? base.sessions,
    tokenMap: overrides.tokenMap ?? base.tokenMap,
    playerTokens: overrides.playerTokens ?? base.playerTokens,
    graceTimers: overrides.graceTimers ?? base.graceTimers,
    lifecycleTimers: overrides.lifecycleTimers ?? base.lifecycleTimers,
    gameState: overrides.gameState !== undefined ? overrides.gameState : base.gameState,
    settings: overrides.settings ?? base.settings,
    chatHistory: overrides.chatHistory ?? base.chatHistory,
    logger: overrides.logger ?? base.logger,
  };
}

/** Wire `players` + `sessions` from parallel arrays (common broadcaster / timer test setup). */
export function createTestRoomWithSessions(
  players: PlayerInfo[],
  wsList: WebSocket[],
  overrides?: CreateTestRoomOverrides,
): Room {
  const room = createTestRoom(overrides);
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const ws = wsList[i];
    if (!player || !ws) continue;
    room.players.set(player.playerId, player);
    const session: PlayerSession = {
      player,
      roomCode: room.roomCode,
      ws,
    };
    room.sessions.set(player.playerId, session);
  }
  return room;
}

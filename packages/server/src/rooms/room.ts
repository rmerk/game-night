import type { FastifyBaseLogger } from "fastify";
import type {
  ChatBroadcast,
  SeatWind,
  GameState,
  JokerRulesMode,
  RoomSettings,
  SessionGameHistoryEntry,
} from "@mahjong-game/shared";
import type { WebSocket } from "ws";

/** Server-only AFK vote state (Story 4B.4) — not part of shared protocol */
export interface AfkVoteState {
  readonly targetPlayerId: string;
  readonly startedAt: number;
  /** Mutable vote tally — updated by AFK_VOTE_CAST handler */
  votes: Map<string, "approve" | "deny">;
}

/** Server-only departure vote state (Story 4B.5) — not part of shared protocol */
export interface DepartureVoteState {
  readonly targetPlayerId: string;
  readonly targetPlayerName: string;
  readonly startedAt: number;
  /** Monotonic epoch millis when the 30s lifecycle timer expires — used by buildPlayerView (Task 7) */
  expiresAt: number;
  /** Mutable vote tally — voterId → choice */
  votes: Map<string, "dead_seat" | "end_game">;
}

export type TurnTimerConfig = { readonly mode: "timed" | "none"; readonly durationMs: number };

/** Play-phase turn timer + AFK cooldown tracking (Story 4B.4) */
export interface TurnTimerState {
  /** Canonical config — keep in sync with room.settings timer fields (Story 4B.7) */
  config: TurnTimerConfig;
  handle: ReturnType<typeof setTimeout> | null;
  stage: "initial" | "extended" | null;
  playerId: string | null;
  /** Consecutive stuck turns (incremented on extended-stage expiry only) */
  consecutiveTimeouts: Map<string, number>;
  afkVoteCooldownPlayerIds: Set<string>;
}

/** Server-side vote timers and AFK / departure votes */
export interface VoteState {
  afk: AfkVoteState | null;
  departure: DepartureVoteState | null;
  /** Single scheduled social-override vote expiry (Story 3C.4) */
  socialOverrideTimer: ReturnType<typeof setTimeout> | null;
  /** Single scheduled table-talk vote expiry (Story 3C.5) */
  tableTalkReportTimer: ReturnType<typeof setTimeout> | null;
}

export interface SeatStatus {
  deadSeatPlayerIds: Set<string>;
  /** Players who sent LEAVE_ROOM and whose seats have not yet been cleaned up (Story 4B.5) */
  departedPlayerIds: Set<string>;
}

/** Simultaneous-disconnect pause (Epic 4B.3) — orthogonal to engine phase */
export interface PauseState {
  paused: boolean;
  pausedAt: number | null;
}

export interface SessionHistory {
  /** Cumulative scores from completed games this room session (Story 5B.4) */
  scoresFromPriorGames: Record<string, number>;
  /** Completed games — appended when merging at rematch / end session (Story 5B.4) */
  gameHistory: SessionGameHistoryEntry[];
}

export interface RateLimits {
  /** Per-player sliding-window timestamps for chat rate limit */
  chatRateTimestamps: Map<string, number[]>;
  /** Per-player sliding-window timestamps for reaction rate limit */
  reactionRateTimestamps: Map<string, number[]>;
}

export interface PlayerInfo {
  playerId: string;
  displayName: string;
  wind: SeatWind;
  isHost: boolean;
  connected: boolean;
  connectedAt: number;
}

export interface PlayerSession {
  player: PlayerInfo;
  roomCode: string;
  ws: WebSocket;
}

export interface Room {
  roomId: string;
  roomCode: string;
  hostToken: string;
  players: Map<string, PlayerInfo>;
  sessions: Map<string, PlayerSession>;
  tokenMap: Map<string, string>; // token → playerId
  playerTokens: Map<string, string>; // playerId → token
  graceTimers: Map<string, ReturnType<typeof setTimeout>>; // playerId → grace period timer
  lifecycleTimers: Map<string, ReturnType<typeof setTimeout>>; // lifecycle timer type → timer
  gameState: GameState | null;
  /** Canonical host settings — keep jokerRulesMode in sync with room.jokerRulesMode */
  settings: RoomSettings;
  /** Host-selected Joker rules for the next game (authoritative for START_GAME) */
  jokerRulesMode: JokerRulesMode;
  /** Last chat lines for future CHAT_HISTORY / 6A.4 — reactions not stored */
  chatHistory: ChatBroadcast[];
  turnTimer: TurnTimerState;
  votes: VoteState;
  seatStatus: SeatStatus;
  pause: PauseState;
  sessionHistory: SessionHistory;
  rateLimits: RateLimits;
  createdAt: number;
  logger: FastifyBaseLogger;
}

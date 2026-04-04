import type { FastifyBaseLogger } from "fastify";
import type { ChatBroadcast, SeatWind, GameState, JokerRulesMode } from "@mahjong-game/shared";
import type { WebSocket } from "ws";

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
  /** Single scheduled social-override vote expiry (Story 3C.4) */
  socialOverrideTimer: ReturnType<typeof setTimeout> | null;
  /** Single scheduled table-talk vote expiry (Story 3C.5) */
  tableTalkReportTimer: ReturnType<typeof setTimeout> | null;
  gameState: GameState | null;
  /** Host-selected Joker rules for the next game (authoritative for START_GAME) */
  jokerRulesMode: JokerRulesMode;
  /** Last chat lines for future CHAT_HISTORY / 6A.4 — reactions not stored */
  chatHistory: ChatBroadcast[];
  /** Per-player sliding-window timestamps for chat rate limit */
  chatRateTimestamps: Map<string, number[]>;
  /** Per-player sliding-window timestamps for reaction rate limit */
  reactionRateTimestamps: Map<string, number[]>;
  createdAt: number;
  logger: FastifyBaseLogger;
}

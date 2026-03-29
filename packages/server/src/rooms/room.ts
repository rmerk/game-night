import type { FastifyBaseLogger } from "fastify";
import type { SeatWind } from "@mahjong-game/shared";
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
  gamePhase: "lobby";
  createdAt: number;
  logger: FastifyBaseLogger;
}

import type { FastifyBaseLogger } from "fastify";

export interface PlayerInfo {
  playerId: string;
  displayName: string;
  isHost: boolean;
  connectedAt: number;
}

export interface Room {
  roomId: string;
  roomCode: string;
  hostToken: string;
  players: Map<string, PlayerInfo>;
  gamePhase: "lobby";
  createdAt: number;
  logger: FastifyBaseLogger;
}

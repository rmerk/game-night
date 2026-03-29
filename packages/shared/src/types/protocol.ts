import type { SeatWind, ResolvedAction } from "./game-state";

export const PROTOCOL_VERSION = 1;

export interface ServerErrorMessage {
  version: typeof PROTOCOL_VERSION;
  type: "ERROR";
  code: string;
  message: string;
}

/** Client → Server: request to join a room */
export interface JoinRoomMessage {
  version: typeof PROTOCOL_VERSION;
  type: "JOIN_ROOM";
  roomCode: string;
  displayName: string;
  token?: string;
}

/** Public info about a player visible to all clients */
export interface PlayerPublicInfo {
  playerId: string;
  displayName: string;
  wind: SeatWind;
  isHost: boolean;
  connected: boolean;
}

/** Lobby state sent to clients before game starts */
export interface LobbyState {
  roomId: string;
  roomCode: string;
  gamePhase: "lobby";
  players: PlayerPublicInfo[];
  myPlayerId: string;
}

/** Server → Client: state update with optional resolved action and token */
export interface StateUpdateMessage {
  version: typeof PROTOCOL_VERSION;
  type: "STATE_UPDATE";
  state: LobbyState;
  resolvedAction?: ResolvedAction;
  token?: string;
}

/** Server → Client: system event notification */
export interface SystemEventMessage {
  version: typeof PROTOCOL_VERSION;
  type: "SYSTEM_EVENT";
  event: "SESSION_SUPERSEDED";
  message?: string;
}

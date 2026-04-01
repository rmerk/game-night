import type {
  SeatWind,
  ResolvedAction,
  GamePhase,
  TurnPhase,
  CharlestonDirection,
  CharlestonStage,
  CharlestonStatus,
  ExposedGroup,
  CallWindowState,
  GameResult,
  PendingMahjongState,
  ChallengeState,
} from "./game-state";
import type { Tile } from "./tiles";
import type { GameAction } from "./actions";

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

/** Client → Server: game action */
export interface ActionMessage {
  version: typeof PROTOCOL_VERSION;
  type: "ACTION";
  action: GameAction;
}

/** Client → Server: request full state resync (e.g., after suspected missed update) */
export interface RequestStateMessage {
  version: typeof PROTOCOL_VERSION;
  type: "REQUEST_STATE";
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

/** Safe Charleston metadata shared with all viewers */
export interface PublicCharlestonView {
  stage: CharlestonStage;
  status: CharlestonStatus;
  currentDirection: CharlestonDirection | null;
  activePlayerIds: string[];
  submittedPlayerIds: string[];
}

/** Per-player Charleston metadata that never exposes hidden tile identities */
export interface PlayerCharlestonView extends PublicCharlestonView {
  myHiddenTileCount: number;
  mySubmissionLocked: boolean;
}

/** Spectator Charleston metadata — public information only */
export type SpectatorCharlestonView = PublicCharlestonView;

/** Per-player filtered game view — each player sees only their own rack */
export interface PlayerGameView {
  roomId: string;
  roomCode: string;
  gamePhase: GamePhase;
  players: PlayerPublicInfo[];
  myPlayerId: string;
  myRack: Tile[];
  exposedGroups: Record<string, ExposedGroup[]>;
  discardPools: Record<string, Tile[]>;
  wallRemaining: number;
  currentTurn: string;
  turnPhase: TurnPhase;
  callWindow: CallWindowState | null;
  scores: Record<string, number>;
  lastDiscard: { tile: Tile; discarderId: string } | null;
  gameResult: GameResult | null;
  pendingMahjong: PendingMahjongState | null;
  challengeState: ChallengeState | null;
  charleston: PlayerCharlestonView | null;
  shownHands: Record<string, Tile[]>;
}

/** Spectator view — public information only, no player racks (post-MVP) */
export interface SpectatorGameView {
  roomId: string;
  roomCode: string;
  gamePhase: GamePhase;
  players: PlayerPublicInfo[];
  exposedGroups: Record<string, ExposedGroup[]>;
  discardPools: Record<string, Tile[]>;
  wallRemaining: number;
  currentTurn: string;
  turnPhase: TurnPhase;
  callWindow: CallWindowState | null;
  scores: Record<string, number>;
  lastDiscard: { tile: Tile; discarderId: string } | null;
  gameResult: GameResult | null;
  charleston: SpectatorCharlestonView | null;
  shownHands: Record<string, Tile[]>;
}

/** Server → Client: state update with optional resolved action and token */
export interface StateUpdateMessage {
  version: typeof PROTOCOL_VERSION;
  type: "STATE_UPDATE";
  state: LobbyState | PlayerGameView;
  resolvedAction?: ResolvedAction;
  token?: string;
}

/** Room closing reason sent to clients before cleanup */
export type RoomClosingReason = "all_disconnected" | "idle_timeout" | "abandoned";

/** Server → Client: system event notification */
export type SystemEventMessage =
  | {
      version: typeof PROTOCOL_VERSION;
      type: "SYSTEM_EVENT";
      event: "SESSION_SUPERSEDED";
    }
  | {
      version: typeof PROTOCOL_VERSION;
      type: "SYSTEM_EVENT";
      event: "ROOM_CLOSING";
      reason: RoomClosingReason;
    };

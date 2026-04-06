import type {
  SeatWind,
  ResolvedAction,
  GamePhase,
  TurnPhase,
  JokerRulesMode,
  CharlestonPairing,
  CharlestonDirection,
  CharlestonStage,
  CharlestonStatus,
  ExposedGroup,
  CallWindowState,
  GameResult,
  PendingMahjongState,
  ChallengeState,
  SocialOverrideState,
  TableTalkReportState,
  SessionGameHistoryEntry,
} from "./game-state";
import type { Tile } from "./tiles";
import type { GameAction } from "./actions";
import type { DealingStyle, RoomSettings, TimerMode } from "./room-settings";

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

/** Client → Server: host sets Joker rules for the next game (lobby only) */
export interface SetJokerRulesMessage {
  version: typeof PROTOCOL_VERSION;
  type: "SET_JOKER_RULES";
  jokerRulesMode: JokerRulesMode;
}

/** Client → Server: host updates room settings between games — partial merge on server (Story 4B.7) */
export interface SetRoomSettingsMessage {
  version: typeof PROTOCOL_VERSION;
  type: "SET_ROOM_SETTINGS";
  timerMode?: TimerMode;
  turnDurationMs?: number;
  jokerRulesMode?: JokerRulesMode;
  dealingStyle?: DealingStyle;
}

/** Client → Server: host requests rematch after scoreboard — server validates preconditions (Story 4B.7) */
export interface RematchMessage {
  version: typeof PROTOCOL_VERSION;
  type: "REMATCH";
}

/** Client → Server: vote during an active AFK escalation vote (Story 4B.4) */
export interface AfkVoteCastMessage {
  version: typeof PROTOCOL_VERSION;
  type: "AFK_VOTE_CAST";
  targetPlayerId: string;
  vote: "approve" | "deny";
}

/** Client → Server: player voluntarily leaves the room mid-game (Story 4B.5) */
export interface LeaveRoomMessage {
  version: typeof PROTOCOL_VERSION;
  type: "LEAVE_ROOM";
}

/** Client → Server: cast a vote in an active departure vote (Story 4B.5) */
export interface DepartureVoteCastMessage {
  version: typeof PROTOCOL_VERSION;
  type: "DEPARTURE_VOTE_CAST";
  targetPlayerId: string;
  choice: "dead_seat" | "end_game";
}

/** Client → Server: table chat (orthogonal to game state — Story 6A.1) */
export interface ChatMessage {
  version: typeof PROTOCOL_VERSION;
  type: "CHAT";
  text: string;
}

/** Client → Server: quick emoji reaction */
export interface ReactionMessage {
  version: typeof PROTOCOL_VERSION;
  type: "REACTION";
  emoji: string;
}

/**
 * Server → Client: sanitized chat line broadcast to the room.
 * User-derived fields are plain strings (NFR48). Story 6A.2 UI must render with `{{ }}` only — never `v-html` for message body.
 */
export interface ChatBroadcast {
  version: typeof PROTOCOL_VERSION;
  type: "CHAT_BROADCAST";
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

/** Server → Client: recent chat lines on join / reconnect / state resync (Story 6A.4). */
export interface ChatHistoryMessage {
  version: typeof PROTOCOL_VERSION;
  type: "CHAT_HISTORY";
  messages: readonly ChatBroadcast[];
}

/**
 * Server → Client: reaction broadcast (live-only; not stored in history).
 * User-derived fields are plain strings (NFR48). Story 6A.2 must not use `v-html` for emoji.
 */
export interface ReactionBroadcast {
  version: typeof PROTOCOL_VERSION;
  type: "REACTION_BROADCAST";
  playerId: string;
  playerName: string;
  emoji: string;
  timestamp: number;
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
  jokerRulesMode: JokerRulesMode;
  readonly settings: RoomSettings;
}

/** Safe Charleston metadata shared with all viewers */
export interface PublicCharlestonView {
  stage: CharlestonStage;
  status: CharlestonStatus;
  currentDirection: CharlestonDirection | null;
  activePlayerIds: string[];
  submittedPlayerIds: string[];
  votesReceivedCount: number;
  courtesyPairings: readonly CharlestonPairing[];
  courtesyResolvedPairCount: number;
}

/** Per-player Charleston metadata that never exposes hidden tile identities */
export interface PlayerCharlestonView extends PublicCharlestonView {
  myHiddenTileCount: number;
  mySubmissionLocked: boolean;
  myVote: boolean | null;
  myCourtesySubmission: {
    count: number;
    tileIds: string[];
  } | null;
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
  /** Cumulative scores from games already completed this room session (Story 5B.4) */
  sessionScoresFromPriorGames: Record<string, number>;
  /** Completed games this session (Story 5B.4) */
  sessionGameHistory: readonly SessionGameHistoryEntry[];
  lastDiscard: { tile: Tile; discarderId: string } | null;
  gameResult: GameResult | null;
  pendingMahjong: PendingMahjongState | null;
  challengeState: ChallengeState | null;
  socialOverrideState: SocialOverrideState | null;
  tableTalkReportState: TableTalkReportState | null;
  tableTalkReportCountsByPlayerId: Record<string, number>;
  charleston: PlayerCharlestonView | null;
  shownHands: Record<string, Tile[]>;
  jokerRulesMode: JokerRulesMode;
  readonly settings: RoomSettings;
  /** True when this viewer's hand is dead — private; opponents have no per-seat dead flag */
  myDeadHand: boolean;
  /** Room-level pause (simultaneous disconnect) — orthogonal to {@link GamePhase} */
  paused: boolean;
  pauseReason?: "simultaneous-disconnect";
  /** Players marked dead-seat by AFK vote (Story 4B.4) — empty when none */
  deadSeatPlayerIds: readonly string[];
  /**
   * Active departure vote targeting a player who left mid-game (Story 4B.5).
   * Required (never omitted) so mid-vote reconnecters can immediately see and participate.
   * Asymmetry from AFK vote: AFK vote state is NOT threaded into PlayerGameView (4B.4 precedent),
   * but departure vote IS — because reconnecters need to cast a departure vote within the window.
   * Populated by buildPlayerView in Task 7; always null until then.
   */
  departureVoteState: {
    targetPlayerId: string;
    targetPlayerName: string;
    expiresAt: number;
  } | null;
  /** Host-only audit log (FR88) — omitted for non-host clients */
  hostAuditLog?: string[];
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
  socialOverrideState: SocialOverrideState | null;
  tableTalkReportState: TableTalkReportState | null;
  tableTalkReportCountsByPlayerId: Record<string, number>;
  charleston: SpectatorCharlestonView | null;
  shownHands: Record<string, Tile[]>;
  jokerRulesMode: JokerRulesMode;
  readonly settings: RoomSettings;
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

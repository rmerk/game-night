import type { Tile } from "./tiles";
import type { GroupType, NMJLCard } from "./card";
import type { RoomSettings } from "./room-settings";

/** Game-level phase */
export type GamePhase = "lobby" | "charleston" | "play" | "scoreboard" | "rematch";

/** Joker rules mode for the match — set at game start, immutable until rematch */
export type JokerRulesMode = "standard" | "simplified";

/** Turn-level phase within active play */
export type TurnPhase = "draw" | "discard" | "callWindow";

/** Seat wind assignment (counterclockwise play order) */
export type SeatWind = "east" | "south" | "west" | "north";

/** Identity of an exposed group — fixed at exposure time, never changes */
export interface GroupIdentity {
  readonly type: GroupType;
  readonly suit?: string;
  readonly value?: number | string;
  readonly wind?: string;
  readonly dragon?: string;
}

/** How an exposed meld was formed (Story 3C.7). */
export type ExposureSource = "call" | "wall";

/**
 * Exposed group on a player's table — populated in Epic 3A when groups are called.
 *
 * `exposureSource`: when omitted, {@link getExposureSource} treats the group as
 * `"call"` (discard-call confirmation) for backward compatibility with pre-3C.7
 * state and tests that omit the field.
 */
export interface ExposedGroup {
  readonly type: GroupType;
  readonly tiles: Tile[];
  readonly identity: GroupIdentity;
  /** Discard-call vs wall/other non-call exposure; defaults to `"call"` when omitted. */
  readonly exposureSource?: ExposureSource;
}

/** Resolved exposure provenance — missing field defaults to `"call"`. */
export function getExposureSource(eg: ExposedGroup): ExposureSource {
  return eg.exposureSource ?? "call";
}

/** Per-player state within a game */
export interface PlayerState {
  readonly id: string;
  readonly seatWind: SeatWind;
  readonly rack: Tile[];
  readonly exposedGroups: ExposedGroup[];
  readonly discardPool: Tile[];
  deadHand: boolean;
}

/** Result of a wall game (draw) — no winner, no payments */
export interface WallGameResult {
  readonly winnerId: null;
  readonly points: 0;
}

/** Per-player payment amounts — positive = receives, negative = pays */
export type PaymentBreakdown = Record<string, number>;

/** Result of a Mahjong win — winner, matched pattern, and payment distribution */
export interface MahjongGameResult {
  readonly winnerId: string;
  readonly patternId: string;
  readonly patternName: string;
  readonly points: number;
  readonly selfDrawn: boolean;
  readonly discarderId?: string;
  readonly calledTile?: Tile;
  readonly payments: PaymentBreakdown;
}

/** Game result — wall game (draw) or Mahjong win */
export type GameResult = WallGameResult | MahjongGameResult;

/** Types of group calls (same-tile, pattern-defined, and mahjong) */
export type CallType = "pung" | "kong" | "quint" | "news" | "dragon_set" | "mahjong";

/** A recorded call in the call window buffer */
export interface CallRecord {
  readonly callType: CallType;
  readonly playerId: string;
  readonly tileIds: string[];
}

/** Call window state — opened after each discard to allow other players to call the tile */
export interface CallWindowState {
  status: "open" | "frozen" | "confirming";
  readonly discardedTile: Tile;
  readonly discarderId: string;
  readonly passes: string[];
  readonly calls: CallRecord[];
  readonly openedAt: number;
  /** Player currently in confirmation phase (set when status is "confirming") */
  confirmingPlayerId: string | null;
  /** Timestamp when confirmation timer expires (set when status is "confirming") */
  confirmationExpiresAt: number | null;
  /** Remaining callers sorted by priority, consumed on retraction fallback */
  remainingCallers: CallRecord[];
  /** The winning call being confirmed */
  winningCall: CallRecord | null;
}

/** State tracking an in-progress invalid Mahjong declaration waiting for cancel/confirm */
export interface PendingMahjongState {
  readonly playerId: string;
  readonly path: "self-drawn" | "discard";
  readonly previousTurnPhase: TurnPhase;
  readonly previousCallWindow: CallWindowState | null;
}

/** State tracking an active challenge vote on a validated Mahjong */
export interface ChallengeState {
  readonly challengerId: string;
  readonly winnerId: string;
  votes: Record<string, "valid" | "invalid">;
  readonly challengeExpiresAt: number;
  readonly originalGameResult: MahjongGameResult;
  readonly calledTile: Tile | null;
}

/** Unanimous vote to undo an accidental discard (Story 3C.4) */
export interface SocialOverrideState {
  readonly requesterId: string;
  readonly description: string;
  readonly expiresAt: number;
  /** Tile to return to the requester's rack (matches last discard) */
  readonly discardedTileId: string;
  /** Only non-requesting players may vote */
  votes: Record<string, "approve" | "deny">;
}

/** Majority vote (2/3) on a table-talk report — dead hand on reported if upheld (Story 3C.5) */
export interface TableTalkReportState {
  readonly reporterId: string;
  readonly reportedPlayerId: string;
  readonly description: string;
  readonly expiresAt: number;
  /** The three non-reporters (includes reported — they may vote deny) */
  readonly voterIds: readonly string[];
  votes: Record<string, "approve" | "deny">;
}

/** Server schedules this duration; shared defines the constant */
export const SOCIAL_OVERRIDE_TIMEOUT_SECONDS = 10;

/** Timeout constant for challenge vote (server schedules the timer) */
export const CHALLENGE_TIMEOUT_SECONDS = 30;

/** Charleston pass order within a round */
export type CharlestonDirection = "right" | "across" | "left";

/** Current Charleston round */
export type CharlestonStage = "first" | "second" | "courtesy";

/** Charleston lifecycle state */
export type CharlestonStatus = "passing" | "vote-ready" | "courtesy-ready";

/** Player pair that will negotiate the courtesy pass */
export type CharlestonPairing = readonly [string, string];

/** A player's courtesy request before the pair resolves */
export interface CourtesySubmission {
  readonly count: number;
  readonly tileIds: readonly string[];
}

/** Internal Charleston engine state */
export interface CharlestonState {
  stage: CharlestonStage;
  status: CharlestonStatus;
  currentDirection: CharlestonDirection | null;
  readonly activePlayerIds: string[];
  submittedPlayerIds: string[];
  lockedTileIdsByPlayerId: Partial<Record<string, readonly string[]>>;
  hiddenAcrossTilesByPlayerId: Partial<Record<string, Tile[]>>;
  votesByPlayerId: Partial<Record<string, boolean>>;
  courtesyPairings: readonly CharlestonPairing[];
  courtesySubmissionsByPlayerId: Partial<Record<string, CourtesySubmission>>;
  courtesyResolvedPairings: readonly CharlestonPairing[];
}

/** Complete game state — mutated in-place by action handlers via validate-then-mutate pattern */
export interface GameState {
  gamePhase: GamePhase;
  players: Record<string, PlayerState>;
  wall: Tile[];
  wallRemaining: number;
  currentTurn: string;
  turnPhase: TurnPhase;
  lastDiscard: { tile: Tile; discarderId: string } | null;
  callWindow: CallWindowState | null;
  scores: Record<string, number>;
  gameResult: GameResult | null;
  /** NMJL card data — loaded at game start, immutable for the session */
  card: NMJLCard | null;
  /** Tracks an in-progress invalid Mahjong declaration waiting for cancel/confirm */
  pendingMahjong: PendingMahjongState | null;
  /** Tracks an active challenge vote on a validated Mahjong */
  challengeState: ChallengeState | null;
  /** Pending social override vote (discard undo) — blocks call-window actions until resolved */
  socialOverrideState: SocialOverrideState | null;
  /** Pending table-talk report vote (majority 2/3) — blocks call-window actions until resolved */
  tableTalkReportState: TableTalkReportState | null;
  /** Completed table-talk submissions per reporter this game (denied outcomes count toward FR83 limit) */
  tableTalkReportCountsByPlayerId: Record<string, number>;
  /** Host-visible audit lines (append-only) */
  hostAuditLog: string[];
  /** Tracks Charleston pass sequencing and blind-pass visibility */
  charleston: CharlestonState | null;
  /** Hands voluntarily shown during scoreboard phase — playerId → rack tiles */
  shownHands: Record<string, Tile[]>;
  /** Joker exchange and related rules — fixed for the match at START_GAME */
  jokerRulesMode: JokerRulesMode;
}

/** One completed game in a room session (Story 5B.4) — server merges on rematch / end session */
export interface SessionGameHistoryEntry {
  readonly gameNumber: number;
  readonly finalScores: Record<string, number>;
  readonly gameResult: GameResult | null;
}

/** Result of processing a game action */
export interface ActionResult {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly resolved?: ResolvedAction;
}

/** Describes what happened after a successful action */
export type ResolvedAction =
  | { readonly type: "PLAYER_JOINED"; readonly playerId: string; readonly playerName: string }
  | {
      readonly type: "PLAYER_RECONNECTING";
      readonly playerId: string;
      readonly playerName: string;
    }
  | { readonly type: "PLAYER_RECONNECTED"; readonly playerId: string; readonly playerName: string }
  | { readonly type: "GAME_STARTED" }
  | {
      readonly type: "CHARLESTON_PHASE_COMPLETE";
      readonly direction: CharlestonDirection;
      readonly nextDirection: CharlestonDirection | null;
      readonly stage: CharlestonStage;
      readonly status: CharlestonStatus;
    }
  | {
      readonly type: "CHARLESTON_VOTE_CAST";
      readonly votesReceivedCount: number;
    }
  | {
      readonly type: "CHARLESTON_VOTE_RESOLVED";
      readonly outcome: "accepted" | "rejected";
      readonly nextDirection: CharlestonDirection | null;
      readonly stage: CharlestonStage;
      readonly status: CharlestonStatus;
    }
  | {
      readonly type: "COURTESY_PASS_LOCKED";
      readonly playerId: string;
      readonly pairing: CharlestonPairing;
    }
  | {
      readonly type: "COURTESY_PAIR_RESOLVED";
      readonly pairing: CharlestonPairing;
      readonly playerRequests: Record<string, number>;
      readonly appliedCount: number;
      readonly entersPlay: boolean;
    }
  | { readonly type: "DRAW_TILE"; readonly playerId: string }
  | { readonly type: "DISCARD_TILE"; readonly playerId: string; readonly tileId: string }
  | {
      readonly type: "JOKER_EXCHANGE";
      readonly playerId: string;
      readonly jokerGroupId: string;
      readonly jokerTileId: string;
      readonly naturalTileId: string;
    }
  | { readonly type: "WALL_GAME" }
  | {
      readonly type: "CALL_WINDOW_OPENED";
      readonly discarderId: string;
      readonly discardedTileId: string;
    }
  | { readonly type: "CALL_WINDOW_CLOSED"; readonly reason: "all_passed" | "timer_expired" }
  | { readonly type: "PASS_CALL"; readonly playerId: string }
  | { readonly type: "CALL_PUNG"; readonly playerId: string }
  | { readonly type: "CALL_KONG"; readonly playerId: string }
  | { readonly type: "CALL_QUINT"; readonly playerId: string }
  | { readonly type: "CALL_NEWS"; readonly playerId: string }
  | { readonly type: "CALL_DRAGON_SET"; readonly playerId: string }
  | { readonly type: "CALL_WINDOW_FROZEN"; readonly callerId: string }
  | {
      readonly type: "CALL_RESOLVED";
      readonly winningCall: CallRecord;
      readonly losingCallerIds: string[];
    }
  | {
      readonly type: "CALL_CONFIRMATION_STARTED";
      readonly callerId: string;
      readonly callType: CallType;
      readonly timerDuration: number;
    }
  | {
      readonly type: "CALL_CONFIRMED";
      readonly callerId: string;
      readonly callType: CallType;
      readonly exposedTileIds: string[];
      readonly calledTileId: string;
      readonly fromPlayerId: string;
      readonly groupIdentity: GroupIdentity;
    }
  | {
      readonly type: "CALL_RETRACTED";
      readonly callerId: string;
      readonly reason: string;
      readonly nextCallerId?: string;
    }
  | {
      readonly type: "CALL_WINDOW_RESUMED";
      readonly remainingTime: number;
    }
  | { readonly type: "CALL_MAHJONG"; readonly playerId: string }
  | {
      readonly type: "MAHJONG_DECLARED";
      readonly winnerId: string;
      readonly patternId: string;
      readonly patternName: string;
      readonly points: number;
      readonly selfDrawn: boolean;
      readonly discarderId?: string;
    }
  | { readonly type: "INVALID_MAHJONG_WARNING"; readonly playerId: string; readonly reason: string }
  | { readonly type: "MAHJONG_CANCELLED"; readonly playerId: string }
  | { readonly type: "DEAD_HAND_ENFORCED"; readonly playerId: string; readonly reason: string }
  | {
      readonly type: "CHALLENGE_INITIATED";
      readonly challengerId: string;
      readonly winnerId: string;
    }
  | {
      readonly type: "CHALLENGE_VOTE_CAST";
      readonly playerId: string;
      readonly vote: "valid" | "invalid";
    }
  | {
      readonly type: "CHALLENGE_RESOLVED";
      readonly outcome: "upheld" | "overturned";
      readonly votes: Record<string, "valid" | "invalid">;
    }
  | {
      readonly type: "SOCIAL_OVERRIDE_REQUESTED";
      readonly requesterId: string;
      readonly description: string;
    }
  | {
      readonly type: "SOCIAL_OVERRIDE_VOTE_CAST";
      readonly playerId: string;
      readonly vote: "approve" | "deny";
    }
  | {
      readonly type: "SOCIAL_OVERRIDE_RESOLVED";
      readonly outcome: "applied" | "rejected";
      readonly requesterId: string;
    }
  | {
      readonly type: "TABLE_TALK_REPORT_SUBMITTED";
      readonly reporterId: string;
      readonly reportedPlayerId: string;
      readonly description: string;
    }
  | {
      readonly type: "TABLE_TALK_VOTE_CAST";
      readonly playerId: string;
      readonly vote: "approve" | "deny";
    }
  | {
      readonly type: "TABLE_TALK_REPORT_RESOLVED";
      readonly outcome: "upheld" | "denied";
      readonly reporterId: string;
      readonly reportedPlayerId: string;
    }
  | {
      readonly type: "GAME_PAUSED";
      readonly disconnectedPlayerIds: readonly string[];
      readonly reason: "simultaneous-disconnect";
    }
  | { readonly type: "GAME_RESUMED" }
  | { readonly type: "GAME_ABANDONED"; readonly reason: "pause-timeout" | "player-departure" }
  | { readonly type: "HAND_SHOWN"; readonly playerId: string }
  | {
      readonly type: "TURN_TIMER_NUDGE";
      readonly playerId: string;
      readonly expiresAt: number;
    }
  | {
      readonly type: "TURN_TIMEOUT_AUTO_DISCARD";
      readonly playerId: string;
      readonly tileId: string;
    }
  | {
      readonly type: "AFK_VOTE_STARTED";
      readonly targetPlayerId: string;
      readonly expiresAt: number;
    }
  | {
      readonly type: "AFK_VOTE_CAST";
      readonly voterId: string;
      readonly targetPlayerId: string;
      readonly vote: "approve" | "deny";
    }
  | {
      readonly type: "AFK_VOTE_RESOLVED";
      readonly targetPlayerId: string;
      readonly outcome: "passed" | "failed" | "cancelled";
    }
  | { readonly type: "PLAYER_DEPARTED"; readonly playerId: string; readonly playerName: string }
  | {
      readonly type: "DEPARTURE_VOTE_STARTED";
      readonly targetPlayerId: string;
      readonly targetPlayerName: string;
      readonly expiresAt: number;
    }
  | {
      readonly type: "DEPARTURE_VOTE_CAST";
      readonly voterId: string;
      readonly targetPlayerId: string;
      readonly choice: "dead_seat" | "end_game";
    }
  | {
      readonly type: "DEPARTURE_VOTE_RESOLVED";
      readonly targetPlayerId: string;
      readonly outcome: "dead_seat" | "end_game" | "cancelled";
    }
  | {
      readonly type: "PLAYER_CONVERTED_TO_DEAD_SEAT";
      readonly playerId: string;
      readonly playerName: string;
    }
  | { readonly type: "TURN_SKIPPED_DEAD_SEAT"; readonly playerId: string }
  | {
      readonly type: "HOST_PROMOTED";
      readonly previousHostId: string | null;
      readonly newHostId: string;
      readonly newHostName: string;
    }
  | {
      readonly type: "ROOM_SETTINGS_CHANGED";
      readonly changedBy: string;
      readonly changedByName: string;
      readonly previous: RoomSettings;
      readonly next: RoomSettings;
      readonly changedKeys: readonly (keyof RoomSettings)[];
    }
  | {
      readonly type: "REMATCH_WAITING_FOR_PLAYERS";
      readonly missingSeats: number;
    }
  | {
      readonly type: "SESSION_ENDED";
      readonly sessionTotals: Record<string, number>;
      readonly sessionGameHistory: readonly SessionGameHistoryEntry[];
    };

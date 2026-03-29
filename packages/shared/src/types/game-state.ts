import type { Tile } from "./tiles";
import type { GroupType, NMJLCard } from "./card";

/** Game-level phase */
export type GamePhase = "lobby" | "charleston" | "play" | "scoreboard" | "rematch";

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

/** Exposed group on a player's table — populated in Epic 3A when groups are called */
export interface ExposedGroup {
  readonly type: GroupType;
  readonly tiles: Tile[];
  readonly identity: GroupIdentity;
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

/** Timeout constant for challenge vote (server schedules the timer) */
export const CHALLENGE_TIMEOUT_SECONDS = 30;

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
  /** Hands voluntarily shown during scoreboard phase — playerId → rack tiles */
  shownHands: Record<string, Tile[]>;
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
  | { readonly type: "PLAYER_RECONNECTED"; readonly playerId: string; readonly playerName: string }
  | { readonly type: "GAME_STARTED" }
  | { readonly type: "DRAW_TILE"; readonly playerId: string }
  | { readonly type: "DISCARD_TILE"; readonly playerId: string; readonly tileId: string }
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
  | { readonly type: "HAND_SHOWN"; readonly playerId: string };

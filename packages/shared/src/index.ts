// Types
export type {
  Tile,
  TileId,
  TileSuit,
  TileCategory,
  TileValue,
  WindValue,
  DragonValue,
  FlowerValue,
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
} from "./types/tiles";

export type {
  GameState,
  GamePhase,
  TurnPhase,
  SeatWind,
  PlayerState,
  ExposedGroup,
  GroupIdentity,
  CallWindowState,
  CallType,
  CallRecord,
  ActionResult,
  ResolvedAction,
  WallGameResult,
  MahjongGameResult,
  PaymentBreakdown,
  GameResult,
  PendingMahjongState,
  ChallengeState,
} from "./types/game-state";

export { CHALLENGE_TIMEOUT_SECONDS } from "./types/game-state";

export type {
  GameAction,
  StartGameAction,
  DrawTileAction,
  DiscardTileAction,
  PassCallAction,
  CallPungAction,
  CallKongAction,
  CallQuintAction,
  CallNewsAction,
  CallDragonSetAction,
  CallMahjongAction,
  DeclareMahjongAction,
  ConfirmCallAction,
  RetractCallAction,
  CancelMahjongAction,
  ConfirmInvalidMahjongAction,
  ChallengeMahjongAction,
  ChallengeVoteAction,
} from "./types/actions";

export type {
  NMJLCard,
  CardCategory,
  HandPattern,
  GroupPattern,
  GroupType,
  TileRequirement,
  TileSpecific,
} from "./types/card";

export type {
  ServerErrorMessage,
  JoinRoomMessage,
  PlayerPublicInfo,
  LobbyState,
  StateUpdateMessage,
  SystemEventMessage,
} from "./types/protocol";
export { PROTOCOL_VERSION } from "./types/protocol";

// Constants
export {
  TILE_COUNT,
  JOKER_COUNT,
  COPIES_PER_TILE,
  COPIES_PER_FLOWER,
  MAX_PLAYERS,
  SEATS,
  SUITS,
  WINDS,
  DRAGONS,
  FLOWERS,
  TILE_VALUES,
  GROUP_TYPES,
  GROUP_SIZES,
  DEFAULT_CALL_WINDOW_MS,
  MIN_CALL_WINDOW_MS,
  MAX_CALL_WINDOW_MS,
} from "./constants";

// Card
export { loadCard } from "./card/card-loader";
export { validateHand } from "./card/pattern-matcher";
export type { MatchResult } from "./card/pattern-matcher";
export {
  isJokerEligibleGroup,
  canSubstituteJoker,
  validateJokerExchange,
} from "./card/joker-eligibility";
export type { ExchangeResult } from "./card/joker-eligibility";
export {
  validateExposure,
  validateHandWithExposure,
  filterAchievableByExposure,
} from "./card/exposure-validation";
export type { ExposureResult } from "./card/exposure-validation";

// Scoring
export { calculatePayments, calculateWallGamePayments, lookupHandPoints } from "./engine/scoring";
export type { CalculatePaymentsParams, ScoringResult } from "./engine/scoring";

// Engine
export { createAllTiles, createWall } from "./engine/state/wall";
export { dealTiles } from "./engine/state/dealing";
export { createGame } from "./engine/state/create-game";
export { createLobbyState, handleAction } from "./engine/game-engine";
export { handleDrawTile, advanceTurn } from "./engine/actions/draw";
export { handleDiscardTile } from "./engine/actions/discard";
export {
  handlePassCall,
  closeCallWindow,
  handleCallAction,
  handleCallMahjong,
  tilesMatch,
  isPatternDefinedCall,
  validateNewsGroup,
  validateDragonSetGroup,
  getValidCallOptions,
  getSeatDistance,
  resolveCallPriority,
  resolveCallWindow,
  enterConfirmationPhase,
  handleConfirmCall,
  handleRetractCall,
  handleConfirmationTimeout,
  handleRetraction,
  CONFIRMATION_TIMER_MS,
} from "./engine/actions/call-window";

export {
  handleDeclareMahjong,
  confirmMahjongCall,
  handleCancelMahjong,
  handleConfirmInvalidMahjong,
} from "./engine/actions/mahjong";

export { handleChallengeMahjong, handleChallengeVote } from "./engine/actions/challenge";

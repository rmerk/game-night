import type { CallType, ResolvedAction } from "@mahjong-game/shared";
import { tileIdToTickerLabel } from "./tileIdTickerLabel";

function displayName(
  playerId: string,
  localPlayerId: string,
  playerNamesById: Record<string, string>,
): string {
  if (localPlayerId !== "" && playerId === localPlayerId) {
    return "You";
  }
  return playerNamesById[playerId] ?? playerId;
}

function callTypeCalledPhrase(callType: CallType): string {
  switch (callType) {
    case "pung":
      return "Pung";
    case "kong":
      return "Kong";
    case "quint":
      return "Quint";
    case "news":
      return "NEWS";
    case "dragon_set":
      return "Dragon Set";
    case "mahjong":
      return "Mahjong";
  }
}

/**
 * Compressed one-line copy for the activity ticker, or `null` when the event should not appear.
 */
export function tickerCopyForAction(
  ra: ResolvedAction,
  playerNamesById: Record<string, string>,
  localPlayerId: string,
): string | null {
  switch (ra.type) {
    case "DRAW_TILE": {
      const name = displayName(ra.playerId, localPlayerId, playerNamesById);
      return `${name} drew`;
    }
    case "DISCARD_TILE": {
      const name = displayName(ra.playerId, localPlayerId, playerNamesById);
      const label = tileIdToTickerLabel(ra.tileId);
      return `${name} discarded ${label}`;
    }
    case "CALL_PUNG": {
      const name = displayName(ra.playerId, localPlayerId, playerNamesById);
      return `${name} called Pung`;
    }
    case "CALL_KONG": {
      const name = displayName(ra.playerId, localPlayerId, playerNamesById);
      return `${name} called Kong`;
    }
    case "CALL_QUINT": {
      const name = displayName(ra.playerId, localPlayerId, playerNamesById);
      return `${name} called Quint`;
    }
    case "CALL_NEWS": {
      const name = displayName(ra.playerId, localPlayerId, playerNamesById);
      return `${name} called NEWS`;
    }
    case "CALL_DRAGON_SET": {
      const name = displayName(ra.playerId, localPlayerId, playerNamesById);
      return `${name} called Dragon Set`;
    }
    case "CALL_CONFIRMED": {
      const name = displayName(ra.callerId, localPlayerId, playerNamesById);
      return `${name} exposed ${callTypeCalledPhrase(ra.callType)}`;
    }
    case "JOKER_EXCHANGE": {
      const name = displayName(ra.playerId, localPlayerId, playerNamesById);
      return `${name} exchanged a joker`;
    }
    case "MAHJONG_DECLARED": {
      const name = displayName(ra.winnerId, localPlayerId, playerNamesById);
      return `${name} declared Mahjong!`;
    }
    case "WALL_GAME":
      return "Wall game — no winner";

    case "PLAYER_JOINED":
    case "PLAYER_RECONNECTING":
    case "PLAYER_RECONNECTED":
    case "GAME_STARTED":
    case "CHARLESTON_PHASE_COMPLETE":
    case "CHARLESTON_VOTE_CAST":
    case "CHARLESTON_VOTE_RESOLVED":
    case "COURTESY_PASS_LOCKED":
    case "COURTESY_PAIR_RESOLVED":
    case "CALL_WINDOW_OPENED":
    case "CALL_WINDOW_CLOSED":
    case "PASS_CALL":
    case "CALL_WINDOW_FROZEN":
    case "CALL_RESOLVED":
    case "CALL_CONFIRMATION_STARTED":
    case "CALL_RETRACTED":
    case "CALL_WINDOW_RESUMED":
    case "CALL_MAHJONG":
    case "INVALID_MAHJONG_WARNING":
    case "MAHJONG_CANCELLED":
    case "DEAD_HAND_ENFORCED":
    case "CHALLENGE_INITIATED":
    case "CHALLENGE_VOTE_CAST":
    case "CHALLENGE_RESOLVED":
    case "SOCIAL_OVERRIDE_REQUESTED":
    case "SOCIAL_OVERRIDE_VOTE_CAST":
    case "SOCIAL_OVERRIDE_RESOLVED":
    case "TABLE_TALK_REPORT_SUBMITTED":
    case "TABLE_TALK_VOTE_CAST":
    case "TABLE_TALK_REPORT_RESOLVED":
    case "GAME_PAUSED":
    case "GAME_RESUMED":
    case "GAME_ABANDONED":
    case "HAND_SHOWN":
    case "TURN_TIMER_NUDGE":
    case "TURN_TIMEOUT_AUTO_DISCARD":
    case "AFK_VOTE_STARTED":
    case "AFK_VOTE_CAST":
    case "AFK_VOTE_RESOLVED":
    case "PLAYER_DEPARTED":
    case "DEPARTURE_VOTE_STARTED":
    case "DEPARTURE_VOTE_CAST":
    case "DEPARTURE_VOTE_RESOLVED":
    case "PLAYER_CONVERTED_TO_DEAD_SEAT":
    case "TURN_SKIPPED_DEAD_SEAT":
    case "HOST_PROMOTED":
    case "ROOM_SETTINGS_CHANGED":
    case "REMATCH_WAITING_FOR_PLAYERS":
    case "SESSION_ENDED":
      return null;
  }
}

import type { GameState, ActionResult } from "../../types/game-state";
import { SOCIAL_OVERRIDE_TIMEOUT_SECONDS } from "../../types/game-state";
import type { SocialOverrideRequestAction, SocialOverrideVoteAction } from "../../types/actions";
import { MAX_PLAYERS } from "../../constants";

const MAX_DESCRIPTION_LEN = 280;

function voterIds(state: GameState, requesterId: string): string[] {
  return Object.keys(state.players).filter((id) => id !== requesterId);
}

function pushHostLog(state: GameState, line: string): void {
  state.hostAuditLog.push(line);
}

/**
 * Discarder requests undo — only while call window is open with no calls recorded yet.
 */
export function handleSocialOverrideRequest(
  state: GameState,
  action: SocialOverrideRequestAction,
): ActionResult {
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (state.socialOverrideState) {
    return { accepted: false, reason: "SOCIAL_OVERRIDE_ALREADY_ACTIVE" };
  }
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }
  if (state.callWindow.status !== "open") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_ELIGIBLE" };
  }
  if (state.callWindow.calls.length > 0) {
    return { accepted: false, reason: "CALL_WINDOW_NOT_ELIGIBLE" };
  }
  if (state.callWindow.discarderId !== action.playerId) {
    return { accepted: false, reason: "NOT_DISCARDER" };
  }
  const requester = state.players[action.playerId];
  if (!requester) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }
  if (requester.deadHand) {
    return { accepted: false, reason: "DEAD_HAND_CANNOT_REQUEST" };
  }
  const desc = action.description.trim();
  if (desc.length === 0) {
    return { accepted: false, reason: "DESCRIPTION_REQUIRED" };
  }
  if (desc.length > MAX_DESCRIPTION_LEN) {
    return { accepted: false, reason: "DESCRIPTION_TOO_LONG" };
  }
  const tileId = state.lastDiscard?.tile.id;
  if (!tileId || tileId !== state.callWindow.discardedTile.id) {
    return { accepted: false, reason: "NO_MATCHING_DISCARD" };
  }

  const expiresAt = Date.now() + SOCIAL_OVERRIDE_TIMEOUT_SECONDS * 1000;
  state.socialOverrideState = {
    requesterId: action.playerId,
    description: desc,
    expiresAt,
    discardedTileId: tileId,
    votes: {},
  };

  pushHostLog(
    state,
    `[Social Override] Request from ${action.playerId}: ${desc.replace(/\s+/g, " ").slice(0, 120)}`,
  );

  return {
    accepted: true,
    resolved: {
      type: "SOCIAL_OVERRIDE_REQUESTED",
      requesterId: action.playerId,
      description: desc,
    },
  };
}

function clearOverride(
  state: GameState,
  outcome: "applied" | "rejected",
  requesterId: string,
): void {
  state.socialOverrideState = null;
  pushHostLog(state, `[Social Override] ${outcome} for ${requesterId}`);
}

function applyDiscardUndo(state: GameState, requesterId: string, discardedTileId: string): void {
  const requester = state.players[requesterId];
  if (!requester) throw new Error("applyDiscardUndo: requester missing");
  const poolIdx = requester.discardPool.findIndex((t) => t.id === discardedTileId);
  if (poolIdx === -1) {
    throw new Error("applyDiscardUndo: tile not in discard pool");
  }
  const [tile] = requester.discardPool.splice(poolIdx, 1);
  requester.rack.push(tile);
  state.lastDiscard = null;
  state.callWindow = null;
  state.turnPhase = "discard";
  state.currentTurn = requesterId;
}

/**
 * Non-requesting player approves or denies. Any deny ends immediately.
 * Unanimous approve (3/3) applies undo.
 */
export function handleSocialOverrideVote(
  state: GameState,
  action: SocialOverrideVoteAction,
): ActionResult {
  const pending = state.socialOverrideState;
  if (!pending) {
    return { accepted: false, reason: "NO_SOCIAL_OVERRIDE_ACTIVE" };
  }
  if (action.playerId === pending.requesterId) {
    return { accepted: false, reason: "REQUESTER_CANNOT_VOTE" };
  }
  const voters = voterIds(state, pending.requesterId);
  if (!voters.includes(action.playerId)) {
    return { accepted: false, reason: "NOT_A_VOTER" };
  }
  if (pending.votes[action.playerId] !== undefined) {
    return { accepted: false, reason: "ALREADY_VOTED" };
  }

  const vote: "approve" | "deny" = action.approve ? "approve" : "deny";
  pending.votes[action.playerId] = vote;

  if (vote === "deny") {
    const rid = pending.requesterId;
    clearOverride(state, "rejected", rid);
    return {
      accepted: true,
      resolved: {
        type: "SOCIAL_OVERRIDE_RESOLVED",
        outcome: "rejected",
        requesterId: rid,
      },
    };
  }

  const approveCount = Object.values(pending.votes).filter((v) => v === "approve").length;
  if (approveCount === MAX_PLAYERS - 1) {
    const rid = pending.requesterId;
    const tileId = pending.discardedTileId;
    clearOverride(state, "applied", rid);
    applyDiscardUndo(state, rid, tileId);
    return {
      accepted: true,
      resolved: {
        type: "SOCIAL_OVERRIDE_RESOLVED",
        outcome: "applied",
        requesterId: rid,
      },
    };
  }

  return {
    accepted: true,
    resolved: {
      type: "SOCIAL_OVERRIDE_VOTE_CAST",
      playerId: action.playerId,
      vote: "approve",
    },
  };
}

/**
 * Silence = deny — server calls when the vote timer expires.
 */
export function handleSocialOverrideTimeout(state: GameState): ActionResult {
  const pending = state.socialOverrideState;
  if (!pending) {
    return { accepted: false, reason: "NO_SOCIAL_OVERRIDE_ACTIVE" };
  }
  const rid = pending.requesterId;
  clearOverride(state, "rejected", rid);
  return {
    accepted: true,
    resolved: {
      type: "SOCIAL_OVERRIDE_RESOLVED",
      outcome: "rejected",
      requesterId: rid,
    },
  };
}

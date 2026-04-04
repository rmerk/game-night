import type { GameState, ActionResult } from "../../types/game-state";
import { SOCIAL_OVERRIDE_TIMEOUT_SECONDS } from "../../types/game-state";
import type { TableTalkReportAction, TableTalkVoteAction } from "../../types/actions";
import { MAX_PLAYERS } from "../../constants";

const MAX_DESCRIPTION_LEN = 280;

function voterIds(state: GameState, reporterId: string): string[] {
  return Object.keys(state.players).filter((id) => id !== reporterId);
}

function pushHostLog(state: GameState, line: string): void {
  state.hostAuditLog.push(line);
}

function incrementReporterSubmissionCount(state: GameState, reporterId: string): void {
  const n = state.tableTalkReportCountsByPlayerId[reporterId] ?? 0;
  state.tableTalkReportCountsByPlayerId[reporterId] = n + 1;
}

function resolveReport(
  state: GameState,
  outcome: "upheld" | "denied",
  reporterId: string,
  reportedPlayerId: string,
): void {
  state.tableTalkReportState = null;
  incrementReporterSubmissionCount(state, reporterId);
  pushHostLog(
    state,
    `[Table Talk] ${outcome} — reporter ${reporterId}, reported ${reportedPlayerId}`,
  );
}

/**
 * Submit a table-talk report — three non-reporters vote; 2/3 approve upholds (dead hand on reported).
 */
export function handleTableTalkReport(
  state: GameState,
  action: TableTalkReportAction,
): ActionResult {
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (state.socialOverrideState) {
    return { accepted: false, reason: "SOCIAL_OVERRIDE_PENDING" };
  }
  if (state.challengeState) {
    return { accepted: false, reason: "CHALLENGE_PENDING" };
  }
  if (state.tableTalkReportState) {
    return { accepted: false, reason: "TABLE_TALK_ALREADY_ACTIVE" };
  }

  const used = state.tableTalkReportCountsByPlayerId[action.playerId] ?? 0;
  if (used >= 2) {
    return { accepted: false, reason: "REPORT_LIMIT_REACHED" };
  }

  if (action.playerId === action.reportedPlayerId) {
    return { accepted: false, reason: "INVALID_REPORTED_PLAYER" };
  }
  const reported = state.players[action.reportedPlayerId];
  if (!reported) {
    return { accepted: false, reason: "INVALID_REPORTED_PLAYER" };
  }
  const reporter = state.players[action.playerId];
  if (!reporter) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }
  if (reporter.deadHand) {
    return { accepted: false, reason: "DEAD_HAND_CANNOT_REQUEST" };
  }

  const desc = action.description.trim();
  if (desc.length === 0) {
    return { accepted: false, reason: "DESCRIPTION_REQUIRED" };
  }
  if (desc.length > MAX_DESCRIPTION_LEN) {
    return { accepted: false, reason: "DESCRIPTION_TOO_LONG" };
  }

  const voters = voterIds(state, action.playerId);
  if (voters.length !== MAX_PLAYERS - 1) {
    return { accepted: false, reason: "INVALID_VOTER_SET" };
  }

  const expiresAt = Date.now() + SOCIAL_OVERRIDE_TIMEOUT_SECONDS * 1000;
  state.tableTalkReportState = {
    reporterId: action.playerId,
    reportedPlayerId: action.reportedPlayerId,
    description: desc,
    expiresAt,
    voterIds: voters,
    votes: {},
  };

  pushHostLog(
    state,
    `[Table Talk] Report from ${action.playerId} vs ${action.reportedPlayerId}: ${desc.replace(/\s+/g, " ").slice(0, 120)}`,
  );

  return {
    accepted: true,
    resolved: {
      type: "TABLE_TALK_REPORT_SUBMITTED",
      reporterId: action.playerId,
      reportedPlayerId: action.reportedPlayerId,
      description: desc,
    },
  };
}

function tryResolveVote(state: GameState): ActionResult | null {
  const pending = state.tableTalkReportState;
  if (!pending) return null;

  const votes = pending.votes;
  const approveCount = Object.values(votes).filter((v) => v === "approve").length;
  const denyCount = Object.values(votes).filter((v) => v === "deny").length;

  if (approveCount >= 2) {
    const reported = state.players[pending.reportedPlayerId];
    if (reported) {
      reported.deadHand = true;
    }
    const rid = pending.reporterId;
    const reportedId = pending.reportedPlayerId;
    resolveReport(state, "upheld", rid, reportedId);
    return {
      accepted: true,
      resolved: {
        type: "TABLE_TALK_REPORT_RESOLVED",
        outcome: "upheld",
        reporterId: rid,
        reportedPlayerId: reportedId,
      },
    };
  }

  if (denyCount >= 2) {
    const rid = pending.reporterId;
    const reportedId = pending.reportedPlayerId;
    resolveReport(state, "denied", rid, reportedId);
    return {
      accepted: true,
      resolved: {
        type: "TABLE_TALK_REPORT_RESOLVED",
        outcome: "denied",
        reporterId: rid,
        reportedPlayerId: reportedId,
      },
    };
  }

  const totalCast = approveCount + denyCount;
  if (totalCast === pending.voterIds.length) {
    const rid = pending.reporterId;
    const reportedId = pending.reportedPlayerId;
    resolveReport(state, "denied", rid, reportedId);
    return {
      accepted: true,
      resolved: {
        type: "TABLE_TALK_REPORT_RESOLVED",
        outcome: "denied",
        reporterId: rid,
        reportedPlayerId: reportedId,
      },
    };
  }

  return null;
}

/**
 * Non-reporter votes approve/deny. Majority 2/3 approve upholds.
 */
export function handleTableTalkVote(state: GameState, action: TableTalkVoteAction): ActionResult {
  const pending = state.tableTalkReportState;
  if (!pending) {
    return { accepted: false, reason: "NO_TABLE_TALK_ACTIVE" };
  }
  if (action.playerId === pending.reporterId) {
    return { accepted: false, reason: "REPORTER_CANNOT_VOTE" };
  }
  if (!pending.voterIds.includes(action.playerId)) {
    return { accepted: false, reason: "NOT_A_VOTER" };
  }
  if (pending.votes[action.playerId] !== undefined) {
    return { accepted: false, reason: "ALREADY_VOTED" };
  }

  const vote: "approve" | "deny" = action.approve ? "approve" : "deny";
  pending.votes[action.playerId] = vote;

  const resolved = tryResolveVote(state);
  if (resolved) {
    return resolved;
  }

  return {
    accepted: true,
    resolved: {
      type: "TABLE_TALK_VOTE_CAST",
      playerId: action.playerId,
      vote,
    },
  };
}

/**
 * Timer expiry — silence counts as not upholding; deny if fewer than 2 approve.
 */
export function handleTableTalkTimeout(state: GameState): ActionResult {
  const pending = state.tableTalkReportState;
  if (!pending) {
    return { accepted: false, reason: "NO_TABLE_TALK_ACTIVE" };
  }
  const approveCount = Object.values(pending.votes).filter((v) => v === "approve").length;
  if (approveCount >= 2) {
    const reported = state.players[pending.reportedPlayerId];
    if (reported) {
      reported.deadHand = true;
    }
    const rid = pending.reporterId;
    const reportedId = pending.reportedPlayerId;
    resolveReport(state, "upheld", rid, reportedId);
    return {
      accepted: true,
      resolved: {
        type: "TABLE_TALK_REPORT_RESOLVED",
        outcome: "upheld",
        reporterId: rid,
        reportedPlayerId: reportedId,
      },
    };
  }
  const rid = pending.reporterId;
  const reportedId = pending.reportedPlayerId;
  resolveReport(state, "denied", rid, reportedId);
  return {
    accepted: true,
    resolved: {
      type: "TABLE_TALK_REPORT_RESOLVED",
      outcome: "denied",
      reporterId: rid,
      reportedPlayerId: reportedId,
    },
  };
}

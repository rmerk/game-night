import type { GameState, SessionGameHistoryEntry } from "@mahjong-game/shared";
import { SEATS, type SeatWind } from "@mahjong-game/shared";
import type { Room } from "./room";

/**
 * Merge the just-finished game's scores into room session totals and history (Story 5B.4).
 * Call when leaving scoreboard for REMATCH or END_SESSION — not while still on scoreboard.
 */
export function mergeCompletedGameIntoSession(room: Room, gameState: GameState): void {
  const prior = room.sessionHistory.scoresFromPriorGames;
  const nextPrior: Record<string, number> = { ...prior };

  for (const pid of Object.keys(gameState.players)) {
    const s = gameState.scores[pid] ?? 0;
    nextPrior[pid] = (nextPrior[pid] ?? 0) + s;
  }

  const gameNumber = room.sessionHistory.gameHistory.length + 1;
  const finalScores: Record<string, number> = {};
  for (const pid of Object.keys(gameState.players)) {
    finalScores[pid] = gameState.scores[pid] ?? 0;
  }

  const entry: SessionGameHistoryEntry = {
    gameNumber,
    finalScores,
    gameResult: gameState.gameResult,
  };

  room.sessionHistory.scoresFromPriorGames = nextPrior;
  room.sessionHistory.gameHistory = [...room.sessionHistory.gameHistory, entry];
}

/**
 * Next game's `playerIds` for START_GAME: dealer (East) rotates CCW — previous South becomes East.
 */
export function rotateDealerPlayerIdsForRematch(gameState: GameState): string[] | null {
  const bySeat: Partial<Record<SeatWind, string>> = {};
  for (const [pid, ps] of Object.entries(gameState.players)) {
    bySeat[ps.seatWind] = pid;
  }
  const ordered = SEATS.map((s) => bySeat[s]);
  const east = ordered[0];
  const south = ordered[1];
  const west = ordered[2];
  const north = ordered[3];
  if (east === undefined || south === undefined || west === undefined || north === undefined) {
    return null;
  }
  return [south, west, north, east];
}

import type { SeatWind } from "@mahjong-game/shared";

export interface OpponentPlayer {
  id: string;
  name: string;
  initial: string;
  connected: boolean;
  seatWind: SeatWind;
  score?: number | null;
}

export interface LocalPlayerSummary {
  id: string;
  name: string;
  seatWind: SeatWind;
  score: number;
}

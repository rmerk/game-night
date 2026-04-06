import type { ResolvedAction } from "@mahjong-game/shared";
import { humanLabel, humanValue } from "./roomSettingsFormatters";

/** Shared user-visible strings for `BaseToast` driven by `resolvedAction` (4B retro: one copy source). */

export function toastCopyHostPromoted(newHostName: string): string {
  return `${newHostName} is now the host`;
}

export function toastCopyRematchWaiting(missingSeats: number): string {
  const n = missingSeats;
  return `Waiting for ${n} more player${n === 1 ? "" : "s"}`;
}

export function toastCopyHandShown(playerName: string): string {
  return `${playerName} showed their hand`;
}

export function toastCopyRoomSettingsChanged(
  ra: Extract<ResolvedAction, { type: "ROOM_SETTINGS_CHANGED" }>,
): string {
  if (ra.changedKeys.length === 1) {
    const k = ra.changedKeys[0];
    return `Host changed ${humanLabel(k)} to ${humanValue(k, ra.next)}`;
  }
  return `Host updated room settings (${ra.changedKeys.length} changes)`;
}

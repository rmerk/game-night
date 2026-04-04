/**
 * Chat / reaction protocol limits (NFR46–NFR47, AR30).
 * Keep in sync with server handlers and tests.
 */
export const MAX_CHAT_LENGTH = 500;

/** Sliding window: max chat messages accepted per player per window (NFR47). */
export const CHAT_RATE_LIMIT_COUNT = 10;
export const CHAT_RATE_LIMIT_WINDOW_MS = 10_000;

/** Sliding window: max reactions per player per window (NFR47). */
export const REACTION_RATE_LIMIT_COUNT = 5;
export const REACTION_RATE_LIMIT_WINDOW_MS = 5_000;

/** Ring buffer capacity per room (AC6 / AR30). */
export const CHAT_HISTORY_CAPACITY = 100;

/**
 * Single source of truth for server validation and future reaction UI (6A.3).
 * Minimum six entries per story spec.
 */
export const REACTION_EMOJI_ALLOWLIST: readonly string[] = ["👍", "😂", "😩", "😮", "🎉", "😢"];

const reactionAllowlistSet = new Set(REACTION_EMOJI_ALLOWLIST);

export function isAllowedReactionEmoji(emoji: string): boolean {
  return reactionAllowlistSet.has(emoji);
}

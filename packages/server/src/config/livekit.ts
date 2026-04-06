import type { FastifyBaseLogger } from "fastify";

export type LiveKitConfig =
  | {
      configured: true;
      url: string;
      apiKey: string;
      apiSecret: string;
    }
  | { configured: false };

function readCompleteEnv(): { url: string; apiKey: string; apiSecret: string } | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (url && apiKey && apiSecret) {
    return { url, apiKey, apiSecret };
  }
  return null;
}

/**
 * Resolves LiveKit credentials from the environment. Never throws — callers treat
 * `configured: false` as "token unavailable" so the game WebSocket stays healthy.
 */
export function getLiveKitConfig(logger: FastifyBaseLogger): LiveKitConfig {
  const full = readCompleteEnv();
  if (full) {
    return { configured: true, ...full };
  }
  logger.warn(
    "LiveKit environment variables are not fully set; voice/video tokens will be unavailable",
  );
  return { configured: false };
}

/**
 * Run during server startup: in production, all three `LIVEKIT_*` vars are required.
 */
export function validateLiveKitEnvOnBoot(logger: FastifyBaseLogger): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (!readCompleteEnv()) {
    throw new Error(
      "LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are required when NODE_ENV=production",
    );
  }
  logger.info("LiveKit environment variables present");
}

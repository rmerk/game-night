import pino from "pino";
import type { FastifyBaseLogger } from "fastify";

/** Pino logger at silent level — valid FastifyBaseLogger for tests without assertions. */
export function createSilentTestLogger(): FastifyBaseLogger {
  return pino({ level: "silent" });
}

/** Watchdog: show degraded + Reconnect A/V if still not connected after this while game WS is open. */
export const AV_RECONNECT_WATCHDOG_MS = 10_000;

/** Manual "Reconnect A/V" attempt timeout (Promise.race with LiveKit connect). */
export const AV_MANUAL_RETRY_TIMEOUT_MS = 10_000;

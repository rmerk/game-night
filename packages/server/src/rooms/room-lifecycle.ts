import type { Room } from "./room";

export type LifecycleTimerType =
  | "disconnect-timeout"
  | "idle-timeout"
  | "abandoned-timeout"
  | "pause-timeout";

export const DEFAULT_DISCONNECT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
export const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_ABANDONED_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_PAUSE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (FR109)

let disconnectTimeoutMs = DEFAULT_DISCONNECT_TIMEOUT_MS;
let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
let abandonedTimeoutMs = DEFAULT_ABANDONED_TIMEOUT_MS;
let pauseTimeoutMs = DEFAULT_PAUSE_TIMEOUT_MS;

export function setDisconnectTimeoutMs(ms: number): void {
  disconnectTimeoutMs = ms;
}

export function setIdleTimeoutMs(ms: number): void {
  idleTimeoutMs = ms;
}

export function setAbandonedTimeoutMs(ms: number): void {
  abandonedTimeoutMs = ms;
}

export function setPauseTimeoutMs(ms: number): void {
  pauseTimeoutMs = ms;
}

function getTimeoutForType(type: LifecycleTimerType): number {
  switch (type) {
    case "disconnect-timeout":
      return disconnectTimeoutMs;
    case "idle-timeout":
      return idleTimeoutMs;
    case "abandoned-timeout":
      return abandonedTimeoutMs;
    case "pause-timeout":
      return pauseTimeoutMs;
  }
}

export function startLifecycleTimer(
  room: Room,
  type: LifecycleTimerType,
  callback: () => void,
): void {
  // Cancel existing timer of same type
  cancelLifecycleTimer(room, type);

  const timer = setTimeout(() => {
    room.lifecycleTimers.delete(type);
    callback();
  }, getTimeoutForType(type));

  room.lifecycleTimers.set(type, timer);
}

export function cancelLifecycleTimer(room: Room, type: LifecycleTimerType): void {
  const timer = room.lifecycleTimers.get(type);
  if (timer) {
    clearTimeout(timer);
    room.lifecycleTimers.delete(type);
  }
}

export function cancelAllLifecycleTimers(room: Room): void {
  for (const timer of room.lifecycleTimers.values()) {
    clearTimeout(timer);
  }
  room.lifecycleTimers.clear();
}

export function hasLifecycleTimer(room: Room, type: LifecycleTimerType): boolean {
  return room.lifecycleTimers.has(type);
}

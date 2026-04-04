const key = (roomCode: string) => `mahjong-ws-token-${roomCode.toUpperCase()}`;

export function readSessionToken(roomCode: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(key(roomCode));
}

export function writeSessionToken(roomCode: string, token: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key(roomCode), token);
}

export function clearSessionToken(roomCode: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(key(roomCode));
}

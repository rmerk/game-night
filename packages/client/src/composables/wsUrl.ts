/**
 * WebSocket URL for the game server.
 * Local dev: client (Vite) and API (Fastify + ws) run on different ports — default ws://host:3001.
 * Production: set VITE_WS_BASE_URL (e.g. wss://api.example.com).
 */
export function getWebSocketUrl(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL;
  if (typeof explicit === "string" && explicit.length > 0) {
    return explicit;
  }

  if (typeof window === "undefined") {
    return "ws://127.0.0.1:3001";
  }

  if (import.meta.env.DEV) {
    const host = window.location.hostname;
    return `ws://${host}:3001`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = window.location.port;
  if (port && port !== "80" && port !== "443") {
    return `${protocol}//${host}:${port}`;
  }
  return `${protocol}//${host}`;
}

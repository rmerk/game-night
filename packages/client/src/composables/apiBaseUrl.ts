/** HTTP API base for room creation (Fastify on PORT 3001 in dev). */
export function getApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_BASE_URL;
  if (typeof explicit === "string" && explicit.length > 0) {
    return explicit.replace(/\/$/, "");
  }
  if (typeof window === "undefined") {
    return "http://127.0.0.1:3001";
  }
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  if (import.meta.env.DEV) {
    return `${protocol}//${host}:3001`;
  }
  return `${protocol}//${host}`;
}

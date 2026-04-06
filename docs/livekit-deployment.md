# LiveKit deployment (voice / video)

The game server issues short-lived JWTs; the browser connects to LiveKit with those tokens. Game state and chat stay on the primary WebSocket — LiveKit is a separate channel for WebRTC only.

## Environment variables

| Location | Variable | Purpose |
|----------|----------|---------|
| Server | `LIVEKIT_URL` | WebSocket URL of the LiveKit server (e.g. `wss://your-project.livekit.cloud`) |
| Server | `LIVEKIT_API_KEY` | API key (server-only; never expose to the client) |
| Server | `LIVEKIT_API_SECRET` | API secret (server-only) |
| Client | `VITE_LIVEKIT_URL` | Same public URL as `LIVEKIT_URL` in typical setups; the **token** always comes from the game server over WebSocket |

Copy from `packages/server/.env.example` and `packages/client/.env.example`.

## LiveKit Cloud (managed)

1. Create a project at [LiveKit Cloud](https://cloud.livekit.io/).
2. Copy the **WebSocket URL**, **API key**, and **API secret** into server env vars.
3. Set `VITE_LIVEKIT_URL` on the client to the same WebSocket URL.

## Self-hosted LiveKit server

- **HTTP / signaling:** TCP **7880** (TLS in production).
- **WebRTC over TCP:** **7881** (optional, depending on config).
- **UDP media:** typically **50000–60000** (adjust per your deployment).

Open firewall rules for the ports used by your LiveKit config. Prefer TLS on 443/7880 with valid certificates.

## TURN / STUN (NAT traversal)

Many clients sit behind NAT or firewalls. Configure TURN/STUN so LiveKit can establish media paths:

- **STUN:** Often sufficient for symmetric NAT; LiveKit can use public STUN servers or your own.
- **TURN:** Required when direct peer-to-peer fails; use a TURN server (e.g. [coturn](https://github.com/coturn/coturn)) or a managed TURN offering and point LiveKit at the TURN credentials.

Follow [LiveKit’s deployment docs](https://docs.livekit.io/home/self-hosting/deployment/) for your version — settings include `turn_servers` / cloud TURN integration.

## TLS / certificates

- Browsers require **trusted** HTTPS/WSS for WebRTC in production. **Self-signed certificates do not work** for typical browser WebRTC flows.
- Use a certificate from a public CA (or your org’s trusted CA) on the LiveKit server and the game API origin.

## Operational notes

- If LiveKit fails, the game **continues** with text chat and the WebSocket game channel (NFR23). Missing or invalid LiveKit configuration does not crash the game server in development/test; in **production**, the server expects `LIVEKIT_*` to be set when `NODE_ENV=production` (see `packages/server/src/config/livekit.ts`).

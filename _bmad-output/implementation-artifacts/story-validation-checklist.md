# Story validation checklist (template)

Paste a copy into new story specs under `## Validation checklist` (or run through before marking review complete).

## Filtered views and privacy

- No hidden tile identities or peer pass selections leak via `buildPlayerView` / `state-broadcaster` / serialized `STATE_UPDATE` (add or extend broadcaster tests when changing filters).
- Internal engine fields that must stay server-private are not exposed on `PlayerGameView` / protocol types.

## Action handlers

- Invalid actions rejected with **zero mutation** (include rejection tests for wrong phase, duplicate submission, bad tile IDs).
- Validate-then-mutate order preserved; early returns before any state write.

## Reconnect and transport (when Charleston, courtesy, or phase-specific state exists)

- First payload after reconnect restores filtered game view (not lobby-only) where required by existing join-handler behavior.
- Integration or WS test covers at least one reconnect path when the story touches connection lifecycle.

## After changing the broadcaster or protocol filters

- Run `packages/server/src/websocket/state-broadcaster.test.ts`.
- Run relevant WebSocket integration tests (e.g. `full-game-flow.test.ts`).

## Regression (QA)

- Existing `state-broadcaster` and integration tests stay green; add one case when new serialized fields are introduced.
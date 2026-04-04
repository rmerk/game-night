# Story 3.5: Table Talk Report (Majority Vote Dead Hand)

Status: done

## Story

As a **player**,
I want **to report table talk violations (naming a specific needed tile) with a majority vote that enforces a dead hand if upheld**,
so that **verbal rules are enforceable through the game system, distinct from the Social Override system (FR80, FR81, FR82, FR83)**.

## Acceptance Criteria

1. **AC1 — Report dispatch:** Given a player suspects table talk (another player named a specific tile they need), when they dispatch `TABLE_TALK_REPORT` with a brief description and a **reported player id** (the accused), then the report is submitted and the **three non-reporter players** (excluding the reporter only — see FR81) receive a vote prompt as an inline approve/deny UI (same interaction pattern as Story 3C.4).
2. **AC2 — Majority uphold:** Given a Table Talk Report vote, when **2 of 3** eligible voters vote to uphold (approve), then the **reported** player receives `deadHand: true` for the current game — same enforcement semantics as Story 3C.3 (draw/discard continues, cannot win or call, etc.).
3. **AC3 — Denied / minority:** Given a Table Talk Report vote, when **fewer than 2** vote to uphold (including explicit deny votes and missing votes after timeout if implemented), then the report is denied — no dead hand, play continues.
4. **AC4 — Denied still counts:** Given a denied report, when checking the reporter’s per-game limit, then that submission still increments their **used report count** toward the limit (FR83).
5. **AC5 — Report limit:** Given a player has already submitted **2** Table Talk Reports in the current game (counting denied outcomes), when they attempt a third `TABLE_TALK_REPORT`, then `{ accepted: false, reason: 'REPORT_LIMIT_REACHED' }`.
6. **AC6 — Voting UI reuse:** Given the voting UI, when presenting the Table Talk Report vote, then it reuses the same voting interaction pattern as Story 3C.4 (inline prompt, approve/deny buttons) but with **majority (2/3)** messaging instead of unanimous (3/3). Labels must distinguish **Table Talk** from **Social Override** (FR80).
7. **AC7 — Validation gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass.

## Tasks / Subtasks

- [x] Task 1: Shared types and GameState (AC: 1–2, 5, 7)
  - [x] 1.1 Add `TableTalkReportState` (or equivalent) with `reporterId`, `reportedPlayerId`, `description`, `expiresAt`, `votes` map for the three voters; add `tableTalkReportCountsByPlayerId: Record<string, number>` (or similar) reset at game start — tracks submissions **initiated** this game per reporter for FR83
  - [x] 1.2 Add `TableTalkReportAction`, `TableTalkVoteAction` to `GameAction`; extend `ResolvedAction` with request / vote cast / resolved variants
  - [x] 1.3 Ensure `GameAction` / `ResolvedAction` discriminated unions stay exhaustive (`game-engine.ts` default branch)
- [x] Task 2: Engine handlers (AC: 1–5)
  - [x] 2.1 Implement `handleTableTalkReport`, `handleTableTalkVote`, `handleTableTalkTimeout` (if using timeout) in `packages/shared/src/engine/actions/table-talk-report.ts` (new file)
  - [x] 2.2 Validation: `gamePhase === "play"`; reporter ≠ reported; `reportedPlayerId` must be another seated player; reporter under limit; **no concurrent** `socialOverrideState` (and optionally `challengeState`) — return clear reasons (e.g. `SOCIAL_OVERRIDE_PENDING`, `TABLE_TALK_ALREADY_ACTIVE`)
  - [x] 2.3 On uphold: set `state.players[reportedPlayerId].deadHand = true` (reuse existing dead-hand behavior; do not duplicate 3C.3 logic beyond this flag)
  - [x] 2.4 On resolution (uphold or deny): increment reporter’s count for this game **once per submitted report**; deny path still counts (FR83)
  - [x] 2.5 Register cases in `packages/shared/src/engine/game-engine.ts`; export from `packages/shared/src/index.ts`
- [x] Task 3: Protocol and broadcaster (AC: 1, 6)
  - [x] 3.1 Extend `PlayerGameView` / protocol with `tableTalkReportState` (or equivalent) so clients can render prompts and progress
  - [x] 3.2 Update `buildPlayerView` in `packages/server/src/websocket/state-broadcaster.ts` — voters see approve/deny; reporter and reported see appropriate copy (reported may vote deny — see FR81 voter set)
- [x] Task 4: Server (AC: 3, 7)
  - [x] 4.1 Parse and validate `TABLE_TALK_REPORT` / `TABLE_TALK_VOTE` in `packages/server/src/websocket/action-handler.ts` (mirror `SOCIAL_OVERRIDE_*` patterns)
  - [x] 4.2 Schedule/clear timeout on `Room` when a vote starts/ends — **recommend** reuse `SOCIAL_OVERRIDE_TIMEOUT_SECONDS` (10s) and silence = deny for parity with 3C.4 unless UX specifies otherwise; document in completion notes if different
- [x] Task 5: Client (AC: 1, 6, 7)
  - [x] 5.1 Add **Table Talk Report** entry point (distinct control from Social Override — FR80) and description input (align with `BaseInput` in UX spec — [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md))
  - [x] 5.2 Reuse or extend `SocialOverridePanel.vue` (composition: `SocialOverrideSection.vue` + `TableTalkReportSection.vue`) / `GameTable.vue` — **majority** threshold copy (2/3 uphold) vs unanimous (3/3); `reportTargets` sync + accused `<label for>` / `<select id>` for accessibility
- [x] Task 6: Tests (AC: all)
  - [x] 6.1 `table-talk-report.test.ts` — uphold, deny, limit, denied-counts-toward-limit, dead hand on reported, reject invalid targets, mutual exclusion with social override if implemented
  - [x] 6.2 Broadcaster / server tests as needed for `PlayerGameView` fields; client tests for panel + `TableTalkReportSection` (`reportTargets` churn)
- [x] Task 7: Validation gate (AC: 7)
  - [x] 7.1 `pnpm test && pnpm run typecheck && vp lint`

## Dev Notes

### Scope boundaries

- **In scope:** Verbal **table talk** enforcement via player report + majority vote; **dead hand** on reported player when upheld; **2 submissions per reporter per game** including denied (FR83); UI distinct from Social Override (FR80).
- **Out of scope:** Auto-detecting speech; Social Override undo; changing Mahjong challenge or scoring flows.

### Voter set (FR81 vs epic wording)

- **FR81:** “Report sent to **all other players** as majority vote (**2 of 3** must agree).”
- **Epic AC:** “other **3** players (excluding the reporter).”
- **Interpretation for implementation:** The **three** voters are the players **other than the reporter** (includes the **reported** player, who may vote deny). This yields a 2/3 majority threshold among those three. **Do not** send the vote prompt only to two neutrals — that would break the FR81 “2 of 3” count unless the product owner revises.

### Action payload (implementation detail)

- Epic text names `TABLE_TALK_REPORT` with description only; the engine **must** know which player is accused. Add **`reportedPlayerId`** (or equivalent) to the action payload and document in protocol types.

### Reuse and differences vs Story 3C.4


| Aspect  | Social Override (3C.4)                | Table Talk (3C.5)                                    |
| ------- | ------------------------------------- | ---------------------------------------------------- |
| Trigger | Open call window, no calls, discarder | Play phase, reporter + description + reported target |
| Votes   | Unanimous 3/3 non-requesters          | Majority **2/3** non-reporters                       |
| Outcome | Undo discard                          | **Dead hand** on reported player                     |
| Limit   | N/A                                   | **2 reports per reporter per game**                  |


### Key files (starting points)


| Area              | File                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Pattern reference | `packages/shared/src/engine/actions/social-override.ts`, `social-override.test.ts`                                         |
| Dead hand flag    | `packages/shared/src/engine/dead-hand.ts`, `PlayerState.deadHand` in `packages/shared/src/types/game-state.ts`             |
| Types             | `packages/shared/src/types/actions.ts`, `packages/shared/src/types/game-state.ts`, `packages/shared/src/types/protocol.ts` |
| Engine dispatch   | `packages/shared/src/engine/game-engine.ts`                                                                                |
| Game init         | `packages/shared/src/engine/state/create-game.ts` — initialize new counters / null pending state                           |
| Server            | `packages/server/src/websocket/action-handler.ts`, `packages/server/src/rooms/room.ts`                                     |
| Broadcast         | `packages/server/src/websocket/state-broadcaster.ts`                                                                       |
| Client            | `SocialOverridePanel.vue`, `SocialOverrideSection.vue`, `TableTalkReportSection.vue`, `GameTable.vue` (`packages/client/src/components/game/`) |


### Host log (optional)

- Consider append-only `hostAuditLog` lines for Table Talk requests and outcomes (parallel FR88) for host transparency — not explicitly required by 3C.5 epic but consistent with 3C.4.

### Project context

- Validate-then-mutate; no server authority bypass; extend unions in `shared` for any new wire actions; co-located `*.test.ts`; use `vite-plus/test` (see [`project-context.md`](../project-context.md)).
- **Strings:** Cap description length server-side (align with `MAX_DESCRIPTION_LEN` in `social-override.ts`, 280) and render with `{{ }}` only — never `v-html` on user text.
- **Regressions:** Extending `GameAction` requires updating `handleAction` exhaustiveness; new pending state must not break `buildPlayerView` or existing Social Override flows.

### Cross-session intelligence

- Epic 3C ordering: Social Override voting UI exists **before** Story 3C.5 — reuse it.
- Story 3C.4 completion notes: `GameTable` may still be wired from dev showcases; production room wiring may need `canRequestTableTalkReport` alongside `canRequestSocialOverride`.

### Previous story intelligence (3C.4)

- Source: [`3c-4-social-override-system-unanimous-vote-undo.md`](3c-4-social-override-system-unanimous-vote-undo.md)
- `socialOverrideState` + server timer; `PASS_CALL` / `CALL_*` blocked while pending; `hostAuditLog` host-only.
- **Do not** copy discard-undo logic — Table Talk applies dead hand only.

### References

- [`epics.md`](../planning-artifacts/epics.md) — Epic 3C intro, Story 3C.5, FR76–FR83, TypeScript union note
- [`gdd.md`](../planning-artifacts/gdd.md) — Dead hand + Table Talk Report (~420–448)
- [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) — `BaseInput` for description (~653)
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — full architecture (supplement as needed)

### Follow-up: production room wiring (out of scope for 3C.5)

Story 3C.5 delivers engine, protocol, server timer, and `GameTable` / `SocialOverridePanel` props + emits. **Hooking the live room / WebSocket client** so `STATE_UPDATE` drives `tableTalkReportState`, `tableTalkReportCountsByPlayerId`, `canRequestTableTalkReport`, and user actions send `ACTION` messages — including the parallel **social override** path from Story 3C.4 (`canRequestSocialOverride`, `SOCIAL_OVERRIDE_*`) — is **not** part of this story.

**Where to track it:** umbrella item **`5a-retro-4-client-integration-layer-before-epic-3b`** in [`sprint-status.yaml`](sprint-status.yaml) (`retro_follow_through`, backlog). Spin a dedicated dev story from that retro item when implementation starts, or fold requirements into the integration story’s acceptance criteria.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented `TABLE_TALK_REPORT` / `TABLE_TALK_VOTE` with `TableTalkReportState` (includes `voterIds` for the three non-reporters). Majority: 2 approve to uphold; 2 deny or all votes cast without 2 approves → denied; `handleTableTalkTimeout` denies if fewer than 2 approves (same 10s as `SOCIAL_OVERRIDE_TIMEOUT_SECONDS`).
- Mutual exclusion: `social-override.ts` rejects when `tableTalkReportState` active (`TABLE_TALK_PENDING`); table-talk rejects when social override or challenge pending. `PASS_CALL` / calls blocked while table talk pending (`TABLE_TALK_PENDING`).
- Client: `SocialOverridePanel.vue` composes `SocialOverrideSection.vue` + `TableTalkReportSection.vue`; `GameTable.vue` wires props/emits; table-talk accused select uses `for`/`id` pairing; `reportTargets` watcher resets invalid `reportedPlayerId` when the opponent list changes. Live room wiring deferred — see **Dev Notes → Follow-up: production room wiring** and sprint **`5a-retro-4-client-integration-layer-before-epic-3b`**.

### File List

- `packages/shared/src/types/actions.ts`
- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/engine/actions/table-talk-report.ts`
- `packages/shared/src/engine/actions/table-talk-report.test.ts`
- `packages/shared/src/engine/actions/social-override.ts`
- `packages/shared/src/engine/actions/call-window.ts`
- `packages/shared/src/engine/game-engine.ts`
- `packages/shared/src/engine/state/create-game.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/websocket/action-handler.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/rooms/room.ts`
- `packages/server/src/rooms/room-manager.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/rooms/session-manager.test.ts`
- `packages/server/src/rooms/seat-assignment.test.ts`
- `packages/server/src/rooms/room-lifecycle.test.ts`
- `packages/client/src/components/game/SocialOverridePanel.vue`
- `packages/client/src/components/game/SocialOverrideSection.vue`
- `packages/client/src/components/game/TableTalkReportSection.vue`
- `packages/client/src/components/game/SocialOverridePanel.test.ts`
- `packages/client/src/components/game/TableTalkReportSection.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3c-5-table-talk-report-majority-vote-dead-hand.md`

## Change Log

- **2026-04-04:** Story file created via GDS create-story workflow; sprint status set to **ready-for-dev**.
- **2026-04-04:** Story 3C.5 implemented — table talk report engine, server timer, protocol/broadcaster, client UI, tests; sprint status **review**.
- **2026-04-04:** Ticket note: production WebSocket ↔ `GameTable` integration (table talk + social override) deferred; tracked under **`5a-retro-4-client-integration-layer-before-epic-3b`** (see Dev Notes follow-up section).
- **2026-04-04:** Client refactor: split table talk / social override into `SocialOverrideSection` + `TableTalkReportSection`; `reportTargets` robustness tests; accused control label/`id` for accessibility.
- **2026-04-04:** GDS adversarial code review complete — ACs and tasks verified; supplemental tests added for table-talk UI and `PlayerGameView` fields; sprint status **done**.

## Senior Developer Review (AI)

**Reviewer:** Rchoi (via GDS code-review workflow)  
**Date:** 2026-04-04

**Outcome:** Approve (story marked **done**)

**Git vs story File List:** Aligned after follow-up commit — includes `SocialOverrideSection.vue`, `TableTalkReportSection.vue`, `TableTalkReportSection.test.ts`.

**Acceptance criteria:** AC1–AC6 implemented in shared engine, server action handler + 10s timer (parity with social override), protocol/broadcaster, and `GameTable` / `SocialOverridePanel`. AC3 timeout path covered by `handleTableTalkTimeout`. AC4–AC5 reporter count increments on resolution (including deny). Production room wiring so live `STATE_UPDATE` drives table-talk props remains explicitly **out of scope** per Dev Notes (retro item `5a-retro-4-client-integration-layer-before-epic-3b`).

**Findings addressed in review pass:**


| Severity | Topic                                                                      | Resolution                                               |
| -------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Medium   | Client tests did not exercise table-talk branches of `SocialOverridePanel` | Added tests for report form + voter UI                   |
| Medium   | `buildPlayerView` test did not assert new table-talk fields                | Extended “includes all public state fields” expectations |


**Verification:** `pnpm test`, `pnpm run typecheck`, `vp lint` — all pass.
# Story 3.5: Table Talk Report (Majority Vote Dead Hand)

Status: ready-for-dev

<!-- Ultimate context engine analysis — comprehensive developer guide for Story 3C.5 (Table Talk Report). -->

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

- [ ] Task 1: Shared types and GameState (AC: 1–2, 5, 7)
  - [ ] 1.1 Add `TableTalkReportState` (or equivalent) with `reporterId`, `reportedPlayerId`, `description`, `expiresAt`, `votes` map for the three voters; add `tableTalkReportCountsByPlayerId: Record<string, number>` (or similar) reset at game start — tracks submissions **initiated** this game per reporter for FR83
  - [ ] 1.2 Add `TableTalkReportAction`, `TableTalkVoteAction` to `GameAction`; extend `ResolvedAction` with request / vote cast / resolved variants
  - [ ] 1.3 Ensure `GameAction` / `ResolvedAction` discriminated unions stay exhaustive (`game-engine.ts` default branch)

- [ ] Task 2: Engine handlers (AC: 1–5)
  - [ ] 2.1 Implement `handleTableTalkReport`, `handleTableTalkVote`, `handleTableTalkTimeout` (if using timeout) in `packages/shared/src/engine/actions/table-talk-report.ts` (new file)
  - [ ] 2.2 Validation: `gamePhase === "play"`; reporter ≠ reported; `reportedPlayerId` must be another seated player; reporter under limit; **no concurrent** `socialOverrideState` (and optionally `challengeState`) — return clear reasons (e.g. `SOCIAL_OVERRIDE_PENDING`, `TABLE_TALK_ALREADY_ACTIVE`)
  - [ ] 2.3 On uphold: set `state.players[reportedPlayerId].deadHand = true` (reuse existing dead-hand behavior; do not duplicate 3C.3 logic beyond this flag)
  - [ ] 2.4 On resolution (uphold or deny): increment reporter’s count for this game **once per submitted report**; deny path still counts (FR83)
  - [ ] 2.5 Register cases in `packages/shared/src/engine/game-engine.ts`; export from `packages/shared/src/index.ts`

- [ ] Task 3: Protocol and broadcaster (AC: 1, 6)
  - [ ] 3.1 Extend `PlayerGameView` / protocol with `tableTalkReportState` (or equivalent) so clients can render prompts and progress
  - [ ] 3.2 Update `buildPlayerView` in `packages/server/src/websocket/state-broadcaster.ts` — voters see approve/deny; reporter and reported see appropriate copy (reported may vote deny — see FR81 voter set)

- [ ] Task 4: Server (AC: 3, 7)
  - [ ] 4.1 Parse and validate `TABLE_TALK_REPORT` / `TABLE_TALK_VOTE` in `packages/server/src/websocket/action-handler.ts` (mirror `SOCIAL_OVERRIDE_*` patterns)
  - [ ] 4.2 Schedule/clear timeout on `Room` when a vote starts/ends — **recommend** reuse `SOCIAL_OVERRIDE_TIMEOUT_SECONDS` (10s) and silence = deny for parity with 3C.4 unless UX specifies otherwise; document in completion notes if different

- [ ] Task 5: Client (AC: 1, 6, 7)
  - [ ] 5.1 Add **Table Talk Report** entry point (distinct control from Social Override — FR80) and description input (align with `BaseInput` in UX spec — [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`])
  - [ ] 5.2 Reuse or extend `SocialOverridePanel.vue` / `GameTable.vue` patterns for vote UI — **majority** threshold copy (2/3 uphold) vs unanimous (3/3)

- [ ] Task 6: Tests (AC: all)
  - [ ] 6.1 `table-talk-report.test.ts` — uphold, deny, limit, denied-counts-toward-limit, dead hand on reported, reject invalid targets, mutual exclusion with social override if implemented
  - [ ] 6.2 Broadcaster / server tests as needed for `PlayerGameView` fields

- [ ] Task 7: Validation gate (AC: 7)
  - [ ] 7.1 `pnpm test && pnpm run typecheck && vp lint`

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

| Aspect | Social Override (3C.4) | Table Talk (3C.5) |
|--------|-------------------------|-------------------|
| Trigger | Open call window, no calls, discarder | Play phase, reporter + description + reported target |
| Votes | Unanimous 3/3 non-requesters | Majority **2/3** non-reporters |
| Outcome | Undo discard | **Dead hand** on reported player |
| Limit | N/A | **2 reports per reporter per game** |

### Key files (starting points)

| Area | File |
|------|------|
| Pattern reference | `packages/shared/src/engine/actions/social-override.ts`, `social-override.test.ts` |
| Dead hand flag | `packages/shared/src/engine/dead-hand.ts`, `PlayerState.deadHand` in `packages/shared/src/types/game-state.ts` |
| Types | `packages/shared/src/types/actions.ts`, `packages/shared/src/types/game-state.ts`, `packages/shared/src/types/protocol.ts` |
| Engine dispatch | `packages/shared/src/engine/game-engine.ts` |
| Game init | `packages/shared/src/engine/state/create-game.ts` — initialize new counters / null pending state |
| Server | `packages/server/src/websocket/action-handler.ts`, `packages/server/src/rooms/room.ts` |
| Broadcast | `packages/server/src/websocket/state-broadcaster.ts` |
| Client | `packages/client/src/components/game/SocialOverridePanel.vue`, `GameTable.vue` |

### Host log (optional)

- Consider append-only `hostAuditLog` lines for Table Talk requests and outcomes (parallel FR88) for host transparency — not explicitly required by 3C.5 epic but consistent with 3C.4.

### Project context

- Validate-then-mutate; no server authority bypass; extend unions in `shared` for any new wire actions; co-located `*.test.ts`; use `vite-plus/test` (see [`_bmad-output/project-context.md`](_bmad-output/project-context.md)).
- **Strings:** Cap description length server-side (align with `MAX_DESCRIPTION_LEN` in `social-override.ts`, 280) and render with `{{ }}` only — never `v-html` on user text.
- **Regressions:** Extending `GameAction` requires updating `handleAction` exhaustiveness; new pending state must not break `buildPlayerView` or existing Social Override flows.

### Cross-session intelligence

- Epic 3C ordering: Social Override voting UI exists **before** Story 3C.5 — reuse it.
- Story 3C.4 completion notes: `GameTable` may still be wired from dev showcases; production room wiring may need `canRequestTableTalkReport` alongside `canRequestSocialOverride`.

### Previous story intelligence (3C.4)

- Source: [`_bmad-output/implementation-artifacts/3c-4-social-override-system-unanimous-vote-undo.md`](_bmad-output/implementation-artifacts/3c-4-social-override-system-unanimous-vote-undo.md)
- `socialOverrideState` + server timer; `PASS_CALL` / `CALL_*` blocked while pending; `hostAuditLog` host-only.
- **Do not** copy discard-undo logic — Table Talk applies dead hand only.

### References

- [`_bmad-output/planning-artifacts/epics.md`](_bmad-output/planning-artifacts/epics.md) — Epic 3C intro, Story 3C.5, FR76–FR83, TypeScript union note
- [`_bmad-output/planning-artifacts/gdd.md`](_bmad-output/planning-artifacts/gdd.md) — Dead hand + Table Talk Report (~420–448)
- [`_bmad-output/planning-artifacts/ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — `BaseInput` for description (~653)
- [`_bmad-output/planning-artifacts/game-architecture.md`](_bmad-output/planning-artifacts/game-architecture.md) — full architecture (supplement as needed)

## Dev Agent Record

### Agent Model Used

_(To be filled by implementer)_

### Debug Log References

### Completion Notes List

### File List

_(To be filled by implementer)_

## Change Log

- **2026-04-04:** Story file created via GDS create-story workflow; sprint status set to **ready-for-dev**.

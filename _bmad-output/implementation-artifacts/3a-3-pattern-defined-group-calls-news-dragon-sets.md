# Story 3A.3: Pattern-Defined Group Calls (NEWS, Dragon Sets)

Status: ready-for-dev

## Story

As a developer,
I want the calling system to support pattern-defined groups from the NMJL card (NEWS = one of each wind, Dragon sets = one of each dragon) in addition to same-tile groups,
so that all valid call types on the NMJL card are supported (FR31).

## Acceptance Criteria

1. **Given** a Wind tile is discarded (e.g., North) / **When** a player has the other 3 Wind tiles (East, West, South) in their rack / **Then** they can call to form a NEWS group — the call is validated as a legal group.
2. **Given** a Dragon tile is discarded (e.g., Red) / **When** a player has the other 2 Dragon tiles (Green, White/Soap) in their rack / **Then** they can call to form a Dragon set — the call is validated as a legal group.
3. **Given** a NEWS or Dragon set call / **When** validating the group / **Then** Jokers can substitute for any tile in the group (groups of 3+), and the group identity is recorded for future Joker exchange validation (FR55).
4. **Given** a player attempts to call a pattern-defined group with incorrect tiles / **When** dispatching the call / **Then** `{ accepted: false, reason: 'INVALID_GROUP' }` is returned.
5. **Given** the call buttons system / **When** determining valid call options for a discarded tile / **Then** both same-tile calls (Pung/Kong/Quint) AND pattern-defined group calls (NEWS/Dragon set) are included based on the player's rack contents (FR30).

## Tasks / Subtasks

- [ ] Task 1: Extend CallType and action types (AC: 1, 2)
  - [ ] 1.1 Widen `CallType` in `types/game-state.ts` from `"pung" | "kong" | "quint"` to also include `"news" | "dragon_set"`
  - [ ] 1.2 Add `CallNewsAction` interface to `types/actions.ts` with `type: "CALL_NEWS"`, `playerId`, `tileIds: readonly string[]`
  - [ ] 1.3 Add `CallDragonSetAction` interface to `types/actions.ts` with `type: "CALL_DRAGON_SET"`, `playerId`, `tileIds: readonly string[]`
  - [ ] 1.4 Extend `GameAction` union with `CallNewsAction | CallDragonSetAction`
  - [ ] 1.5 Extend `ResolvedAction` union with `CALL_NEWS` and `CALL_DRAGON_SET` variants
  - [ ] 1.6 Register `CALL_NEWS` and `CALL_DRAGON_SET` in game engine dispatcher (`game-engine.ts`)

- [ ] Task 2: Implement pattern-defined group validation (AC: 1, 2, 3, 4)
  - [ ] 2.1 Add `isPatternDefinedCall(callType: CallType): boolean` helper to `call-window.ts` — returns `true` for `"news"` and `"dragon_set"`
  - [ ] 2.2 Add `validateNewsGroup(rackTiles: Tile[], discardedTile: Tile): boolean` — verifies the rack tiles + discard contain one of each wind (N/E/W/S), with Jokers allowed as substitutes; discard must be a wind tile
  - [ ] 2.3 Add `validateDragonSetGroup(rackTiles: Tile[], discardedTile: Tile): boolean` — verifies the rack tiles + discard contain one of each dragon (red/green/soap), with Jokers allowed as substitutes; discard must be a dragon tile
  - [ ] 2.4 Refactor `handleCallAction` to branch on `isPatternDefinedCall(callType)`:
    - Same-tile path (existing): `tilesMatch` check per tile
    - Pattern-defined path (new): call `validateNewsGroup` or `validateDragonSetGroup` instead of `tilesMatch` loop; use `INVALID_GROUP` reason on failure
  - [ ] 2.5 Update `REQUIRED_FROM_RACK` to include `news: 3` and `dragon_set: 2` (group size minus the discarded tile)
  - [ ] 2.6 Add guard: NEWS call requires discarded tile category `"wind"`; Dragon set call requires `"dragon"` — reject with `INVALID_GROUP` if wrong category

- [ ] Task 3: Write tests for NEWS call validation (AC: 1, 3, 4)
  - [ ] 3.1 Test: valid NEWS call — player has 3 other wind tiles, discard is a wind → accepted, call recorded in buffer
  - [ ] 3.2 Test: valid NEWS call with Joker substitution — player has 2 wind tiles + 1 Joker → accepted
  - [ ] 3.3 Test: valid NEWS call with multiple Jokers — player has 1 wind + 2 Jokers → accepted
  - [ ] 3.4 Test: invalid NEWS call — player has 3 wind tiles but all same wind as discard → rejected `INVALID_GROUP`
  - [ ] 3.5 Test: invalid NEWS call — discard is not a wind tile (e.g., suited tile) → rejected `INVALID_GROUP`
  - [ ] 3.6 Test: invalid NEWS call — player missing a wind and no Joker to substitute → rejected `INVALID_GROUP`
  - [ ] 3.7 Test: NEWS call inherits all common validations from handleCallAction (call window open, not discarder, not passed, no duplicate tile IDs, tiles in rack)

- [ ] Task 4: Write tests for Dragon set call validation (AC: 2, 3, 4)
  - [ ] 4.1 Test: valid Dragon set call — player has 2 other dragon tiles, discard is a dragon → accepted
  - [ ] 4.2 Test: valid Dragon set with Joker — player has 1 dragon + 1 Joker → accepted
  - [ ] 4.3 Test: invalid Dragon set — discard is not a dragon tile → rejected `INVALID_GROUP`
  - [ ] 4.4 Test: invalid Dragon set — player has wrong dragons (e.g., duplicates instead of distinct) → rejected `INVALID_GROUP`
  - [ ] 4.5 Test: Dragon set inherits common validations

- [ ] Task 5: Implement and test `getValidCallOptions` utility (AC: 5)
  - [ ] 5.1 Create `getValidCallOptions(rack: Tile[], discardedTile: Tile): CallType[]` in `call-window.ts` — returns all valid call types given a player's rack and the discarded tile
  - [ ] 5.2 For same-tile calls: count matching tiles (via `tilesMatch`); if count >= 2 → include pung; >= 3 → include kong; >= 4 → include quint
  - [ ] 5.3 For NEWS: if discard is a wind tile and player has the other 3 winds (with Joker substitution) → include news
  - [ ] 5.4 For Dragon set: if discard is a dragon tile and player has the other 2 dragons (with Joker substitution) → include dragon_set
  - [ ] 5.5 Test: suited tile discarded → only same-tile calls returned, never news/dragon_set
  - [ ] 5.6 Test: wind tile discarded, player has all other winds → includes both pung (if matching tiles) and news
  - [ ] 5.7 Test: dragon tile discarded, player has all other dragons → includes both pung (if matching) and dragon_set
  - [ ] 5.8 Test: wind tile discarded, player missing a wind but has Joker → news included
  - [ ] 5.9 Test: empty rack or no matching tiles → empty array
  - [ ] 5.10 Export `getValidCallOptions` from barrel (`index.ts`)

## Dev Notes

### Architecture Requirements

- **Validate-then-mutate pattern mandatory** — every handler: validate (read-only) → mutate (only if valid) → return `ActionResult`
- **Never throw for rule violations** — return `{ accepted: false, reason }` with zero mutations
- All game logic in `packages/shared/` — zero runtime dependencies, no `console.*`
- Import types within shared from specific files, not the barrel
- Co-located tests: `call-window.test.ts` next to `call-window.ts`

### Key Implementation Details

**NEWS validation logic:**
The discarded tile is one of the 4 winds. The caller must provide 3 tiles from their rack. Together (discard + 3 rack tiles) they must cover all 4 winds (N/E/W/S). Jokers substitute for any missing wind. Validation steps:
1. Confirm discarded tile is category `"wind"`
2. Build a set of required winds: `{ "north", "east", "west", "south" }`
3. Remove the discard's wind value from the required set
4. For each rack tile: if it's a Joker, decrement needed count; if it's a wind not yet covered, remove from required set; otherwise → `INVALID_GROUP`
5. If required set is empty (all winds covered) → valid

**Dragon set validation logic:**
Same approach but with 3 dragons (red/green/soap). Discard must be category `"dragon"`. Caller provides 2 rack tiles. Together they must cover all 3 dragons.

**Joker substitution rules:**
- Jokers can substitute in groups of 3+ tiles (NEWS=4, Dragon set=3) — both are eligible
- A Joker in the rack can stand for any missing wind/dragon
- Multiple Jokers allowed (e.g., 1 real wind + 2 Jokers for NEWS)
- Pair guard (group size === 2) does NOT apply here — smallest pattern-defined group is Dragon set at size 3

**Refactoring `handleCallAction`:**
The existing function handles same-tile calls. Add a branch after common validations (phase, call window, discarder, passed, duplicates, tile count, tile ownership) that routes to pattern-specific validation instead of the `tilesMatch` loop. The common prefix validations are shared; only step 6 (tile matching) diverges.

**`getValidCallOptions` is a pure function** — it does NOT depend on game state beyond the rack and discarded tile. It's intended for client-side call button display and server-side validation. It must handle Joker counting correctly when determining if pattern-defined groups are possible.

### Previous Story (3a-2) Learnings — CRITICAL

1. **Pair rejection ordering matters.** In 3a-2, the pair check was initially dead code because the count check fired first. Place the pair guard BEFORE count validation. Not directly applicable to NEWS/Dragon set (both size ≥ 3), but maintain the same validation chain order.

2. **Duplicate tile ID security.** 3a-2 R2 found that `rack.find()` resolves the same tile on each iteration, allowing `['bam-3-1', 'bam-3-1']` to fake a pung with 1 tile. The duplicate check (`new Set(action.tileIds).size !== action.tileIds.length`) is already in place — ensure it runs before any pattern-defined validation.

3. **`tilesMatch` helper is exported** — reuse it in tests via import. Also reuse it inside `getValidCallOptions` for counting same-tile matches.

4. **Test determinism.** Use `injectTilesIntoRack` pattern (or equivalent test helper in `@mahjong-game/shared/testing/helpers`) to set up specific rack contents. Never rely on wall shuffling for test state.

5. **Validation chain order** established in 3a-2: phase → callWindow → status → discarder → passed → duplicates → pair → count → ownership → matching → mutate. Maintain this order; pattern-defined validation replaces only the "matching" step.

6. **`CallRecord` interface** uses `CallType` — widening `CallType` automatically allows NEWS/Dragon set records in the buffer. No changes needed to `CallRecord` itself.

### File Structure

All changes in `packages/shared/src/`:

| File | Change |
|------|--------|
| `types/game-state.ts` | Widen `CallType`, add `CALL_NEWS`/`CALL_DRAGON_SET` to `ResolvedAction` |
| `types/actions.ts` | Add `CallNewsAction`, `CallDragonSetAction`, extend `GameAction` union |
| `engine/actions/call-window.ts` | Add pattern-defined validation functions, refactor `handleCallAction`, add `getValidCallOptions` |
| `engine/actions/call-window.test.ts` | Add ~20 new tests for NEWS, Dragon set, and `getValidCallOptions` |
| `engine/game-engine.ts` | Register `CALL_NEWS`, `CALL_DRAGON_SET` dispatcher cases |
| `index.ts` | Export `getValidCallOptions` and new action types |

### Testing Standards

- Vitest with `restoreMocks: true`, `clearMocks: true`
- Co-located test file: `call-window.test.ts`
- Use `createTestState()` from `@mahjong-game/shared/testing/helpers` for game state fixtures
- Real assertions — never hardcode expected values as magic numbers
- Test Joker substitution at every eligible position
- Verify zero mutations on rejection (read state before, assert unchanged after)
- Use `WINDS` and `DRAGONS` constants from `constants.ts` in tests — don't hardcode wind/dragon lists

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3A.3]
- [Source: _bmad-output/planning-artifacts/gdd.md — Group Definitions table, lines 236-244]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Call System, GroupPattern type]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Call Buttons spec]
- [Source: packages/shared/src/constants.ts — GROUP_SIZES, WINDS, DRAGONS]
- [Source: packages/shared/src/types/game-state.ts — CallType, CallRecord, CallWindowState]
- [Source: packages/shared/src/engine/actions/call-window.ts — handleCallAction, tilesMatch]
- [Source: _bmad-output/implementation-artifacts/3a-2-call-actions-pung-kong-quint-with-validation.md — Dev Notes, Completion Notes, R1/R2/R3 review findings]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List


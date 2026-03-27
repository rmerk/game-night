# Card Schema Spike — A/B/C Abstraction Validation

**Date:** 2026-03-26
**Goal:** Validate the NMJL card data schema from `game-architecture.md` Decision 5 against 6 hard edge-case hands before Epic 2 begins.
**Status:** Complete

## Schema Under Test

From `game-architecture.md`:

```typescript
interface HandPattern {
  id: string
  name?: string
  points: number
  exposure: 'X' | 'C'
  groups: GroupPattern[]
}

interface GroupPattern {
  type: 'single' | 'pair' | 'pung' | 'kong' | 'quint' | 'sextet' | 'news' | 'dragon_set'
  tile?: TileRequirement
  jokerEligible: boolean
  concealed?: boolean
}

interface TileRequirement {
  color?: string            // "A", "B", "C"
  value?: number | string   // exact number, or "N", "N+1", "N+2"
  category?: 'flower' | 'wind' | 'dragon'
  specific?: TileSpecific
}

type TileSpecific =
  | 'north' | 'south' | 'east' | 'west'
  | 'red' | 'green' | 'soap'
  | 'any'
  | `any_different:${number}`
```

---

## Hand 1: Three-Suit Consecutive Kongs

**Category:** Consecutive Run
**Description:** Kong of N in one suit, kong of N+1 in second suit, kong of N+2 in third suit, dragon pair.
**Notation:** `NNNN N+1N+1N+1N+1 N+2N+2N+2N+2 DD`
**Tile count:** 4 + 4 + 4 + 2 = 14 ✓
**Tests:** Color groups A/B/C, consecutive value wildcards N/N+1/N+2, dragon with `specific: "any"`

```json
{
  "id": "cr-1",
  "name": "Three-Suit Run Kongs",
  "points": 25,
  "exposure": "X",
  "groups": [
    { "type": "kong", "tile": { "color": "A", "value": "N" }, "jokerEligible": true },
    { "type": "kong", "tile": { "color": "B", "value": "N+1" }, "jokerEligible": true },
    { "type": "kong", "tile": { "color": "C", "value": "N+2" }, "jokerEligible": true },
    { "type": "pair", "tile": { "category": "dragon", "specific": "any" }, "jokerEligible": false }
  ]
}
```

**Verdict: CLEAN.** All features work as designed.
- A/B/C ensures three different suits. Matcher tries all 6 permutations (3! = 6).
- N/N+1/N+2 constrains N to 1-7 (since N+2 ≤ 9). Matcher iterates N=1..7.
- `specific: "any"` on dragon pair means "any one dragon type, both tiles matching."
- Worst case: 6 suits × 7 values = 42 pattern attempts. Trivial.

---

## Hand 2: NEWS + Suited Kongs

**Category:** Winds-Dragons
**Description:** NEWS group, two kongs of same number in different suits, dragon pair.
**Notation:** `NEWS NNNN NNNN DD`
**Tile count:** 4 + 4 + 4 + 2 = 14 ✓
**Tests:** NEWS special group type, same value N across groups, implicit tile composition

```json
{
  "id": "wd-1",
  "name": "NEWS Double Kong",
  "points": 25,
  "exposure": "X",
  "groups": [
    { "type": "news", "jokerEligible": true },
    { "type": "kong", "tile": { "color": "A", "value": "N" }, "jokerEligible": true },
    { "type": "kong", "tile": { "color": "B", "value": "N" }, "jokerEligible": true },
    { "type": "pair", "tile": { "category": "dragon", "specific": "any" }, "jokerEligible": false }
  ]
}
```

**Verdict: CLEAN.**
- `type: "news"` has no `tile` field — composition is implicit (one each of N/E/W/S).
- Both kongs share value "N" ensuring same number, different suits via A/B.
- Joker substitution in NEWS: Joker replaces one specific wind position. Matcher concern, not schema.

---

## Hand 3: Double Quint (Joker-Required)

**Category:** Quints
**Description:** Two quints of same number in different suits, kong of same number in third suit.
**Notation:** `NNNNN NNNNN NNNN`
**Tile count:** 5 + 5 + 4 = 14 ✓
**Tests:** Quint group type, Joker-required groups (only 4 natural copies exist), three colors

```json
{
  "id": "q-1",
  "name": "Double Quint Same Number",
  "points": 50,
  "exposure": "X",
  "groups": [
    { "type": "quint", "tile": { "color": "A", "value": "N" }, "jokerEligible": true },
    { "type": "quint", "tile": { "color": "B", "value": "N" }, "jokerEligible": true },
    { "type": "kong", "tile": { "color": "C", "value": "N" }, "jokerEligible": true }
  ]
}
```

**Verdict: CLEAN.**
- Each quint needs 5 tiles but only 4 natural copies exist → minimum 1 Joker per quint, 2 Jokers total required.
- The schema doesn't encode "Jokers required" — `jokerEligible: true` just means Jokers CAN substitute. The matcher naturally handles this: when trying to fill 5 slots with 4 natural tiles, it must use at least 1 Joker.
- All three groups use same value N → same number across all suits.

---

## Hand 4: Year Hand (2026 — 0=Soap)

**Category:** 2468
**Description:** Kong of 2s, kong of Soap dragons (0=Soap), kong of 2s in different suit, pair of 6s.
**Notation:** `2222 0000 2222 66`
**Tile count:** 4 + 4 + 4 + 2 = 14 ✓
**Tests:** Exact numeric values (not wildcards), 0→Soap mapping, dragon group with specific value, mixed suited+non-suited

```json
{
  "id": "ev-1",
  "name": "2026 Year Hand",
  "points": 25,
  "exposure": "C",
  "groups": [
    { "type": "kong", "tile": { "color": "A", "value": 2 }, "jokerEligible": true, "concealed": true },
    { "type": "kong", "tile": { "category": "dragon", "specific": "soap" }, "jokerEligible": true, "concealed": true },
    { "type": "kong", "tile": { "color": "B", "value": 2 }, "jokerEligible": true, "concealed": true },
    { "type": "pair", "tile": { "color": "C", "value": 6 }, "jokerEligible": false, "concealed": true }
  ]
}
```

**Verdict: CLEAN.**
- Exact values (`value: 2`, `value: 6`) work alongside wildcard values in other hands.
- 0 → Soap mapping: `{ "category": "dragon", "specific": "soap" }` cleanly represents "0" in year digits.
- `exposure: "C"` + `concealed: true` on all groups = fully concealed hand.
- `color: "A"` and `color: "B"` for the two kongs of 2s ensures different suits.

---

## Hand 5: Flowers + Mixed Concealed/Exposed

**Category:** Singles and Pairs
**Description:** Flower kong (exposed), pung in suit A (concealed), pung in suit B (concealed), pair in suit C (concealed), flower pair (concealed).
**Notation:** `FFFF NNN NNN NN FF`
**Tile count:** 4 + 3 + 3 + 2 + 2 = 14 ✓
**Tests:** Flower category, mixed concealed/exposed at group level, multiple groups of same category

```json
{
  "id": "sp-1",
  "name": "Flower Frame",
  "points": 30,
  "exposure": "X",
  "groups": [
    { "type": "kong", "tile": { "category": "flower", "specific": "any" }, "jokerEligible": true, "concealed": false },
    { "type": "pung", "tile": { "color": "A", "value": "N" }, "jokerEligible": true, "concealed": true },
    { "type": "pung", "tile": { "color": "B", "value": "N" }, "jokerEligible": true, "concealed": true },
    { "type": "pair", "tile": { "color": "C", "value": "N" }, "jokerEligible": false, "concealed": true },
    { "type": "pair", "tile": { "category": "flower", "specific": "any" }, "jokerEligible": false, "concealed": true }
  ]
}
```

**Verdict: CLEAN, with one clarification needed.**
- `exposure: "X"` (exposed hand) but individual groups have `concealed: true/false` — this is the mixed pattern from the GDD (FR61).
- Flower kong: `{ category: "flower", specific: "any" }` → kong of any one flower type (A×4 or B×4).
- Flower pair: same `specific: "any"` → pair of any one flower type.
- **Clarification needed:** When both flower groups use `specific: "any"`, the matcher must explore whether they're same type or different. If the kong takes all 4 Flower-A tiles, the pair must be Flower-B. Constraint satisfaction handles this naturally — no schema change needed.

---

## Hand 6: Dragon Set + Same-Suit 369 Pungs

**Category:** 369
**Description:** Dragon set (one each R/G/Soap), pung of 3s, pung of 6s, pung of 9s (all same suit), dragon pair.
**Notation:** `DDD 333 666 999 DD`
**Tile count:** 3 + 3 + 3 + 3 + 2 = 14 ✓
**Tests:** dragon_set special group type, exact values in same suit, dragon pair

```json
{
  "id": "ts-1",
  "name": "Dragon 369",
  "points": 25,
  "exposure": "X",
  "groups": [
    { "type": "dragon_set", "jokerEligible": true },
    { "type": "pung", "tile": { "color": "A", "value": 3 }, "jokerEligible": true },
    { "type": "pung", "tile": { "color": "A", "value": 6 }, "jokerEligible": true },
    { "type": "pung", "tile": { "color": "A", "value": 9 }, "jokerEligible": true },
    { "type": "pair", "tile": { "category": "dragon", "specific": "any" }, "jokerEligible": false }
  ]
}
```

**Verdict: CLEAN.**
- `type: "dragon_set"` with no `tile` field — composition is implicit (Red + Green + Soap).
- Three pungs all use `color: "A"` ensuring same suit, with exact values 3, 6, 9.
- Dragon pair with `specific: "any"` — could be any one dragon type.
- Joker in dragon_set: substitutes for one specific dragon position. Matcher concern.

---

## Findings Summary

### Schema Validates: YES

All 6 edge-case hands encode cleanly with the current schema. No blocking issues found.

### Features Validated

| Feature | Hands Tested | Result |
|---------|-------------|--------|
| Color groups A/B/C (same letter = same suit) | 1, 2, 3, 4, 5, 6 | ✅ Works |
| Consecutive value wildcards (N, N+1, N+2) | 1 | ✅ Works |
| Single value wildcard (N across groups) | 2, 3, 5 | ✅ Works |
| Exact numeric values | 4, 6 | ✅ Works |
| NEWS special group (implicit composition) | 2 | ✅ Works |
| dragon_set special group (implicit composition) | 6 | ✅ Works |
| Quint with Joker requirement | 3 | ✅ Works |
| Flowers (category with specific: "any") | 5 | ✅ Works |
| Mixed concealed/exposed per group | 5 | ✅ Works |
| Fully concealed hand | 4 | ✅ Works |
| 0 → Soap mapping for year digits | 4 | ✅ Works |
| Dragon/wind with specific value | 4 | ✅ Works |
| Dragon/wind with "any" wildcard | 1, 2, 5, 6 | ✅ Works |
| Multiple groups of same category | 5 | ✅ Works |

### Clarifications for Implementation (Not Schema Changes)

1. **`news` and `dragon_set` omit `tile` field.** Their composition is implicit in the type. The matcher must handle these specially — not as "N copies of one tile" but as "one each of the defined set."

2. **`specific: "any"` semantics.** For pair/pung/kong, this means "any one specific tile in the category, all copies matching." The matcher tries each option. For example, `{ category: "dragon", specific: "any" }` with `type: "pair"` means "pair of Red OR pair of Green OR pair of Soap."

3. **`any_different:N` usage.** Not needed for any of the 6 test hands. Intended for hands where multiple groups need "different" tiles from the same category without specifying which. Example: "pung of one dragon + pung of a different dragon" → `any_different:1` + `any_different:2`. Uncommon but valid.

4. **Constraint satisfaction across groups.** When multiple groups compete for the same tile pool (e.g., two flower groups both using `specific: "any"`), the matcher's backtracking naturally handles disambiguation. No schema changes needed.

5. **Value boundary enforcement.** N+2 patterns constrain N ≤ 7 (since max value is 9). This is matcher logic, not schema validation.

6. **Joker distribution.** Quints require at least 1 Joker (only 4 natural copies exist). Two quints require at least 2 Jokers. The schema doesn't encode "minimum Jokers required" — the matcher discovers this by exhaustion. This is correct behavior — the schema describes the pattern, the matcher solves the assignment.

### Recommendation

**Proceed with Epic 2 using this schema as-is.** No modifications needed. The schema cleanly expresses all tested edge cases. The complexity lives in the pattern matcher (constraint satisfaction, backtracking, Joker distribution), not in the schema design.

The only documentation enhancement: add the clarifications above to the Story 2.1 spec so the schema implementer understands implicit group types and `specific: "any"` semantics.

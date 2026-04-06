import type { Tile, TileSuit } from "../types/tiles";
import type { NMJLCard, HandPattern, GroupPattern, GroupType } from "../types/card";
import { SUITS, WINDS, DRAGONS, FLOWERS, GROUP_SIZES } from "../constants";

export interface MatchResult {
  patternId: string;
  patternName: string;
  points: number;
}

// ---------------------------------------------------------------------------
// Tile Pool — indexed by identity key with Joker count separate
// ---------------------------------------------------------------------------

interface TilePool {
  counts: Map<string, number>;
  jokers: number;
}

function poolKey(tile: Tile): string {
  switch (tile.category) {
    case "suited":
      return `suited:${tile.suit}:${tile.value}`;
    case "wind":
      return `wind:${tile.value}`;
    case "dragon":
      return `dragon:${tile.value}`;
    case "flower":
      return `flower:${tile.value}`;
    case "joker":
      return "joker";
  }
}

function buildTilePool(tiles: Tile[]): TilePool {
  const counts = new Map<string, number>();
  let jokers = 0;
  for (const tile of tiles) {
    if (tile.category === "joker") {
      jokers++;
    } else {
      const k = poolKey(tile);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return { counts, jokers };
}

function clonePool(pool: TilePool): TilePool {
  return { counts: new Map(pool.counts), jokers: pool.jokers };
}

function take(pool: TilePool, key: string, count: number, jokerOk: boolean): boolean {
  const avail = pool.counts.get(key) ?? 0;
  if (avail >= count) {
    pool.counts.set(key, avail - count);
    return true;
  }
  if (!jokerOk) return false;
  const need = count - avail;
  if (pool.jokers < need) return false;
  pool.counts.set(key, 0);
  pool.jokers -= need;
  return true;
}

// ---------------------------------------------------------------------------
// Phase 1 — Fast feasibility filter
// ---------------------------------------------------------------------------

interface TileSummary {
  suited: number;
  wind: number;
  dragon: number;
  flower: number;
  joker: number;
}

function categorizePlayerTiles(tiles: Tile[]): TileSummary {
  const s: TileSummary = { suited: 0, wind: 0, dragon: 0, flower: 0, joker: 0 };
  for (const t of tiles) {
    s[t.category]++;
  }
  return s;
}

function filterFeasibleHands(summary: TileSummary, card: NMJLCard): HandPattern[] {
  return card.categories.flatMap((c) => c.hands).filter((h) => isFeasible(h, summary));
}

function isFeasible(hand: HandPattern, s: TileSummary): boolean {
  let sn = 0;
  let wn = 0;
  let dn = 0;
  let fn = 0;
  let jokerSlots = 0;
  for (const g of hand.groups) {
    const sz = GROUP_SIZES[g.type];
    if (g.type === "news") {
      wn += 4;
      if (g.jokerEligible) jokerSlots += 4;
    } else if (g.type === "dragon_set") {
      dn += 3;
      if (g.jokerEligible) jokerSlots += 3;
    } else if (g.tile?.category === "wind") {
      wn += sz;
      if (g.jokerEligible) jokerSlots += sz;
    } else if (g.tile?.category === "dragon") {
      dn += sz;
      if (g.jokerEligible) jokerSlots += sz;
    } else if (g.tile?.category === "flower") {
      fn += sz;
      if (g.jokerEligible) jokerSlots += sz;
    } else if (g.tile?.color) {
      sn += sz;
      if (g.jokerEligible) jokerSlots += sz;
    }
  }
  const shortfall =
    Math.max(0, sn - s.suited) +
    Math.max(0, wn - s.wind) +
    Math.max(0, dn - s.dragon) +
    Math.max(0, fn - s.flower);
  return shortfall <= s.joker && shortfall <= jokerSlots;
}

// ---------------------------------------------------------------------------
// Suit permutation generation
// ---------------------------------------------------------------------------

type SuitMap = Record<string, TileSuit>;

function getSuitPermutations(hand: HandPattern): SuitMap[] {
  const colors = new Set<string>();
  for (const g of hand.groups) {
    if (g.tile?.color) colors.add(g.tile.color);
  }
  const cl = [...colors].sort();
  if (cl.length === 0) return [{}];

  const results: SuitMap[] = [];
  const suits: TileSuit[] = [...SUITS];

  (function gen(i: number, used: Set<string>, map: SuitMap) {
    if (i >= cl.length) {
      results.push({ ...map });
      return;
    }
    for (const s of suits) {
      if (used.has(s)) continue;
      map[cl[i]] = s;
      used.add(s);
      gen(i + 1, used, map);
      used.delete(s);
    }
  })(0, new Set(), {});

  return results;
}

// ---------------------------------------------------------------------------
// Value range enumeration
// ---------------------------------------------------------------------------

function getValueRanges(hand: HandPattern): number[] {
  let maxOff = -1;
  for (const g of hand.groups) {
    const v = g.tile?.value;
    if (typeof v === "string") {
      if (v === "N") maxOff = Math.max(maxOff, 0);
      else if (v === "N+1") maxOff = Math.max(maxOff, 1);
      else if (v === "N+2") maxOff = Math.max(maxOff, 2);
    }
  }
  if (maxOff < 0) return [0]; // no N wildcards — sentinel
  const result: number[] = [];
  for (let n = 1; n <= 9 - maxOff; n++) result.push(n);
  return result;
}

// ---------------------------------------------------------------------------
// Resolve value wildcard
// ---------------------------------------------------------------------------

function resolveVal(v: number | string | undefined, n: number): number | undefined {
  if (typeof v === "number") return v;
  if (v === "N") return n;
  if (v === "N+1") return n + 1;
  if (v === "N+2") return n + 2;
  return undefined;
}

// ---------------------------------------------------------------------------
// Resolved group structure
// ---------------------------------------------------------------------------

interface RGroup {
  type: GroupType;
  jok: boolean;
  suit?: TileSuit;
  val?: number;
  cat?: "flower" | "wind" | "dragon";
  spec?: string;
}

function resolveGroup(g: GroupPattern, sm: SuitMap, n: number): RGroup | null {
  const r: RGroup = { type: g.type, jok: g.jokerEligible };
  if (g.type === "news" || g.type === "dragon_set") return r;
  if (!g.tile) return null;
  if (g.tile.color) {
    r.suit = sm[g.tile.color];
    if (!r.suit) return null;
    const v = resolveVal(g.tile.value, n);
    if (v === undefined || v < 1 || v > 9) return null;
    r.val = v;
  } else if (g.tile.category) {
    r.cat = g.tile.category;
    r.spec = g.tile.specific ?? "any";
  }
  return r;
}

// ---------------------------------------------------------------------------
// Category value pools
// ---------------------------------------------------------------------------

const CAT_POOL: Record<string, readonly string[]> = {
  dragon: DRAGONS,
  wind: WINDS,
  flower: FLOWERS,
};

// ---------------------------------------------------------------------------
// Group matching with backtracking for "any" choices
// ---------------------------------------------------------------------------

function tryMatch(
  groups: RGroup[],
  gi: number,
  pool: TilePool,
  picks: Map<string, string[]>,
): boolean {
  if (gi >= groups.length) return true;
  const g = groups[gi];
  const sz = GROUP_SIZES[g.type];

  // NEWS — one each of N/E/W/S
  if (g.type === "news") {
    const p = clonePool(pool);
    let need = 0;
    for (const w of WINDS) {
      const a = p.counts.get(`wind:${w}`) ?? 0;
      if (a > 0) p.counts.set(`wind:${w}`, a - 1);
      else need++;
    }
    if (!g.jok && need > 0) return false;
    if (need > p.jokers) return false;
    p.jokers -= need;
    return tryMatch(groups, gi + 1, p, picks);
  }

  // Dragon set — one each of red/green/soap
  if (g.type === "dragon_set") {
    const p = clonePool(pool);
    let need = 0;
    for (const d of DRAGONS) {
      const a = p.counts.get(`dragon:${d}`) ?? 0;
      if (a > 0) p.counts.set(`dragon:${d}`, a - 1);
      else need++;
    }
    if (!g.jok && need > 0) return false;
    if (need > p.jokers) return false;
    p.jokers -= need;
    return tryMatch(groups, gi + 1, p, picks);
  }

  // Suited tile group
  if (g.suit !== undefined && g.val !== undefined) {
    const key = `suited:${g.suit}:${g.val}`;
    const avail = pool.counts.get(key) ?? 0;
    if (g.jok && pool.jokers > 0) {
      const maxNat = Math.min(sz, avail);
      const minNat = Math.max(0, sz - pool.jokers);
      for (let nat = maxNat; nat >= minNat; nat--) {
        const jok = sz - nat;
        const p = clonePool(pool);
        p.counts.set(key, avail - nat);
        p.jokers -= jok;
        if (tryMatch(groups, gi + 1, p, picks)) return true;
      }
      return false;
    }
    const p = clonePool(pool);
    return take(p, key, sz, false) && tryMatch(groups, gi + 1, p, picks);
  }

  // Category tile group
  if (g.cat) {
    const catPool = CAT_POOL[g.cat];
    if (!catPool) return false;
    const spec = g.spec ?? "any";

    // Concrete specific value (e.g., "north", "red", "soap")
    if (spec !== "any" && !spec.startsWith("any_different:")) {
      const key = `${g.cat}:${spec}`;
      if (g.jok && pool.jokers > 0) {
        const avail = pool.counts.get(key) ?? 0;
        const maxNat = Math.min(sz, avail);
        const minNat = Math.max(0, sz - pool.jokers);
        for (let nat = maxNat; nat >= minNat; nat--) {
          const jok = sz - nat;
          const p = clonePool(pool);
          p.counts.set(key, avail - nat);
          p.jokers -= jok;
          if (tryMatch(groups, gi + 1, p, picks)) return true;
        }
        return false;
      }
      const p = clonePool(pool);
      return take(p, key, sz, false) && tryMatch(groups, gi + 1, p, picks);
    }

    // "any" — reuse existing category pick or try each
    if (spec === "any") {
      const existing = picks.get(g.cat);
      if (existing && existing.length > 0) {
        const p = clonePool(pool);
        return take(p, `${g.cat}:${existing[0]}`, sz, g.jok) && tryMatch(groups, gi + 1, p, picks);
      }
      for (const v of catPool) {
        const p = clonePool(pool);
        if (!take(p, `${g.cat}:${v}`, sz, g.jok)) continue;
        const np = new Map(picks);
        np.set(g.cat, [v]);
        if (tryMatch(groups, gi + 1, p, np)) return true;
      }
      return false;
    }

    // "any_different:N" — pick the Nth distinct value for this category
    const n = parseInt(spec.split(":")[1]);
    const existing = picks.get(g.cat) ?? [];
    if (existing.length >= n) {
      const p = clonePool(pool);
      return (
        take(p, `${g.cat}:${existing[n - 1]}`, sz, g.jok) && tryMatch(groups, gi + 1, p, picks)
      );
    }
    const used = new Set(existing);
    for (const v of catPool) {
      if (used.has(v)) continue;
      const p = clonePool(pool);
      if (!take(p, `${g.cat}:${v}`, sz, g.jok)) continue;
      const np = new Map(picks);
      np.set(g.cat, [...existing, v]);
      if (tryMatch(groups, gi + 1, p, np)) return true;
    }
    return false;
  }

  return false;
}

/**
 * Like {@link tryMatch}, but up to `budget` additional tiles may be "drawn" from the wall
 * (phantom naturals) to complete the hand. Each phantom tile costs 1 budget and is placed
 * on the key that the matcher needs next (same group is retried after augmentation).
 * Used by hand guidance (Story 5B.2) — distance = 14 − |pool| when this succeeds with
 * budget = 14 − |pool|.
 */
function tryMatchWithExtraBudget(
  groups: RGroup[],
  gi: number,
  pool: TilePool,
  picks: Map<string, string[]>,
  budget: number,
): boolean {
  if (gi >= groups.length) return true;
  const g = groups[gi];
  const sz = GROUP_SIZES[g.type];

  if (g.type === "news") {
    const p = clonePool(pool);
    let need = 0;
    for (const w of WINDS) {
      const a = p.counts.get(`wind:${w}`) ?? 0;
      if (a > 0) p.counts.set(`wind:${w}`, a - 1);
      else need++;
    }
    if (!g.jok && need > 0) return false;
    if (need > p.jokers) {
      const deficit = need - p.jokers;
      if (deficit > budget) return false;
      p.jokers = 0;
      return tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget - deficit);
    }
    p.jokers -= need;
    return tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget);
  }

  if (g.type === "dragon_set") {
    const p = clonePool(pool);
    let need = 0;
    for (const d of DRAGONS) {
      const a = p.counts.get(`dragon:${d}`) ?? 0;
      if (a > 0) p.counts.set(`dragon:${d}`, a - 1);
      else need++;
    }
    if (!g.jok && need > 0) return false;
    if (need > p.jokers) {
      const deficit = need - p.jokers;
      if (deficit > budget) return false;
      p.jokers = 0;
      return tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget - deficit);
    }
    p.jokers -= need;
    return tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget);
  }

  if (g.suit !== undefined && g.val !== undefined) {
    const key = `suited:${g.suit}:${g.val}`;
    const avail = pool.counts.get(key) ?? 0;
    if (g.jok && pool.jokers > 0) {
      const maxNat = Math.min(sz, avail);
      const minNat = Math.max(0, sz - pool.jokers);
      for (let nat = maxNat; nat >= minNat; nat--) {
        const jok = sz - nat;
        const p = clonePool(pool);
        p.counts.set(key, avail - nat);
        p.jokers -= jok;
        if (tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget)) return true;
      }
      if (budget > 0) {
        const p = clonePool(pool);
        p.counts.set(key, avail + 1);
        if (tryMatchWithExtraBudget(groups, gi, p, picks, budget - 1)) return true;
      }
      return false;
    }
    const p = clonePool(pool);
    if (take(p, key, sz, false)) {
      if (tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget)) return true;
    }
    if (budget > 0) {
      const p2 = clonePool(pool);
      p2.counts.set(key, (p2.counts.get(key) ?? 0) + 1);
      if (tryMatchWithExtraBudget(groups, gi, p2, picks, budget - 1)) return true;
    }
    return false;
  }

  if (g.cat) {
    const catPool = CAT_POOL[g.cat];
    if (!catPool) return false;
    const spec = g.spec ?? "any";

    if (spec !== "any" && !spec.startsWith("any_different:")) {
      const key = `${g.cat}:${spec}`;
      const avail = pool.counts.get(key) ?? 0;
      if (g.jok && pool.jokers > 0) {
        const maxNat = Math.min(sz, avail);
        const minNat = Math.max(0, sz - pool.jokers);
        for (let nat = maxNat; nat >= minNat; nat--) {
          const jok = sz - nat;
          const p = clonePool(pool);
          p.counts.set(key, avail - nat);
          p.jokers -= jok;
          if (tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget)) return true;
        }
        if (budget > 0) {
          const p = clonePool(pool);
          p.counts.set(key, avail + 1);
          if (tryMatchWithExtraBudget(groups, gi, p, picks, budget - 1)) return true;
        }
        return false;
      }
      const p = clonePool(pool);
      if (take(p, key, sz, false)) {
        if (tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget)) return true;
      }
      if (budget > 0) {
        const p2 = clonePool(pool);
        p2.counts.set(key, (p2.counts.get(key) ?? 0) + 1);
        if (tryMatchWithExtraBudget(groups, gi, p2, picks, budget - 1)) return true;
      }
      return false;
    }

    if (spec === "any") {
      const existing = picks.get(g.cat);
      if (existing && existing.length > 0) {
        const p = clonePool(pool);
        if (
          take(p, `${g.cat}:${existing[0]}`, sz, g.jok) &&
          tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget)
        ) {
          return true;
        }
        if (budget > 0) {
          const k = `${g.cat}:${existing[0]}`;
          const p2 = clonePool(pool);
          p2.counts.set(k, (p2.counts.get(k) ?? 0) + 1);
          if (tryMatchWithExtraBudget(groups, gi, p2, picks, budget - 1)) return true;
        }
        return false;
      }
      for (const v of catPool) {
        const p = clonePool(pool);
        if (!take(p, `${g.cat}:${v}`, sz, g.jok)) continue;
        const np = new Map(picks);
        np.set(g.cat, [v]);
        if (tryMatchWithExtraBudget(groups, gi + 1, p, np, budget)) return true;
      }
      if (budget > 0) {
        for (const v of catPool) {
          const p = clonePool(pool);
          const k = `${g.cat}:${v}`;
          p.counts.set(k, (p.counts.get(k) ?? 0) + 1);
          const np = new Map(picks);
          np.set(g.cat, [v]);
          if (tryMatchWithExtraBudget(groups, gi, p, np, budget - 1)) return true;
        }
      }
      return false;
    }

    const n = parseInt(spec.split(":")[1]);
    const existing = picks.get(g.cat) ?? [];
    if (existing.length >= n) {
      const p = clonePool(pool);
      if (
        take(p, `${g.cat}:${existing[n - 1]}`, sz, g.jok) &&
        tryMatchWithExtraBudget(groups, gi + 1, p, picks, budget)
      ) {
        return true;
      }
      if (budget > 0) {
        const k = `${g.cat}:${existing[n - 1]}`;
        const p2 = clonePool(pool);
        p2.counts.set(k, (p2.counts.get(k) ?? 0) + 1);
        if (tryMatchWithExtraBudget(groups, gi, p2, picks, budget - 1)) return true;
      }
      return false;
    }
    const used = new Set(existing);
    for (const v of catPool) {
      if (used.has(v)) continue;
      const p = clonePool(pool);
      if (!take(p, `${g.cat}:${v}`, sz, g.jok)) continue;
      const np = new Map(picks);
      np.set(g.cat, [...existing, v]);
      if (tryMatchWithExtraBudget(groups, gi + 1, p, np, budget)) return true;
    }
    if (budget > 0) {
      for (const v of catPool) {
        if (used.has(v)) continue;
        const p = clonePool(pool);
        const k = `${g.cat}:${v}`;
        p.counts.set(k, (p.counts.get(k) ?? 0) + 1);
        const np = new Map(picks);
        np.set(g.cat, [...existing, v]);
        if (tryMatchWithExtraBudget(groups, gi, p, np, budget - 1)) return true;
      }
    }
    return false;
  }

  return false;
}

/**
 * True iff `tiles` (length 14) completes `pattern` under the same matching rules as
 * {@link validateHand} for a single pattern.
 */
export function matchesSpecificPattern(tiles: Tile[], pattern: HandPattern): boolean {
  if (tiles.length !== 14) return false;
  const summary = categorizePlayerTiles(tiles);
  if (!isFeasible(pattern, summary)) return false;
  const pool = buildTilePool(tiles);
  const suitPerms = getSuitPermutations(pattern);
  const valRanges = getValueRanges(pattern);
  for (const sm of suitPerms) {
    for (const nv of valRanges) {
      const resolved: RGroup[] = [];
      let ok = true;
      for (const g of pattern.groups) {
        const r = resolveGroup(g, sm, nv || 1);
        if (!r) {
          ok = false;
          break;
        }
        resolved.push(r);
      }
      if (!ok) continue;
      if (tryMatch(resolved, 0, clonePool(pool), new Map())) return true;
    }
  }
  return false;
}

/**
 * Minimum extra tiles to draw so the hand can complete `pattern`, or `null` if impossible.
 * When `tiles.length === 14`, returns `0` if the pattern matches, else `null`.
 * When `tiles.length < 14`, returns `14 - tiles.length` if completable with exactly that many
 * draws (optimally chosen), else `null`.
 */
export function minAdditionalTilesForPattern(tiles: Tile[], pattern: HandPattern): number | null {
  const n = tiles.length;
  if (n > 14) return null;
  const summary = categorizePlayerTiles(tiles);
  /** Phase-1 filter assumes 14 tiles; partial pools can be wrongly rejected (e.g. 13 naturals, 1 draw left). */
  if (n === 14 && !isFeasible(pattern, summary)) return null;
  const pool = buildTilePool(tiles);
  const suitPerms = getSuitPermutations(pattern);
  const valRanges = getValueRanges(pattern);

  if (n === 14) {
    for (const sm of suitPerms) {
      for (const nv of valRanges) {
        const resolved: RGroup[] = [];
        let ok = true;
        for (const g of pattern.groups) {
          const r = resolveGroup(g, sm, nv || 1);
          if (!r) {
            ok = false;
            break;
          }
          resolved.push(r);
        }
        if (!ok) continue;
        if (tryMatch(resolved, 0, clonePool(pool), new Map())) return 0;
      }
    }
    return null;
  }

  const need = 14 - n;
  for (const sm of suitPerms) {
    for (const nv of valRanges) {
      const resolved: RGroup[] = [];
      let ok = true;
      for (const g of pattern.groups) {
        const r = resolveGroup(g, sm, nv || 1);
        if (!r) {
          ok = false;
          break;
        }
        resolved.push(r);
      }
      if (!ok) continue;
      if (tryMatchWithExtraBudget(resolved, 0, clonePool(pool), new Map(), need)) return need;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function validateHand(tiles: Tile[], card: NMJLCard): MatchResult | null {
  if (tiles.length !== 14) return null;

  const summary = categorizePlayerTiles(tiles);
  const feasible = filterFeasibleHands(summary, card);
  const pool = buildTilePool(tiles);

  let best: MatchResult | null = null;

  for (const hand of feasible) {
    if (best && hand.points < best.points) continue;

    const suitPerms = getSuitPermutations(hand);
    const valRanges = getValueRanges(hand);

    let matched = false;
    for (const sm of suitPerms) {
      if (matched) break;
      for (const nv of valRanges) {
        const resolved: RGroup[] = [];
        let ok = true;
        for (const g of hand.groups) {
          const r = resolveGroup(g, sm, nv || 1);
          if (!r) {
            ok = false;
            break;
          }
          resolved.push(r);
        }
        if (!ok) continue;

        if (tryMatch(resolved, 0, clonePool(pool), new Map())) {
          if (!best || hand.points > best.points) {
            best = {
              patternId: hand.id,
              patternName: hand.name ?? hand.id,
              points: hand.points,
            };
          }
          matched = true;
          break;
        }
      }
    }
  }

  return best;
}

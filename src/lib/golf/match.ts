import { vegasCombine, vegasHoleResult } from "./formats.ts";

export type HoleResult = "A" | "B" | "H" | null;

export type MatchStanding = {
  thru: number;
  holesUp: number;
  leader: "A" | "B" | null;
  closed: boolean;
  result: string;
  holeWinners: HoleResult[];
};

function formatStanding(leader: "A" | "B" | null, holesUp: number, thru: number, remaining: number): {
  closed: boolean;
  result: string;
} {
  if (thru === 0) return { closed: false, result: "ALL SQUARE" };
  if (!leader || holesUp === 0) {
    if (thru >= 18) return { closed: true, result: "AS" };
    return { closed: false, result: "ALL SQUARE" };
  }
  if (holesUp > remaining) {
    const closedLabel = remaining === 0 ? `${holesUp} UP` : `${holesUp} & ${remaining}`;
    return { closed: true, result: closedLabel };
  }
  if (thru >= 18) return { closed: true, result: `${holesUp} UP` };
  return { closed: false, result: `${holesUp} UP` };
}

/**
 * Two-man best-ball match play. Each side's hole score is the lower net of
 * the two partners. Winner is decided hole-by-hole, not by total.
 */
export function computeMatch(
  aNets: Array<number | null>,
  bNets: Array<number | null>,
): MatchStanding {
  const aHoles: Array<number | null> = [];
  const bHoles: Array<number | null> = [];
  for (let i = 0; i < 18; i += 1) {
    const aBest = [aNets[i * 2] ?? null, aNets[i * 2 + 1] ?? null].filter((n): n is number => n != null);
    const bBest = [bNets[i * 2] ?? null, bNets[i * 2 + 1] ?? null].filter((n): n is number => n != null);
    aHoles.push(aBest.length ? Math.min(...aBest) : null);
    bHoles.push(bBest.length ? Math.min(...bBest) : null);
  }
  return computeSides(aHoles, bHoles);
}

/** Hole-by-hole match from two sides of 18 scores. */
export function computeSides(aHoles: Array<number | null>, bHoles: Array<number | null>): MatchStanding {
  const holeWinners: HoleResult[] = Array.from({ length: 18 }, () => null);
  let aUp = 0;
  let thru = 0;
  let closedAt: { holesUp: number; remaining: number; leader: "A" | "B" } | null = null;

  for (let i = 0; i < 18; i += 1) {
    const aScore = aHoles[i] ?? null;
    const bScore = bHoles[i] ?? null;
    if (aScore == null || bScore == null) break;

    if (aScore < bScore) {
      holeWinners[i] = "A";
      aUp += 1;
    } else if (bScore < aScore) {
      holeWinners[i] = "B";
      aUp -= 1;
    } else {
      holeWinners[i] = "H";
    }
    thru = i + 1;
    const remaining = 18 - thru;
    const holesUp = Math.abs(aUp);
    const leader = aUp > 0 ? "A" : aUp < 0 ? "B" : null;
    if (leader && holesUp > remaining) {
      closedAt = { holesUp, remaining, leader };
      break;
    }
  }

  const leader = closedAt?.leader ?? (aUp > 0 ? "A" : aUp < 0 ? "B" : null);
  const holesUp = closedAt?.holesUp ?? Math.abs(aUp);
  const remaining = 18 - thru;
  const standing = closedAt
    ? {
        closed: true,
        result: closedAt.remaining === 0 ? `${closedAt.holesUp} UP` : `${closedAt.holesUp} & ${closedAt.remaining}`,
      }
    : formatStanding(leader, holesUp, thru, remaining);

  return {
    thru,
    holesUp,
    leader,
    closed: standing.closed,
    result: standing.result,
    holeWinners,
  };
}

/** Running total for a pair with no opponent (intergroup field team). */
export function computeStrokeTotal(holes: Array<number | null>, label: string): MatchStanding {
  let total = 0;
  let thru = 0;
  for (const n of holes) {
    if (n == null) break;
    total += n;
    thru += 1;
  }
  return {
    thru,
    holesUp: total,
    leader: null,
    closed: thru >= 18,
    result: thru ? `${label} ${total}` : `${label} —`,
    holeWinners: Array.from({ length: 18 }, () => null),
  };
}

export type VegasHoleInput = {
  aNets: [number, number] | null;
  bNets: [number, number] | null;
  aBirdie: boolean;
  bBirdie: boolean;
  aEagle: boolean;
  bEagle: boolean;
};

/** 2v2 Vegas. Never closes early — you play all 18. holesUp is the point differential. */
export function computeVegas(holes: VegasHoleInput[]): MatchStanding {
  const holeWinners: HoleResult[] = Array.from({ length: 18 }, () => null);
  let aPts = 0;
  let thru = 0;
  for (let i = 0; i < 18; i += 1) {
    const h = holes[i];
    if (!h?.aNets || !h.bNets) break;
    const r = vegasHoleResult({
      aNets: h.aNets,
      bNets: h.bNets,
      aBirdie: h.aBirdie,
      bBirdie: h.bBirdie,
      aEagle: h.aEagle,
      bEagle: h.bEagle,
    });
    aPts += r.aPoints;
    holeWinners[i] = r.aPoints > 0 ? "A" : r.aPoints < 0 ? "B" : "H";
    thru = i + 1;
  }
  const leader = aPts > 0 ? "A" : aPts < 0 ? "B" : null;
  const holesUp = Math.abs(aPts);
  return {
    thru,
    holesUp,
    leader,
    closed: thru >= 18,
    result: thru === 0 ? "EVEN" : leader ? `${leader} ${holesUp}` : "EVEN",
    holeWinners,
  };
}

/** Pair Vegas vs the field: cumulative combined number, lower is better. */
export function computeVegasTotal(holes: Array<[number, number] | null>): MatchStanding {
  const combined: Array<number | null> = holes.map((h) => (h ? vegasCombine(h[0], h[1]) : null));
  return computeStrokeTotal(combined, "Vegas");
}

export type RotatingVegasHole = {
  a1: number;
  a2: number;
  b1: number;
  b2: number;
  nets: Record<number, number>;
  birdie: Record<number, boolean>;
  eagle: Record<number, boolean>;
};

export type RotatingVegasStanding = MatchStanding & { points: Map<number, number> };

/**
 * 4-man Vegas with a new 2v2 every hole. Each partner on the winning side
 * takes +swing; the other pair takes −swing. Stops at the first hole that
 * is missing a split or a net.
 */
export function computeRotatingVegas(
  playerIds: number[],
  holes: Array<RotatingVegasHole | null>,
  nameOf?: (id: number) => string,
): RotatingVegasStanding {
  const pts = new Map<number, number>(playerIds.map((id) => [id, 0]));
  const holeWinners: HoleResult[] = Array.from({ length: 18 }, () => null);
  let thru = 0;
  for (let i = 0; i < 18; i += 1) {
    const h = holes[i];
    if (!h) break;
    const a1n = h.nets[h.a1];
    const a2n = h.nets[h.a2];
    const b1n = h.nets[h.b1];
    const b2n = h.nets[h.b2];
    if (a1n == null || a2n == null || b1n == null || b2n == null) break;
    const r = vegasHoleResult({
      aNets: [a1n, a2n],
      bNets: [b1n, b2n],
      aBirdie: Boolean(h.birdie[h.a1] || h.birdie[h.a2]),
      bBirdie: Boolean(h.birdie[h.b1] || h.birdie[h.b2]),
      aEagle: Boolean(h.eagle[h.a1] || h.eagle[h.a2]),
      bEagle: Boolean(h.eagle[h.b1] || h.eagle[h.b2]),
    });
    for (const id of [h.a1, h.a2]) pts.set(id, (pts.get(id) ?? 0) + r.aPoints);
    for (const id of [h.b1, h.b2]) pts.set(id, (pts.get(id) ?? 0) - r.aPoints);
    holeWinners[i] = r.aPoints > 0 ? "A" : r.aPoints < 0 ? "B" : "H";
    thru = i + 1;
  }
  const board = [...pts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const lead = board[0]?.[1] ?? 0;
  const label = (id: number, n: number) => (nameOf ? `${nameOf(id)} ${n}` : String(n));
  return {
    thru,
    holesUp: Math.abs(lead),
    leader: null,
    closed: thru >= 18,
    result: thru === 0 ? "EVEN" : board.map(([id, n]) => label(id, n)).join(" · "),
    holeWinners,
    points: pts,
  };
}

export function pointsFor(side: "A" | "B", standing: MatchStanding): { a: number; b: number } {
  if (!standing.closed && standing.thru < 18) return { a: 0, b: 0 };
  if (!standing.leader || standing.holesUp === 0) return { a: 0.5, b: 0.5 };
  return standing.leader === "A" ? { a: 1, b: 0 } : { a: 0, b: 1 };
}

export type MatchHoleTally = {
  playerId: number;
  won: number;
  lost: number;
  halved: number;
};

export function matchHoleTallies(args: {
  players: { id: number }[];
  matches: { a1: number; a2: number | null; b1: number | null; b2: number | null; round_id: number }[];
  scores: { player_id: number; round_id: number; hole_number: number; net: number }[];
}): MatchHoleTally[] {
  const tallies = new Map<number, MatchHoleTally>();
  for (const p of args.players) {
    tallies.set(p.id, { playerId: p.id, won: 0, lost: 0, halved: 0 });
  }
  const netAt = (pid: number, roundId: number, hole: number) =>
    args.scores.find((s) => s.player_id === pid && s.round_id === roundId && s.hole_number === hole)?.net ?? null;

  for (const m of args.matches) {
    if (m.a2 == null || m.b1 == null || m.b2 == null) continue;
    const aNets: Array<number | null> = [];
    const bNets: Array<number | null> = [];
    for (let h = 1; h <= 18; h += 1) {
      aNets.push(netAt(m.a1, m.round_id, h), netAt(m.a2, m.round_id, h));
      bNets.push(netAt(m.b1, m.round_id, h), netAt(m.b2, m.round_id, h));
    }
    const standing = computeMatch(aNets, bNets);
    const aSide = [m.a1, m.a2];
    const bSide = [m.b1, m.b2];
    for (const w of standing.holeWinners) {
      if (!w) continue;
      if (w === "H") {
        for (const id of [...aSide, ...bSide]) {
          const row = tallies.get(id);
          if (row) row.halved += 1;
        }
      } else if (w === "A") {
        for (const id of aSide) {
          const row = tallies.get(id);
          if (row) row.won += 1;
        }
        for (const id of bSide) {
          const row = tallies.get(id);
          if (row) row.lost += 1;
        }
      } else {
        for (const id of bSide) {
          const row = tallies.get(id);
          if (row) row.won += 1;
        }
        for (const id of aSide) {
          const row = tallies.get(id);
          if (row) row.lost += 1;
        }
      }
    }
  }
  return [...tallies.values()];
}

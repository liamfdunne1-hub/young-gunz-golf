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
  const holeWinners: HoleResult[] = Array.from({ length: 18 }, () => null);
  let aUp = 0;
  let thru = 0;
  let closedAt: { holesUp: number; remaining: number; leader: "A" | "B" } | null = null;

  for (let i = 0; i < 18; i += 1) {
    const a1 = aNets[i * 2] ?? null;
    const a2 = aNets[i * 2 + 1] ?? null;
    const b1 = bNets[i * 2] ?? null;
    const b2 = bNets[i * 2 + 1] ?? null;
    const aBest = [a1, a2].filter((n): n is number => n != null);
    const bBest = [b1, b2].filter((n): n is number => n != null);
    if (!aBest.length || !bBest.length) break;

    const aScore = Math.min(...aBest);
    const bScore = Math.min(...bBest);
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
  matches: { a1: number; a2: number; b1: number; b2: number; round_id: number }[];
  scores: { player_id: number; round_id: number; hole_number: number; net: number }[];
}): MatchHoleTally[] {
  const tallies = new Map<number, MatchHoleTally>();
  for (const p of args.players) {
    tallies.set(p.id, { playerId: p.id, won: 0, lost: 0, halved: 0 });
  }
  const netAt = (pid: number, roundId: number, hole: number) =>
    args.scores.find((s) => s.player_id === pid && s.round_id === roundId && s.hole_number === hole)?.net ?? null;

  for (const m of args.matches) {
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

import type { Bootstrap } from "@/lib/golf/derive";
import { playerName } from "@/lib/utils";

export type RoundTeam = {
  key: string;
  roundId: number;
  roundNumber: number;
  roundName: string;
  a: number;
  b: number;
  label: string;
  holes: number;
  combinedGross: number | null;
  combinedNet: number | null;
  bestBallGross: number | null;
  bestBallNet: number | null;
  source: "match" | "pair";
};

type HoleLine = { hole: number; gross: number; net: number };

function card(data: Bootstrap, roundId: number, playerId: number): HoleLine[] {
  return data.scores
    .filter((s) => s.round_id === roundId && s.player_id === playerId)
    .map((s) => ({ hole: s.hole_number, gross: s.gross, net: s.net }));
}

function combined(lines: HoleLine[], key: "gross" | "net"): number | null {
  if (!lines.length) return null;
  return lines.reduce((s, h) => s + h[key], 0);
}

function bestBall(a: HoleLine[], b: HoleLine[], key: "gross" | "net"): number | null {
  let total = 0;
  let n = 0;
  for (let hole = 1; hole <= 18; hole += 1) {
    const av = a.find((h) => h.hole === hole)?.[key];
    const bv = b.find((h) => h.hole === hole)?.[key];
    const vals = [av, bv].filter((v): v is number => v != null);
    if (!vals.length) continue;
    total += Math.min(...vals);
    n += 1;
  }
  return n ? total : null;
}

function labelOf(data: Bootstrap, a: number, b: number): string {
  const pa = data.players.find((p) => p.id === a);
  const pb = data.players.find((p) => p.id === b);
  return `${pa ? playerName(pa) : "?"} / ${pb ? playerName(pb) : "?"}`;
}

export function deriveRoundTeams(data: Bootstrap): RoundTeam[] {
  const used = new Set<string>();
  const teams: RoundTeam[] = [];

  const push = (roundId: number, a: number, b: number, source: "match" | "pair") => {
    const pair = a < b ? `${roundId}:${a}:${b}` : `${roundId}:${b}:${a}`;
    if (used.has(pair)) return;
    used.add(pair);
    const round = data.rounds.find((r) => r.id === roundId);
    if (!round) return;
    const ca = card(data, roundId, a);
    const cb = card(data, roundId, b);
    const holes = new Set([...ca, ...cb].map((h) => h.hole)).size;
    teams.push({
      key: pair,
      roundId,
      roundNumber: round.round_number,
      roundName: round.name,
      a,
      b,
      label: labelOf(data, a, b),
      holes,
      combinedGross: addNullable(combined(ca, "gross"), combined(cb, "gross")),
      combinedNet: addNullable(combined(ca, "net"), combined(cb, "net")),
      bestBallGross: bestBall(ca, cb, "gross"),
      bestBallNet: bestBall(ca, cb, "net"),
      source,
    });
  };

  for (const m of data.matches) {
    push(m.round_id, m.a1, m.a2, "match");
    push(m.round_id, m.b1, m.b2, "match");
  }

  for (const g of data.groups) {
    const ids = data.groupPlayers.filter((gp) => gp.group_id === g.id).map((gp) => gp.player_id);
    if (ids.length === 2) push(g.round_id, ids[0], ids[1], "pair");
    if (ids.length === 4) {
      push(g.round_id, ids[0], ids[1], "pair");
      push(g.round_id, ids[2], ids[3], "pair");
    }
  }

  return teams.sort((x, y) => x.roundNumber - y.roundNumber || x.label.localeCompare(y.label));
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

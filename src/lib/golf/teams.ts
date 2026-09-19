import type { Bootstrap } from "@/lib/golf/derive";
import { asFormat, isRotatingVegas, isTeamFormat, isVegas, vegasCombine, type RoundFormat } from "@/lib/golf/formats";
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

export type IntergroupRow = {
  key: string;
  roundId: number;
  groupNumber: number;
  format: RoundFormat;
  a: number;
  b: number;
  label: string;
  thru: number;
  gameScore: number | null;
  gameName: string;
  netToPar: number | null;
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

  const push = (roundId: number, a: number, b: number | null, source: "match" | "pair") => {
    if (!b) return;
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
    if (isRotatingVegas(asFormat(m.format), m)) continue;
    if (m.a2) push(m.round_id, m.a1, m.a2, "match");
    if (m.b1 && m.b2) push(m.round_id, m.b1, m.b2, "match");
  }

  for (const g of data.groups) {
    const ids = data.groupPlayers.filter((gp) => gp.group_id === g.id).map((gp) => gp.player_id);
    if (ids.length === 2) push(g.round_id, ids[0]!, ids[1]!, "pair");
    if (ids.length === 4) {
      push(g.round_id, ids[0]!, ids[1]!, "pair");
      push(g.round_id, ids[2]!, ids[3]!, "pair");
    }
  }

  return teams.sort((x, y) => x.roundNumber - y.roundNumber || x.label.localeCompare(y.label));
}

export function deriveIntergroup(data: Bootstrap, roundId: number): IntergroupRow[] {
  const round = data.rounds.find((r) => r.id === roundId);
  if (!round) return [];
  const holesMeta = data.holes.filter((h) => h.tee_id === round.tee_id);
  const parOf = (n: number) => holesMeta.find((h) => h.number === n)?.par ?? 4;
  const used = new Set<string>();
  const rows: IntergroupRow[] = [];

  const push = (args: {
    groupNumber: number;
    format: RoundFormat;
    a: number;
    b: number;
    matchId?: number;
    side?: "A" | "B";
  }) => {
    const pair = args.a < args.b ? `${roundId}:${args.a}:${args.b}` : `${roundId}:${args.b}:${args.a}`;
    if (used.has(pair)) return;
    used.add(pair);
    const ca = card(data, roundId, args.a);
    const cb = card(data, roundId, args.b);
    const posted = new Set([...ca, ...cb].map((h) => h.hole));
    const thru = posted.size;
    const bbNet = bestBall(ca, cb, "net");
    const parPlayed = [...posted].reduce((s, n) => s + parOf(n), 0);
    let gameScore = bbNet;
    let gameName = "Best-ball net";
    if (isVegas(args.format)) {
      let vegas = 0;
      let n = 0;
      for (let hole = 1; hole <= 18; hole += 1) {
        const av = ca.find((h) => h.hole === hole)?.net;
        const bv = cb.find((h) => h.hole === hole)?.net;
        if (av == null || bv == null) continue;
        vegas += vegasCombine(av, bv);
        n += 1;
      }
      gameScore = n ? vegas : null;
      gameName = "Vegas";
    } else if (isTeamFormat(args.format) && args.matchId) {
      const teamLines = data.teamScores.filter(
        (t) => t.match_id === args.matchId && t.side === (args.side ?? "A"),
      );
      if (teamLines.length) {
        gameScore = teamLines.reduce((s, t) => s + t.net, 0);
        gameName = "Team net";
      }
    }
    const netToPar = bbNet == null ? null : bbNet - parPlayed;
    rows.push({
      key: pair,
      roundId,
      groupNumber: args.groupNumber,
      format: args.format,
      a: args.a,
      b: args.b,
      label: labelOf(data, args.a, args.b),
      thru,
      gameScore,
      gameName,
      netToPar,
    });
  };

  for (const m of data.matches.filter((x) => x.round_id === roundId)) {
    const format = asFormat(m.format, asFormat(round.format));
    if (format === "wolf") continue;
    if (isRotatingVegas(format, m)) continue;
    const group = data.groups.find((g) => g.id === m.group_id);
    const groupNumber = group?.group_number ?? 0;
    if (m.a2) push({ groupNumber, format, a: m.a1, b: m.a2, matchId: m.id, side: "A" });
    if (m.b1 && m.b2) push({ groupNumber, format, a: m.b1, b: m.b2, matchId: m.id, side: "B" });
  }

  for (const g of data.groups.filter((x) => x.round_id === roundId)) {
    const ids = data.groupPlayers.filter((gp) => gp.group_id === g.id).map((gp) => gp.player_id);
    if (ids.length !== 2) continue;
    push({
      groupNumber: g.group_number,
      format: asFormat(g.format, asFormat(round.format)),
      a: ids[0]!,
      b: ids[1]!,
    });
  }

  const allVegas = rows.length > 0 && rows.every((r) => r.format === "vegas");
  return rows.sort((a, b) => {
    if (allVegas) return (a.gameScore ?? 9999) - (b.gameScore ?? 9999) || a.label.localeCompare(b.label);
    if (a.netToPar == null && b.netToPar == null) return a.label.localeCompare(b.label);
    if (a.netToPar == null) return 1;
    if (b.netToPar == null) return -1;
    return a.netToPar - b.netToPar || a.label.localeCompare(b.label);
  });
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

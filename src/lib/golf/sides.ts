import { SIDE_LABEL, playersOnSide, type Side } from "./roster.ts";

export type SidePlayer = {
  playerId: number;
  slug: string;
  holes: number;
  grossToPar: number | null;
  netToPar: number | null;
};

export type SideFive = {
  side: Side;
  label: string;
  holes: number;
  grossToPar: number | null;
  netToPar: number | null;
  players: SidePlayer[];
};

type SideInput = {
  players: { id: number; slug: string; side?: string | null }[];
  scores: { round_id: number; player_id: number; hole_number: number; gross: number; net: number }[];
  rounds: { id: number; tee_id: number }[];
  holes: { tee_id: number; number: number; par: number }[];
};

function parFor(data: SideInput, roundId: number, hole: number): number {
  const round = data.rounds.find((r) => r.id === roundId);
  if (!round) return 4;
  return data.holes.find((h) => h.tee_id === round.tee_id && h.number === hole)?.par ?? 4;
}

/** Aggregate net 5v5. Each side is the five field sides; score is the sum of nets to par. */
export function deriveSideFive(data: SideInput, roundId: number | "all"): SideFive[] {
  return (["a", "b"] as const).map((side) => {
    const players = playersOnSide(data.players, side).map((p) => {
      const mine = data.scores.filter(
        (s) => s.player_id === p.id && (roundId === "all" || s.round_id === roundId),
      );
      if (!mine.length) {
        return { playerId: p.id, slug: p.slug, holes: 0, grossToPar: null, netToPar: null };
      }
      let grossToPar = 0;
      let netToPar = 0;
      for (const s of mine) {
        const par = parFor(data, s.round_id, s.hole_number);
        grossToPar += s.gross - par;
        netToPar += s.net - par;
      }
      return { playerId: p.id, slug: p.slug, holes: mine.length, grossToPar, netToPar };
    });
    const scored = players.filter((p) => p.netToPar != null);
    return {
      side,
      label: SIDE_LABEL[side],
      holes: scored.reduce((n, p) => n + p.holes, 0),
      grossToPar: scored.length ? scored.reduce((n, p) => n + (p.grossToPar ?? 0), 0) : null,
      netToPar: scored.length ? scored.reduce((n, p) => n + (p.netToPar ?? 0), 0) : null,
      players,
    };
  });
}

export function sideMargin(sides: SideFive[]): string {
  const a = sides.find((s) => s.side === "a")?.netToPar;
  const b = sides.find((s) => s.side === "b")?.netToPar;
  if (a == null || b == null) return "Waiting on cards";
  if (a === b) return "All square";
  return a < b ? `A by ${b - a}` : `B by ${a - b}`;
}

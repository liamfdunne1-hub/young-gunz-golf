import { strokesOnHole } from "@/lib/golf/handicap";
import { matchHoleTallies } from "@/lib/golf/match";
import { computeSkins, type SkinsBoard } from "@/lib/golf/skins";
import type { Player } from "@/lib/types";

export type Bootstrap = Awaited<ReturnType<typeof import("@/lib/server/bootstrap").loadBootstrap>>;

export type PlayerStats = {
  playerId: number;
  roundsPlayed: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  grossAvg: number | null;
  netAvg: number | null;
  bestGross: number | null;
  worstGross: number | null;
  birdies: number;
  eagles: number;
  pars: number;
  bogeys: number;
  doubles: number;
  grossTotal: number | null;
  netTotal: number | null;
  grossToPar: number | null;
  netToPar: number | null;
  askSeth: number;
  money: number;
  skins: number;
  skinsHoles: number;
  skinsValue: number;
  holesWon: number;
  holesLost: number;
  holesHalved: number;
  worstHole: number | null;
  bestHoleToPar: number | null;
  worstHoleToPar: number | null;
};

export function skinsBoard(data: Bootstrap): SkinsBoard {
  const holes = data.rounds.flatMap((r) =>
    data.holes
      .filter((h) => h.tee_id === r.tee_id)
      .map((h) => ({
        roundId: r.id,
        roundNumber: r.round_number,
        hole: h.number,
        par: h.par,
        status: r.status,
      })),
  );
  return computeSkins({
    pot: data.trip.skins_pot,
    fieldIds: data.players.map((p) => p.id),
    rounds: data.rounds.map((r) => ({
      id: r.id,
      roundNumber: r.round_number,
      status: r.status,
    })),
    holes,
    scores: data.scores.map((s) => ({
      roundId: s.round_id,
      playerId: s.player_id,
      hole: s.hole_number,
      gross: s.gross,
    })),
  });
}

export function deriveStats(data: Bootstrap): PlayerStats[] {
  const parFor = (roundId: number, hole: number) => {
    const round = data.rounds.find((r) => r.id === roundId);
    if (!round) return 4;
    const holeRow = data.holes.find((h) => h.tee_id === round.tee_id && h.number === hole);
    return holeRow?.par ?? 4;
  };

  const skins = skinsBoard(data);
  const holeTallies = matchHoleTallies({
    players: data.players,
    matches: data.matches,
    scores: data.scores,
  });

  return data.players.map((p) => {
    const mine = data.scores.filter((s) => s.player_id === p.id);
    const byRound = new Map<number, typeof mine>();
    for (const s of mine) {
      const arr = byRound.get(s.round_id) ?? [];
      arr.push(s);
      byRound.set(s.round_id, arr);
    }
    const roundGross: number[] = [];
    const roundNet: number[] = [];
    let birdies = 0,
      eagles = 0,
      pars = 0,
      bogeys = 0,
      doubles = 0,
      grossToPar = 0,
      netToPar = 0,
      worstHole: number | null = null,
      bestHoleToPar: number | null = null,
      worstHoleToPar: number | null = null;
    let scoredHoles = 0;
    for (const [rid, holes] of byRound) {
      if (!holes.length) continue;
      scoredHoles += holes.length;
      if (holes.length >= 18) {
        roundGross.push(holes.reduce((s, h) => s + h.gross, 0));
        roundNet.push(holes.reduce((s, h) => s + h.net, 0));
      }
      for (const h of holes) {
        const par = parFor(rid, h.hole_number);
        const d = h.gross - par;
        if (d <= -2) eagles += 1;
        else if (d === -1) birdies += 1;
        else if (d === 0) pars += 1;
        else if (d === 1) bogeys += 1;
        else doubles += 1;
        grossToPar += d;
        netToPar += h.net - par;
        worstHole = worstHole == null ? h.gross : Math.max(worstHole, h.gross);
        bestHoleToPar = bestHoleToPar == null ? d : Math.min(bestHoleToPar, d);
        worstHoleToPar = worstHoleToPar == null ? d : Math.max(worstHoleToPar, d);
      }
    }

    let wins = 0,
      losses = 0,
      ties = 0,
      points = 0,
      matchesPlayed = 0;
    for (const m of data.matches) {
      const side = m.a1 === p.id || m.a2 === p.id ? "A" : m.b1 === p.id || m.b2 === p.id ? "B" : null;
      if (!side) continue;
      if (m.status !== "final") continue;
      matchesPlayed += 1;
      if (!m.winner_side) {
        ties += 1;
        points += 0.5;
      } else if (m.winner_side === side) {
        wins += 1;
        points += 1;
      } else {
        losses += 1;
      }
    }

    const askSeth = data.askSeth.find((a) => a.player_id === p.id)?.n ?? 0;
    const contributed = data.contributions.find((c) => c.player_id === p.id)?.total ?? 0;
    const paid = data.settlements.find((s) => s.player_id === p.id)?.total ?? 0;
    let matchMoney = 0;
    for (const e of data.ledger) {
      if (e.to_player_id === p.id) matchMoney += e.amount;
      if (e.from_player_id === p.id) matchMoney -= e.amount;
    }

    const skinRow = skins.standings.find((s) => s.playerId === p.id);
    const tally = holeTallies.find((t) => t.playerId === p.id);

    return {
      playerId: p.id,
      roundsPlayed: byRound.size,
      matchesPlayed,
      wins,
      losses,
      ties,
      points,
      grossAvg: roundGross.length ? roundGross.reduce((a, b) => a + b, 0) / roundGross.length : null,
      netAvg: roundNet.length ? roundNet.reduce((a, b) => a + b, 0) / roundNet.length : null,
      bestGross: roundGross.length ? Math.min(...roundGross) : null,
      worstGross: roundGross.length ? Math.max(...roundGross) : null,
      birdies,
      eagles,
      pars,
      bogeys,
      doubles,
      grossTotal: roundGross.length ? roundGross.reduce((a, b) => a + b, 0) : null,
      netTotal: roundNet.length ? roundNet.reduce((a, b) => a + b, 0) : null,
      grossToPar: scoredHoles ? grossToPar : null,
      netToPar: scoredHoles ? netToPar : null,
      askSeth,
      money: paid - contributed + matchMoney,
      skins: skinRow?.skins ?? 0,
      skinsHoles: skinRow?.holesWon ?? 0,
      skinsValue: skinRow?.value ?? 0,
      holesWon: tally?.won ?? 0,
      holesLost: tally?.lost ?? 0,
      holesHalved: tally?.halved ?? 0,
      worstHole,
      bestHoleToPar,
      worstHoleToPar,
    };
  });
}

export function metricLabels(): { key: keyof Player["joke_metrics"]; label: string }[] {
  return [
    { key: "driving", label: "Driving Ability" },
    { key: "irons", label: "Iron Play" },
    { key: "putting", label: "Putting" },
    { key: "alcohol", label: "Alcohol Tolerance" },
    { key: "lipOut", label: "Likelihood of Complaining About a Lip-Out" },
    { key: "thatsGood", label: "Likelihood of Saying “That’s Good”" },
    { key: "breakfastBall", label: "Breakfast Ball Dependency" },
    { key: "cart", label: "Cart Management" },
    { key: "wakeup", label: "Ability to Wake Up for a 6:50 AM Tee Time" },
    { key: "loseSomething", label: "Probability of Losing Something" },
    { key: "sethDependency", label: "Seth Dependency Rating" },
  ];
}

export { strokesOnHole };

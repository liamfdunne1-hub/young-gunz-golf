import { matchHoleTallies } from "@/lib/golf/match";
import { deriveRoundTeams } from "@/lib/golf/teams";
import type { Bootstrap } from "@/lib/golf/derive";
import type { SkinsBoard } from "@/lib/golf/skins";

export type RecordEntry = {
  key: string;
  label: string;
  value: string;
  detail: string;
  playerId?: number | null;
};

export type RecordGroup = {
  id: string;
  title: string;
  kicker: string;
  entries: RecordEntry[];
};

function nameOf(data: Bootstrap, id?: number | null): string {
  if (id == null) return "Not yet";
  const p = data.players.find((x) => x.id === id);
  return p ? `${p.first_name} ${p.last_name}`.trim() : "Not yet";
}

function parFor(data: Bootstrap, roundId: number, hole: number): number {
  const round = data.rounds.find((r) => r.id === roundId);
  if (!round) return 4;
  return data.holes.find((h) => h.tee_id === round.tee_id && h.number === hole)?.par ?? 4;
}

function courseName(data: Bootstrap, roundId: number): string {
  const round = data.rounds.find((r) => r.id === roundId);
  const course = data.courses.find((c) => c.id === round?.course_id);
  return course?.name ?? "Unknown course";
}

function toParLabel(n: number): string {
  if (n === 0) return "E";
  if (n > 0) return `+${n}`;
  return String(n);
}

function awaiting(label: string, detail: string): RecordEntry {
  return { key: label, label, value: "Awaiting golf", detail };
}

type HoleScore = Bootstrap["scores"][number] & { par: number; toPar: number };

function scoredHoles(data: Bootstrap): HoleScore[] {
  return data.scores.map((s) => {
    const par = parFor(data, s.round_id, s.hole_number);
    return { ...s, par, toPar: s.gross - par };
  });
}

type HoleAgg = {
  key: string;
  courseId: number;
  courseName: string;
  hole: number;
  par: number;
  yardage: number;
  n: number;
  gross: number;
  toPar: number;
};

function holeDifficulty(data: Bootstrap): HoleAgg[] {
  const map = new Map<string, HoleAgg>();
  for (const s of scoredHoles(data)) {
    const round = data.rounds.find((r) => r.id === s.round_id);
    if (!round) continue;
    const hole = data.holes.find((h) => h.tee_id === round.tee_id && h.number === s.hole_number);
    const course = data.courses.find((c) => c.id === round.course_id);
    const key = `${round.course_id}:${s.hole_number}`;
    const row = map.get(key) ?? {
      key,
      courseId: round.course_id,
      courseName: course?.name ?? "Course",
      hole: s.hole_number,
      par: hole?.par ?? 4,
      yardage: hole?.yardage ?? 0,
      n: 0,
      gross: 0,
      toPar: 0,
    };
    row.n += 1;
    row.gross += s.gross;
    row.toPar += s.toPar;
    map.set(key, row);
  }
  return [...map.values()].filter((h) => h.n > 0);
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdev(nums: number[]): number | null {
  if (nums.length < 3) return null;
  const m = avg(nums)!;
  const v = nums.reduce((s, n) => s + (n - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

export function deriveRecords(data: Bootstrap, skins: SkinsBoard): RecordGroup[] {
  const holes = scoredHoles(data);
  const byPlayerRound = new Map<string, typeof holes>();
  for (const h of holes) {
    const key = `${h.player_id}:${h.round_id}`;
    const arr = byPlayerRound.get(key) ?? [];
    arr.push(h);
    byPlayerRound.set(key, arr);
  }
  const roundsPlayed = [...byPlayerRound.entries()].map(([key, rows]) => {
    const [playerId, roundId] = key.split(":").map(Number);
    const gross = rows.reduce((s, h) => s + h.gross, 0);
    const net = rows.reduce((s, h) => s + h.net, 0);
    const toPar = rows.reduce((s, h) => s + h.toPar, 0);
    const front = rows.filter((h) => h.hole_number <= 9);
    const back = rows.filter((h) => h.hole_number >= 10);
    return {
      playerId,
      roundId,
      holes: rows.length,
      gross,
      net,
      toPar,
      front: front.length ? front.reduce((s, h) => s + h.gross, 0) : null,
      back: back.length ? back.reduce((s, h) => s + h.gross, 0) : null,
      frontToPar: front.length ? front.reduce((s, h) => s + h.toPar, 0) : null,
      backToPar: back.length ? back.reduce((s, h) => s + h.toPar, 0) : null,
    };
  });

  const completeRounds = roundsPlayed.filter((r) => r.holes >= 18);
  const lowRound = [...completeRounds].sort((a, b) => a.gross - b.gross)[0];
  const highRound = [...completeRounds].sort((a, b) => b.gross - a.gross)[0];
  const lowNet = [...completeRounds].sort((a, b) => a.net - b.net)[0];
  const nines = roundsPlayed.flatMap((r) => {
    const out: {
      playerId: number;
      roundId: number;
      nine: "front" | "back";
      gross: number;
      toPar: number;
    }[] = [];
    if (r.front != null && r.frontToPar != null) {
      const frontHoles = byPlayerRound.get(`${r.playerId}:${r.roundId}`)?.filter((h) => h.hole_number <= 9) ?? [];
      if (frontHoles.length >= 9) {
        out.push({ playerId: r.playerId, roundId: r.roundId, nine: "front", gross: r.front, toPar: r.frontToPar });
      }
    }
    if (r.back != null && r.backToPar != null) {
      const backHoles = byPlayerRound.get(`${r.playerId}:${r.roundId}`)?.filter((h) => h.hole_number >= 10) ?? [];
      if (backHoles.length >= 9) {
        out.push({ playerId: r.playerId, roundId: r.roundId, nine: "back", gross: r.back, toPar: r.backToPar });
      }
    }
    return out;
  });
  const bestNine = [...nines].sort((a, b) => a.gross - b.gross)[0];
  const worstNine = [...nines].sort((a, b) => b.gross - a.gross)[0];

  const birdies = holes.filter((h) => h.toPar === -1);
  const eagles = holes.filter((h) => h.toPar <= -2);
  const aces = holes.filter((h) => h.gross === 1);
  const pars = holes.filter((h) => h.toPar === 0);
  const bogeys = holes.filter((h) => h.toPar === 1);
  const doubles = holes.filter((h) => h.toPar === 2);
  const worse = holes.filter((h) => h.toPar >= 3);
  const countBy = (rows: HoleScore[]) => {
    const m = new Map<number, number>();
    for (const h of rows) m.set(h.player_id, (m.get(h.player_id) ?? 0) + 1);
    let bestId: number | null = null;
    let bestN = 0;
    for (const [id, n] of m) {
      if (n > bestN) {
        bestId = id;
        bestN = n;
      }
    }
    return { playerId: bestId, n: bestN };
  };

  const highestHole = [...holes].sort((a, b) => b.gross - a.gross || b.toPar - a.toPar)[0];
  const lowestHole = [...holes].sort((a, b) => a.gross - b.gross || a.toPar - b.toPar)[0];
  const biggestBlowup = [...holes].sort((a, b) => b.toPar - a.toPar)[0];
  const bestHole = [...holes].sort((a, b) => a.toPar - b.toPar || a.gross - b.gross)[0];

  const difficulty = holeDifficulty(data);
  const hardest = [...difficulty].sort((a, b) => b.toPar / b.n - a.toPar / a.n)[0];
  const easiest = [...difficulty].sort((a, b) => a.toPar / a.n - b.toPar / a.n)[0];

  const par3 = holes.filter((h) => h.par === 3);
  const par4 = holes.filter((h) => h.par === 4);
  const par5 = holes.filter((h) => h.par === 5);
  const parLeader = (rows: HoleScore[]) => {
    const m = new Map<number, { n: number; toPar: number }>();
    for (const h of rows) {
      const row = m.get(h.player_id) ?? { n: 0, toPar: 0 };
      row.n += 1;
      row.toPar += h.toPar;
      m.set(h.player_id, row);
    }
    let best: { playerId: number; avg: number; n: number } | null = null;
    for (const [id, row] of m) {
      if (row.n < 1) continue;
      const a = row.toPar / row.n;
      if (!best || a < best.avg) best = { playerId: id, avg: a, n: row.n };
    }
    return best;
  };

  const bounce = (() => {
    const m = new Map<number, number>();
    const grouped = new Map<string, HoleScore[]>();
    for (const h of holes) {
      const key = `${h.player_id}:${h.round_id}`;
      const arr = grouped.get(key) ?? [];
      arr.push(h);
      grouped.set(key, arr);
    }
    for (const rows of grouped.values()) {
      const ordered = [...rows].sort((a, b) => a.hole_number - b.hole_number);
      for (let i = 1; i < ordered.length; i += 1) {
        if (ordered[i - 1].toPar >= 2 && ordered[i].toPar < 0) {
          m.set(ordered[i].player_id, (m.get(ordered[i].player_id) ?? 0) + 1);
        }
      }
    }
    let bestId: number | null = null;
    let bestN = 0;
    for (const [id, n] of m) {
      if (n > bestN) {
        bestId = id;
        bestN = n;
      }
    }
    return { playerId: bestId, n: bestN };
  })();

  const consistency = (() => {
    let best: { playerId: number; sd: number } | null = null;
    for (const p of data.players) {
      const mine = holes.filter((h) => h.player_id === p.id).map((h) => h.toPar);
      const sd = stdev(mine);
      if (sd == null) continue;
      if (!best || sd < best.sd) best = { playerId: p.id, sd };
    }
    return best;
  })();

  const firstTee = holes.filter((h) => h.hole_number === 1);
  const closer = holes.filter((h) => h.hole_number === 18);
  const firstTeeDisaster = [...firstTee].sort((a, b) => b.toPar - a.toPar)[0];
  const closerKing = [...closer].sort((a, b) => a.toPar - b.toPar)[0];

  const tallies = matchHoleTallies({
    players: data.players,
    matches: data.matches,
    scores: data.scores,
  });
  const mostWon = [...tallies].sort((a, b) => b.won - a.won)[0];
  const mostLost = [...tallies].sort((a, b) => b.lost - a.lost)[0];
  const mostHalved = [...tallies].sort((a, b) => b.halved - a.halved)[0];
  const biggestMatch = [...data.matches]
    .filter((m) => m.status === "final" && m.winner_side && (m.holes_up ?? 0) > 0)
    .sort((a, b) => (b.holes_up ?? 0) - (a.holes_up ?? 0))[0];

  const matchWins = new Map<number, number>();
  for (const m of data.matches) {
    if (m.status !== "final" || !m.winner_side) continue;
    const ids = m.winner_side === "A" || m.winner_side === "a" ? [m.a1, m.a2] : [m.b1, m.b2];
    for (const id of ids) matchWins.set(id, (matchWins.get(id) ?? 0) + 1);
  }
  let matchWinLeader: { playerId: number; n: number } | null = null;
  for (const [id, n] of matchWins) {
    if (!matchWinLeader || n > matchWinLeader.n) matchWinLeader = { playerId: id, n };
  }

  const skinLead = skins.standings.find((s) => s.skins > 0);
  const richestSkin = [...skins.holes].filter((h) => h.status === "won").sort((a, b) => b.value - a.value)[0];
  const longestCarryHole = [...skins.holes].sort((a, b) => b.skinsAtStake - a.skinsAtStake)[0];

  const askLead = [...data.askSeth].sort((a, b) => b.n - a.n)[0];
  const moneyByPlayer = new Map<number, number>();
  for (const p of data.players) moneyByPlayer.set(p.id, 0);
  for (const e of data.ledger) {
    if (e.to_player_id) moneyByPlayer.set(e.to_player_id, (moneyByPlayer.get(e.to_player_id) ?? 0) + e.amount);
    if (e.from_player_id) moneyByPlayer.set(e.from_player_id, (moneyByPlayer.get(e.from_player_id) ?? 0) - e.amount);
  }
  for (const c of data.contributions) {
    moneyByPlayer.set(c.player_id, (moneyByPlayer.get(c.player_id) ?? 0) - c.total);
  }
  for (const s of data.settlements) {
    moneyByPlayer.set(s.player_id, (moneyByPlayer.get(s.player_id) ?? 0) + s.total);
  }
  const moneyLead = [...moneyByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
  const actionLead = [...data.contributions].sort((a, b) => b.total - a.total)[0];

  const golf: RecordEntry[] = holes.length
    ? [
        {
          key: "low-round",
          label: "Lowest round",
          value: lowRound ? `${nameOf(data, lowRound.playerId)} · ${lowRound.gross}` : "Awaiting golf",
          detail: lowRound ? `${courseName(data, lowRound.roundId)} · ${toParLabel(lowRound.toPar)} gross` : "Card a round.",
          playerId: lowRound?.playerId,
        },
        {
          key: "low-net",
          label: "Lowest net round",
          value: lowNet ? `${nameOf(data, lowNet.playerId)} · ${lowNet.net}` : "Awaiting golf",
          detail: lowNet ? `${courseName(data, lowNet.roundId)} · net, USGA 90%` : "Card a round.",
          playerId: lowNet?.playerId,
        },
        {
          key: "high-round",
          label: "Highest round",
          value: highRound ? `${nameOf(data, highRound.playerId)} · ${highRound.gross}` : "Awaiting golf",
          detail: highRound ? `${courseName(data, highRound.roundId)} · this is also a record` : "Someone will.",
          playerId: highRound?.playerId,
        },
        {
          key: "best-nine",
          label: "Best nine",
          value: bestNine ? `${nameOf(data, bestNine.playerId)} · ${bestNine.gross}` : "Awaiting golf",
          detail: bestNine
            ? `${bestNine.nine === "front" ? "Front" : "Back"} nine · ${toParLabel(bestNine.toPar)}`
            : "Nine holes of evidence.",
          playerId: bestNine?.playerId,
        },
        {
          key: "worst-nine",
          label: "Worst nine",
          value: worstNine ? `${nameOf(data, worstNine.playerId)} · ${worstNine.gross}` : "Awaiting golf",
          detail: worstNine
            ? `${worstNine.nine === "front" ? "Front" : "Back"} nine · ${toParLabel(worstNine.toPar)}`
            : "It will happen after lunch.",
          playerId: worstNine?.playerId,
        },
        {
          key: "birdies",
          label: "Most birdies",
          value: countBy(birdies).n ? `${nameOf(data, countBy(birdies).playerId)} · ${countBy(birdies).n}` : "None yet",
          detail: `${birdies.length} birdies posted trip-wide.`,
          playerId: countBy(birdies).playerId,
        },
        {
          key: "eagles",
          label: "Most eagles",
          value: countBy(eagles).n ? `${nameOf(data, countBy(eagles).playerId)} · ${countBy(eagles).n}` : "None yet",
          detail: aces.length ? `${aces.length} hole-in-one${aces.length === 1 ? "" : "s"} in the book.` : "Eagles are rare. That is the point.",
          playerId: countBy(eagles).playerId,
        },
        {
          key: "pars",
          label: "Most pars",
          value: countBy(pars).n ? `${nameOf(data, countBy(pars).playerId)} · ${countBy(pars).n}` : "None yet",
          detail: "The official currency of not embarrassing yourself.",
          playerId: countBy(pars).playerId,
        },
        {
          key: "doubles",
          label: "Most doubles or worse",
          value: countBy([...doubles, ...worse]).n
            ? `${nameOf(data, countBy([...doubles, ...worse]).playerId)} · ${countBy([...doubles, ...worse]).n}`
            : "None yet",
          detail: `${worse.length} triples-or-worse have been committed.`,
          playerId: countBy([...doubles, ...worse]).playerId,
        },
        {
          key: "consistent",
          label: "Most consistent",
          value: consistency ? `${nameOf(data, consistency.playerId)} · σ ${consistency.sd.toFixed(2)}` : "Need more holes",
          detail: "Lowest standard deviation versus par. Boring is a skill.",
          playerId: consistency?.playerId,
        },
        {
          key: "bounce",
          label: "Bounce-back king",
          value: bounce.n ? `${nameOf(data, bounce.playerId)} · ${bounce.n}` : "None yet",
          detail: "Birdie or better immediately after a double or worse.",
          playerId: bounce.playerId,
        },
      ]
    : [
        awaiting("Lowest round", "The first card opens the book."),
        awaiting("Lowest net round", "USGA 90%. Card a round."),
        awaiting("Highest round", "Someone will donate a number."),
        awaiting("Best nine", "Nine holes of evidence."),
        awaiting("Worst nine", "It will happen after lunch."),
        awaiting("Most birdies", "Circles are still theoretical."),
        awaiting("Most eagles", "Eagles are rare. That is the point."),
        awaiting("Most pars", "The official currency of not embarrassing yourself."),
        awaiting("Most doubles or worse", "Volume scoring awaits."),
        awaiting("Most consistent", "Need more holes."),
        awaiting("Bounce-back king", "Birdie after a double. Character."),
      ];

  const holeGame: RecordEntry[] = holes.length
    ? [
        {
          key: "hardest",
          label: "Hardest hole",
          value: hardest ? `${hardest.courseName} · No. ${hardest.hole}` : "Awaiting golf",
          detail: hardest
            ? `Avg ${toParLabel(hardest.toPar / hardest.n)} · par ${hardest.par} · ${hardest.n} ball${hardest.n === 1 ? "" : "s"}`
            : "Play the hole.",
        },
        {
          key: "easiest",
          label: "Easiest hole",
          value: easiest ? `${easiest.courseName} · No. ${easiest.hole}` : "Awaiting golf",
          detail: easiest
            ? `Avg ${toParLabel(easiest.toPar / easiest.n)} · par ${easiest.par} · ${easiest.n} ball${easiest.n === 1 ? "" : "s"}`
            : "Play the hole.",
        },
        {
          key: "highest-hole",
          label: "Highest score on a hole",
          value: highestHole ? `${nameOf(data, highestHole.player_id)} · ${highestHole.gross}` : "Awaiting golf",
          detail: highestHole
            ? `${courseName(data, highestHole.round_id)} No. ${highestHole.hole_number} · par ${highestHole.par} · ${toParLabel(highestHole.toPar)}`
            : "Pick up when it is time.",
          playerId: highestHole?.player_id,
        },
        {
          key: "lowest-hole",
          label: "Lowest score on a hole",
          value: lowestHole ? `${nameOf(data, lowestHole.player_id)} · ${lowestHole.gross}` : "Awaiting golf",
          detail: lowestHole
            ? `${courseName(data, lowestHole.round_id)} No. ${lowestHole.hole_number} · par ${lowestHole.par}`
            : "An ace would settle this.",
          playerId: lowestHole?.player_id,
        },
        {
          key: "blowup",
          label: "Biggest blow-up",
          value: biggestBlowup ? `${nameOf(data, biggestBlowup.player_id)} · ${toParLabel(biggestBlowup.toPar)}` : "Awaiting golf",
          detail: biggestBlowup
            ? `A ${biggestBlowup.gross} on ${courseName(data, biggestBlowup.round_id)} No. ${biggestBlowup.hole_number}`
            : "The snowman is watching.",
          playerId: biggestBlowup?.player_id,
        },
        {
          key: "best-hole",
          label: "Best hole versus par",
          value: bestHole ? `${nameOf(data, bestHole.player_id)} · ${toParLabel(bestHole.toPar)}` : "Awaiting golf",
          detail: bestHole
            ? `${bestHole.gross} on ${courseName(data, bestHole.round_id)} No. ${bestHole.hole_number} (par ${bestHole.par})`
            : "Make something.",
          playerId: bestHole?.player_id,
        },
        {
          key: "par3",
          label: "Par-3 specialist",
          value: parLeader(par3) ? `${nameOf(data, parLeader(par3)!.playerId)} · ${toParLabel(Number(parLeader(par3)!.avg.toFixed(2)))}` : "Awaiting golf",
          detail: `${par3.length} par-3s logged.`,
          playerId: parLeader(par3)?.playerId,
        },
        {
          key: "par4",
          label: "Par-4 specialist",
          value: parLeader(par4) ? `${nameOf(data, parLeader(par4)!.playerId)} · ${toParLabel(Number(parLeader(par4)!.avg.toFixed(2)))}` : "Awaiting golf",
          detail: `${par4.length} par-4s logged.`,
          playerId: parLeader(par4)?.playerId,
        },
        {
          key: "par5",
          label: "Par-5 specialist",
          value: parLeader(par5) ? `${nameOf(data, parLeader(par5)!.playerId)} · ${toParLabel(Number(parLeader(par5)!.avg.toFixed(2)))}` : "Awaiting golf",
          detail: `${par5.length} par-5s logged.`,
          playerId: parLeader(par5)?.playerId,
        },
        {
          key: "first-tee",
          label: "First-tee disaster",
          value: firstTeeDisaster ? `${nameOf(data, firstTeeDisaster.player_id)} · ${firstTeeDisaster.gross}` : "Awaiting golf",
          detail: firstTeeDisaster
            ? `Hole 1 · ${toParLabel(firstTeeDisaster.toPar)} · ${courseName(data, firstTeeDisaster.round_id)}`
            : "The opening tee shot is a personality test.",
          playerId: firstTeeDisaster?.player_id,
        },
        {
          key: "closer",
          label: "Closing hole",
          value: closerKing ? `${nameOf(data, closerKing.player_id)} · ${closerKing.gross}` : "Awaiting golf",
          detail: closerKing
            ? `No. 18 · ${toParLabel(closerKing.toPar)} · ${courseName(data, closerKing.round_id)}`
            : "Get it in the house.",
          playerId: closerKing?.player_id,
        },
        {
          key: "bogeys",
          label: "Most bogeys",
          value: countBy(bogeys).n ? `${nameOf(data, countBy(bogeys).playerId)} · ${countBy(bogeys).n}` : "None yet",
          detail: "The honest score.",
          playerId: countBy(bogeys).playerId,
        },
      ]
    : [
        awaiting("Hardest hole", "The course has opinions. We need scores."),
        awaiting("Easiest hole", "Someone has to birdie something."),
        awaiting("Highest score on a hole", "Pick up is still a number."),
        awaiting("Lowest score on a hole", "An ace would settle this."),
        awaiting("Biggest blow-up", "The snowman is watching."),
        awaiting("Best hole versus par", "Make something."),
        awaiting("Par-3 specialist", "The little ones."),
        awaiting("Par-4 specialist", "The bulk of the damage."),
        awaiting("Par-5 specialist", "Reachable in theory."),
        awaiting("First-tee disaster", "The opening tee shot is a personality test."),
        awaiting("Closing hole", "Get it in the house."),
        awaiting("Most bogeys", "The honest score."),
      ];

  const matchGame: RecordEntry[] = [
    {
      key: "holes-won",
      label: "Most holes won",
      value: mostWon && mostWon.won ? `${nameOf(data, mostWon.playerId)} · ${mostWon.won}` : "Awaiting matches",
      detail: "Net four-ball. Your side's best ball.",
      playerId: mostWon?.playerId,
    },
    {
      key: "holes-lost",
      label: "Most holes lost",
      value: mostLost && mostLost.lost ? `${nameOf(data, mostLost.playerId)} · ${mostLost.lost}` : "Awaiting matches",
      detail: "Also a record. Unfortunately.",
      playerId: mostLost?.playerId,
    },
    {
      key: "holes-halved",
      label: "Most holes halved",
      value: mostHalved && mostHalved.halved ? `${nameOf(data, mostHalved.playerId)} · ${mostHalved.halved}` : "Awaiting matches",
      detail: "The official sport of pushing.",
      playerId: mostHalved?.playerId,
    },
    {
      key: "match-wins",
      label: "Match wins",
      value: matchWinLeader ? `${nameOf(data, matchWinLeader.playerId)} · ${matchWinLeader.n}` : "Awaiting matches",
      detail: "Closed four-ball matches only.",
      playerId: matchWinLeader?.playerId,
    },
    {
      key: "biggest-match",
      label: "Biggest match win",
      value: biggestMatch
        ? `${nameOf(data, biggestMatch.winner_side === "A" || biggestMatch.winner_side === "a" ? biggestMatch.a1 : biggestMatch.b1)}'s side · ${biggestMatch.result}`
        : "Awaiting matches",
      detail: biggestMatch ? `${biggestMatch.holes_up} up. Mercy is not tracked.` : "Play 18.",
    },
  ];

  const skinsGame: RecordEntry[] = [
    {
      key: "skins-lead",
      label: "Most skins",
      value: skinLead ? `${nameOf(data, skinLead.playerId)} · ${skinLead.skins}` : "No skins yet",
      detail: "Gross. Unique low. Full field. Ties push.",
      playerId: skinLead?.playerId,
    },
    {
      key: "skins-money",
      label: "Skins pot collected",
      value: skinLead && skinLead.value > 0
        ? `${nameOf(data, skinLead.playerId)} · $${skinLead.value.toFixed(2)}`
        : "Pot is still intact",
      detail: `Communal pot ${skins.pot.toFixed(0)}. Not a bet. Not on the ledger.`,
      playerId: skinLead?.playerId,
    },
    {
      key: "richest-skin",
      label: "Richest skin",
      value: richestSkin
        ? `${nameOf(data, richestSkin.winnerId)} · ${richestSkin.skinsAtStake} skins`
        : "No carry has paid yet",
      detail: richestSkin
        ? `Round ${richestSkin.roundNumber} hole ${richestSkin.hole} · $${richestSkin.value.toFixed(2)}`
        : "Pushes make this interesting.",
      playerId: richestSkin?.winnerId,
    },
    {
      key: "longest-carry",
      label: "Longest carry",
      value: longestCarryHole && longestCarryHole.skinsAtStake > 1
        ? `${longestCarryHole.skinsAtStake} skins on R${longestCarryHole.roundNumber} No. ${longestCarryHole.hole}`
        : "No carry yet",
      detail: "Ties do this. The field is allergic to uniqueness.",
    },
    {
      key: "unclaimed",
      label: "Unclaimed skins",
      value: skins.leftoverSkins || skins.pendingSkins
        ? `${skins.leftoverSkins + skins.pendingSkins} sitting`
        : "None",
      detail: "Pending holes and trailing pushes stay in the communal pot.",
    },
  ];

  const character: RecordEntry[] = [
    {
      key: "ask-seth",
      label: "Most Ask Seth requests",
      value: askLead ? `${nameOf(data, askLead.player_id)} · ${askLead.n}` : `${nameOf(data, data.players.find((p) => p.slug === "seth-young")?.id)} · 0`,
      detail: "The only leaderboard that is already operational.",
      playerId: askLead?.player_id,
    },
    {
      key: "action-volume",
      label: "Most Action volume",
      value: actionLead ? `${nameOf(data, actionLead.player_id)} · $${Number(actionLead.total).toFixed(0)}` : "The window is quiet",
      detail: "Pari-mutuel entries only. Skins are not this.",
      playerId: actionLead?.player_id,
    },
    {
      key: "gambling-tab",
      label: "Hottest gambling tab",
      value: moneyLead && moneyLead[1] !== 0
        ? `${nameOf(data, moneyLead[0])} · ${moneyLead[1] >= 0 ? "+" : ""}$${moneyLead[1].toFixed(0)}`
        : "Even",
      detail: "The Action. Skins live in a different church.",
      playerId: moneyLead?.[0],
    },
    {
      key: "champion",
      label: "Trip champion",
      value: data.trip.status === "finalized" ? "See official results" : "Survival Sunday will decide",
      detail: "Unlike the pairings, that one will actually be final.",
    },
  ];

  const teams = deriveRoundTeams(data).filter((t) => t.combinedGross != null);
  const partnerships: RecordEntry[] = teams.length
    ? [
        {
          key: "team-gross",
          label: "Lowest team combined gross",
          value: `${[...teams].sort((a, b) => (a.combinedGross ?? 99) - (b.combinedGross ?? 99))[0].label} · ${[...teams].sort((a, b) => (a.combinedGross ?? 99) - (b.combinedGross ?? 99))[0].combinedGross}`,
          detail: `${[...teams].sort((a, b) => (a.combinedGross ?? 99) - (b.combinedGross ?? 99))[0].roundName}. Partnerships are temporary.`,
        },
        {
          key: "team-net",
          label: "Lowest team combined net",
          value: `${[...teams].sort((a, b) => (a.combinedNet ?? 99) - (b.combinedNet ?? 99))[0].label} · ${[...teams].sort((a, b) => (a.combinedNet ?? 99) - (b.combinedNet ?? 99))[0].combinedNet}`,
          detail: `${[...teams].sort((a, b) => (a.combinedNet ?? 99) - (b.combinedNet ?? 99))[0].roundName}. Two cards, one number.`,
        },
        {
          key: "team-bb",
          label: "Lowest team best-ball net",
          value: (() => {
            const bb = [...teams].filter((t) => t.bestBallNet != null).sort((a, b) => (a.bestBallNet ?? 99) - (b.bestBallNet ?? 99))[0];
            return bb ? `${bb.label} · ${bb.bestBallNet}` : "Awaiting golf";
          })(),
          detail: "Better net each hole. Partners change tomorrow.",
        },
        {
          key: "team-high",
          label: "Highest team combined",
          value: `${[...teams].sort((a, b) => (b.combinedGross ?? 0) - (a.combinedGross ?? 0))[0].label} · ${[...teams].sort((a, b) => (b.combinedGross ?? 0) - (a.combinedGross ?? 0))[0].combinedGross}`,
          detail: "Two men, one bad day.",
        },
      ]
    : [
        awaiting("Lowest team combined gross", "Partners change every round. Score them."),
        awaiting("Lowest team combined net", "USGA net, added together."),
        awaiting("Lowest team best-ball net", "Better ball each hole."),
        awaiting("Highest team combined", "Two men, one bad day."),
      ];

  return [
    { id: "golf", title: "The golf", kicker: "Strokes, circles, snowmen.", entries: golf },
    { id: "holes", title: "The holes", kicker: "Where the trip actually happens.", entries: holeGame },
    { id: "matches", title: "The matches", kicker: "Net four-ball. Holes, not totals.", entries: matchGame },
    { id: "teams", title: "The partnerships", kicker: "Two-man teams. They change every day.", entries: partnerships },
    { id: "skins", title: "The skins", kicker: "Gross. Unique. Or nobody.", entries: skinsGame },
    { id: "character", title: "The character file", kicker: "Everything else the app refuses to forget.", entries: character },
  ];
}

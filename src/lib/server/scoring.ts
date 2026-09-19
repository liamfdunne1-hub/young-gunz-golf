import type { Sql } from "@/lib/db";
import { DEFAULT_MATCH_STAKE } from "@/lib/golf/bets";
import {
  FOUR_BALL_MATCH_ALLOWANCE,
  courseHandicap,
  playingHandicap,
  strokesOnHole,
  netScore,
  matchPlayOff,
} from "@/lib/golf/handicap";
import {
  asFormat,
  allowanceForFormat,
  defaultFormatForSize,
  isRotatingVegas,
  isTeamFormat,
  isVegas,
  MAX_GROUPS,
  teamPlayingHandicap,
  wolfOfHole,
} from "@/lib/golf/formats";
import {
  computeMatch,
  computeRotatingVegas,
  computeSides,
  computeStrokeTotal,
  computeVegas,
  computeVegasTotal,
  pointsFor,
  type RotatingVegasHole,
} from "@/lib/golf/match";
import { num } from "@/lib/utils";

export async function freezeHandicaps(sql: Sql, roundId: number) {
  const [round] = await sql<{
    tee_id: number;
    allowance_pct: number;
    status: string;
    format: string | null;
  }>`select tee_id, allowance_pct, status, format from rounds where id = ${roundId}`;
  if (!round) throw new Error("Round not found");
  const defaultTee = await sql<{ id: number; rating: string | number; slope: number; course_id: number }>`
    select t.id, t.rating, t.slope, t.course_id from tees t where t.id = ${round.tee_id}
  `;
  const [course] = await sql<{ par: number }>`
    select par from courses where id = ${defaultTee[0].course_id}
  `;
  const tees = await sql<{ id: number; name: string; rating: string | number; slope: number }>`
    select id, name, rating, slope from tees where course_id = ${defaultTee[0].course_id}
  `;
  const players = await sql<{
    id: number;
    handicap_index: string | number;
    tee_name: string;
  }>`select id, handicap_index, tee_name from players`;
  const overrides = await sql<{
    player_id: number;
    handicap_index: string | number;
    course_handicap: number | null;
    playing_handicap: number | null;
    created_at: string;
    round_id: number | null;
  }>`
    select player_id, handicap_index, course_handicap, playing_handicap, created_at, round_id
    from handicap_overrides
    where round_id = ${roundId} or round_id is null
    order by created_at desc
  `;
  const latestOverride = new Map<number, (typeof overrides)[number]>();
  for (const row of overrides) {
    if (!latestOverride.has(row.player_id)) latestOverride.set(row.player_id, row);
  }
  const allowance = round.allowance_pct || allowanceForFormat(asFormat(round.format)) || FOUR_BALL_MATCH_ALLOWANCE;
  const lock = round.status === "finalized";

  for (const p of players) {
    const tee = tees.find((t) => t.name === p.tee_name) ?? defaultTee[0];
    const ov = latestOverride.get(p.id);
    const idx = ov ? num(ov.handicap_index) : num(p.handicap_index);
    const ch = ov?.course_handicap ?? courseHandicap(idx, tee.slope, num(tee.rating), course.par);
    const ph = ov?.playing_handicap ?? playingHandicap(ch, allowance);
    if (lock) {
      await sql`
        insert into round_handicaps (round_id, player_id, tee_id, handicap_index, course_handicap, playing_handicap)
        values (${roundId}, ${p.id}, ${tee.id}, ${idx}, ${ch}, ${ph})
        on conflict (round_id, player_id) do nothing
      `;
    } else {
      await sql`
        insert into round_handicaps (round_id, player_id, tee_id, handicap_index, course_handicap, playing_handicap)
        values (${roundId}, ${p.id}, ${tee.id}, ${idx}, ${ch}, ${ph})
        on conflict (round_id, player_id) do update set
          tee_id = excluded.tee_id,
          handicap_index = excluded.handicap_index,
          course_handicap = excluded.course_handicap,
          playing_handicap = excluded.playing_handicap
      `;
    }
  }
}

export async function holeMeta(sql: Sql, roundId: number, holeNumber: number) {
  const [row] = await sql<{
    par: number;
    yardage: number;
    stroke_index: number;
    playing_needed: boolean;
  }>`
    select h.par, h.yardage, h.stroke_index, true as playing_needed
    from rounds r
    join holes h on h.tee_id = r.tee_id
    where r.id = ${roundId} and h.number = ${holeNumber}
  `;
  return row;
}

export async function playingFor(sql: Sql, roundId: number, playerId: number): Promise<number> {
  const existing = await sql<{ playing_handicap: number }>`
    select playing_handicap from round_handicaps where round_id = ${roundId} and player_id = ${playerId}
  `;
  if (existing[0]) return existing[0].playing_handicap;
  await freezeHandicaps(sql, roundId);
  const again = await sql<{ playing_handicap: number }>`
    select playing_handicap from round_handicaps where round_id = ${roundId} and player_id = ${playerId}
  `;
  return again[0]?.playing_handicap ?? 0;
}

export async function saveGross(
  sql: Sql,
  roundId: number,
  playerId: number,
  holeNumber: number,
  gross: number,
) {
  const hole = await holeMeta(sql, roundId, holeNumber);
  if (!hole) throw new Error("Hole not found");
  const ph = await playingFor(sql, roundId, playerId);
  const strokes = strokesOnHole(ph, hole.stroke_index);
  const net = netScore(gross, strokes);
  await sql`
    insert into scores (round_id, player_id, hole_number, gross, net, strokes, updated_at)
    values (${roundId}, ${playerId}, ${holeNumber}, ${gross}, ${net}, ${strokes}, now())
    on conflict (round_id, player_id, hole_number)
    do update set gross = excluded.gross, net = excluded.net, strokes = excluded.strokes, updated_at = now()
  `;
  await refreshMatches(sql, roundId);
  return { gross, net, strokes, par: hole.par };
}

async function tripStake(sql: Sql): Promise<{ tripId: number; stake: number }> {
  const [trip] = await sql<{ id: number; match_stake: string | number | null }>`
    select id, match_stake from trips order by id limit 1
  `;
  return { tripId: trip.id, stake: num(trip.match_stake, DEFAULT_MATCH_STAKE) };
}

export async function pruneExtraGroups(sql: Sql) {
  await ensureRoundGroups(sql);
}

export async function ensureRoundGroups(sql: Sql, roundId?: number) {
  const rounds = roundId
    ? await sql<{ id: number }>`select id from rounds where id = ${roundId}`
    : await sql<{ id: number }>`select id from rounds`;
  for (const r of rounds) {
    const existing = await sql<{ group_number: number }>`
      select group_number from groups where round_id = ${r.id}
    `;
    const have = new Set(existing.map((g) => g.group_number));
    for (let n = 1; n <= MAX_GROUPS; n += 1) {
      if (have.has(n)) continue;
      await sql`insert into groups (round_id, group_number) values (${r.id}, ${n})`;
    }
    await sql`delete from groups where round_id = ${r.id} and group_number > ${MAX_GROUPS}`;
  }
}

export async function ensureFoursomeMatches(sql: Sql, roundId: number) {
  const { stake } = await tripStake(sql);
  const [round] = await sql<{ format: string | null }>`select format from rounds where id = ${roundId}`;
  const roundFormat = asFormat(round?.format);
  const groups = await sql<{ id: number; format: string | null }>`
    select id, format from groups where round_id = ${roundId} and group_number <= ${MAX_GROUPS}
  `;
  for (const g of groups) {
    const members = await sql<{ player_id: number }>`
      select player_id from group_players where group_id = ${g.id} order by position
    `;
    const ids = members.map((m) => m.player_id);
    const existing = await sql<{ id: number }>`
      select id from matches
      where group_id = ${g.id} and coalesce(kind, 'group') = 'group'
    `;
    if (existing.length) continue;
    const format = asFormat(g.format, defaultFormatForSize(ids.length, roundFormat));
    if (ids.length === 3 || format === "wolf") {
      if (ids.length < 3) continue;
      await sql`
        insert into matches (round_id, group_id, kind, format, a1, a2, b1, b2, status, stake, bet_status)
        values (
          ${roundId}, ${g.id}, 'group', 'wolf',
          ${ids[0]}, ${ids[1]}, ${ids[2]}, null,
          'pending', ${stake}, 'open'
        )
      `;
      continue;
    }
    if (ids.length === 2) {
      await sql`
        insert into matches (round_id, group_id, kind, format, a1, a2, b1, b2, status, stake, bet_status)
        values (
          ${roundId}, ${g.id}, 'group', ${format},
          ${ids[0]}, ${ids[1]}, null, null,
          'pending', ${stake}, 'open'
        )
      `;
      continue;
    }
    if (ids.length !== 4) continue;
    await sql`
      insert into matches (round_id, group_id, kind, format, a1, a2, b1, b2, status, stake, bet_status)
      values (
        ${roundId}, ${g.id}, 'group', ${format},
        ${ids[0]}, ${ids[1]}, ${ids[2]}, ${ids[3]},
        'pending', ${stake}, 'open'
      )
    `;
  }
}

export async function saveTeamGross(
  sql: Sql,
  roundId: number,
  matchId: number,
  side: "A" | "B",
  holeNumber: number,
  gross: number,
) {
  const hole = await holeMeta(sql, roundId, holeNumber);
  if (!hole) throw new Error("Hole not found");
  const [match] = await sql<{
    format: string | null;
    a1: number;
    a2: number | null;
    b1: number | null;
    b2: number | null;
  }>`select format, a1, a2, b1, b2 from matches where id = ${matchId}`;
  if (!match) throw new Error("Match not found");
  const format = asFormat(match.format);
  const pair = side === "A" ? [match.a1, match.a2] : [match.b1, match.b2];
  if (!pair[0] || !pair[1]) throw new Error("That side is not a pair.");
  const chs = await courseHcpPair(sql, roundId, pair[0], pair[1]);
  const teamPh = teamPlayingHandicap(format, chs[0], chs[1]);
  const other = side === "A" ? [match.b1, match.b2] : [match.a1, match.a2];
  let rel = teamPh;
  if (other[0] && other[1]) {
    const och = await courseHcpPair(sql, roundId, other[0], other[1]);
    const otherPh = teamPlayingHandicap(format, och[0], och[1]);
    rel = Math.max(0, teamPh - Math.min(teamPh, otherPh));
  }
  const strokes = strokesOnHole(rel, hole.stroke_index);
  const net = netScore(gross, strokes);
  await sql`
    insert into team_scores (round_id, match_id, side, hole_number, gross, net, strokes, updated_at)
    values (${roundId}, ${matchId}, ${side}, ${holeNumber}, ${gross}, ${net}, ${strokes}, now())
    on conflict (match_id, side, hole_number)
    do update set gross = excluded.gross, net = excluded.net, strokes = excluded.strokes, updated_at = now()
  `;
  for (const pid of pair) {
    if (pid == null) continue;
    await saveGross(sql, roundId, pid, holeNumber, gross);
  }
  await refreshMatches(sql, roundId);
  return { gross, net, strokes, par: hole.par };
}

async function courseHcpPair(sql: Sql, roundId: number, a: number, b: number): Promise<[number, number]> {
  await freezeHandicaps(sql, roundId);
  const rows = await sql<{ player_id: number; course_handicap: number }>`
    select player_id, course_handicap from round_handicaps
    where round_id = ${roundId} and (player_id = ${a} or player_id = ${b})
  `;
  const ch = (id: number) => rows.find((r) => r.player_id === id)?.course_handicap ?? 0;
  return [ch(a), ch(b)];
}

export async function refreshMatches(sql: Sql, roundId: number) {
  const matches = await sql<{
    id: number;
    format: string | null;
    group_id: number | null;
    kind: string | null;
    a1: number;
    a2: number | null;
    b1: number | null;
    b2: number | null;
  }>`select id, format, group_id, kind, a1, a2, b1, b2 from matches where round_id = ${roundId}`;
  const scores = await sql<{ player_id: number; hole_number: number; gross: number; net: number }>`
    select player_id, hole_number, gross, net from scores where round_id = ${roundId}
  `;
  const teamScores = await sql<{ match_id: number; side: string; hole_number: number; net: number }>`
    select match_id, side, hole_number, net from team_scores where round_id = ${roundId}
  `.catch(() => []);
  const holes = await sql<{ number: number; stroke_index: number; par: number }>`
    select h.number, h.stroke_index, h.par
    from rounds r join holes h on h.tee_id = r.tee_id
    where r.id = ${roundId}
    order by h.number
  `;
  const hcps = await sql<{ player_id: number; playing_handicap: number; course_handicap: number }>`
    select player_id, playing_handicap, course_handicap from round_handicaps where round_id = ${roundId}
  `;
  const names = await sql<{ id: number; first_name: string }>`select id, first_name from players`;
  const ph = (id: number | null) =>
    id == null ? 0 : (hcps.find((h) => h.player_id === id)?.playing_handicap ?? 0);
  const ch = (id: number | null) =>
    id == null ? 0 : (hcps.find((h) => h.player_id === id)?.course_handicap ?? 0);
  const grossAt = (pid: number | null, hole: number) =>
    pid == null ? null : (scores.find((s) => s.player_id === pid && s.hole_number === hole)?.gross ?? null);
  const si = (hole: number) => holes.find((h) => h.number === hole)?.stroke_index ?? hole;
  const parAt = (hole: number) => holes.find((h) => h.number === hole)?.par ?? 4;
  const netAtMatch = (pid: number | null, hole: number, rel: number) => {
    const g = grossAt(pid, hole);
    if (g == null || pid == null) return null;
    return netScore(g, strokesOnHole(rel, si(hole)));
  };
  const birdieAt = (pid: number | null, hole: number) => {
    const g = grossAt(pid, hole);
    if (g == null) return false;
    return g <= parAt(hole) - 1;
  };
  const eagleAt = (pid: number | null, hole: number) => {
    const g = grossAt(pid, hole);
    if (g == null) return false;
    return g <= parAt(hole) - 2;
  };
  const firstName = (id: number) => names.find((p) => p.id === id)?.first_name ?? "?";

  for (const m of matches) {
    const format = asFormat(m.format);
    const pairOnly = Boolean(m.a2) && !m.b1 && !m.b2;
    let standing;
    if (format === "wolf") {
      standing = await refreshWolf(sql, roundId, m, scores, hcps, holes);
    } else if (isVegas(format) && isRotatingVegas(format, m) && m.group_id) {
      standing = await refreshRotatingVegas(sql, roundId, m, scores, hcps, holes, firstName);
    } else if (isVegas(format) && m.a2 && m.b1 && m.b2) {
      const ids = [m.a1, m.a2, m.b1, m.b2];
      const rel = matchPlayOff(ids.map((id) => ph(id)));
      const vegasHoles = Array.from({ length: 18 }, (_, i) => {
        const h = i + 1;
        const a1n = netAtMatch(m.a1, h, rel[0] ?? 0);
        const a2n = netAtMatch(m.a2, h, rel[1] ?? 0);
        const b1n = netAtMatch(m.b1, h, rel[2] ?? 0);
        const b2n = netAtMatch(m.b2, h, rel[3] ?? 0);
        return {
          aNets: a1n != null && a2n != null ? ([a1n, a2n] as [number, number]) : null,
          bNets: b1n != null && b2n != null ? ([b1n, b2n] as [number, number]) : null,
          aBirdie: birdieAt(m.a1, h) || birdieAt(m.a2, h),
          bBirdie: birdieAt(m.b1, h) || birdieAt(m.b2, h),
          aEagle: eagleAt(m.a1, h) || eagleAt(m.a2, h),
          bEagle: eagleAt(m.b1, h) || eagleAt(m.b2, h),
        };
      });
      standing = computeVegas(vegasHoles);
    } else if (isVegas(format) && pairOnly && m.a2) {
      const rel = matchPlayOff([ph(m.a1), ph(m.a2)]);
      const pairHoles: Array<[number, number] | null> = [];
      for (let h = 1; h <= 18; h += 1) {
        const a = netAtMatch(m.a1, h, rel[0] ?? 0);
        const b = netAtMatch(m.a2, h, rel[1] ?? 0);
        pairHoles.push(a != null && b != null ? [a, b] : null);
      }
      standing = computeVegasTotal(pairHoles);
    } else if (isTeamFormat(format) && m.a2 && m.b1 && m.b2) {
      const aPh = teamPlayingHandicap(format, ch(m.a1), ch(m.a2));
      const bPh = teamPlayingHandicap(format, ch(m.b1), ch(m.b2));
      const low = Math.min(aPh, bPh);
      const aRel = aPh - low;
      const bRel = bPh - low;
      const aHoles: Array<number | null> = [];
      const bHoles: Array<number | null> = [];
      for (let h = 1; h <= 18; h += 1) {
        const aTeam = teamScores.find((t) => t.match_id === m.id && t.side === "A" && t.hole_number === h);
        const bTeam = teamScores.find((t) => t.match_id === m.id && t.side === "B" && t.hole_number === h);
        const aGross = aTeam?.net != null ? null : grossAt(m.a1, h) ?? grossAt(m.a2, h);
        const bGross = bTeam?.net != null ? null : grossAt(m.b1, h) ?? grossAt(m.b2, h);
        aHoles.push(aTeam ? aTeam.net : aGross == null ? null : netScore(aGross, strokesOnHole(aRel, si(h))));
        bHoles.push(bTeam ? bTeam.net : bGross == null ? null : netScore(bGross, strokesOnHole(bRel, si(h))));
      }
      standing = computeSides(aHoles, bHoles);
    } else if (isTeamFormat(format) && pairOnly && m.a2) {
      const aPh = teamPlayingHandicap(format, ch(m.a1), ch(m.a2));
      const aHoles: Array<number | null> = [];
      for (let h = 1; h <= 18; h += 1) {
        const aTeam = teamScores.find((t) => t.match_id === m.id && t.side === "A" && t.hole_number === h);
        const aGross = aTeam?.net != null ? null : grossAt(m.a1, h) ?? grossAt(m.a2, h);
        aHoles.push(aTeam ? aTeam.net : aGross == null ? null : netScore(aGross, strokesOnHole(aPh, si(h))));
      }
      standing = computeStrokeTotal(aHoles, "Net");
    } else if (pairOnly && m.a2) {
      const rel = matchPlayOff([ph(m.a1), ph(m.a2)]);
      const aHoles: Array<number | null> = [];
      for (let h = 1; h <= 18; h += 1) {
        const a = netAtMatch(m.a1, h, rel[0] ?? 0);
        const b = netAtMatch(m.a2, h, rel[1] ?? 0);
        aHoles.push(a != null && b != null ? Math.min(a, b) : null);
      }
      standing = computeStrokeTotal(aHoles, "BB");
    } else {
      const ids = [m.a1, m.a2, m.b1, m.b2];
      const rel = matchPlayOff(ids.map((id) => ph(id)));
      const aNets: Array<number | null> = [];
      const bNets: Array<number | null> = [];
      for (let h = 1; h <= 18; h += 1) {
        aNets.push(netAtMatch(m.a1, h, rel[0] ?? 0), netAtMatch(m.a2, h, rel[1] ?? 0));
        bNets.push(netAtMatch(m.b1, h, rel[2] ?? 0), netAtMatch(m.b2, h, rel[3] ?? 0));
      }
      standing = computeMatch(aNets, bNets);
    }
    pointsFor("A", standing);
    const winnerSide = !standing.closed && standing.thru < 18 ? null : standing.leader;
    const status = standing.closed ? "final" : standing.thru > 0 ? "live" : "pending";
    await sql`
      update matches
      set status = ${status},
          result = ${standing.result},
          winner_side = ${winnerSide},
          holes_up = ${standing.holesUp},
          thru = ${standing.thru}
      where id = ${m.id}
    `;
  }
}

async function refreshRotatingVegas(
  sql: Sql,
  roundId: number,
  m: { id: number; group_id: number | null; a1: number; a2: number | null; b1: number | null; b2: number | null },
  scores: Array<{ player_id: number; hole_number: number; gross: number }>,
  hcps: Array<{ player_id: number; playing_handicap: number }>,
  holes: Array<{ number: number; stroke_index: number; par: number }>,
  firstName: (id: number) => string,
) {
  const ids = [m.a1, m.a2, m.b1, m.b2].filter((id): id is number => id != null);
  const splits = m.group_id
    ? await sql<{ hole_number: number; a1: number; a2: number; b1: number; b2: number }>`
        select hole_number, a1, a2, b1, b2
        from vegas_splits where round_id = ${roundId} and group_id = ${m.group_id}
      `.catch(() => [])
    : [];
  const ph = (id: number) => hcps.find((h) => h.player_id === id)?.playing_handicap ?? 0;
  const rel = matchPlayOff(ids.map(ph));
  const relOf = (id: number) => rel[ids.indexOf(id)] ?? 0;
  const grossAt = (pid: number, hole: number) =>
    scores.find((s) => s.player_id === pid && s.hole_number === hole)?.gross ?? null;
  const si = (hole: number) => holes.find((h) => h.number === hole)?.stroke_index ?? hole;
  const parAt = (hole: number) => holes.find((h) => h.number === hole)?.par ?? 4;
  const netAt = (pid: number, hole: number) => {
    const g = grossAt(pid, hole);
    if (g == null) return null;
    return netScore(g, strokesOnHole(relOf(pid), si(hole)));
  };

  const rotating: Array<RotatingVegasHole | null> = [];
  for (let h = 1; h <= 18; h += 1) {
    const split = splits.find((s) => s.hole_number === h);
    if (!split) {
      rotating.push(null);
      continue;
    }
    const nets: Record<number, number> = {};
    const birdie: Record<number, boolean> = {};
    const eagle: Record<number, boolean> = {};
    let complete = true;
    for (const id of ids) {
      const n = netAt(id, h);
      const g = grossAt(id, h);
      if (n == null || g == null) {
        complete = false;
        break;
      }
      nets[id] = n;
      birdie[id] = g <= parAt(h) - 1;
      eagle[id] = g <= parAt(h) - 2;
    }
    if (!complete) {
      rotating.push(null);
      continue;
    }
    rotating.push({
      a1: split.a1,
      a2: split.a2,
      b1: split.b1,
      b2: split.b2,
      nets,
      birdie,
      eagle,
    });
  }
  return computeRotatingVegas(ids, rotating, firstName);
}

async function refreshWolf(
  sql: Sql,
  roundId: number,
  m: { id: number; group_id: number | null; a1: number; a2: number | null; b1: number | null },
  scores: Array<{ player_id: number; hole_number: number; gross: number }>,
  hcps: Array<{ player_id: number; playing_handicap: number }>,
  holes: Array<{ number: number; stroke_index: number }>,
) {
  const ids = [m.a1, m.a2, m.b1].filter((id): id is number => id != null);
  const picks = m.group_id
    ? await sql<{ hole_number: number; wolf_player_id: number; partner_player_id: number | null; lone: boolean }>`
        select hole_number, wolf_player_id, partner_player_id, lone
        from wolf_picks where round_id = ${roundId} and group_id = ${m.group_id}
      `.catch(() => [])
    : [];
  const ph = (id: number) => hcps.find((h) => h.player_id === id)?.playing_handicap ?? 0;
  const rel = matchPlayOff(ids.map(ph));
  const relOf = (id: number) => rel[ids.indexOf(id)] ?? 0;
  const grossAt = (pid: number, hole: number) =>
    scores.find((s) => s.player_id === pid && s.hole_number === hole)?.gross ?? null;
  const si = (hole: number) => holes.find((h) => h.number === hole)?.stroke_index ?? hole;
  const netAt = (pid: number, hole: number) => {
    const g = grossAt(pid, hole);
    if (g == null) return null;
    return netScore(g, strokesOnHole(relOf(pid), si(hole)));
  };

  const aHoles: Array<number | null> = [];
  const bHoles: Array<number | null> = [];
  const pts = new Map<number, number>(ids.map((id) => [id, 0]));
  for (let h = 1; h <= 18; h += 1) {
    const wolfId = wolfOfHole(ids, h);
    const pick = picks.find((p) => p.hole_number === h);
    const nets = ids.map((id) => netAt(id, h));
    if (nets.some((n) => n == null)) {
      aHoles.push(null);
      bHoles.push(null);
      continue;
    }
    if (!pick || (!pick.lone && pick.partner_player_id == null)) {
      aHoles.push(null);
      bHoles.push(null);
      continue;
    }
    const wolfNet = netAt(wolfId, h)!;
    if (pick.lone) {
      const others = ids.filter((id) => id !== wolfId).map((id) => netAt(id, h)!);
      const field = Math.min(...others);
      aHoles.push(wolfNet);
      bHoles.push(field);
      if (wolfNet < field) pts.set(wolfId, (pts.get(wolfId) ?? 0) + 2);
      else if (field < wolfNet) {
        for (const id of ids.filter((x) => x !== wolfId)) pts.set(id, (pts.get(id) ?? 0) + 1);
      }
    } else {
      const partner = pick.partner_player_id!;
      const leftover = ids.find((id) => id !== wolfId && id !== partner);
      const pair = Math.min(wolfNet, netAt(partner, h)!);
      const one = leftover != null ? netAt(leftover, h)! : pair;
      aHoles.push(pair);
      bHoles.push(one);
      if (pair < one) {
        pts.set(wolfId, (pts.get(wolfId) ?? 0) + 1);
        pts.set(partner, (pts.get(partner) ?? 0) + 1);
      } else if (one < pair && leftover != null) {
        pts.set(leftover, (pts.get(leftover) ?? 0) + 2);
      }
    }
  }
  const standing = computeSides(aHoles, bHoles);
  const board = [...pts.entries()].sort((a, b) => b[1] - a[1]);
  standing.result = board.map(([, n]) => String(n)).join(" · ") + (standing.thru ? ` · thru ${standing.thru}` : "");
  return standing;
}

export async function recomputeRoundNets(sql: Sql, roundId: number) {
  const scores = await sql<{ player_id: number; hole_number: number; gross: number }>`
    select player_id, hole_number, gross from scores where round_id = ${roundId}
  `;
  await freezeHandicaps(sql, roundId);
  for (const row of scores) {
    await saveGross(sql, roundId, row.player_id, row.hole_number, row.gross);
  }
}

export async function roundScoreboard(sql: Sql, roundId: number) {
  const holes = await sql<{ number: number; par: number; yardage: number; stroke_index: number }>`
    select h.number, h.par, h.yardage, h.stroke_index
    from rounds r join holes h on h.tee_id = r.tee_id
    where r.id = ${roundId}
    order by h.number
  `;
  const players = await sql<{ id: number; first_name: string; last_name: string; slug: string }>`
    select id, first_name, last_name, slug from players order by last_name
  `;
  const scores = await sql<{ player_id: number; hole_number: number; gross: number; net: number; strokes: number }>`
    select player_id, hole_number, gross, net, strokes from scores where round_id = ${roundId}
  `;
  const hcps = await sql<{ player_id: number; playing_handicap: number; course_handicap: number }>`
    select player_id, playing_handicap, course_handicap from round_handicaps where round_id = ${roundId}
  `;
  const parByHole = new Map(holes.map((h) => [h.number, h.par]));
  const lines = players.map((p) => {
    const holeLines = holes.map((h) => {
      const s = scores.find((x) => x.player_id === p.id && x.hole_number === h.number);
      return {
        hole: h.number,
        gross: s?.gross ?? null,
        net: s?.net ?? null,
        strokes: s?.strokes ?? 0,
        par: h.par,
      };
    });
    const played = holeLines.filter((h) => h.gross != null);
    const grossTotal = played.length ? played.reduce((s, h) => s + (h.gross ?? 0), 0) : null;
    const netTotal = played.length ? played.reduce((s, h) => s + (h.net ?? 0), 0) : null;
    const parPlayed = played.reduce((s, h) => s + (parByHole.get(h.hole) ?? 4), 0);
    return {
      playerId: p.id,
      name: `${p.first_name} ${p.last_name}`,
      slug: p.slug,
      playing: hcps.find((h) => h.player_id === p.id)?.playing_handicap ?? null,
      holes: holeLines,
      grossTotal,
      netTotal,
      toPar: grossTotal != null ? grossTotal - parPlayed : null,
      netToPar: netTotal != null ? netTotal - parPlayed : null,
      thru: played.length,
    };
  });
  return { holes, coursePar: holes.reduce((s, h) => s + h.par, 0), lines };
}

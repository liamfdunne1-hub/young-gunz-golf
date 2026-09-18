import type { Sql } from "@/lib/db";
import { DEFAULT_MATCH_STAKE } from "@/lib/golf/bets";
import {
  FOUR_BALL_MATCH_ALLOWANCE,
  courseHandicap,
  playingHandicap,
  strokesOnHole,
  netScore,
} from "@/lib/golf/handicap";
import { computeMatch, pointsFor } from "@/lib/golf/match";
import { num } from "@/lib/utils";

export async function freezeHandicaps(sql: Sql, roundId: number) {
  const [round] = await sql<{
    tee_id: number;
    allowance_pct: number;
    status: string;
  }>`select tee_id, allowance_pct, status from rounds where id = ${roundId}`;
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
  const allowance = round.allowance_pct || FOUR_BALL_MATCH_ALLOWANCE;
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
  await sql`delete from groups where group_number > 3`;
}

export async function ensureFoursomeMatches(sql: Sql, roundId: number) {
  const { stake } = await tripStake(sql);
  const groups = await sql<{ id: number }>`select id from groups where round_id = ${roundId} and group_number <= 3`;
  for (const g of groups) {
    const members = await sql<{ player_id: number }>`
      select player_id from group_players where group_id = ${g.id} order by position
    `;
    if (members.length !== 4) continue;
    const existing = await sql<{ id: number }>`select id from matches where group_id = ${g.id}`;
    if (existing.length) continue;
    await sql`
      insert into matches (round_id, group_id, a1, a2, b1, b2, status, stake, bet_status)
      values (
        ${roundId}, ${g.id},
        ${members[0].player_id}, ${members[1].player_id},
        ${members[2].player_id}, ${members[3].player_id},
        'pending', ${stake}, 'open'
      )
    `;
  }
}

export async function refreshMatches(sql: Sql, roundId: number) {
  const matches = await sql<{
    id: number;
    a1: number;
    a2: number;
    b1: number;
    b2: number;
  }>`select id, a1, a2, b1, b2 from matches where round_id = ${roundId}`;
  const scores = await sql<{ player_id: number; hole_number: number; net: number }>`
    select player_id, hole_number, net from scores where round_id = ${roundId}
  `;
  const netAt = (pid: number, hole: number) =>
    scores.find((s) => s.player_id === pid && s.hole_number === hole)?.net ?? null;

  for (const m of matches) {
    const aNets: Array<number | null> = [];
    const bNets: Array<number | null> = [];
    for (let h = 1; h <= 18; h += 1) {
      aNets.push(netAt(m.a1, h), netAt(m.a2, h));
      bNets.push(netAt(m.b1, h), netAt(m.b2, h));
    }
    const standing = computeMatch(aNets, bNets);
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

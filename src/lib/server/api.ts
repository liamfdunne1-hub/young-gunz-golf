import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { num, playerName, slugify, isAttachableEmail } from "@/lib/utils";
import {
  withDb,
  tripId,
  mapPlayer,
  playerByUser,
  clearBagClaim,
  requireAdmin,
  grantSethMode,
  audit,
  setMomMessage,
  notify,
  notifyAll,
  type PlayerRow,
} from "@/lib/server/db";
import {
  freezeHandicaps,
  saveGross,
  roundScoreboard,
  refreshMatches,
  ensureFoursomeMatches,
  recomputeRoundNets,
  pruneExtraGroups,
} from "@/lib/server/scoring";
import { settlePool } from "@/lib/golf/pools";
import { FOUR_BALL_MATCH_ALLOWANCE, courseHandicap, playingHandicap } from "@/lib/golf/handicap";
import { validateScorecard } from "@/lib/golf/scorecard";
import { DEFAULT_MATCH_STAKE } from "@/lib/golf/bets";
import { DEFAULT_SKINS_POT } from "@/lib/golf/skins";
import { DEFAULT_SETH_PASSCODE, hashPasscode, passcodeMatches } from "@/lib/server/seth";
import {
  inviteEmailHtml,
  pairingEmailHtml,
  reminderEmailHtml,
  queueEmail,
  wrapHtml,
  escapeHtml,
  loadMailConfig,
  mailStatus,
  flushQueuedEmails,
} from "@/lib/server/email";
import { pickAwards } from "@/lib/golf/awards";
import { writeRecapWithAi } from "@/lib/server/ai";
import { loadBootstrap } from "@/lib/server/bootstrap";

async function persistAwardPicks(sql: Awaited<ReturnType<typeof withDb>>, data: Awaited<ReturnType<typeof loadBootstrap>>) {
  const tid = await tripId(sql);
  const picks = pickAwards(data);
  const existing = await sql<{ id: number; name: string; player_id: number | null }>`
    select id, name, player_id from awards
  `;
  const applied: { name: string; playerId: number; reason: string }[] = [];
  for (const pick of picks) {
    const row = existing.find((a) => a.name === pick.name);
    if (row) {
      if (!pick.overwrite && row.player_id) {
        applied.push({ name: pick.name, playerId: row.player_id, reason: "Already assigned" });
        continue;
      }
      await sql`
        update awards
        set player_id = ${pick.playerId}, description = ${pick.description}, category = ${pick.category}, published = true
        where id = ${row.id}
      `;
      applied.push({ name: pick.name, playerId: pick.playerId, reason: pick.reason });
    } else {
      await sql`
        insert into awards (trip_id, name, description, category, player_id, published)
        values (${tid}, ${pick.name}, ${pick.description}, ${pick.category}, ${pick.playerId}, true)
      `;
      applied.push({ name: pick.name, playerId: pick.playerId, reason: pick.reason });
    }
  }
  return applied;
}

async function ensureMailColumns(sql: Awaited<ReturnType<typeof withDb>>) {
  await sql`alter table trips add column if not exists email_provider text not null default 'none'`;
  await sql`alter table trips add column if not exists email_api_key text`;
  await sql`alter table trips add column if not exists email_from text`;
  await sql`alter table trips add column if not exists smtp_host text`;
  await sql`alter table trips add column if not exists smtp_port integer`;
  await sql`alter table trips add column if not exists smtp_user text`;
  await sql`alter table trips add column if not exists smtp_pass text`;
  await sql`alter table trips add column if not exists xai_api_key text`;
}

async function userEmail(sql: Awaited<ReturnType<typeof withDb>>, userId: string) {
  const [u] = await sql<{ email: string | null; name: string | null }>`
    select email, name from "user" where id = ${userId} limit 1
  `;
  return { email: u?.email ?? null, name: u?.name ?? null };
}

export const getBootstrap = createServerFn({ method: "GET" }).handler(async () => loadBootstrap());

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const player = await playerByUser(sql, context.userId, ident.email);
    const unread = player
      ? await sql<{ n: number }>`
          select count(*)::int as n from notifications where player_id = ${player.id} and read_at is null
        `
      : [{ n: 0 }];
    const prefs = player
      ? await sql<{
          pairings: boolean;
          tee_times: boolean;
          results: boolean;
          pools: boolean;
          announcements: boolean;
          recaps: boolean;
        }>`select * from notification_prefs where player_id = ${player.id}`
      : [];
    const notes = player
      ? await sql<{
          id: number;
          type: string;
          title: string;
          body: string;
          link: string | null;
          read_at: string | null;
          created_at: string;
        }>`
          select id, type, title, body, link, read_at, created_at
          from notifications where player_id = ${player.id}
          order by created_at desc limit 40
        `
      : [];
    let unlocked = false;
    try {
      const [row] = await sql<{ n: number }>`
        select 1 as n from seth_sessions where user_id = ${context.userId} limit 1
      `;
      unlocked = Boolean(row?.n);
    } catch {
      unlocked = false;
    }
    return {
      userId: context.userId,
      email: ident.email,
      name: ident.name,
      player,
      isAdmin: player?.role === "admin" || unlocked,
      unread: unread[0]?.n ?? 0,
      prefs: prefs[0] ?? null,
      notifications: notes,
    };
  });

export const getDraftPairings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ roundId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await pruneExtraGroups(sql);
    const groups = await sql<{ id: number; round_id: number; group_number: number; locked: boolean }>`
      select * from groups where round_id = ${data.roundId} and group_number <= 3 order by group_number
    `;
    const gps = await sql<{ group_id: number; player_id: number; position: number }>`
      select gp.group_id, gp.player_id, gp.position
      from group_players gp join groups g on g.id = gp.group_id
      where g.round_id = ${data.roundId}
    `;
    const [round] = await sql<{ pairings_status: string }>`
      select pairings_status from rounds where id = ${data.roundId}
    `;
    return { groups, groupPlayers: gps, pairingsStatus: round?.pairings_status ?? "draft" };
  });

export const getMomDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const players = await sql<PlayerRow>`select * from players order by last_name`;
    const flights = await sql<{ player_id: number; direction: string }>`select player_id, direction from flights`;
    const emails = await sql<{
      id: number;
      to_email: string;
      subject: string;
      type: string;
      status: string;
      sent_at: string | null;
      created_at: string;
    }>`select id, to_email, subject, type, status, sent_at, created_at from emails order by created_at desc limit 40`;
    const rounds = await sql<{
      id: number;
      round_number: number;
      pairings_status: string;
      status: string;
      name: string;
    }>`select id, round_number, pairings_status, status, name from rounds order by round_number`;
    const scoreCounts = await sql<{ round_id: number; n: number }>`
      select round_id, count(distinct player_id)::int as n from scores group by round_id
    `;
    const together = await togetherMatrix(sql);
    return {
      players: players.map(mapPlayer),
      flights,
      emails,
      rounds,
      scoreCounts,
      together,
    };
  });

async function togetherMatrix(sql: Awaited<ReturnType<typeof withDb>>) {
  const rows = await sql<{ a: number; b: number; n: number }>`
    select least(gp1.player_id, gp2.player_id) as a,
           greatest(gp1.player_id, gp2.player_id) as b,
           count(*)::int as n
    from group_players gp1
    join group_players gp2 on gp1.group_id = gp2.group_id and gp1.player_id < gp2.player_id
    join groups g on g.id = gp1.group_id
    join rounds r on r.id = g.round_id
    where r.pairings_status = 'published'
    group by 1, 2
  `;
  return rows;
}

export const enterScore = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      roundId: z.number(),
      playerId: z.number(),
      hole: z.number().min(1).max(18),
      gross: z.number().min(1).max(15),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const me = await playerByUser(sql, context.userId, ident.email);
    if (!me) throw new Error("You are not on the field. Ask Seth.");
    const [round] = await sql<{ status: string; finalized_at: string | null }>`
      select status, finalized_at from rounds where id = ${data.roundId}
    `;
    if (!round) throw new Error("Round not found");
    if (round.finalized_at) throw new Error("This round is locked.");
    if (me.role !== "admin" && me.id !== data.playerId) {
      const sameGroup = await sql<{ n: number }>`
        select count(*)::int as n
        from group_players gp
        join groups g on g.id = gp.group_id
        where g.round_id = ${data.roundId}
          and gp.player_id = ${data.playerId}
          and gp.group_id in (
            select group_id from group_players gp2
            join groups g2 on g2.id = gp2.group_id
            where g2.round_id = ${data.roundId} and gp2.player_id = ${me.id}
          )
      `;
      const sameMatch = await sql<{ n: number }>`
        select count(*)::int as n from matches
        where round_id = ${data.roundId}
          and (
            (a1 = ${me.id} or a2 = ${me.id} or b1 = ${me.id} or b2 = ${me.id})
            and (a1 = ${data.playerId} or a2 = ${data.playerId} or b1 = ${data.playerId} or b2 = ${data.playerId})
          )
      `;
      if ((sameGroup[0]?.n ?? 0) === 0 && (sameMatch[0]?.n ?? 0) === 0) {
        throw new Error("You can only score your group.");
      }
    }
    if (round.status === "upcoming") {
      await sql`update rounds set status = 'live' where id = ${data.roundId}`;
    }
    const saved = await saveGross(sql, data.roundId, data.playerId, data.hole, data.gross);
    return saved;
  });

export const savePairings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      roundId: z.number(),
      groups: z.array(
        z.object({
          groupId: z.number(),
          playerIds: z.array(z.number()),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const locked = await sql<{ id: number }>`
      select id from groups where round_id = ${data.roundId} and locked = true
    `;
    const lockedIds = new Set(locked.map((g) => g.id));
    for (const g of data.groups) {
      if (lockedIds.has(g.groupId)) continue;
      await sql`delete from group_players where group_id = ${g.groupId}`;
      for (const [i, pid] of g.playerIds.entries()) {
        await sql`
          insert into group_players (group_id, player_id, position)
          values (${g.groupId}, ${pid}, ${i})
        `;
      }
    }
    const msg = await setMomMessage(sql);
    await audit(sql, context.userId, "save_pairings", "round", data.roundId);
    return { ok: true, message: msg };
  });

export const randomizePairings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ roundId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const players = await sql<{ id: number }>`select id from players`;
    const shuffled = [...players].sort(() => Math.random() - 0.5).map((p) => p.id);
    const groups = await sql<{ id: number; locked: boolean }>`
      select id, locked from groups where round_id = ${data.roundId} and group_number <= 3 order by group_number
    `;
    const sizes = [4, 3, 3];
    let i = 0;
    for (const [gi, g] of groups.entries()) {
      if (g.locked) continue;
      await sql`delete from group_players where group_id = ${g.id}`;
      const slice = shuffled.slice(i, i + (sizes[gi] ?? 3));
      i += sizes[gi] ?? 3;
      for (const [pos, pid] of slice.entries()) {
        await sql`
          insert into group_players (group_id, player_id, position) values (${g.id}, ${pid}, ${pos})
        `;
      }
    }
    const msg = await setMomMessage(sql, "Seth made another spreadsheet decision.");
    await audit(sql, context.userId, "randomize_pairings", "round", data.roundId);
    return { ok: true, message: msg };
  });

export const copyPrevPairings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ roundId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const [round] = await sql<{ round_number: number }>`select round_number from rounds where id = ${data.roundId}`;
    const [prev] = await sql<{ id: number }>`
      select id from rounds where round_number = ${round.round_number - 1} limit 1
    `;
    if (!prev) throw new Error("No previous round.");
    const prevGroups = await sql<{ id: number; group_number: number }>`
      select id, group_number from groups where round_id = ${prev.id} and group_number <= 3
    `;
    const nextGroups = await sql<{ id: number; group_number: number }>`
      select id, group_number from groups where round_id = ${data.roundId} and group_number <= 3
    `;
    for (const ng of nextGroups) {
      await sql`delete from group_players where group_id = ${ng.id}`;
      const pg = prevGroups.find((g) => g.group_number === ng.group_number);
      if (!pg) continue;
      const members = await sql<{ player_id: number; position: number }>`
        select player_id, position from group_players where group_id = ${pg.id}
      `;
      for (const m of members) {
        await sql`
          insert into group_players (group_id, player_id, position)
          values (${ng.id}, ${m.player_id}, ${m.position})
        `;
      }
    }
    return { ok: true, message: "Copied. Friendships remain un-shuffled." };
  });

export const lockGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ groupId: z.number(), locked: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await sql`update groups set locked = ${data.locked} where id = ${data.groupId}`;
    return { ok: true };
  });

export const publishPairings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ roundId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const [was] = await sql<{ pairings_status: string }>`
      select pairings_status from rounds where id = ${data.roundId}
    `;
    const before = was?.pairings_status === "published"
      ? await sql<{ player_id: number; group_number: number }>`
          select gp.player_id, g.group_number
          from group_players gp join groups g on g.id = gp.group_id
          where g.round_id = ${data.roundId}
        `
      : [];
    await sql`
      update rounds set pairings_status = 'published', published_at = now() where id = ${data.roundId}
    `;
    await freezeHandicaps(sql, data.roundId);
    await ensureFoursomeMatches(sql, data.roundId);
    await refreshMatches(sql, data.roundId);
    const [round] = await sql<{
      name: string;
      tee_time: string;
      course_id: number;
    }>`select name, tee_time, course_id from rounds where id = ${data.roundId}`;
    const [course] = await sql<{ name: string }>`select name from courses where id = ${round.course_id}`;
    const groups = await sql<{ id: number; group_number: number }>`
      select id, group_number from groups where round_id = ${data.roundId}
    `;
    const after = await sql<{ player_id: number; group_number: number }>`
      select gp.player_id, g.group_number
      from group_players gp join groups g on g.id = gp.group_id
      where g.round_id = ${data.roundId}
    `;
    const tid = await tripId(sql);
    const players = await sql<PlayerRow>`select * from players`;
    const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "";

    const changed = new Set<number>();
    if (before.length) {
      for (const a of after) {
        const prev = before.find((b) => b.player_id === a.player_id);
        if (!prev || prev.group_number !== a.group_number) changed.add(a.player_id);
      }
    }

    for (const g of groups) {
      const members = after.filter((x) => x.group_number === g.group_number);
      const names = members.map((m) => {
        const p = players.find((pl) => pl.id === m.player_id);
        return p ? playerName(p) : "Unknown";
      });
      const match = await sql<{ a1: number; a2: number; b1: number; b2: number }>`
        select a1, a2, b1, b2 from matches where round_id = ${data.roundId} and group_id = ${g.id} limit 1
      `;
      const matchLine = match[0]
        ? `${nameOf(players, match[0].a1)} / ${nameOf(players, match[0].a2)} vs. ${nameOf(players, match[0].b1)} / ${nameOf(players, match[0].b2)}`
        : undefined;
      for (const m of members) {
        if (before.length && !changed.has(m.player_id)) continue;
        const p = players.find((pl) => pl.id === m.player_id);
        if (!p) continue;
        const subject = before.length ? "PAIRINGS HAVE CHANGED" : "The Pairings Are In.";
        const body = before.length
          ? "Seth changed the pairings."
          : "Seth has decided who you’re stuck with tomorrow.";
        await notify(sql, p.id, before.length ? "pairings_changed" : "pairings", subject, body, "/pairings");
        await queueEmail(sql, {
          tripId: tid,
          toEmail: p.email,
          toPlayerId: p.id,
          subject,
          html: pairingEmailHtml({
            roundName: round.name,
            course: course.name,
            teeTime: round.tee_time,
            group: names,
            match: matchLine,
            url: `${origin}/pairings`,
          }),
          type: "pairings",
          roundId: data.roundId,
        });
      }
    }
    const msg = await setMomMessage(
      sql,
      before.length ? "Seth changed the pairings." : "The Commissioner has spoken.",
    );
    await audit(sql, context.userId, "publish_pairings", "round", data.roundId);
    return { ok: true, message: msg };
  });

function nameOf(players: PlayerRow[], id: number) {
  const p = players.find((x) => x.id === id);
  return p ? playerName(p) : "?";
}

export const createMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      roundId: z.number(),
      groupId: z.number().nullable(),
      a1: z.number(),
      a2: z.number(),
      b1: z.number(),
      b2: z.number(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const ids = [data.a1, data.a2, data.b1, data.b2];
    if (new Set(ids).size !== 4) throw new Error("Four different golfers, please.");
    const [trip] = await sql<{ match_stake: string | number | null }>`select match_stake from trips order by id limit 1`;
    const stake = num(trip?.match_stake, DEFAULT_MATCH_STAKE);
    const [row] = await sql<{ id: number }>`
      insert into matches (round_id, group_id, a1, a2, b1, b2, status, stake, bet_status)
      values (${data.roundId}, ${data.groupId}, ${data.a1}, ${data.a2}, ${data.b1}, ${data.b2}, 'pending', ${stake}, 'open')
      returning id
    `;
    await refreshMatches(sql, data.roundId);
    await audit(sql, context.userId, "create_match", "match", row.id);
    return { id: row.id };
  });

export const deleteMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ matchId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await sql`delete from matches where id = ${data.matchId}`;
    return { ok: true };
  });

export const autoMatches = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ roundId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await ensureFoursomeMatches(sql, data.roundId);
    await refreshMatches(sql, data.roundId);
    return { ok: true, message: "2v2 net matches posted for every foursome. Partnerships remain temporary." };
  });

export const updatePlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      playerId: z.number(),
      handicapIndex: z.number().optional(),
      courseHandicap: z.number().optional(),
      playingHandicap: z.number().optional(),
      teeName: z.string().optional(),
      scoutingReport: z.string().optional(),
      nickname: z.string().optional(),
      threatLevel: z.string().nullable().optional(),
      jokeMetrics: z.record(z.string(), z.number()).optional(),
      email: z.string().email().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const [p] = await sql<PlayerRow>`select * from players where id = ${data.playerId}`;
    if (!p) throw new Error("Player not found");
    const idx = data.handicapIndex ?? num(p.handicap_index);
    const ch = data.courseHandicap ?? p.course_handicap;
    const ph = data.playingHandicap ?? p.playing_handicap;
    await sql`
      update players set
        handicap_index = ${idx},
        course_handicap = ${ch},
        playing_handicap = ${ph},
        tee_name = ${data.teeName ?? p.tee_name},
        scouting_report = ${data.scoutingReport ?? p.scouting_report},
        nickname = ${data.nickname ?? p.nickname},
        threat_level = ${data.threatLevel === undefined ? p.threat_level : data.threatLevel},
        joke_metrics = ${JSON.stringify(data.jokeMetrics ?? p.joke_metrics)}::jsonb,
        email = ${data.email ?? p.email}
      where id = ${data.playerId}
    `;
    if (data.handicapIndex != null) {
      await sql`
        insert into handicap_overrides (player_id, handicap_index, course_handicap, playing_handicap, reason, actor_user_id)
        values (${data.playerId}, ${idx}, ${ch}, ${ph}, 'Admin edit', ${context.userId})
      `;
    }
    await audit(sql, context.userId, "update_player", "player", data.playerId, data);
    return { ok: true };
  });

export const addPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      firstName: z.string().min(1).max(40),
      lastName: z.string().min(1).max(40),
      handicapIndex: z.number().min(-10).max(54).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const first = data.firstName.trim();
    const last = data.lastName.trim();
    if (!first || !last) throw new Error("First and last name. That is the whole form.");
    const tid = await tripId(sql);
    const base = slugify(`${first} ${last}`) || "golfer";
    const taken = await sql<{ slug: string }>`select slug from players where trip_id = ${tid}`;
    const used = new Set(taken.map((r) => r.slug));
    let slug = base;
    let n = 2;
    while (used.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    const pending = `pending+${slug}-${crypto.randomUUID().slice(0, 8)}@younggunz.golf`;
    const idx = data.handicapIndex ?? 18;
    const metrics = {
      driving: 50,
      irons: 50,
      putting: 50,
      alcohol: 50,
      lipOut: 50,
      thatsGood: 50,
      breakfastBall: 50,
      cart: 50,
      wakeup: 50,
      loseSomething: 50,
      sethDependency: 50,
    };
    const [row] = await sql<PlayerRow>`
      insert into players (
        trip_id, first_name, last_name, nickname, email, slug, role,
        handicap_index, tee_name, scouting_report, joke_metrics
      ) values (
        ${tid}, ${first}, ${last}, ${first}, ${pending}, ${slug}, 'player',
        ${idx}, 'Blue', ${`${first} ${last} has been added to the field. Scouting report pending.`},
        ${JSON.stringify(metrics)}::jsonb
      )
      returning *
    `;
    await sql`insert into notification_prefs (player_id) values (${row.id})`;
    await audit(sql, context.userId, "add_player", "player", row.id);
    return { ok: true as const, player: mapPlayer(row) };
  });

export const deletePlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ playerId: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const [p] = await sql<{ id: number; first_name: string; last_name: string }>`
      select id, first_name, last_name from players where id = ${data.playerId}
    `;
    if (!p) throw new Error("Already gone.");
    const [{ n }] = await sql<{ n: number }>`select count(*)::int as n from players`;
    if (n <= 1) throw new Error("You cannot delete the last golfer. The trip would look lonely.");
    await sql`delete from matches where a1 = ${p.id} or a2 = ${p.id} or b1 = ${p.id} or b2 = ${p.id}`;
    await sql`delete from ledger_entries where from_player_id = ${p.id} or to_player_id = ${p.id}`;
    await sql`delete from pool_entries where player_id = ${p.id}`;
    await sql`delete from pool_settlements where player_id = ${p.id}`;
    await sql`update awards set player_id = null where player_id = ${p.id}`;
    await sql`update market_selections set player_id = null where player_id = ${p.id}`;
    await sql`update emails set to_player_id = null where to_player_id = ${p.id}`;
    await sql`update photos set player_id = null where player_id = ${p.id}`;
    await sql`update announcements set author_player_id = null where author_player_id = ${p.id}`;
    await sql`delete from players where id = ${p.id}`;
    await audit(sql, context.userId, "delete_player", "player", p.id, { name: `${p.first_name} ${p.last_name}` });
    return { ok: true as const };
  });


export const postAnnouncement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ title: z.string().min(1), body: z.string().min(1), important: z.boolean(), email: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const operator = await requireAdmin(sql, context.userId, ident.email);
    await sql`
      insert into announcements (trip_id, author_player_id, title, body, important)
      values (${await tripId(sql)}, ${operator?.id ?? null}, ${data.title}, ${data.body}, ${data.important})
    `;
    await notifyAll(sql, "mom", data.title, data.body, "/");
    if (data.email) {
      const tid = await tripId(sql);
      const players = await sql<{ id: number; email: string; first_name: string }>`select id, email, first_name from players`;
      for (const p of players) {
        await queueEmail(sql, {
          tripId: tid,
          toEmail: p.email,
          toPlayerId: p.id,
          subject: `Seth Alert — ${data.title}`,
          html: wrapHtml(data.title, `<p>${escapeHtml(data.body)}</p><p>— Seth</p>`),
          type: "announcement",
        });
      }
    }
    return { ok: true };
  });

export const saveFlight = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      playerId: z.number().optional(),
      direction: z.enum(["arrival", "departure"]),
      airport: z.string().optional(),
      airline: z.string().optional(),
      flightNumber: z.string().optional(),
      departsAt: z.string().optional(),
      arrivesAt: z.string().optional(),
      terminal: z.string().optional(),
      status: z.string().optional(),
      rental: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const me = await playerByUser(sql, context.userId, ident.email);
    if (!me) throw new Error("Not on the field.");
    const playerId = data.playerId ?? me.id;
    if (playerId !== me.id && me.role !== "admin") throw new Error("Not your flight.");
    await sql`
      insert into flights (
        player_id, direction, airport, airline, flight_number, departs_at, arrives_at, terminal, status, rental, notes
      ) values (
        ${playerId}, ${data.direction}, ${data.airport ?? null}, ${data.airline ?? null},
        ${data.flightNumber ?? null}, ${data.departsAt ?? null}, ${data.arrivesAt ?? null},
        ${data.terminal ?? null}, ${data.status ?? "unknown"}, ${data.rental ?? null}, ${data.notes ?? null}
      )
      on conflict (player_id, direction) do update set
        airport = excluded.airport,
        airline = excluded.airline,
        flight_number = excluded.flight_number,
        departs_at = excluded.departs_at,
        arrives_at = excluded.arrives_at,
        terminal = excluded.terminal,
        status = excluded.status,
        rental = excluded.rental,
        notes = excluded.notes
    `;
    return { ok: true };
  });

export const askSeth = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const me = await playerByUser(sql, context.userId, ident.email);
    if (!me) throw new Error("Guests cannot bother Seth from this website. That is what the group chat is for.");
    await sql`insert into ask_seth_events (player_id) values (${me.id})`;
    return { ok: true };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const me = await playerByUser(sql, context.userId, ident.email);
    if (!me) return { ok: true };
    await sql`update notifications set read_at = now() where player_id = ${me.id} and read_at is null`;
    return { ok: true };
  });

export const savePrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      pairings: z.boolean(),
      tee_times: z.boolean(),
      results: z.boolean(),
      pools: z.boolean(),
      announcements: z.boolean(),
      recaps: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const me = await playerByUser(sql, context.userId, ident.email);
    if (!me) throw new Error("Not on the field.");
    await sql`
      insert into notification_prefs (player_id, pairings, tee_times, results, pools, announcements, recaps)
      values (${me.id}, ${data.pairings}, ${data.tee_times}, ${data.results}, ${data.pools}, ${data.announcements}, ${data.recaps})
      on conflict (player_id) do update set
        pairings = excluded.pairings,
        tee_times = excluded.tee_times,
        results = excluded.results,
        pools = excluded.pools,
        announcements = excluded.announcements,
        recaps = excluded.recaps
    `;
    return { ok: true };
  });

export const placeEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ marketId: z.number(), selectionId: z.number(), amount: z.number().positive().max(500) }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const me = await playerByUser(sql, context.userId, ident.email);
    if (!me) throw new Error("Only golfers on the field can record pool entries.");
    const [m] = await sql<{ status: string }>`select status from markets where id = ${data.marketId}`;
    if (!m || m.status !== "open") throw new Error("Market is not open.");
    await sql`
      insert into pool_entries (market_id, selection_id, player_id, amount)
      values (${data.marketId}, ${data.selectionId}, ${me.id}, ${data.amount})
    `;
    return { ok: true };
  });

export const createMarket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().min(2),
      kind: z.string(),
      roundId: z.number().nullable(),
      selectionLabels: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const tid = await tripId(sql);
    const [m] = await sql<{ id: number }>`
      insert into markets (trip_id, round_id, name, kind, status)
      values (${tid}, ${data.roundId}, ${data.name}, ${data.kind}, 'open')
      returning id
    `;
    const players = await sql<{ id: number; first_name: string; last_name: string }>`select id, first_name, last_name from players`;
    if (data.selectionLabels?.length) {
      for (const label of data.selectionLabels) {
        await sql`insert into market_selections (market_id, label) values (${m.id}, ${label})`;
      }
    } else {
      for (const p of players) {
        await sql`
          insert into market_selections (market_id, label, player_id)
          values (${m.id}, ${`${p.first_name} ${p.last_name}`}, ${p.id})
        `;
      }
      if (data.kind.startsWith("field_")) {
        await sql`insert into market_selections (market_id, label, player_id) values (${m.id}, 'The Field', null)`;
      }
    }
    await audit(sql, context.userId, "create_market", "market", m.id);
    return { id: m.id };
  });

export const setMarketStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ marketId: z.number(), status: z.enum(["open", "closed", "void"]) }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await sql`update markets set status = ${data.status} where id = ${data.marketId}`;
    return { ok: true };
  });

export const settleMarket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ marketId: z.number(), winningSelectionId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const entries = await sql<{ player_id: number; selection_id: number; amount: string | number }>`
      select player_id, selection_id, amount from pool_entries where market_id = ${data.marketId}
    `;
    const total = entries.reduce((s, e) => s + num(e.amount), 0);
    const winningTotal = entries
      .filter((e) => e.selection_id === data.winningSelectionId)
      .reduce((s, e) => s + num(e.amount), 0);
    await sql`delete from pool_settlements where market_id = ${data.marketId}`;
    const byPlayer = new Map<number, number>();
    for (const e of entries) {
      if (e.selection_id !== data.winningSelectionId) continue;
      const dist = settlePool({ totalPool: total, winningTotal, contribution: num(e.amount) });
      byPlayer.set(e.player_id, (byPlayer.get(e.player_id) ?? 0) + dist);
    }
    for (const [pid, amount] of byPlayer) {
      await sql`
        insert into pool_settlements (market_id, player_id, amount) values (${data.marketId}, ${pid}, ${amount})
      `;
    }
    await sql`
      update markets set status = 'settled', winning_selection_id = ${data.winningSelectionId}
      where id = ${data.marketId}
    `;
    await notifyAll(sql, "pool", "Pool settled", "The Action has distributed a participant-funded pool. No house. No rake.", "/action");
    await audit(sql, context.userId, "settle_market", "market", data.marketId);
    return { ok: true, total, winningTotal };
  });

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      subject: z.string().min(1),
      body: z.string().min(1),
      playerIds: z.array(z.number()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const tid = await tripId(sql);
    const allPlayers = await sql<{ id: number; email: string; first_name: string }>`
      select id, email, first_name from players
    `;
    const players = data.playerIds?.length
      ? allPlayers.filter((p) => data.playerIds!.includes(p.id))
      : allPlayers;
    for (const p of players) {
      await queueEmail(sql, {
        tripId: tid,
        toEmail: p.email,
        toPlayerId: p.id,
        subject: data.subject,
        html: wrapHtml(data.subject, `<p>Hello ${escapeHtml(p.first_name)},</p><p>${escapeHtml(data.body)}</p>`),
        type: "broadcast",
      });
    }
    return { ok: true, count: players.length };
  });

export const remindPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ playerId: z.number(), task: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const [p] = await sql<{ id: number; email: string; first_name: string }>`
      select id, email, first_name from players where id = ${data.playerId}
    `;
    if (!p) throw new Error("Missing person, ironically.");
    const tid = await tripId(sql);
    const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "";
    await queueEmail(sql, {
      tripId: tid,
      toEmail: p.email,
      toPlayerId: p.id,
      subject: "Seth Needs Something From You",
      html: reminderEmailHtml(p.first_name, data.task, `${origin}/flights`),
      type: "nudge",
    });
    await notify(sql, p.id, "mom", "Seth Needs Something From You", data.task, "/flights");
    return { ok: true };
  });

export const invitePlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ playerId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const token = crypto.randomUUID();
    await sql`
      update players set invite_token = ${token}, invited_at = now() where id = ${data.playerId}
    `;
    const [p] = await sql<{ email: string; first_name: string }>`
      select email, first_name from players where id = ${data.playerId}
    `;
    const tid = await tripId(sql);
    const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "";
    await queueEmail(sql, {
      tripId: tid,
      toEmail: p.email,
      toPlayerId: data.playerId,
      subject: "You Have Been Summoned to the Young Gunz — Orlando 2026",
      html: inviteEmailHtml(`${origin}/invite/${token}`),
      type: "invite",
    });
    return { ok: true, token };
  });

export const claimInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ token: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const [p] = await sql<{ id: number; user_id: string | null }>`
      select id, user_id from players where invite_token = ${data.token}
    `;
    if (!p) throw new Error("This invitation is not recognized. Ask Seth. Then look at the website anyway.");
    if (p.user_id && p.user_id !== context.userId) throw new Error("Already claimed.");
    await sql`
      update players set user_id = ${context.userId}, registered_at = now() where id = ${p.id}
    `;
    return { ok: true };
  });

export const claimBag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      playerId: z.number().int().positive().optional(),
      email: z.string().email().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const loginEmail = ident.email?.trim().toLowerCase() || null;
    const email = data.email?.trim().toLowerCase() || null;
    let playerId = data.playerId ?? null;

    if (email) {
      const [byEmail] = await sql<{ id: number; user_id: string | null }>`
        select id, user_id from players where lower(email) = ${email} limit 1
      `;
      if (byEmail) {
        if (byEmail.user_id && byEmail.user_id !== context.userId) {
          throw new Error("That bag is already claimed. Ask Seth, then look at the website anyway.");
        }
        playerId = byEmail.id;
      } else {
        throw new Error("No bag with that email. Pick a name on the field instead.");
      }
    }

    if (!playerId) {
      throw new Error("Pick a golfer on the field.");
    }

    const [target] = await sql<PlayerRow>`select * from players where id = ${playerId}`;
    if (!target) throw new Error("Not on the field.");
    if (target.user_id && target.user_id !== context.userId) {
      throw new Error("Someone else is wearing that bag.");
    }

    const attach = isAttachableEmail(loginEmail) ? loginEmail : null;
    if (attach) {
      const [taken] = await sql<{ id: number }>`
        select id from players where lower(email) = ${attach} and id <> ${playerId} limit 1
      `;
      if (taken) throw new Error("That sign-in email is already on another bag.");
    }

    await sql`update players set user_id = null where user_id = ${context.userId} and id <> ${playerId}`;

    await sql`
      update players
      set user_id = ${context.userId},
          registered_at = coalesce(registered_at, now()),
          email = ${attach ?? target.email}
      where id = ${playerId}
    `;
    await audit(sql, context.userId, "claim_bag", "player", playerId, { email: attach ?? email });
    const [fresh] = await sql<PlayerRow>`select * from players where id = ${playerId}`;
    if (!fresh) throw new Error("Bag went missing. Classic.");
    return { ok: true, player: mapPlayer(fresh) };
  });


export const dropBag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const current = await playerByUser(sql, context.userId, ident.email);
    if (current) {
      await clearBagClaim(sql, current.id, current.slug);
      await audit(sql, context.userId, "drop_bag", "player", current.id);
    } else {
      await sql`update players set user_id = null where user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

export const releaseBag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ playerId: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const [p] = await sql<{ id: number; slug: string; first_name: string; last_name: string; user_id: string | null }>`
      select id, slug, first_name, last_name, user_id from players where id = ${data.playerId}
    `;
    if (!p) throw new Error("Not on the field.");
    if (!p.user_id) throw new Error("That bag is already open.");
    await clearBagClaim(sql, p.id, p.slug);
    await audit(sql, context.userId, "release_bag", "player", p.id);
    return { ok: true as const, name: `${p.first_name} ${p.last_name}` };
  });


export const finalizeRound = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ roundId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await refreshMatches(sql, data.roundId);
    await sql`update rounds set status = 'finalized', finalized_at = now() where id = ${data.roundId}`;
    const board = await roundScoreboard(sql, data.roundId);
    const lowGross = [...board.lines].filter((l) => l.grossTotal != null).sort((a, b) => (a.grossTotal ?? 99) - (b.grossTotal ?? 99))[0];
    const tid = await tripId(sql);
    const players = await sql<PlayerRow>`select * from players`;
    const [round] = await sql<{ name: string; date: string }>`select name, date from rounds where id = ${data.roundId}`;
    for (const p of players) {
      const line = board.lines.find((l) => l.playerId === p.id);
      const commentary =
        (line?.toPar ?? 0) < 0
          ? "An alarmingly competent performance. Handicap Committee notified."
          : (line?.toPar ?? 0) > 8
            ? "Several excuses were submitted. None affected the final score."
            : "Unfortunately, this round will remain in the historical record.";
      const html = wrapHtml(
        "Young Gunz — Round Results",
        `<p>${escapeHtml(round.name)}</p>
         <p>Low Gross: ${lowGross ? escapeHtml(lowGross.name) + " (" + lowGross.grossTotal + ")" : "pending"}</p>
         <p><strong>${escapeHtml(p.first_name)}’s Round</strong><br/>
         Gross: ${line?.grossTotal ?? "—"} · Net: ${line?.netTotal ?? "—"} · Thru ${line?.thru ?? 0}</p>
         <p>${commentary}</p>`,
      );
      await queueEmail(sql, {
        tripId: tid,
        toEmail: p.email,
        toPlayerId: p.id,
        subject: "Young Gunz — Round Results",
        html,
        type: "results",
        roundId: data.roundId,
      });
      await notify(sql, p.id, "results", "Round finalized", commentary, "/leaderboard");
    }
    await audit(sql, context.userId, "finalize_round", "round", data.roundId);
    try {
      const snapshot = await loadBootstrap();
      await persistAwardPicks(sql, snapshot);
      const cfg = await loadMailConfig(sql);
      const { draft } = await writeRecapWithAi(snapshot, round.date, cfg.xaiKey);
      const existingRecap = await sql<{ id: number; published: boolean }>`
        select id, published from recaps where trip_id = ${tid} and day = ${round.date} limit 1
      `;
      if (!existingRecap[0]) {
        await sql`
          insert into recaps (trip_id, day, title, body, quote, published)
          values (${tid}, ${draft.day}, ${draft.title}, ${draft.body}, ${draft.quote}, false)
        `;
      } else if (!existingRecap[0].published) {
        await sql`
          update recaps set title = ${draft.title}, body = ${draft.body}, quote = ${draft.quote}
          where id = ${existingRecap[0].id}
        `;
      }
    } catch {
      /* recap/awards are best-effort on finalize */
    }
    return { ok: true };
  });

export const saveRecap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      day: z.string(),
      title: z.string(),
      body: z.string(),
      quote: z.string().optional(),
      publish: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const tid = await tripId(sql);
    const existing = await sql<{ id: number }>`select id from recaps where trip_id = ${tid} and day = ${data.day}`;
    let id = existing[0]?.id;
    if (id) {
      await sql`
        update recaps set title = ${data.title}, body = ${data.body}, quote = ${data.quote ?? null},
          published = ${data.publish}, published_at = ${data.publish ? new Date().toISOString() : null}
        where id = ${id}
      `;
    } else {
      const [row] = await sql<{ id: number }>`
        insert into recaps (trip_id, day, title, body, quote, published, published_at)
        values (${tid}, ${data.day}, ${data.title}, ${data.body}, ${data.quote ?? null}, ${data.publish}, ${data.publish ? new Date().toISOString() : null})
        returning id
      `;
      id = row.id;
    }
    if (data.publish) {
      await notifyAll(sql, "recap", data.title, "The daily recap is up. It is not flattering.", "/recaps");
      const players = await sql<{ id: number; email: string }>`select id, email from players`;
      for (const p of players) {
        await queueEmail(sql, {
          tripId: tid,
          toEmail: p.email,
          toPlayerId: p.id,
          subject: data.title,
          html: wrapHtml(data.title, `<p>${escapeHtml(data.body)}</p>${data.quote ? `<p><em>${escapeHtml(data.quote)}</em></p>` : ""}`),
          type: "recap",
        });
      }
    }
    return { id };
  });

export const saveAward = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      awardId: z.number().optional(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      playerId: z.number().nullable(),
      published: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const tid = await tripId(sql);
    if (data.awardId) {
      await sql`
        update awards set name = ${data.name}, description = ${data.description}, category = ${data.category},
          player_id = ${data.playerId}, published = ${data.published}
        where id = ${data.awardId}
      `;
      return { id: data.awardId };
    }
    const [row] = await sql<{ id: number }>`
      insert into awards (trip_id, name, description, category, player_id, published)
      values (${tid}, ${data.name}, ${data.description}, ${data.category}, ${data.playerId}, ${data.published})
      returning id
    `;
    return { id: row.id };
  });

export const saveReportCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      playerId: z.number(),
      golf: z.string(),
      gambling: z.string(),
      decisions: z.string(),
      entertainment: z.string(),
      sethDependency: z.string(),
      comment: z.string(),
      published: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const tid = await tripId(sql);
    await sql`
      insert into report_cards (
        trip_id, player_id, golf_grade, gambling_grade, decisions_grade, entertainment_grade, seth_dependency, comment, published
      ) values (
        ${tid}, ${data.playerId}, ${data.golf}, ${data.gambling}, ${data.decisions}, ${data.entertainment},
        ${data.sethDependency}, ${data.comment}, ${data.published}
      )
      on conflict (trip_id, player_id) do update set
        golf_grade = excluded.golf_grade,
        gambling_grade = excluded.gambling_grade,
        decisions_grade = excluded.decisions_grade,
        entertainment_grade = excluded.entertainment_grade,
        seth_dependency = excluded.seth_dependency,
        comment = excluded.comment,
        published = excluded.published
    `;
    return { ok: true };
  });

export const finalizeTrip = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await sql`update trips set status = 'finalized', finalized_at = now()`;
    await notifyAll(
      sql,
      "final",
      "Young Gunz Orlando 2026 — The Damage Report",
      "Unlike the pairings, this one is actually final.",
      "/results",
    );
    const tid = await tripId(sql);
    const players = await sql<{ id: number; email: string; first_name: string }>`select id, email, first_name from players`;
    for (const p of players) {
      await queueEmail(sql, {
        tripId: tid,
        toEmail: p.email,
        toPlayerId: p.id,
        subject: "Young Gunz Orlando 2026 — The Damage Report",
        html: wrapHtml(
          "The Damage Report",
          `<p>Hello ${escapeHtml(p.first_name)},</p>
           <p>Official results are locked. View the complete 2026 record.</p>
           <p>Would be invited again. Probably.</p>`,
        ),
        type: "final",
      });
    }
    await audit(sql, context.userId, "finalize_trip", "trip", tid);
    return { ok: true };
  });

export const addPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      url: z.string().min(4),
      caption: z.string().optional(),
      roundId: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    const me = await playerByUser(sql, context.userId, ident.email);
    if (!me) throw new Error("Sign in as a golfer to upload evidence.");
    const tid = await tripId(sql);
    await sql`
      insert into photos (trip_id, round_id, player_id, url, caption)
      values (${tid}, ${data.roundId ?? null}, ${me.id}, ${data.url}, ${data.caption ?? null})
    `;
    return { ok: true };
  });

export const featurePhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ photoId: z.number(), featured: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await sql`update photos set featured = ${data.featured} where id = ${data.photoId}`;
    return { ok: true };
  });

export const getScoreboard = createServerFn({ method: "GET" })
  .validator(z.object({ roundId: z.number() }))
  .handler(async ({ data }) => {
    const sql = await withDb();
    return roundScoreboard(sql, data.roundId);
  });

export const getEmails = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    return sql<{
      id: number;
      to_email: string;
      subject: string;
      type: string;
      status: string;
      html: string;
      sent_at: string | null;
      created_at: string;
    }>`select id, to_email, subject, type, status, html, sent_at, created_at from emails order by created_at desc limit 80`;
  });

export const recalcHandicaps = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const players = await sql<PlayerRow>`select * from players`;
    const [tee] = await sql<{ slope: number; rating: string | number }>`
      select slope, rating from tees where name = 'Blue' order by id limit 1
    `;
    for (const p of players) {
      const idx = num(p.handicap_index);
      const ch = courseHandicap(idx, tee.slope, num(tee.rating), 72);
      const ph = playingHandicap(ch, FOUR_BALL_MATCH_ALLOWANCE);
      await sql`update players set course_handicap = ${ch}, playing_handicap = ${ph} where id = ${p.id}`;
    }
    return { ok: true };
  });

export const startRound = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ roundId: z.number() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await freezeHandicaps(sql, data.roundId);
    await sql`update rounds set status = 'live' where id = ${data.roundId}`;
    return { ok: true };
  });

export const getSethDesk = getMomDesk;

export const unlockSethMode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ passcode: z.string().min(1).max(32) }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const [trip] = await sql<{ seth_passcode_hash: string | null }>`
      select seth_passcode_hash from trips order by id limit 1
    `;
    if (!passcodeMatches(data.passcode, trip?.seth_passcode_hash ?? null)) {
      throw new Error("Wrong code. Seth would like you to sit down.");
    }
    if (!trip?.seth_passcode_hash) {
      await sql`update trips set seth_passcode_hash = ${hashPasscode(DEFAULT_SETH_PASSCODE)}`;
    }
    await grantSethMode(sql, context.userId);
    await audit(sql, context.userId, "unlock_seth_mode", "trip");
    return { ok: true as const };
  });

export const setSethPasscode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ passcode: z.string().min(4).max(32) }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await sql`update trips set seth_passcode_hash = ${hashPasscode(data.passcode)}`;
    await audit(sql, context.userId, "set_seth_passcode", "trip");
    return { ok: true as const };
  });

export const setMatchStake = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ stake: z.number().positive().max(500) }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await sql`update trips set match_stake = ${data.stake}`;
    await audit(sql, context.userId, "set_match_stake", "trip", data.stake);
    return { ok: true as const, stake: data.stake };
  });

export const setSkinsPot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ pot: z.number().min(0).max(10000) }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await sql`update trips set skins_pot = ${data.pot}`;
    await audit(sql, context.userId, "set_skins_pot", "trip", data.pot);
    return { ok: true as const, pot: data.pot };
  });


const holeInput = z.object({
  number: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage: z.number().int().min(50).max(800),
  strokeIndex: z.number().int().min(1).max(18),
});

export const saveCourseScorecard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      courseId: z.number().int().positive().optional(),
      name: z.string().trim().min(2).max(80),
      address: z.string().trim().max(160).optional(),
      city: z.string().trim().max(80).optional(),
      designer: z.string().trim().max(80).optional(),
      theme: z.string().trim().max(160).optional(),
      description: z.string().trim().max(4000).optional(),
      imageUrl: z.string().trim().max(200).optional(),
      copyParAndIndex: z.boolean().optional(),
      tee: z.object({
        id: z.number().int().positive().optional(),
        name: z.string().trim().min(1).max(24),
        color: z.string().trim().min(3).max(24),
        rating: z.number().min(55).max(90),
        slope: z.number().int().min(55).max(155),
      }),
      holes: z.array(holeInput).length(18),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const problem = validateScorecard(data.holes);
    if (problem) throw new Error(problem);

    const tid = await tripId(sql);
    const par = data.holes.reduce((s, h) => s + h.par, 0);
    const yardage = data.holes.reduce((s, h) => s + h.yardage, 0);
    let courseId = data.courseId ?? null;
    let slug: string;

    if (courseId) {
      const [existing] = await sql<{ id: number; slug: string }>`
        select id, slug from courses where id = ${courseId}
      `;
      if (!existing) throw new Error("Course not found.");
      slug = existing.slug;
      await sql`
        update courses set
          name = ${data.name},
          address = ${data.address ?? ""},
          city = ${data.city ?? ""},
          designer = ${data.designer ?? null},
          theme = ${data.theme ?? null},
          description = ${data.description ?? ""},
          par = ${par},
          image_url = coalesce(${data.imageUrl ?? null}, image_url)
        where id = ${courseId}
      `;
    } else {
      slug = slugify(data.name);
      const clash = await sql<{ id: number }>`select id from courses where slug = ${slug}`;
      if (clash[0]) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const [row] = await sql<{ id: number }>`
        insert into courses (trip_id, name, slug, address, city, designer, image_url, par, description, theme)
        values (
          ${tid}, ${data.name}, ${slug}, ${data.address ?? ""}, ${data.city ?? ""},
          ${data.designer ?? null}, ${data.imageUrl ?? "/images/hero.jpg"}, ${par}, ${data.description ?? ""}, ${data.theme ?? null}
        )
        returning id
      `;
      courseId = row.id;
    }

    let teeId = data.tee.id ?? null;
    if (teeId) {
      const [tee] = await sql<{ id: number; course_id: number }>`
        select id, course_id from tees where id = ${teeId}
      `;
      if (!tee || tee.course_id !== courseId) throw new Error("Tee does not belong to this course.");
      await sql`
        update tees set
          name = ${data.tee.name},
          color = ${data.tee.color},
          rating = ${data.tee.rating},
          slope = ${data.tee.slope},
          yardage = ${yardage}
        where id = ${teeId}
      `;
    } else {
      const [tee] = await sql<{ id: number }>`
        insert into tees (course_id, name, color, rating, slope, yardage)
        values (${courseId}, ${data.tee.name}, ${data.tee.color}, ${data.tee.rating}, ${data.tee.slope}, ${yardage})
        returning id
      `;
      teeId = tee.id;
    }

    for (const h of data.holes) {
      await sql`
        insert into holes (tee_id, number, par, yardage, stroke_index)
        values (${teeId}, ${h.number}, ${h.par}, ${h.yardage}, ${h.strokeIndex})
        on conflict (tee_id, number) do update set
          par = excluded.par,
          yardage = excluded.yardage,
          stroke_index = excluded.stroke_index
      `;
    }

    if (data.copyParAndIndex !== false) {
      const others = await sql<{ id: number }>`
        select id from tees where course_id = ${courseId} and id <> ${teeId}
      `;
      for (const other of others) {
        for (const h of data.holes) {
          await sql`
            update holes
            set par = ${h.par}, stroke_index = ${h.strokeIndex}
            where tee_id = ${other.id} and number = ${h.number}
          `;
        }
      }
    }

    const rounds = await sql<{ id: number; status: string }>`
      select id, status from rounds where course_id = ${courseId} and status <> 'finalized'
    `;
    for (const r of rounds) await recomputeRoundNets(sql, r.id);

    await audit(sql, context.userId, "save_scorecard", "course", courseId, { teeId, par, yardage });
    return { ok: true as const, courseId, teeId, slug, par, yardage };
  });

export const addCourseTee = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      courseId: z.number().int().positive(),
      name: z.string().trim().min(1).max(24),
      color: z.string().trim().min(3).max(24),
      rating: z.number().min(55).max(90),
      slope: z.number().int().min(55).max(155),
      copyFromTeeId: z.number().int().positive().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const sourceId =
      data.copyFromTeeId ??
      (
        await sql<{ id: number }>`
          select id from tees where course_id = ${data.courseId} order by yardage desc limit 1
        `
      )[0]?.id;
    const sourceHoles = sourceId
      ? await sql<{ number: number; par: number; yardage: number; stroke_index: number }>`
          select number, par, yardage, stroke_index from holes where tee_id = ${sourceId} order by number
        `
      : [];
    const holes = sourceHoles.length
      ? sourceHoles
      : Array.from({ length: 18 }, (_, i) => ({
          number: i + 1,
          par: 4,
          yardage: 400,
          stroke_index: i + 1,
        }));
    const yardage = holes.reduce((s, h) => s + h.yardage, 0);
    const [tee] = await sql<{ id: number }>`
      insert into tees (course_id, name, color, rating, slope, yardage)
      values (${data.courseId}, ${data.name}, ${data.color}, ${data.rating}, ${data.slope}, ${yardage})
      returning id
    `;
    for (const h of holes) {
      await sql`
        insert into holes (tee_id, number, par, yardage, stroke_index)
        values (${tee.id}, ${h.number}, ${h.par}, ${h.yardage}, ${h.stroke_index})
      `;
    }
    await audit(sql, context.userId, "add_tee", "tee", tee.id);
    return { ok: true as const, teeId: tee.id };
  });

export const assignRoundCourse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      roundId: z.number().int().positive(),
      courseId: z.number().int().positive(),
      teeId: z.number().int().positive(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const [round] = await sql<{ id: number; status: string }>`
      select id, status from rounds where id = ${data.roundId}
    `;
    if (!round) throw new Error("Round not found.");
    if (round.status === "finalized") throw new Error("That round is locked.");
    const [tee] = await sql<{ id: number; course_id: number }>`
      select id, course_id from tees where id = ${data.teeId}
    `;
    if (!tee || tee.course_id !== data.courseId) throw new Error("Tee does not match the course.");
    const [course] = await sql<{ theme: string | null }>`select theme from courses where id = ${data.courseId}`;
    await sql`
      update rounds
      set course_id = ${data.courseId}, tee_id = ${data.teeId}, theme = coalesce(${course?.theme ?? null}, theme)
      where id = ${data.roundId}
    `;
    await recomputeRoundNets(sql, data.roundId);
    await audit(sql, context.userId, "assign_round_course", "round", data.roundId, data);
    return { ok: true as const };
  });

export const getMailSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await ensureMailColumns(sql);
    const cfg = await loadMailConfig(sql);
    const queued = await sql<{ n: number }>`
      select count(*)::int as n from emails where status in ('queued', 'failed')
    `;
    return { ...mailStatus(cfg), queued: queued[0]?.n ?? 0 };
  });

export const saveMailSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      provider: z.enum(["none", "resend", "smtp"]),
      from: z.string().min(3).max(200),
      apiKey: z.string().max(200).optional(),
      smtpHost: z.string().max(200).optional(),
      smtpPort: z.number().int().min(1).max(65535).optional(),
      smtpUser: z.string().max(200).optional(),
      smtpPass: z.string().max(200).optional(),
      xaiKey: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    await ensureMailColumns(sql);
    const current = await loadMailConfig(sql);
    const apiKey = data.apiKey?.trim() || current.apiKey;
    const smtpPass = data.smtpPass?.trim() || current.smtpPass;
    const xaiKey = data.xaiKey?.trim() || current.xaiKey;
    await sql`
      update trips set
        email_provider = ${data.provider},
        email_from = ${data.from.trim()},
        email_api_key = ${apiKey},
        smtp_host = ${data.smtpHost?.trim() || current.smtpHost},
        smtp_port = ${data.smtpPort ?? current.smtpPort},
        smtp_user = ${data.smtpUser?.trim() || current.smtpUser},
        smtp_pass = ${smtpPass},
        xai_api_key = ${xaiKey}
    `;
    await audit(sql, context.userId, "save_mail_settings", "trip");
    const flushed = data.provider === "none" ? { sent: 0, leftover: 0 } : await flushQueuedEmails(sql);
    const cfg = await loadMailConfig(sql);
    const queued = await sql<{ n: number }>`
      select count(*)::int as n from emails where status in ('queued', 'failed')
    `;
    return { ...mailStatus(cfg), queued: queued[0]?.n ?? 0, flushed: flushed.sent };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ to: z.string().email() }))
  .handler(async ({ context, data }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const html = wrapHtml(
      "Seth Mode test",
      "<p>If you can read this, the Young Gunz mail connection works. The group chat is still not an acceptable substitute.</p>",
    );
    const tid = await tripId(sql);
    const result = await queueEmail(sql, {
      tripId: tid,
      toEmail: data.to,
      subject: "Young Gunz — mail test",
      html,
      type: "test",
    });
    if (result.status !== "sent") {
      throw new Error("Queued, not sent. Check the API key, From address, or SMTP login.");
    }
    return { ok: true as const, status: result.status };
  });

export const assignAwardsFromData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await withDb();
    const ident = await userEmail(sql, context.userId);
    await requireAdmin(sql, context.userId, ident.email);
    const snapshot = await loadBootstrap();
    const applied = await persistAwardPicks(sql, snapshot);
    await audit(sql, context.userId, "assign_awards", "trip");
    return { ok: true as const, applied };
  });


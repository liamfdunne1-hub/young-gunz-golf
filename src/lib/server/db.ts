import { getSql, type Sql } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { maybeQueueReminders } from "@/lib/server/email";
import { num } from "@/lib/utils";
import type { JokeMetrics, Player } from "@/lib/types";

export async function withDb(): Promise<Sql> {
  const sql = await getSql();
  await ensureSeeded(sql);
  await maybeQueueReminders(sql).catch(() => undefined);
  return sql;
}

export async function tripId(sql: Sql): Promise<number> {
  const [row] = await sql<{ id: number }>`select id from trips order by id limit 1`;
  if (!row) throw new Error("Trip not seeded");
  return row.id;
}

function parseMetrics(raw: unknown): JokeMetrics {
  const obj = typeof raw === "string" ? (JSON.parse(raw) as Record<string, number>) : (raw as Record<string, number> | null);
  const n = (k: string, d = 50) => num(obj?.[k], d);
  return {
    driving: n("driving"),
    irons: n("irons"),
    putting: n("putting"),
    alcohol: n("alcohol"),
    lipOut: n("lipOut"),
    thatsGood: n("thatsGood"),
    breakfastBall: n("breakfastBall"),
    cart: n("cart"),
    wakeup: n("wakeup"),
    loseSomething: n("loseSomething"),
    sethDependency: n("sethDependency"),
  };
}

export type PlayerRow = {
  id: number;
  user_id: string | null;
  first_name: string;
  last_name: string;
  nickname: string | null;
  email: string;
  slug: string;
  role: "admin" | "player";
  handicap_index: string | number;
  course_handicap: number | null;
  playing_handicap: number | null;
  tee_name: string;
  scouting_report: string;
  threat_level: string | null;
  joke_metrics: unknown;
  registered_at: string | null;
};

export function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    user_id: row.user_id,
    first_name: row.first_name,
    last_name: row.last_name,
    nickname: row.nickname,
    email: row.email,
    slug: row.slug,
    role: row.role,
    handicap_index: num(row.handicap_index),
    course_handicap: row.course_handicap,
    playing_handicap: row.playing_handicap,
    tee_name: row.tee_name,
    scouting_report: row.scouting_report,
    threat_level: row.threat_level,
    joke_metrics: parseMetrics(row.joke_metrics),
    registered_at: row.registered_at,
  };
}

export async function playerByUser(sql: Sql, userId: string, email: string | null): Promise<Player | null> {
  const byUser = await sql<PlayerRow>`select * from players where user_id = ${userId} limit 1`;
  if (byUser[0]) return mapPlayer(byUser[0]);

  if (email) {
    const byEmail = await sql<PlayerRow>`
      select * from players where lower(email) = ${email.toLowerCase()} limit 1
    `;
    if (byEmail[0] && !byEmail[0].user_id) {
      await sql`
        update players set user_id = ${userId}, registered_at = coalesce(registered_at, now())
        where id = ${byEmail[0].id}
      `;
      return mapPlayer({ ...byEmail[0], user_id: userId });
    }
    if (byEmail[0]?.user_id === userId) return mapPlayer(byEmail[0]);
  }

  return null;
}

export async function requireAdmin(sql: Sql, userId: string, email: string | null): Promise<Player | null> {
  const player = await playerByUser(sql, userId, email);
  if (player?.role === "admin") return player;
  try {
    const [unlocked] = await sql<{ user_id: string }>`
      select user_id from seth_sessions where user_id = ${userId} limit 1
    `;
    if (unlocked) return player;
  } catch {
    /* table not applied yet */
  }
  throw new Error("Seth Mode is locked. Enter the door code.");
}

export async function grantSethMode(sql: Sql, userId: string) {
  await sql`
    create table if not exists seth_sessions (
      user_id text primary key,
      unlocked_at timestamptz not null default now()
    )
  `;
  await sql`
    insert into seth_sessions (user_id, unlocked_at)
    values (${userId}, now())
    on conflict (user_id) do update set unlocked_at = now()
  `;
}

export async function audit(
  sql: Sql,
  actorUserId: string,
  action: string,
  entity: string,
  entityId?: string | number,
  details?: unknown,
) {
  await sql`
    insert into audit_logs (actor_user_id, action, entity, entity_id, details)
    values (
      ${actorUserId}, ${action}, ${entity}, ${entityId != null ? String(entityId) : null},
      ${details ? JSON.stringify(details) : null}::jsonb
    )
  `;
}

const MOM_LINES = [
  "Seth changed the pairings.",
  "Seth has reorganized everyone’s lives again.",
  "The Commissioner has spoken.",
  "Please stop asking Seth what time the tee time is. It is literally on this website.",
  "Seth made another spreadsheet decision.",
  "Pairings updated by Seth Young because apparently this couldn’t wait until morning.",
];

export async function setMomMessage(sql: Sql, message?: string) {
  const text = message ?? MOM_LINES[Math.floor(Math.random() * MOM_LINES.length)];
  await sql`update trips set last_admin_message = ${text}`;
  return text;
}

export async function notify(
  sql: Sql,
  playerId: number,
  type: string,
  title: string,
  body: string,
  link?: string,
) {
  await sql`
    insert into notifications (player_id, type, title, body, link)
    values (${playerId}, ${type}, ${title}, ${body}, ${link ?? null})
  `;
}

export async function notifyAll(
  sql: Sql,
  type: string,
  title: string,
  body: string,
  link?: string,
) {
  const players = await sql<{ id: number }>`select id from players`;
  for (const p of players) {
    await notify(sql, p.id, type, title, body, link);
  }
}

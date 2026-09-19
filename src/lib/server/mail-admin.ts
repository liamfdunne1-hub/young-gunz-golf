import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { withDb, requireAdmin } from "@/lib/server/db";

async function adminIdent(userId: string) {
  const sql = await withDb();
  const [u] = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId} limit 1
  `;
  await requireAdmin(sql, userId, u?.email ?? null);
  return sql;
}

export const clearMailKeys = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await adminIdent(context.userId);
    await sql`alter table trips add column if not exists email_api_key text`;
    await sql`alter table trips add column if not exists smtp_pass text`;
    await sql`alter table trips add column if not exists xai_api_key text`;
    await sql`alter table trips add column if not exists email_provider text not null default 'none'`;
    await sql`
      update trips set
        email_provider = 'none',
        email_api_key = null,
        smtp_pass = null,
        xai_api_key = null
    `;
    return { ok: true as const };
  });

export const clearPlaceholderPlayerEmails = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await adminIdent(context.userId);
    const updated = await sql<{ id: number }>`
      update players
      set email = 'pending+' || slug || '@pending.younggunz.golf'
      where email ilike '%@younggunz.golf'
         or email ilike '%@younggunzgolf.com'
         or email ilike '%.invalid'
      returning id
    `;
    const cancelled = await sql<{ id: number }>`
      update emails
      set status = 'failed'
      where status in ('queued', 'failed')
        and (
          to_email ilike '%@younggunz.golf'
          or to_email ilike '%@pending.younggunz.golf'
          or to_email ilike '%.invalid'
        )
      returning id
    `;
    return { ok: true as const, players: updated.length, emails: cancelled.length };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const generateRecap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ day: z.string().min(8) }))
  .handler(async ({ context, data }) => {
    const { withDb, requireAdmin } = await import("@/lib/server/db");
    const { loadMailConfig } = await import("@/lib/server/email");
    const { writeRecapWithAi } = await import("@/lib/server/ai");
    const { loadBootstrap } = await import("@/lib/server/bootstrap");
    const sql = await withDb();
    const [u] = await sql<{ email: string | null }>`
      select email from "user" where id = ${context.userId} limit 1
    `;
    await requireAdmin(sql, context.userId, u?.email ?? null);
    const snapshot = await loadBootstrap();
    const cfg = await loadMailConfig(sql);
    const { draft, usedAi } = await writeRecapWithAi(snapshot, data.day, cfg.xaiKey);
    return { ...draft, usedAi, fromNumbers: !usedAi };
  });

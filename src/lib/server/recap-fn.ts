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

export const generateTestRecap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
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
    const round = snapshot.rounds[0];
    if (!round) throw new Error("No rounds on the trip to fake.");
    const fakeScores = snapshot.players.flatMap((p, pi) =>
      Array.from({ length: 18 }, (_, i) => {
        const hole = i + 1;
        const wobble = ((p.id * 17 + hole * 13) % 5) - 1;
        const blow = hole === 7 + (pi % 3) ? 4 : hole === 16 ? 3 : 0;
        const gross = Math.max(3, Math.min(10, 4 + wobble + blow));
        const net = Math.max(2, gross - (hole % 5 === 0 ? 1 : 0));
        return {
          id: 900000 + p.id * 20 + hole,
          round_id: round.id,
          player_id: p.id,
          hole,
          hole_number: hole,
          gross,
          net,
        };
      }),
    );
    const fake = {
      ...snapshot,
      scores: fakeScores,
      askSeth: snapshot.players.map((p, i) => ({ player_id: p.id, n: i % 4 })),
    };
    const cfg = await loadMailConfig(sql);
    const { draft, usedAi } = await writeRecapWithAi(fake as typeof snapshot, round.date, cfg.xaiKey);
    return {
      ...draft,
      usedAi,
      fromNumbers: !usedAi,
      note: usedAi
        ? undefined
        : cfg.xaiKey
          ? "Key is saved but Grok did not answer. Template used fake cards."
          : "No xAI key saved. Template used fake cards. Paste a key, Save connection, try again.",
    };
  });

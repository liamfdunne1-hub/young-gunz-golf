import { createFileRoute, Link } from "@tanstack/react-router";
import { BroadcastNav } from "@/components/broadcast-nav";
import { useStats } from "@/lib/hooks";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const { data, records, isPending } = useStats();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Young Gunz History</p>
        <h1 className="font-display text-4xl">The Record Book</h1>
        <p className="max-w-2xl text-sm text-muted">
          2026 · Orlando. Every number the trip produces is bound here: holes won, holes lost, the hardest hole, the
          easiest hole, the worst individual score, skins, and the other things ten friends should not have a website
          for.
        </p>
        <BroadcastNav />
      </header>

      {records.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-gold">{group.kicker}</p>
            <h2 className="font-display text-3xl">{group.title}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {group.entries.map((entry) => {
              const player = entry.playerId ? data.players.find((p) => p.id === entry.playerId) : null;
              return (
                <article key={entry.key} className="panel p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gold">{entry.label}</p>
                  {player ? (
                    <Link to="/players/$slug" params={{ slug: player.slug }} className="font-display text-2xl hover:text-gold">
                      {entry.value}
                    </Link>
                  ) : (
                    <p className="font-display text-2xl">{entry.value}</p>
                  )}
                  <p className="mt-1 text-sm text-muted">{entry.detail}</p>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-sm text-muted">
        Live cards feed this book automatically. Keep score on the{" "}
        <Link to="/scores" className="text-gold">
          scoring desk
        </Link>
        .
      </p>
    </div>
  );
}

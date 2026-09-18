import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerAvatar } from "@/components/avatar";
import { useStats } from "@/lib/hooks";
import { formatHandicap, playerName } from "@/lib/utils";

export const Route = createFileRoute("/players/")({ component: Players });

function Players() {
  const { data, stats, isPending } = useStats();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">The Field</p>
        <h1 className="font-display text-4xl">Ten Golfers</h1>
        <p className="text-sm text-muted">Handicaps are editable. Arguments about them are not.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.players.map((p) => {
          const s = stats.find((x) => x.playerId === p.id);
          return (
            <Link key={p.id} to="/players/$slug" params={{ slug: p.slug }} className="panel flex gap-4 p-4">
              <PlayerAvatar player={p} size={56} />
              <div className="min-w-0">
                <p className="truncate font-display text-2xl leading-tight">{playerName(p)}</p>
                <p className="text-xs text-gold">{p.nickname}</p>
                <p className="mt-1 text-sm tabular">
                  Index {formatHandicap(p.handicap_index)}
                  {p.course_handicap != null ? ` · CH ${p.course_handicap}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {s?.points ?? 0} pts · {s?.birdies ?? 0} birdies · Seth dep {p.joke_metrics.sethDependency}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

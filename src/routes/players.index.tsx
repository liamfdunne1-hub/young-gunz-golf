import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerAvatar } from "@/components/avatar";
import { useStats } from "@/lib/hooks";
import { SIDE_LABEL, playersOnSide, type Side } from "@/lib/golf/roster";
import { formatCourseHcp, formatHandicap, playerName } from "@/lib/utils";

export const Route = createFileRoute("/players/")({ component: Players });

function Players() {
  const { data, stats, isPending } = useStats();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  const sides: Side[] = ["a", "b"];
  const placed = new Set(sides.flatMap((side) => playersOnSide(data.players, side).map((p) => p.id)));
  const loose = data.players.filter((p) => !placed.has(p.id));
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">The Field · 5 v 5</p>
        <h1 className="font-display text-4xl">Ten Golfers</h1>
        <p className="text-sm text-muted">Two sides. Handicaps are posted. Arguments about them are not.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {sides.map((side) => (
          <section key={side} className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gold">{SIDE_LABEL[side]}</p>
            <ul className="mt-2 divide-y divide-line">
              {playersOnSide(data.players, side).map((p) => {
                const s = stats.find((x) => x.playerId === p.id);
                return (
                  <li key={p.id}>
                    <Link to="/players/$slug" params={{ slug: p.slug }} className="flex items-center gap-3 py-3">
                      <PlayerAvatar player={p} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-2xl leading-tight">{playerName(p)}</p>
                        <p className="text-xs text-muted">
                          {p.nickname}
                          {p.course_handicap != null ? ` · CH ${formatCourseHcp(p.course_handicap)}` : ""}
                          {" · "}
                          {s?.points ?? 0} pts
                        </p>
                      </div>
                      <p className="font-display text-2xl tabular text-gold">{formatHandicap(p.handicap_index)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {loose.length ? (
        <section className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Unassigned</p>
          <ul className="mt-2">
            {loose.map((p) => (
              <li key={p.id}>
                <Link to="/players/$slug" params={{ slug: p.slug }} className="flex items-center gap-3 py-2">
                  <PlayerAvatar player={p} size={36} />
                  <span>{playerName(p)}</span>
                  <span className="ml-auto text-gold">{formatHandicap(p.handicap_index)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
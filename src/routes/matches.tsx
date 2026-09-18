import { createFileRoute } from "@tanstack/react-router";
import { useTrip } from "@/lib/hooks";
import { matchPlayOff } from "@/lib/golf/handicap";
import { formatCourseHcp, playerName } from "@/lib/utils";

export const Route = createFileRoute("/matches")({ component: Matches });

function Matches() {
  const { data, isPending } = useTrip();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  const name = (id: number) => {
    const p = data.players.find((x) => x.id === id);
    return p ? playerName(p) : "—";
  };
  const short = (id: number) => data.players.find((x) => x.id === id)?.first_name ?? "—";
  const ph = (roundId: number, playerId: number) => {
    const frozen = data.roundHandicaps.find((h) => h.round_id === roundId && h.player_id === playerId);
    if (frozen) return frozen.playing_handicap;
    const p = data.players.find((x) => x.id === playerId);
    return p?.playing_handicap ?? p?.course_handicap ?? 0;
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Net four-ball · USGA 90%</p>
        <h1 className="font-display text-4xl">Matches</h1>
        <p className="text-sm text-muted">
          Two-man best ball, net of each partner, USGA playing handicaps at 90% of course handicap. Lowest net wins the hole.
        </p>
      </header>
      {data.matches.length === 0 ? (
        <div className="panel p-6 text-sm text-muted">
          No matches yet. When Seth publishes pairings, foursomes become 1-2 vs 3-4.
        </div>
      ) : (
        data.rounds.map((round) => {
          const ms = data.matches.filter((m) => m.round_id === round.id);
          if (!ms.length) return null;
          return (
            <section key={round.id}>
              <h2 className="mb-2 font-display text-2xl">
                Round {round.round_number} · {round.tee_time}
              </h2>
              <div className="space-y-3">
                {ms.map((m) => {
                  const ids = [m.a1, m.a2, m.b1, m.b2];
                  const rel = matchPlayOff(ids.map((id) => ph(round.id, id)));
                  return (
                    <article key={m.id} className="panel p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-display text-xl">
                            {name(m.a1)} / {name(m.a2)}
                          </p>
                          <p className="text-sm text-muted">
                            vs {name(m.b1)} / {name(m.b2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-3xl text-gold">{m.result ?? "ALL SQUARE"}</p>
                          <p className="text-xs uppercase tracking-[0.14em] text-muted">
                            {m.status === "final" ? "Final" : `Thru ${m.thru ?? 0}`}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted">
                        Strokes this match (off scratch): {short(m.a1)} {formatCourseHcp(rel[0] ?? 0)}, {short(m.a2)}{" "}
                        {formatCourseHcp(rel[1] ?? 0)}, {short(m.b1)} {formatCourseHcp(rel[2] ?? 0)}, {short(m.b2)}{" "}
                        {formatCourseHcp(rel[3] ?? 0)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

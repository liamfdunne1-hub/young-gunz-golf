import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerAvatar } from "@/components/avatar";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { playerName } from "@/lib/utils";

export const Route = createFileRoute("/pairings")({ component: Pairings });

function Pairings() {
  const { data, isPending } = useTrip();
  const me = useMeQuery();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">No permanent teams</p>
        <h1 className="font-display text-4xl">Pairings</h1>
        <p className="text-sm text-muted">
          Two-man best-ball, net, USGA 90%. Partnerships can change every round. Drafts stay with Seth until he publishes.
        </p>
        {me.data?.isAdmin ? (
          <Link to="/seth/pairings" className="mt-2 inline-block text-sm text-gold">
            Open pairings manager
          </Link>
        ) : null}
      </header>
      {data.rounds.map((round) => {
        const course = data.courses.find((c) => c.id === round.course_id);
        const groups = data.groups.filter((g) => g.round_id === round.id);
        const published = round.pairings_status === "published";
        return (
          <section key={round.id} className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gold">
              Round {round.round_number} · {round.tee_time}
            </p>
            <h2 className="font-display text-2xl">{course?.name}</h2>
            {!published || !groups.length ? (
              <p className="mt-3 text-sm text-muted">
                Not yet announced. Waiting for Seth to rearrange everyone for the 14th time.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {groups.map((g) => {
                  const members = data.groupPlayers
                    .filter((gp) => gp.group_id === g.id)
                    .map((gp) => data.players.find((p) => p.id === gp.player_id))
                    .filter(Boolean);
                  const match = data.matches.find((m) => m.group_id === g.id);
                  return (
                    <div key={g.id} className="rounded-[16px] border border-line p-3">
                      <p className="text-xs text-gold">Group {g.group_number}</p>
                      <ul className="mt-2 space-y-2">
                        {members.map((p) => (
                          <li key={p!.id} className="flex items-center gap-2 text-sm">
                            <PlayerAvatar player={p!} size={28} />
                            {playerName(p!)}
                          </li>
                        ))}
                      </ul>
                      {match ? (
                        <p className="mt-2 text-xs text-muted">
                          {data.players.find((p) => p.id === match.a1)?.first_name} /{" "}
                          {data.players.find((p) => p.id === match.a2)?.first_name} vs{" "}
                          {data.players.find((p) => p.id === match.b1)?.first_name} /{" "}
                          {data.players.find((p) => p.id === match.b2)?.first_name}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerAvatar } from "@/components/avatar";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { playerName } from "@/lib/utils";
import {
  FORMAT_DETAIL,
  FORMAT_LABEL,
  SHAPE_LABEL,
  asFormat,
  asShape,
  isInterMatch,
  isRotatingVegas,
  isTeamFormat,
  teeLabel,
} from "@/lib/golf/formats";

export const Route = createFileRoute("/pairings")({ component: Pairings });

function Pairings() {
  const { data, isPending } = useTrip();
  const me = useMeQuery();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Tee times first. Then the match.</p>
        <h1 className="font-display text-4xl">Pairings</h1>
        <p className="text-sm text-muted">
          Who you walk with is the tee time. The game inside it is separate from an inter-tee match. Vegas partners
          come from where the balls land, every hole.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          {me.data?.isAdmin ? (
            <Link to="/seth/pairings" className="text-sm text-gold">
              Open pairings manager
            </Link>
          ) : null}
          <Link to="/leaderboard" className="text-sm text-gold">
            Intergroup board
          </Link>
        </div>
      </header>
      {data.rounds.map((round) => {
        const course = data.courses.find((c) => c.id === round.course_id);
        const groups = data.groups.filter((g) => g.round_id === round.id);
        const published = round.pairings_status === "published";
        const format = asFormat(round.format);
        const shape = asShape(round.group_shape);
        const inter = data.matches.filter((m) => m.round_id === round.id && isInterMatch(m));
        const first = (id: number | null) =>
          id == null ? null : data.players.find((p) => p.id === id)?.first_name;
        return (
          <section key={round.id} className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gold">
              Round {round.round_number} · {round.tee_time} · {SHAPE_LABEL[shape]}
            </p>
            <h2 className="font-display text-2xl">{course?.name}</h2>
            <p className="mt-1 text-xs text-muted">
              Default {FORMAT_LABEL[format]} inside a tee time. {FORMAT_DETAIL[format]}
            </p>
            {!published || !groups.length ? (
              <p className="mt-3 text-sm text-muted">
                Not yet announced. Waiting for Seth to rearrange everyone for the 14th time.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groups
                    .filter((g) => data.groupPlayers.some((gp) => gp.group_id === g.id))
                    .map((g) => {
                      const members = data.groupPlayers
                        .filter((gp) => gp.group_id === g.id)
                        .map((gp) => data.players.find((p) => p.id === gp.player_id))
                        .filter(Boolean);
                      const match = data.matches.find((m) => m.group_id === g.id && !isInterMatch(m));
                      const groupFormat = asFormat(match?.format ?? g.format, format);
                      const pairOnly = Boolean(match?.a2) && !match?.b1;
                      const rotating = match ? isRotatingVegas(groupFormat, match) : isVegasAndFour(groupFormat, members.length);
                      return (
                        <div key={g.id} className="rounded-[16px] border border-line p-3">
                          <p className="text-xs text-gold">
                            {teeLabel(g.group_number, g.tee_time)} · {FORMAT_LABEL[groupFormat]}
                          </p>
                          <ul className="mt-2 space-y-2">
                            {members.map((p) => (
                              <li key={p!.id} className="flex items-center gap-2 text-sm">
                                <PlayerAvatar player={p!} size={28} />
                                {playerName(p!)}
                              </li>
                            ))}
                          </ul>
                          {match && groupFormat === "wolf" ? (
                            <p className="mt-2 text-xs text-muted">
                              Wolf rotation: {[match.a1, match.a2, match.b1]
                                .filter((id): id is number => id != null)
                                .map(first)
                                .join(" → ")}
                            </p>
                          ) : match && rotating ? (
                            <p className="mt-2 text-xs text-muted">
                              Vegas — partners from the landing, every hole
                            </p>
                          ) : match && pairOnly ? (
                            <p className="mt-2 text-xs text-muted">
                              {first(match.a1)} / {first(match.a2)} vs the field
                            </p>
                          ) : match && isTeamFormat(groupFormat) ? (
                            <p className="mt-2 text-xs text-muted">
                              {first(match.a1)} / {first(match.a2)} vs {first(match.b1)} / {first(match.b2)}
                            </p>
                          ) : match ? (
                            <p className="mt-2 text-xs text-muted">
                              {first(match.a1)} / {first(match.a2)} vs {first(match.b1)} / {first(match.b2)}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
                {inter.length ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Inter-tee matches</p>
                    {inter.map((m) => (
                      <p key={m.id} className="text-sm">
                        <span className="text-gold">{FORMAT_LABEL[asFormat(m.format, format)]}</span>{" "}
                        {first(m.a1)} / {first(m.a2)} vs {first(m.b1)} / {first(m.b2)}
                        {asFormat(m.format) === "vegas" ? " · partners locked for 18" : ""}
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function isVegasAndFour(format: ReturnType<typeof asFormat>, n: number) {
  return format === "vegas" && n === 4;
}

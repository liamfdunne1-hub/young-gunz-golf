import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerAvatar } from "@/components/avatar";
import { metricLabels } from "@/lib/golf/derive";
import { useStats } from "@/lib/hooks";
import { formatCourseHcp, formatHandicap, playerName } from "@/lib/utils";
import { SETH_TITLES } from "@/lib/constants";

export const Route = createFileRoute("/players/$slug")({ component: Profile });

function Profile() {
  const { slug } = Route.useParams();
  const { data, stats, isPending } = useStats();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  const p = data.players.find((x) => x.slug === slug);
  if (!p) return <p>Unknown golfer. Seth does not recognize this person.</p>;
  const s = stats.find((x) => x.playerId === p.id);
  const isSeth = p.slug === "seth-young";
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <PlayerAvatar player={p} size={80} />
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{p.nickname}</p>
          <h1 className="font-display text-4xl leading-tight">{playerName(p)}</h1>
          {isSeth ? (
            <p className="text-sm text-gold">{SETH_TITLES.join(" · ")}</p>
          ) : null}
          {p.threat_level ? (
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-orange">Threat: {p.threat_level}</p>
          ) : null}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat k="Index" v={formatHandicap(p.handicap_index)} />
        <Stat k="Course Hcp" v={p.course_handicap != null ? formatCourseHcp(p.course_handicap) : "—"} />
        <Stat k="Points" v={String(s?.points ?? 0)} />
        <Stat k="Record" v={`${s?.wins ?? 0}-${s?.losses ?? 0}-${s?.ties ?? 0}`} />
        <Stat k="Gross avg" v={s?.grossAvg != null ? s.grossAvg.toFixed(1) : "—"} />
        <Stat k="Net avg" v={s?.netAvg != null ? s.netAvg.toFixed(1) : "—"} />
        <Stat k="Birdies" v={String(s?.birdies ?? 0)} />
        <Stat k="Skins" v={String(s?.skins ?? 0)} />
        <Stat k="Holes won" v={String(s?.holesWon ?? 0)} />
        <Stat k="Holes lost" v={String(s?.holesLost ?? 0)} />
        <Stat k="Ask Seth" v={String(s?.askSeth ?? 0)} />
      </section>

      <section className="panel p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Scouting report</p>
        <p className="mt-2 text-base leading-relaxed">{p.scouting_report}</p>
      </section>

      <section className="panel p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Match history</p>
        <ul className="mt-3 space-y-2">
          {data.matches.filter((m) => [m.a1, m.a2, m.b1, m.b2].includes(p.id)).length === 0 ? (
            <li className="text-sm text-muted">No matches. Seth has not finished thinking.</li>
          ) : (
            data.matches
              .filter((m) => [m.a1, m.a2, m.b1, m.b2].includes(p.id))
              .map((m) => {
                const round = data.rounds.find((r) => r.id === m.round_id);
                const side = m.a1 === p.id || m.a2 === p.id ? "A" : "B";
                const partnerId = side === "A" ? (m.a1 === p.id ? m.a2 : m.a1) : m.b1 === p.id ? m.b2 : m.b1;
                const partner = partnerId ? data.players.find((x) => x.id === partnerId) : null;
                return (
                  <li key={m.id} className="flex justify-between text-sm">
                    <span>
                      R{round?.round_number}{" "}
                      {m.format === "wolf"
                        ? "Wolf"
                        : partner
                          ? `with ${partner.first_name}`
                          : "solo"}
                    </span>
                    <span className="text-gold">{m.result ?? "AS"}</span>
                  </li>
                );
              })
          )}
        </ul>
      </section>

      <section className="panel p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Completely unnecessary analytics</p>
        <ul className="mt-4 space-y-3">
          {metricLabels().map((m) => {
            const v = p.joke_metrics[m.key];
            return (
              <li key={m.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{m.label}</span>
                  <span className="tabular text-gold">{v}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-navy">
                  <div className="h-full bg-gold" style={{ width: `${v}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Link to="/players" className="text-sm text-gold">
        Back to the field
      </Link>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{k}</p>
      <p className="font-display text-2xl tabular">{v}</p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useTrip } from "@/lib/hooks";
import { matchPlayOff } from "@/lib/golf/handicap";
import {
  FORMAT_DETAIL,
  FORMAT_LABEL,
  asFormat,
  isInterMatch,
  isRotatingVegas,
  isTeamFormat,
  teamPlayingHandicap,
  teeLabel,
} from "@/lib/golf/formats";
import { formatCourseHcp, playerName } from "@/lib/utils";

export const Route = createFileRoute("/matches")({ component: Matches });

function Matches() {
  const { data, isPending } = useTrip();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  const trip = data;
  const name = (id: number | null) => {
    if (id == null) return "—";
    const p = data.players.find((x) => x.id === id);
    return p ? playerName(p) : "—";
  };
  const short = (id: number | null) =>
    id == null ? "—" : (data.players.find((x) => x.id === id)?.first_name ?? "—");
  const ph = (roundId: number, playerId: number) => {
    const frozen = data.roundHandicaps.find((h) => h.round_id === roundId && h.player_id === playerId);
    if (frozen) return frozen.playing_handicap;
    const p = data.players.find((x) => x.id === playerId);
    return p?.playing_handicap ?? p?.course_handicap ?? 0;
  };
  const ch = (roundId: number, playerId: number) => {
    const frozen = data.roundHandicaps.find((h) => h.round_id === roundId && h.player_id === playerId);
    if (frozen) return frozen.course_handicap;
    const p = data.players.find((x) => x.id === playerId);
    return p?.course_handicap ?? 0;
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">USGA net · hole by hole</p>
        <h1 className="font-display text-4xl">Matches</h1>
        <p className="text-sm text-muted">
          Tee-time games and inter-tee matches are separate. Vegas inside a foursome re-pairs from the landing every
          hole. An inter-tee Vegas locks partners for 18.
        </p>
      </header>
      {data.matches.length === 0 ? (
        <div className="panel p-6 text-sm text-muted">
          No matches yet. When Seth publishes pairings, tee times become games — and he can post a match between tee
          times.
        </div>
      ) : (
        data.rounds.map((round) => {
          const ms = data.matches.filter((m) => m.round_id === round.id);
          if (!ms.length) return null;
          const roundFormat = asFormat(round.format);
          const teeGames = ms.filter((m) => !isInterMatch(m));
          const inter = ms.filter((m) => isInterMatch(m));
          return (
            <section key={round.id}>
              <h2 className="mb-1 font-display text-2xl">
                Round {round.round_number} · {round.tee_time}
              </h2>
              <p className="mb-2 text-xs text-muted">
                {FORMAT_LABEL[roundFormat]} · {FORMAT_DETAIL[roundFormat]}
              </p>
              {teeGames.length ? (
                <div className="mb-4 space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Tee-time games</p>
                  {teeGames.map((m) =>
                    renderCard(m, round.id, roundFormat, { name, short, ph, ch, groupLabel: groupLabel(m.group_id) }),
                  )}
                </div>
              ) : null}
              {inter.length ? (
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Inter-tee matches</p>
                  {inter.map((m) => renderCard(m, round.id, roundFormat, { name, short, ph, ch, groupLabel: null }))}
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );

  function groupLabel(groupId: number | null) {
    if (groupId == null) return null;
    const g = trip.groups.find((x) => x.id === groupId);
    return g ? teeLabel(g.group_number, g.tee_time) : null;
  }

  function renderCard(
    m: (typeof trip.matches)[number],
    roundId: number,
    roundFormat: ReturnType<typeof asFormat>,
    fn: {
      name: (id: number | null) => string;
      short: (id: number | null) => string;
      ph: (roundId: number, playerId: number) => number;
      ch: (roundId: number, playerId: number) => number;
      groupLabel: string | null;
    },
  ) {
    const format = asFormat(m.format, roundFormat);
    const ids = [m.a1, m.a2, m.b1, m.b2].filter((id): id is number => id != null);
    const rel = matchPlayOff(ids.map((id) => fn.ph(roundId, id)));
    const pairOnly = Boolean(m.a2) && !m.b1;
    const rotating = isRotatingVegas(format, m);
    let strokeLine = "";
    if (format === "wolf") {
      strokeLine = `Strokes this Wolf (off scratch, 100% CH): ${ids
        .map((id, i) => `${fn.short(id)} ${formatCourseHcp(rel[i] ?? 0)}`)
        .join(", ")}`;
    } else if (isTeamFormat(format) && m.a2 && m.b1 && m.b2) {
      const aPh = teamPlayingHandicap(format, fn.ch(roundId, m.a1), fn.ch(roundId, m.a2));
      const bPh = teamPlayingHandicap(format, fn.ch(roundId, m.b1), fn.ch(roundId, m.b2));
      const low = Math.min(aPh, bPh);
      strokeLine = `Team PH ${aPh} vs ${bPh}. ${fn.short(m.a1)}/${fn.short(m.a2)} ${
        aPh - low ? `get ${aPh - low}` : "off scratch"
      }, ${fn.short(m.b1)}/${fn.short(m.b2)} ${bPh - low ? `get ${bPh - low}` : "off scratch"}.`;
    } else if (isTeamFormat(format) && pairOnly && m.a2) {
      const aPh = teamPlayingHandicap(format, fn.ch(roundId, m.a1), fn.ch(roundId, m.a2));
      strokeLine = `Team PH ${aPh} vs the field.`;
    } else if (format === "vegas") {
      strokeLine = rotating
        ? `Vegas net (90% CH, off scratch): ${ids
            .map((id, i) => `${fn.short(id)} ${formatCourseHcp(rel[i] ?? 0)}`)
            .join(", ")}. Partners from the landing. Birdie reverses the other side. Eagle doubles.`
        : `Vegas net (90% CH, off scratch): ${ids
            .map((id, i) => `${fn.short(id)} ${formatCourseHcp(rel[i] ?? 0)}`)
            .join(", ")}. Birdie reverses the other side. Eagle doubles.`;
    } else {
      strokeLine = `Strokes this match (90% CH, off scratch): ${ids
        .map((id, i) => `${fn.short(id)} ${formatCourseHcp(rel[i] ?? 0)}`)
        .join(", ")}`;
    }
    return (
      <article key={m.id} className="panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-gold">
              {isInterMatch(m) ? "Inter-tee · " : fn.groupLabel ? `${fn.groupLabel} · ` : ""}
              {FORMAT_LABEL[format]}
            </p>
            {format === "wolf" ? (
              <>
                <p className="font-display text-xl">{ids.map(fn.short).join(" · ")}</p>
                <p className="text-sm text-muted">Rotation {ids.map(fn.short).join(" → ")}</p>
              </>
            ) : rotating ? (
              <>
                <p className="font-display text-xl">{ids.map(fn.short).join(" · ")}</p>
                <p className="text-sm text-muted">Partners from the landing, every hole</p>
              </>
            ) : pairOnly ? (
              <>
                <p className="font-display text-xl">
                  {fn.name(m.a1)} / {fn.name(m.a2)}
                </p>
                <p className="text-sm text-muted">vs the field · intergroup</p>
              </>
            ) : (
              <>
                <p className="font-display text-xl">
                  {fn.name(m.a1)} / {fn.name(m.a2)}
                </p>
                <p className="text-sm text-muted">
                  vs {fn.name(m.b1)} / {fn.name(m.b2)}
                </p>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="font-display text-3xl text-gold">{m.result ?? "ALL SQUARE"}</p>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {m.status === "final" ? "Final" : `Thru ${m.thru ?? 0}`}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{strokeLine}</p>
      </article>
    );
  }
}

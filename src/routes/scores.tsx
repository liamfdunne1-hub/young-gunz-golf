import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { enterScore, enterTeamScore, saveWolfPick, saveVegasSplit } from "@/lib/server/api";
import { matchPlayOff } from "@/lib/golf/handicap";
import { asFormat, FORMAT_LABEL, isInterMatch, isRotatingVegas, isTeamFormat, isVegas, strokeDotsOnHole, teamPlayingHandicap, vegasCombine, vegasHoleResult, wolfOfHole } from "@/lib/golf/formats";
import { useMeQuery, useTrip, useStats } from "@/lib/hooks";
import { enqueueScore, readScoreQueue, writeScoreQueue } from "@/lib/score-queue";
import { cn, formatCourseHcp, formatMoney, playerName } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { Bootstrap } from "@/lib/golf/derive";
import type { SkinsBoard } from "@/lib/golf/skins";

export const Route = createFileRoute("/scores")({ component: Scores });

type Mode = "me" | "group" | "field";

function playingOf(data: Bootstrap, roundId: number, playerId: number, fallback: number) {
  return (
    data.roundHandicaps.find((h) => h.round_id === roundId && h.player_id === playerId)?.playing_handicap ?? fallback
  );
}

function Scores() {
  const { data, isPending } = useTrip();
  const { skins } = useStats();
  const me = useMeQuery();
  const qc = useQueryClient();
  const [roundId, setRoundId] = useState<number | null>(null);
  const [hole, setHole] = useState(1);
  const [offline, setOffline] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    if (!data || roundId) return;
    const live = data.rounds.find((r) => r.status === "live") ?? data.rounds.find((r) => r.status !== "finalized");
    if (live) setRoundId(live.id);
  }, [data, roundId]);

  const mut = useMutation({
    mutationFn: (payload: { roundId: number; playerId: number; hole: number; gross: number }) =>
      enterScore({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
    },
  });
  const teamMut = useMutation({
    mutationFn: (payload: { roundId: number; matchId: number; side: "A" | "B"; hole: number; gross: number }) =>
      enterTeamScore({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
    },
  });
  const wolfMut = useMutation({
    mutationFn: (payload: { roundId: number; groupId: number; hole: number; partnerId: number | null; lone: boolean }) =>
      saveWolfPick({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const vegasMut = useMutation({
    mutationFn: (payload: {
      roundId: number;
      groupId: number;
      hole: number;
      a1: number;
      a2: number;
      b1: number;
      b2: number;
    }) => saveVegasSplit({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    async function flush() {
      const q = readScoreQueue();
      if (!q.length) return;
      const remain = [];
      for (const item of q) {
        try {
          await enterScore({ data: item });
        } catch {
          remain.push(item);
        }
      }
      writeScoreQueue(remain);
      if (remain.length < q.length) qc.invalidateQueries({ queryKey: ["trip"] });
    }
    const onOnline = () => {
      setOffline(false);
      void flush();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", () => setOffline(true));
    if (navigator.onLine) void flush();
    else setOffline(true);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [qc]);

  const round = data?.rounds.find((r) => r.id === roundId);
  const holes = useMemo(() => {
    if (!data || !round) return [];
    return data.holes.filter((h) => h.tee_id === round.tee_id).sort((a, b) => a.number - b.number);
  }, [data, round]);
  const holeMeta = holes.find((h) => h.number === hole);
  const meId = me.data?.player?.id;
  const resolvedMode: Mode = mode ?? (meId ? "me" : "field");

  const groupPlayerIds = useMemo(() => {
    if (!data || !round) return [];
    const groups = data.groups.filter((g) => g.round_id === round.id);
    if (meId) {
      const mine = data.groupPlayers.find((gp) => {
        const g = groups.find((x) => x.id === gp.group_id);
        return g && gp.player_id === meId;
      });
      if (mine) {
        return data.groupPlayers.filter((gp) => gp.group_id === mine.group_id).map((gp) => gp.player_id);
      }
    }
    return [];
  }, [data, round, meId]);

  const mineMatches = useMemo(() => {
    if (!data || !round || !meId) return [];
    return data.matches.filter(
      (m) => m.round_id === round.id && (m.a1 === meId || m.a2 === meId || m.b1 === meId || m.b2 === meId),
    );
  }, [data, round, meId]);
  const groupMatch = mineMatches.find((m) => !isInterMatch(m)) ?? null;
  const interMatch = mineMatches.find((m) => isInterMatch(m)) ?? null;
  const match = groupMatch ?? interMatch;

  function postScore(playerId: number, gross: number) {
    if (!roundId) return;
    const payload = { roundId, playerId, hole, gross };
    mut.mutate(payload, {
      onError: () => {
        enqueueScore(payload);
        setOffline(true);
        toast("Saved on this phone. It will sync when reception returns.");
      },
    });
  }

  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  if (!round || !holeMeta) {
    return (
      <div>
        <h1 className="font-display text-4xl">Live scoring</h1>
        <p className="text-muted">Waiting on a round. And on Seth.</p>
      </div>
    );
  }

  const sideName = (id: number) => data.players.find((p) => p.id === id)?.first_name ?? "";
  const myPlayer = meId ? data.players.find((p) => p.id === meId) : null;
  const canSelf = Boolean(meId);
  const editableIds =
    resolvedMode === "me" && meId
      ? [meId]
      : resolvedMode === "group" && groupPlayerIds.length
        ? groupPlayerIds
        : resolvedMode === "field" && me.data?.isAdmin
          ? data.players.map((p) => p.id)
          : [];

  const matchIds = match ? [match.a1, match.a2, match.b1, match.b2].filter((id): id is number => id != null) : [];
  const matchPhs = matchIds.map((id) => {
    const p = data.players.find((x) => x.id === id);
    return playingOf(data, round.id, id, p?.playing_handicap ?? p?.course_handicap ?? 0);
  });
  const relative = matchIds.length ? matchPlayOff(matchPhs) : [];
  const myRel = meId && match ? relative[matchIds.indexOf(meId)] : null;
  const format = asFormat(match?.format ?? round.format);
  const rotating = match ? isRotatingVegas(format, match) : false;
  const holeSplit =
    rotating && groupMatch?.group_id
      ? data.vegasSplits.find(
          (s) => s.round_id === round.id && s.group_id === groupMatch.group_id && s.hole_number === hole,
        ) ?? null
      : null;
  const chOf = (id: number) =>
    data.roundHandicaps.find((h) => h.round_id === round.id && h.player_id === id)?.course_handicap ??
    data.players.find((p) => p.id === id)?.course_handicap ??
    0;
  function teamRelOf(m: NonNullable<typeof match>) {
    const f = asFormat(m.format);
    if (!isTeamFormat(f) || !m.a2) return null;
    const aPh = teamPlayingHandicap(f, chOf(m.a1), chOf(m.a2));
    if (m.b1 && m.b2) {
      const bPh = teamPlayingHandicap(f, chOf(m.b1), chOf(m.b2));
      const low = Math.min(aPh, bPh);
      return { aPh, bPh, aRel: aPh - low, bRel: bPh - low, pair: false as const };
    }
    return { aPh, bPh: aPh, aRel: aPh, bRel: 0, pair: true as const };
  }
  const teamRel = match ? teamRelOf(match) : null;
  function strokeHcpFor(pid: number): number {
    if (teamRel && match && isTeamFormat(format)) {
      return pid === match.a1 || pid === match.a2 ? teamRel.aRel : teamRel.bRel;
    }
    const idx = matchIds.indexOf(pid);
    if (idx >= 0) return relative[idx] ?? 0;
    const p = data!.players.find((x) => x.id === pid);
    return playingOf(data!, round!.id, pid, p?.playing_handicap ?? p?.course_handicap ?? 0);
  }
  const myStrokeHcp = meId ? strokeHcpFor(meId) : 0;
  const myHoleStrokes = strokeDotsOnHole(myStrokeHcp, holeMeta.stroke_index);
  const standings = [groupMatch, interMatch].filter((m, i, arr) => m && arr.indexOf(m) === i) as NonNullable<
    typeof match
  >[];

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Keep your own card</p>
          <h1 className="font-display text-3xl">Hole {hole}</h1>
          <p className="text-sm text-muted">
            {data.courses.find((c) => c.id === round.course_id)?.name} · {round.tee_time}
          </p>
          <p className="text-xs text-gold">
            {FORMAT_LABEL[format]} · USGA net
            {myHoleStrokes ? ` · ${myHoleStrokes} stroke${myHoleStrokes === 1 ? "" : "s"} here` : ""}
          </p>
        </div>
        <select
          className="h-11 rounded-[12px] border border-line bg-navy px-3 text-sm"
          value={round.id}
          onChange={(e) => {
            setRoundId(Number(e.target.value));
            setHole(1);
          }}
        >
          {data.rounds.map((r) => (
            <option key={r.id} value={r.id}>
              R{r.round_number} · {r.tee_time}
            </option>
          ))}
        </select>
      </header>

      <div className="flex gap-2">
        {(
          [
            ["me", "My card"],
            ["group", "Tee time"],
            ["field", "Live field"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "h-10 rounded-full px-4 text-xs uppercase tracking-[0.14em]",
              resolvedMode === id ? "bg-gold text-navy" : "border border-line text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {offline ? (
        <p className="flex items-center gap-2 rounded-[12px] border border-orange/40 bg-orange/10 px-3 py-2 text-sm text-orange">
          <WifiOff size={16} /> Course reception mode. Scores are cached on this phone.
        </p>
      ) : null}

      {standings.length ? (
        standings.map((m) => {
          const f = asFormat(m.format, format);
          const rotatingThis = isRotatingVegas(f, m);
          const ids = [m.a1, m.a2, m.b1, m.b2].filter((id): id is number => id != null);
          return (
            <div key={m.id} className="panel flex items-center justify-between p-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-gold">
                  {isInterMatch(m) ? "Inter-tee · " : "Tee time · "}
                  {FORMAT_LABEL[f]}
                </p>
                {rotatingThis ? (
                  <>
                    <p className="font-display text-xl">{ids.map(sideName).join(" · ")}</p>
                    <p className="text-xs text-muted">Partners from the landing, every hole</p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-xl">
                      {sideName(m.a1)}
                      {m.a2 ? ` / ${sideName(m.a2)}` : ""}
                    </p>
                    {m.b1 ? (
                      <p className="text-xs text-muted">
                        vs {sideName(m.b1)}
                        {m.b2 ? ` / ${sideName(m.b2)}` : ""}
                      </p>
                    ) : m.a2 ? (
                      <p className="text-xs text-muted">vs the field · intergroup</p>
                    ) : null}
                  </>
                )}
                {match && m.id === match.id && myRel != null && f !== "wolf" && !isTeamFormat(f) ? (
                  <p className="mt-1 text-xs text-gold">
                    {myRel === 0 ? "You play off scratch this match." : `You get ${myRel} strokes this match.`}
                  </p>
                ) : null}
                {match && m.id === match.id && teamRel ? (
                  <p className="mt-1 text-xs text-gold">
                    {teamRel.pair
                      ? `Team PH ${teamRel.aPh} vs the card.`
                      : `Team PH ${teamRel.aPh} vs ${teamRel.bPh}. `}
                    {!teamRel.pair && meId && (meId === m.a1 || meId === m.a2)
                      ? teamRel.aRel
                        ? `Your side gets ${teamRel.aRel} this match.`
                        : "Your side plays off scratch."
                      : !teamRel.pair && teamRel.bRel
                        ? `Your side gets ${teamRel.bRel} this match.`
                        : !teamRel.pair
                          ? "Your side plays off scratch."
                          : null}
                  </p>
                ) : null}
                {f === "wolf" && match && m.id === match.id && myRel != null ? (
                  <p className="mt-1 text-xs text-gold">
                    Wolf is 100% course handicap, play off the low man.
                    {myRel ? ` You get ${myRel}.` : " You play off scratch."}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="font-display text-3xl text-gold">{m.result ?? "ALL SQUARE"}</p>
                <p className="text-xs text-muted">THRU {m.thru ?? 0}</p>
              </div>
            </div>
          );
        })
      ) : (
        <div className="panel p-4 text-sm text-muted">
          No match posted yet. Keep your own card anyway — pairings do not gate scoring.
        </div>
      )}

      {skins && resolvedMode !== "field" ? <ThisHoleSkin skins={skins} roundId={round.id} hole={hole} data={data} /> : null}

      {groupMatch && format === "wolf" && groupMatch.group_id && resolvedMode !== "field" ? (
        <WolfPickCard
          data={data}
          roundId={round.id}
          groupId={groupMatch.group_id}
          hole={hole}
          ids={matchIds}
          meId={meId}
          isAdmin={Boolean(me.data?.isAdmin)}
          pending={wolfMut.isPending}
          onPick={(partnerId, lone) =>
            wolfMut.mutate({
              roundId: round.id,
              groupId: groupMatch.group_id!,
              hole,
              partnerId,
              lone,
            })
          }
        />
      ) : null}

      {rotating && groupMatch?.group_id && resolvedMode !== "field" ? (
        <VegasSplitCard
          data={data}
          hole={hole}
          ids={matchIds}
          meId={meId}
          isAdmin={Boolean(me.data?.isAdmin)}
          pending={vegasMut.isPending}
          split={holeSplit}
          onSplit={(a1, a2, b1, b2) =>
            vegasMut.mutate({
              roundId: round.id,
              groupId: groupMatch.group_id!,
              hole,
              a1,
              a2,
              b1,
              b2,
            })
          }
        />
      ) : null}

      {standings
        .filter((m) => isVegas(asFormat(m.format)) && m.a2 && resolvedMode !== "field")
        .map((m) => {
          const f = asFormat(m.format);
          const split = isRotatingVegas(f, m) ? holeSplit : null;
          const partners = split
            ? { a1: split.a1, a2: split.a2, b1: split.b1, b2: split.b2 }
            : { a1: m.a1, a2: m.a2, b1: m.b1, b2: m.b2 };
          return (
            <VegasHole
              key={`vegas-${m.id}`}
              data={data}
              roundId={round.id}
              hole={hole}
              par={holeMeta.par}
              si={holeMeta.stroke_index}
              match={partners}
              waitingOnSplit={isRotatingVegas(f, m) && !split}
              strokeHcpFor={strokeHcpFor}
              sideName={sideName}
            />
          );
        })}

      {standings
        .filter((m) => isTeamFormat(asFormat(m.format)) && m.a2 && resolvedMode !== "field")
        .map((teamMatch) => {
          const teamFormat = asFormat(teamMatch.format);
          const rel = teamRelOf(teamMatch);
          if (!rel) return null;
          const sides =
            resolvedMode === "group" || !meId
              ? teamMatch.b1 && teamMatch.b2
                ? (["A", "B"] as const)
                : (["A"] as const)
              : meId === teamMatch.a1 || meId === teamMatch.a2
                ? (["A"] as const)
                : (["B"] as const);
          return (
            <div key={`team-${teamMatch.id}`} className="space-y-3">
              {sides.map((side) => {
                const pair =
                  side === "A"
                    ? [teamMatch.a1, teamMatch.a2!]
                    : teamMatch.b1 && teamMatch.b2
                      ? [teamMatch.b1, teamMatch.b2]
                      : [teamMatch.a1, teamMatch.a2!];
                const sideRel = side === "A" ? rel.aRel : rel.bRel;
                const lines = data.teamScores.filter((t) => t.match_id === teamMatch.id && t.side === side);
                const posted = lines.find((t) => t.hole_number === hole)?.gross ?? null;
                const canEdit =
                  meId != null &&
                  (Boolean(me.data?.isAdmin) || pair.includes(meId) || groupPlayerIds.includes(meId));
                return (
                  <div key={`${teamMatch.id}-${side}`} className="panel p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-gold">
                          {isInterMatch(teamMatch) ? "Inter-tee · " : ""}
                          {FORMAT_LABEL[teamFormat]} · side {side}
                        </p>
                        <p className="font-display text-xl">
                          {sideName(pair[0]!)} / {sideName(pair[1]!)}
                        </p>
                        <p className="text-[11px] text-muted">
                          Team PH {side === "A" ? rel.aPh : rel.bPh}
                          {sideRel ? ` · ${sideRel} stroke${sideRel === 1 ? "" : "s"} this match` : " · off scratch"}
                        </p>
                      </div>
                      <p className="font-display text-4xl tabular">{posted ?? "—"}</p>
                    </div>
                    <HoleStrip
                      holes={holes}
                      scores={lines.map((t) => ({ hole_number: t.hole_number, gross: t.gross, strokes: t.strokes }))}
                      current={hole}
                      playingHcp={sideRel}
                      onPick={setHole}
                    />
                    {canEdit ? (
                      <GrossSlot
                        hole={hole}
                        par={holeMeta.par}
                        posted={posted}
                        pending={teamMut.isPending}
                        label="Team gross"
                        onPost={(gross) =>
                          teamMut.mutate({
                            roundId: round.id,
                            matchId: teamMatch.id,
                            side,
                            hole,
                            gross,
                          })
                        }
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}

      {resolvedMode !== "field" ? (
        <div className="sticky top-16 z-20 flex items-center justify-between rounded-[18px] border border-line bg-navy/95 px-2 py-2 backdrop-blur-md">
          <Button variant="ghost" size="icon" onClick={() => setHole((h) => Math.max(1, h - 1))} aria-label="Previous hole">
            <ChevronLeft />
          </Button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Hole {hole}</p>
            <p className="font-display text-2xl">Par {holeMeta.par}</p>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
              {holeMeta.yardage} yds · SI {holeMeta.stroke_index}
              <StrokeDots count={myHoleStrokes} />
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setHole((h) => Math.min(18, h + 1))} aria-label="Next hole">
            <ChevronRight />
          </Button>
        </div>
      ) : null}

      {resolvedMode === "field" ? (
        <FieldBoard data={data} roundId={round.id} holes={holes} />
      ) : isTeamFormat(format) && match?.a2 ? null : (
        <ul className="space-y-3">
          {(editableIds.length ? editableIds : meId ? [meId] : []).map((pid) => {
            const p = data.players.find((x) => x.id === pid);
            if (!p) return null;
            const score = data.scores.find((s) => s.round_id === round.id && s.player_id === pid && s.hole_number === hole);
            const ph = playingOf(data, round.id, pid, p.playing_handicap ?? p.course_handicap ?? 0);
            const strokeHcp = strokeHcpFor(pid);
            const strokes = strokeDotsOnHole(strokeHcp, holeMeta.stroke_index);
            const mine = data.scores.filter((s) => s.round_id === round.id && s.player_id === pid);
            const thru = mine.length;
            const gTot = mine.reduce((n, s) => n + s.gross, 0);
            const nTot = mine.reduce((n, s) => n + s.net, 0);
            const canEdit =
              !isTeamFormat(format) &&
              Boolean(meId) &&
              (me.data?.isAdmin || pid === meId || groupPlayerIds.includes(pid));
            return (
              <li key={pid} className="panel p-3">
                <div className="mb-3 flex items-center gap-3">
                  <PlayerAvatar player={p} size={44} />
                  <div className="flex-1">
                    <p className="text-sm">{playerName(p)}</p>
                    <p className="text-[11px] text-muted">
                      PH {formatCourseHcp(ph)} · {strokes ? `${strokes} stroke${strokes === 1 ? "" : "s"} here` : "no stroke"} · Thru {thru} · Gross {thru ? gTot : "—"} · Net {thru ? nTot : "—"}
                    </p>
                  </div>
                  <p className="font-display text-4xl tabular">{score?.gross ?? "—"}</p>
                </div>
                <HoleStrip
                  holes={holes}
                  scores={mine}
                  current={hole}
                  playingHcp={strokeHcp}
                  onPick={setHole}
                />
                {canEdit ? (
                  <GrossSlot
                    hole={hole}
                    par={holeMeta.par}
                    posted={score?.gross ?? null}
                    pending={mut.isPending}
                    onPost={(gross) => postScore(pid, gross)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!canSelf ? (
        <p className="text-sm text-muted">
          Sign in to keep your own live card. Guests can watch the field.{" "}
          <Link to="/login" className="text-gold">
            Sign in
          </Link>
        </p>
      ) : resolvedMode === "me" && !myPlayer ? (
        <p className="text-sm text-muted">Your login is not on the field. Ask Seth.</p>
      ) : null}
    </div>
  );
}

function StrokeDots({ count }: { count: number }) {
  if (count <= 0) return <span className="inline-block h-1.5 w-1.5" aria-hidden />;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} stroke${count === 1 ? "" : "s"}`}>
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <span key={i} className="size-1.5 rounded-full bg-gold" />
      ))}
    </span>
  );
}

function HoleStrip({
  holes,
  scores,
  current,
  playingHcp,
  onPick,
}: {
  holes: Array<{ number: number; par: number; stroke_index: number }>;
  scores: Array<{ hole_number: number; gross: number; strokes: number }>;
  current: number;
  playingHcp: number;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {holes.map((h) => {
        const s = scores.find((x) => x.hole_number === h.number);
        const dots = strokeDotsOnHole(playingHcp, h.stroke_index);
        return (
          <button
            key={h.number}
            type="button"
            onClick={() => onPick(h.number)}
            className={cn(
              "flex min-h-14 min-w-10 flex-col items-center justify-center rounded-[8px] border px-1 py-1",
              current === h.number ? "border-gold bg-gold/15" : "border-line",
            )}
          >
            <span className={cn("text-[10px] tabular leading-none", current === h.number ? "text-gold" : "text-muted")}>
              {h.number}
            </span>
            <StrokeDots count={dots} />
            <span className="font-display text-lg tabular leading-none">{s ? s.gross : "—"}</span>
          </button>
        );
      })}
    </div>
  );
}

function GrossSlot({
  hole,
  par,
  posted,
  pending,
  onPost,
  label = "Gross",
}: {
  hole: number;
  par: number;
  posted: number | null;
  pending?: boolean;
  onPost: (gross: number) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState(posted != null ? String(posted) : "");
  useEffect(() => {
    setDraft(posted != null ? String(posted) : "");
  }, [hole, posted]);

  function commit() {
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 1 || n > 15) return;
    onPost(n);
  }

  return (
    <form
      className="mt-3 flex items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-gold">{label}</p>
      <Input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        aria-label={`Gross score for hole ${hole}`}
        placeholder={String(par)}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={commit}
        className="h-12 w-20 text-center font-display text-2xl tabular"
      />
      <Button type="submit" size="sm" disabled={pending || !draft}>
        {pending ? "…" : "Post"}
      </Button>
    </form>
  );
}

function toParLabel(n: number): string {
  if (n === 0) return "E";
  if (n > 0) return `+${n}`;
  return String(n);
}

function FieldBoard({
  data,
  roundId,
  holes,
}: {
  data: Bootstrap;
  roundId: number;
  holes: Array<{ number: number; par: number }>;
}) {
  const parAt = (n: number) => holes.find((h) => h.number === n)?.par ?? 4;
  const rows = data.players
    .map((p) => {
      const tripScores = data.scores.filter((s) => s.player_id === p.id);
      const today = tripScores.filter((s) => s.round_id === roundId);
      const todayPar = today.reduce((n, s) => n + parAt(s.hole_number), 0);
      const tripPar = tripScores.reduce((n, s) => {
        const round = data.rounds.find((r) => r.id === s.round_id);
        const par = data.holes.find((h) => h.tee_id === round?.tee_id && h.number === s.hole_number)?.par ?? 4;
        return n + par;
      }, 0);
      const last = [...today].sort((a, b) => a.hole_number - b.hole_number).slice(-5);
      return {
        p,
        thru: today.length,
        todayToPar: today.length ? today.reduce((n, s) => n + s.gross, 0) - todayPar : null,
        totToPar: tripScores.length ? tripScores.reduce((n, s) => n + s.gross, 0) - tripPar : null,
        last,
      };
    })
    .sort((a, b) => {
      if (a.totToPar == null && b.totToPar == null) return 0;
      if (a.totToPar == null) return 1;
      if (b.totToPar == null) return -1;
      return a.totToPar - b.totToPar || a.thru - b.thru;
    });

  let lastScore: number | null = null;
  let lastPos = 0;

  return (
    <div className="overflow-hidden rounded-[18px] border border-line">
      <div className="grid grid-cols-[2.2rem_1fr_3.2rem_2.6rem_3.2rem] gap-1 border-b border-line bg-navy-2 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-muted">
        <span>Pos</span>
        <span>Player</span>
        <span className="text-right">Today</span>
        <span className="text-right">Thru</span>
        <span className="text-right">Tot</span>
      </div>
      <ol>
        {rows.map((r, i) => {
          const tied = r.totToPar != null && r.totToPar === lastScore;
          const pos = tied ? lastPos : i + 1;
          if (!tied) lastPos = pos;
          lastScore = r.totToPar;
          const posLabel = r.totToPar == null ? "—" : tied ? `T${pos}` : String(pos);
          return (
            <li
              key={r.p.id}
              className="grid grid-cols-[2.2rem_1fr_3.2rem_2.6rem_3.2rem] items-center gap-1 border-t border-line px-3 py-2.5"
            >
              <span className="text-xs tabular text-gold">{posLabel}</span>
              <div className="min-w-0">
                <p className="truncate text-sm text-cream">{playerName(r.p)}</p>
                <div className="mt-0.5 flex gap-0.5">
                  {r.last.map((s) => {
                    const par = parAt(s.hole_number);
                    const rel = s.gross - par;
                    return (
                      <span
                        key={s.hole_number}
                        className={cn(
                          "grid size-5 place-items-center text-[10px] tabular",
                          rel <= -2 && "rounded-full bg-gold text-navy",
                          rel === -1 && "rounded-full border border-gold text-gold",
                          rel === 0 && "text-muted",
                          rel === 1 && "border border-line text-cream",
                          rel >= 2 && "bg-navy-3 text-cream",
                        )}
                      >
                        {s.gross}
                      </span>
                    );
                  })}
                </div>
              </div>
              <span className={cn("text-right text-sm tabular", r.todayToPar != null && r.todayToPar < 0 && "text-gold")}>
                {r.todayToPar == null ? "—" : toParLabel(r.todayToPar)}
              </span>
              <span className="text-right text-xs tabular text-muted">{r.thru === 18 ? "F" : r.thru || "—"}</span>
              <span
                className={cn(
                  "text-right font-display text-xl tabular",
                  r.totToPar != null && r.totToPar < 0 && "text-gold",
                )}
              >
                {r.totToPar == null ? "—" : toParLabel(r.totToPar)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ThisHoleSkin({
  skins,
  roundId,
  hole,
  data,
}: {
  skins: SkinsBoard;
  roundId: number;
  hole: number;
  data: Bootstrap;
}) {
  const h = skins.holes.find((x) => x.roundId === roundId && x.hole === hole);
  if (!h) return null;
  const winner = h.winnerId ? data.players.find((p) => p.id === h.winnerId) : null;
  const copy =
    h.status === "won" && winner
      ? `${winner.first_name} has the skin with a ${h.lowScore}`
      : h.status === "push"
        ? `Push at ${h.lowScore}. ${h.skinsAtStake} skins carry.`
        : `${h.posted}/${h.fieldSize} posted · unique low still open`;
  return (
    <Link to="/skins" className="panel flex items-center justify-between gap-3 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-gold">
          Gross skins · {h.skinsAtStake} at stake · {formatMoney(h.value)}
        </p>
        <p className="text-sm">{copy}</p>
      </div>
      <p className="text-xs uppercase tracking-[0.14em] text-gold">Board</p>
    </Link>
  );
}

function WolfPickCard({
  data,
  roundId,
  groupId,
  hole,
  ids,
  meId,
  isAdmin,
  pending,
  onPick,
}: {
  data: Bootstrap;
  roundId: number;
  groupId: number;
  hole: number;
  ids: number[];
  meId: number | undefined;
  isAdmin: boolean;
  pending: boolean;
  onPick: (partnerId: number | null, lone: boolean) => void;
}) {
  const wolfId = wolfOfHole(ids, hole);
  const wolf = data.players.find((p) => p.id === wolfId);
  const others = ids.filter((id) => id !== wolfId);
  const pick = data.wolfPicks.find((p) => p.round_id === roundId && p.group_id === groupId && p.hole_number === hole);
  const canPick = isAdmin || meId === wolfId;
  const name = (id: number) => data.players.find((p) => p.id === id)?.first_name ?? "?";
  const status = pick?.lone
    ? `${name(wolfId)} is lone wolf`
    : pick?.partner_player_id
      ? `${name(wolfId)} took ${name(pick.partner_player_id)}`
      : "Waiting on the Wolf";
  return (
    <div className="panel space-y-3 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Hole {hole} · Wolf</p>
        <p className="font-display text-xl">{wolf ? playerName(wolf) : "—"} is the Wolf</p>
        <p className="text-xs text-muted">
          Rotation {ids.map(name).join(" → ")}. {status}.
        </p>
      </div>
      {canPick ? (
        <div className="flex flex-wrap gap-2">
          {others.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={pick && !pick.lone && pick.partner_player_id === id ? "gold" : "navy"}
              disabled={pending}
              onClick={() => onPick(id, false)}
            >
              Take {name(id)}
            </Button>
          ))}
          <Button
            size="sm"
            variant={pick?.lone ? "gold" : "navy"}
            disabled={pending}
            onClick={() => onPick(null, true)}
          >
            Lone wolf
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Only the Wolf picks. Everyone still posts their own ball.</p>
      )}
    </div>
  );
}

function VegasSplitCard({
  data,
  hole,
  ids,
  meId,
  isAdmin,
  pending,
  split,
  onSplit,
}: {
  data: Bootstrap;
  hole: number;
  ids: number[];
  meId: number | undefined;
  isAdmin: boolean;
  pending: boolean;
  split: { a1: number; a2: number; b1: number; b2: number } | null;
  onSplit: (a1: number, a2: number, b1: number, b2: number) => void;
}) {
  const [picked, setPicked] = useState<number[]>(split ? [split.a1, split.a2] : []);
  useEffect(() => {
    setPicked(split ? [split.a1, split.a2] : []);
  }, [hole, split?.a1, split?.a2]);
  const canPick = isAdmin || (meId != null && ids.includes(meId));
  const name = (id: number) => data.players.find((p) => p.id === id)?.first_name ?? "?";
  const sideB = ids.filter((id) => !picked.includes(id));
  const status = split
    ? `${name(split.a1)} / ${name(split.a2)} vs ${name(split.b1)} / ${name(split.b2)}`
    : "Waiting on who landed together";

  function tap(id: number) {
    const next = picked.includes(id)
      ? picked.filter((x) => x !== id)
      : picked.length >= 2
        ? [picked[1]!, id]
        : [...picked, id];
    setPicked(next);
    if (next.length === 2) {
      const rest = ids.filter((x) => !next.includes(x));
      if (rest.length === 2) onSplit(next[0]!, next[1]!, rest[0]!, rest[1]!);
    }
  }

  return (
    <div className="panel space-y-3 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Hole {hole} · Vegas partners</p>
        <p className="font-display text-xl">After the drives</p>
        <p className="text-xs text-muted">
          Tap the two who ended up together. The other two are the other side. {status}.
        </p>
      </div>
      {canPick ? (
        <div className="flex flex-wrap gap-2">
          {ids.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={picked.includes(id) ? "gold" : "navy"}
              disabled={pending}
              onClick={() => tap(id)}
            >
              {name(id)}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">Anyone in this tee time can lock who landed together.</p>
      )}
      {picked.length === 2 && sideB.length === 2 ? (
        <p className="text-xs text-gold">
          {name(picked[0]!)} / {name(picked[1]!)} vs {name(sideB[0]!)} / {name(sideB[1]!)}
        </p>
      ) : null}
    </div>
  );
}

function VegasHole({
  data,
  roundId,
  hole,
  par,
  si,
  match,
  waitingOnSplit,
  strokeHcpFor,
  sideName,
}: {
  data: Bootstrap;
  roundId: number;
  hole: number;
  par: number;
  si: number;
  match: { a1: number; a2: number | null; b1: number | null; b2: number | null };
  waitingOnSplit?: boolean;
  strokeHcpFor: (pid: number) => number;
  sideName: (id: number) => string;
}) {
  if (waitingOnSplit) {
    return (
      <div className="panel p-3 text-sm text-muted">
        Vegas · tap who landed together after the drives. The hole does not count until the split and all four nets are
        in.
      </div>
    );
  }
  const net = (pid: number | null) => {
    if (pid == null) return null;
    const s = data.scores.find((x) => x.round_id === roundId && x.player_id === pid && x.hole_number === hole);
    if (!s) return null;
    const strokes = strokeDotsOnHole(strokeHcpFor(pid), si);
    return s.gross - strokes;
  };
  const grossOf = (pid: number | null) => {
    if (pid == null) return null;
    return data.scores.find((x) => x.round_id === roundId && x.player_id === pid && x.hole_number === hole)?.gross ?? null;
  };
  const a1n = net(match.a1);
  const a2n = net(match.a2);
  const b1n = net(match.b1);
  const b2n = net(match.b2);
  const birdie = (pid: number | null) => {
    const g = grossOf(pid);
    return g != null && g <= par - 1;
  };
  const eagle = (pid: number | null) => {
    const g = grossOf(pid);
    return g != null && g <= par - 2;
  };
  if (a1n == null || a2n == null) {
    return (
      <div className="panel p-3 text-sm text-muted">
        Vegas · both partners post a net on this hole to make the number.
      </div>
    );
  }
  const aNum = vegasCombine(a1n, a2n);
  if (b1n == null || b2n == null || match.b1 == null) {
    return (
      <div className="panel p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Vegas this hole</p>
        <p className="font-display text-3xl text-gold">{aNum}</p>
        <p className="text-xs text-muted">
          {sideName(match.a1)} {a1n} / {sideName(match.a2!)} {a2n} · low digit first · vs the field
        </p>
      </div>
    );
  }
  const r = vegasHoleResult({
    aNets: [a1n, a2n],
    bNets: [b1n, b2n],
    aBirdie: birdie(match.a1) || birdie(match.a2),
    bBirdie: birdie(match.b1) || birdie(match.b2),
    aEagle: eagle(match.a1) || eagle(match.a2),
    bEagle: eagle(match.b1) || eagle(match.b2),
  });
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Vegas this hole</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl tabular text-gold">{r.aNumber}</p>
          <p className="text-xs text-muted">
            {sideName(match.a1)} / {sideName(match.a2!)}
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted">vs</p>
        <div className="text-right">
          <p className="font-display text-3xl tabular">{r.bNumber}</p>
          <p className="text-xs text-muted">
            {sideName(match.b1)} / {sideName(match.b2!)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gold">
        {r.aPoints === 0
          ? "Even on the hole."
          : r.aPoints > 0
            ? `A takes ${r.aPoints}.`
            : `B takes ${-r.aPoints}.`}
        {eagle(match.a1) || eagle(match.a2) || eagle(match.b1) || eagle(match.b2) ? " Eagle doubles the swing." : ""}
      </p>
    </div>
  );
}


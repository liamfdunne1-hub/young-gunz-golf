import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { enterScore } from "@/lib/server/api";
import { matchPlayOff, strokesOnHole } from "@/lib/golf/handicap";
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

  const match = useMemo(() => {
    if (!data || !round || !meId) return null;
    return (
      data.matches.find(
        (m) => m.round_id === round.id && (m.a1 === meId || m.a2 === meId || m.b1 === meId || m.b2 === meId),
      ) ?? null
    );
  }, [data, round, meId]);

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

  const matchIds = match ? [match.a1, match.a2, match.b1, match.b2] : [];
  const matchPhs = matchIds.map((id) => {
    const p = data.players.find((x) => x.id === id);
    return playingOf(data, round.id, id, p?.playing_handicap ?? p?.course_handicap ?? 0);
  });
  const relative = matchIds.length ? matchPlayOff(matchPhs) : [];
  const myRel = meId && match ? relative[matchIds.indexOf(meId)] : null;

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
            Net four-ball · USGA {round.allowance_pct ?? 90}% playing handicap
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
            ["group", "Group"],
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

      {match ? (
        <div className="panel flex items-center justify-between p-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Net four-ball</p>
            <p className="font-display text-xl">
              {sideName(match.a1)} / {sideName(match.a2)}
            </p>
            <p className="text-xs text-muted">
              vs {sideName(match.b1)} / {sideName(match.b2)}
            </p>
            {myRel != null ? (
              <p className="mt-1 text-xs text-gold">
                {myRel === 0 ? "You play off scratch this match." : `You get ${myRel} strokes this match.`}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="font-display text-3xl text-gold">{match.result ?? "ALL SQUARE"}</p>
            <p className="text-xs text-muted">THRU {match.thru ?? 0}</p>
          </div>
        </div>
      ) : (
        <div className="panel p-4 text-sm text-muted">
          No match posted yet. Keep your own card anyway — pairings do not gate scoring.
        </div>
      )}

      {skins && resolvedMode !== "field" ? <ThisHoleSkin skins={skins} roundId={round.id} hole={hole} data={data} /> : null}

      {resolvedMode !== "field" ? (
        <div className="sticky top-16 z-20 flex items-center justify-between rounded-[18px] border border-line bg-navy/95 px-2 py-2 backdrop-blur-md">
          <Button variant="ghost" size="icon" onClick={() => setHole((h) => Math.max(1, h - 1))} aria-label="Previous hole">
            <ChevronLeft />
          </Button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Hole {hole}</p>
            <p className="font-display text-2xl">Par {holeMeta.par}</p>
            <p className="text-xs text-muted">
              {holeMeta.yardage} yds · SI {holeMeta.stroke_index}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setHole((h) => Math.min(18, h + 1))} aria-label="Next hole">
            <ChevronRight />
          </Button>
        </div>
      ) : null}

      {resolvedMode === "field" ? (
        <FieldBoard data={data} roundId={round.id} holes={holes} />
      ) : (
        <ul className="space-y-3">
          {(editableIds.length ? editableIds : meId ? [meId] : []).map((pid) => {
            const p = data.players.find((x) => x.id === pid);
            if (!p) return null;
            const score = data.scores.find((s) => s.round_id === round.id && s.player_id === pid && s.hole_number === hole);
            const ph = playingOf(data, round.id, pid, p.playing_handicap ?? p.course_handicap ?? 0);
            const strokes = score?.strokes ?? strokesOnHole(ph, holeMeta.stroke_index);
            const mine = data.scores.filter((s) => s.round_id === round.id && s.player_id === pid);
            const thru = mine.length;
            const gTot = mine.reduce((n, s) => n + s.gross, 0);
            const nTot = mine.reduce((n, s) => n + s.net, 0);
            const canEdit = Boolean(meId) && (me.data?.isAdmin || pid === meId || groupPlayerIds.includes(pid));
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

function HoleStrip({
  holes,
  scores,
  current,
  onPick,
}: {
  holes: Array<{ number: number; par: number; stroke_index: number }>;
  scores: Array<{ hole_number: number; gross: number; strokes: number }>;
  current: number;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {holes.map((h) => {
        const s = scores.find((x) => x.hole_number === h.number);
        return (
          <button
            key={h.number}
            type="button"
            onClick={() => onPick(h.number)}
            className={cn(
              "flex min-h-12 min-w-10 flex-col items-center justify-center rounded-[8px] border px-1 py-1",
              current === h.number ? "border-gold bg-gold/15" : "border-line",
            )}
          >
            <span className={cn("text-[10px] tabular leading-none", current === h.number ? "text-gold" : "text-muted")}>
              {h.number}
            </span>
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
}: {
  hole: number;
  par: number;
  posted: number | null;
  pending?: boolean;
  onPost: (gross: number) => void;
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
      <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Gross</p>
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

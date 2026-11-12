import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Flag, Swords } from "lucide-react";
import { toast } from "sonner";
import {
  copyPrevPairings,
  createMatch,
  deleteMatch,
  getDraftPairings,
  getSethDesk,
  lockGroup,
  publishPairings,
  randomizePairings,
  savePairings,
  setRoundFormat,
  setGroupShape,
  setGroupTeeTime,
} from "@/lib/server/api";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/avatar";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn, playerName } from "@/lib/utils";
import {
  FORMAT_LABEL,
  SHAPE_LABEL,
  asFormat,
  asShape,
  formatsForGroupSize,
  isInterMatch,
  isVegas,
  teeLabel,
  type RoundFormat,
} from "@/lib/golf/formats";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/seth/pairings")({ component: SethPairings });

type Step = "tees" | "games" | "matches";

const STEPS: { id: Step; n: string; label: string; icon: typeof Clock }[] = [
  { id: "tees", n: "1", label: "Tee times", icon: Clock },
  { id: "games", n: "2", label: "Games", icon: Flag },
  { id: "matches", n: "3", label: "Matches", icon: Swords },
];

type DraftMatch = {
  id: number;
  group_id: number | null;
  kind?: string | null;
  format: string | null;
  a1: number;
  a2: number | null;
  b1: number | null;
  b2: number | null;
};

function SethPairings() {
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const trip = useTrip();
  const qc = useQueryClient();
  const [roundId, setRoundId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, number[]>>({});
  const [confirm, setConfirm] = useState<null | "rand" | "pub">(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("tees");
  const [togetherOpen, setTogetherOpen] = useState(false);

  useEffect(() => {
    if (trip.data && !roundId) setRoundId(trip.data.rounds[0]?.id ?? null);
  }, [trip.data, roundId]);

  const q = useQuery({
    queryKey: ["draft", roundId],
    queryFn: () => getDraftPairings({ data: { roundId: roundId! } }),
    enabled: Boolean(roundId && me.data?.isAdmin),
  });
  const desk = useQuery({
    queryKey: ["seth"],
    queryFn: () => getSethDesk(),
    enabled: Boolean(me.data?.isAdmin),
  });

  useEffect(() => {
    if (!q.data) return;
    const next: Record<number, number[]> = {};
    for (const g of q.data.groups) {
      next[g.id] = q.data.groupPlayers.filter((gp) => gp.group_id === g.id).map((gp) => gp.player_id);
    }
    setDraft(next);
  }, [q.data]);

  const assigned = useMemo(() => new Set(Object.values(draft).flat()), [draft]);
  const bench = (trip.data?.players ?? []).filter((p) => !assigned.has(p.id));

  const save = useMutation({
    mutationFn: () =>
      savePairings({
        data: {
          roundId: roundId!,
          groups: Object.entries(draft).map(([groupId, playerIds]) => ({
            groupId: Number(groupId),
            playerIds,
          })),
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["draft"] });
      toast(res.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function move(playerId: number, toGroup: number | "bench") {
    setPicked(null);
    setDraft((prev) => {
      const next: Record<number, number[]> = {};
      for (const [k, ids] of Object.entries(prev)) {
        next[Number(k)] = ids.filter((id) => id !== playerId);
      }
      if (toGroup !== "bench") next[toGroup] = [...(next[toGroup] ?? []), playerId];
      return next;
    });
  }

  async function persistTees() {
    if (!roundId) return;
    await save.mutateAsync();
  }

  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;
  if (me.isFetched && !me.data?.isAdmin) return <p>Commissioner only.</p>;
  if (!trip.data || !roundId) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  const groups = q.data?.groups ?? [];
  const together = desk.data?.together ?? [];
  const groupMatches = (q.data?.matches ?? []).filter((m) => !isInterMatch(m));
  const interMatches = (q.data?.matches ?? []).filter((m) => isInterMatch(m));
  const filled = groups.filter((g) => (draft[g.id] ?? []).length > 0);
  const empty = groups.filter((g) => (draft[g.id] ?? []).length === 0);
  const fieldSize = trip.data.players.length;
  const postedGames = filled.filter((g) => groupMatches.some((m) => m.group_id === g.id)).length;
  const status = q.data?.pairingsStatus ?? "draft";

  return (
    <div className="space-y-4 pb-24">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Commissioner desk</p>
        <h1 className="font-display text-4xl">Pairings</h1>
        <p className="text-sm text-muted">
          Three jobs, in order. Tee times first. Then the game inside each tee. Then a match across tees, if you want
          one. {status === "published" ? "Live." : "Draft — nobody sees this until you publish."}
        </p>
      </header>

      <select
        className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
        value={roundId}
        onChange={(e) => {
          setRoundId(Number(e.target.value));
          setStep("tees");
        }}
        aria-label="Round"
      >
        {trip.data.rounds.map((r) => (
          <option key={r.id} value={r.id}>
            Round {r.round_number} · {r.tee_time}
          </option>
        ))}
      </select>

      <nav className="sticky top-14 z-20 grid grid-cols-3 gap-1 rounded-[16px] border border-line bg-navy/95 p-1 backdrop-blur-md" aria-label="Pairings steps">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const done =
            s.id === "tees"
              ? assigned.size === fieldSize
              : s.id === "games"
                ? postedGames === filled.length && filled.length > 0
                : interMatches.length > 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 py-2",
                step === s.id ? "bg-gold text-navy" : "text-muted",
              )}
            >
              <Icon size={14} />
              <span className="text-[10px] uppercase tracking-[0.12em]">
                {s.n} {s.label}
                {done && step !== s.id ? " · done" : ""}
              </span>
            </button>
          );
        })}
      </nav>

      {step === "tees" ? (
        <TeesStep
          groups={groups}
          empty={empty}
          draft={draft}
          bench={bench}
          players={trip.data.players}
          picked={picked}
          setPicked={setPicked}
          move={move}
          assignedCount={assigned.size}
          fieldSize={fieldSize}
          shape={asShape(q.data?.groupShape ?? trip.data.rounds.find((r) => r.id === roundId)?.group_shape)}
          roundId={roundId}
          together={together}
          togetherOpen={togetherOpen}
          setTogetherOpen={setTogetherOpen}
          saving={save.isPending}
          onSave={() => save.mutate()}
          onShuffle={() => setConfirm("rand")}
          onCopy={() =>
            copyPrevPairings({ data: { roundId } }).then(() => {
              qc.invalidateQueries({ queryKey: ["draft"] });
              toast("Copied last round’s tee times.");
            })
          }
          onNext={async () => {
            try {
              await persistTees();
              setStep("games");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not save tee times.");
            }
          }}
        />
      ) : null}

      {step === "games" ? (
        <GamesStep
          roundId={roundId}
          filled={filled}
          draft={draft}
          players={trip.data.players}
          matches={groupMatches}
          defaultFormat={asFormat(q.data?.format ?? trip.data.rounds.find((r) => r.id === roundId)?.format)}
          postedGames={postedGames}
          onBack={() => setStep("tees")}
          onNext={() => setStep("matches")}
        />
      ) : null}

      {step === "matches" ? (
        <MatchesStep
          roundId={roundId}
          players={trip.data.players}
          groups={groups}
          draft={draft}
          matches={interMatches}
          filledCount={filled.length}
          postedGames={postedGames}
          status={status}
          onBack={() => setStep("games")}
          onPublish={() => setConfirm("pub")}
        />
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4">
          <div className="panel max-w-sm p-5">
            <h2 className="font-display text-2xl">
              {confirm === "rand"
                ? "Shuffle the tee times? Friendships may be affected."
                : "Publish. Tee times and games go live. People are about to develop opinions."}
            </h2>
            <div className="mt-4 flex gap-2">
              <Button variant="navy" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    if (confirm === "rand") {
                      const shape = asShape(q.data?.groupShape);
                      const res = await randomizePairings({ data: { roundId, shape } });
                      toast(res.message);
                      qc.invalidateQueries({ queryKey: ["draft"] });
                    } else {
                      await save.mutateAsync();
                      const res = await publishPairings({ data: { roundId } });
                      toast(res.message);
                      qc.invalidateQueries();
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                  setConfirm(null);
                }}
              >
                {confirm === "rand" ? "Shuffle" : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TeesStep({
  groups,
  empty,
  draft,
  bench,
  players,
  picked,
  setPicked,
  move,
  assignedCount,
  fieldSize,
  shape,
  roundId,
  together,
  togetherOpen,
  setTogetherOpen,
  saving,
  onSave,
  onShuffle,
  onCopy,
  onNext,
}: {
  groups: Array<{ id: number; group_number: number; locked: boolean; tee_time: string | null }>;
  empty: Array<{ id: number; group_number: number; locked: boolean; tee_time: string | null }>;
  draft: Record<number, number[]>;
  bench: Player[];
  players: Player[];
  picked: number | null;
  setPicked: (id: number | null) => void;
  move: (playerId: number, toGroup: number | "bench") => void;
  assignedCount: number;
  fieldSize: number;
  shape: "foursomes" | "pairs";
  roundId: number;
  together: Array<{ a: number; b: number; n: number }>;
  togetherOpen: boolean;
  setTogetherOpen: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onShuffle: () => void;
  onCopy: () => void;
  onNext: () => void;
}) {
  const qc = useQueryClient();
  return (
    <div className="space-y-4">
      <section className="panel space-y-3 p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Step 1 · Who walks together</p>
          <h2 className="font-display text-2xl">Tee times</h2>
          <p className="text-sm text-muted">
            This is the group that rides. Not the match. {assignedCount} of {fieldSize} on a tee.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["foursomes", "pairs"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                void setGroupShape({ data: { roundId, shape: s } }).then(() => {
                  qc.invalidateQueries({ queryKey: ["draft"] });
                  qc.invalidateQueries({ queryKey: ["trip"] });
                });
              }}
              className={cn(
                "min-h-16 rounded-[14px] border px-3 py-3 text-left",
                shape === s ? "border-gold bg-gold/15" : "border-line",
              )}
            >
              <p className="font-display text-xl leading-none text-cream">{s === "foursomes" ? "4-3-3" : "Pairs"}</p>
              <p className="mt-1 text-[11px] text-muted">{SHAPE_LABEL[s]}</p>
            </button>
          ))}
        </div>
      </section>

      <section
        className="panel p-3"
        onClick={() => {
          if (picked) move(picked, "bench");
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => move(Number(e.dataTransfer.getData("pid")), "bench")}
      >
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gold">
          Unassigned {bench.length ? `· ${bench.length}` : ""}
        </p>
        <div className="flex min-h-14 flex-wrap gap-2">
          {bench.length ? (
            bench.map((p) => <Chip key={p.id} player={p} selected={picked === p.id} onPick={() => setPicked(p.id)} />)
          ) : (
            <p className="self-center text-xs text-muted">Everyone has a tee.</p>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">Tap a golfer, then tap a tee. Or drag.</p>
      </section>

      <div className="space-y-3">
        {groups.map((g) => {
          const ids = draft[g.id] ?? [];
          const spare = ids.length === 0;
          const dimSpare = spare && empty.length > 2 && groups.length - empty.length >= 3;
          return (
            <div
              key={g.id}
              className={cn("panel p-3", dimSpare && "opacity-70")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => move(Number(e.dataTransfer.getData("pid")), g.id)}
              onClick={() => {
                if (picked) move(picked, g.id);
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.14em] text-gold">
                  {spare ? `Spare tee ${g.group_number}` : teeLabel(g.group_number, g.tee_time)}
                </p>
                <button
                  type="button"
                  className="min-h-10 px-2 text-[11px] text-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    void lockGroup({ data: { groupId: g.id, locked: !g.locked } }).then(() =>
                      qc.invalidateQueries({ queryKey: ["draft"] }),
                    );
                  }}
                >
                  {g.locked ? "Locked" : "Lock"}
                </button>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Input
                  placeholder="Tee time · 8:12 AM"
                  defaultValue={g.tee_time ?? ""}
                  key={`${g.id}-${g.tee_time ?? ""}`}
                  className="mb-2 h-11"
                  aria-label={`Clock time for tee ${g.group_number}`}
                  onBlur={(e) => {
                    const teeTime = e.target.value.trim();
                    if (teeTime === (g.tee_time ?? "")) return;
                    void setGroupTeeTime({ data: { groupId: g.id, teeTime } }).then(() => {
                      qc.invalidateQueries({ queryKey: ["draft"] });
                      qc.invalidateQueries({ queryKey: ["trip"] });
                    });
                  }}
                />
              </div>
              <div className="flex min-h-12 flex-wrap gap-2">
                {ids.length ? (
                  ids.map((id) => {
                    const p = players.find((x) => x.id === id);
                    return p ? (
                      <Chip key={id} player={p} selected={picked === id} onPick={() => setPicked(id)} />
                    ) : null;
                  })
                ) : (
                  <p className="self-center text-xs text-muted">Empty. Drop someone here if you need another tee.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="navy" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save tee times"}
        </Button>
        <Button size="sm" variant="navy" onClick={onShuffle}>
          Shuffle
        </Button>
        <Button size="sm" variant="navy" onClick={onCopy}>
          Copy last round
        </Button>
      </div>

      <Button className="w-full" onClick={onNext} disabled={saving}>
        Next · set the games
      </Button>

      {together.length ? (
        <div className="panel p-3">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between text-left text-xs uppercase tracking-[0.14em] text-gold"
            onClick={() => setTogetherOpen(!togetherOpen)}
          >
            Who has already walked together
            <span className="text-muted">{togetherOpen ? "Hide" : "Show"}</span>
          </button>
          {togetherOpen ? (
            <ul className="mt-2 space-y-1 text-sm">
              {together.slice(0, 12).map((row) => {
                const a = players.find((p) => p.id === row.a);
                const b = players.find((p) => p.id === row.b);
                return (
                  <li key={`${row.a}-${row.b}`} className="flex justify-between border-t border-line py-2">
                    <span>
                      {a ? playerName(a) : row.a} / {b ? playerName(b) : row.b}
                    </span>
                    <span className="tabular text-muted">{row.n}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GamesStep({
  roundId,
  filled,
  draft,
  players,
  matches,
  defaultFormat,
  postedGames,
  onBack,
  onNext,
}: {
  roundId: number;
  filled: Array<{ id: number; group_number: number; tee_time: string | null; format: string | null }>;
  draft: Record<number, number[]>;
  players: Player[];
  matches: DraftMatch[];
  defaultFormat: RoundFormat;
  postedGames: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const qc = useQueryClient();
  const [formats, setFormats] = useState<Record<number, RoundFormat>>({});
  const [sides, setSides] = useState<Record<number, number[]>>({});
  const [busy, setBusy] = useState(false);
  const seedKey = filled
    .map((g) => {
      const m = matches.find((x) => x.group_id === g.id);
      return `${g.id}:${(draft[g.id] ?? []).join(",")}:${m?.format ?? ""}:${m?.a1 ?? ""}:${m?.a2 ?? ""}`;
    })
    .join("|");

  useEffect(() => {
    const nextF: Record<number, RoundFormat> = {};
    const nextS: Record<number, number[]> = {};
    for (const g of filled) {
      const ids = draft[g.id] ?? [];
      const existing = matches.find((m) => m.group_id === g.id);
      const allowed = formatsForGroupSize(ids.length);
      const fromMatch = existing?.format ? asFormat(existing.format) : null;
      const fromGroup = g.format ? asFormat(g.format) : null;
      const pick = [fromMatch, fromGroup, defaultFormat, allowed[0]].find(
        (f): f is RoundFormat => Boolean(f) && allowed.includes(f as RoundFormat),
      );
      nextF[g.id] = pick ?? "fourball";
      nextS[g.id] = existing?.a2 ? [existing.a1, existing.a2] : ids.slice(0, 2);
    }
    setFormats(nextF);
    setSides(nextS);
    // Seed from posted matches / tee membership. Intentionally not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, defaultFormat]);

  const name = (id: number) => players.find((p) => p.id === id)?.first_name ?? "?";

  async function postAll() {
    setBusy(true);
    try {
      for (const g of filled) {
        const ids = draft[g.id] ?? [];
        const format = formats[g.id] ?? defaultFormat;
        const payload = matchPayload(roundId, g.id, ids, format, sides[g.id] ?? []);
        if (!payload) continue;
        await createMatch({ data: payload });
      }
      toast("Games set for every tee.");
      qc.invalidateQueries({ queryKey: ["draft"] });
      qc.invalidateQueries({ queryKey: ["trip"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set games.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel space-y-3 p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Step 2 · What they play in the tee</p>
          <h2 className="font-display text-2xl">Games</h2>
          <p className="text-sm text-muted">
            One game per tee. Vegas in a four re-pairs from the landing — do not pick partners here. That happens on
            the scorecard after the drives. {postedGames} of {filled.length} posted.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gold">Default for empty tees</span>
          <select
            className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
            value={defaultFormat}
            onChange={(e) => {
              const format = asFormat(e.target.value);
              void setRoundFormat({ data: { roundId, format } }).then(() => {
                qc.invalidateQueries({ queryKey: ["draft"] });
                qc.invalidateQueries({ queryKey: ["trip"] });
              });
            }}
          >
            <option value="fourball">{FORMAT_LABEL.fourball}</option>
            <option value="vegas">{FORMAT_LABEL.vegas}</option>
            <option value="alternate">{FORMAT_LABEL.alternate}</option>
            <option value="scramble">{FORMAT_LABEL.scramble}</option>
            <option value="wolf">{FORMAT_LABEL.wolf}</option>
          </select>
        </label>
      </section>

      {filled.length === 0 ? (
        <div className="panel p-4 text-sm text-muted">Put people on tee times first.</div>
      ) : (
        <ul className="space-y-3">
          {filled.map((g) => {
            const ids = draft[g.id] ?? [];
            const format = formats[g.id] ?? defaultFormat;
            const allowed = formatsForGroupSize(ids.length);
            const existing = matches.find((m) => m.group_id === g.id);
            const rotating = isVegas(format) && ids.length === 4;
            const needsPartners = format !== "wolf" && !rotating && ids.length === 4;
            const sideA = sides[g.id] ?? ids.slice(0, 2);
            const sideB = ids.filter((id) => !sideA.includes(id));
            return (
              <li key={g.id} className="panel space-y-3 p-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-gold">
                    {teeLabel(g.group_number, g.tee_time)}
                    {existing ? " · posted" : " · not posted"}
                  </p>
                  <p className="font-display text-xl">{ids.map(name).join(" · ")}</p>
                </div>
                <select
                  className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
                  value={allowed.includes(format) ? format : (allowed[0] ?? "fourball")}
                  onChange={(e) => {
                    const next = asFormat(e.target.value);
                    setFormats((prev) => ({ ...prev, [g.id]: next }));
                  }}
                >
                  {allowed.map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABEL[f]}
                    </option>
                  ))}
                </select>
                {ids.length === 3 && format === "wolf" ? (
                  <p className="text-xs text-muted">
                    Wolf. Rotation {ids.map(name).join(" → ")}. They pick a partner on each hole. Nothing to set here.
                  </p>
                ) : rotating ? (
                  <p className="text-xs text-muted">
                    Vegas. Partners come from where the balls land, every hole. After the drives, tap the two who ended
                    up together on the scorecard.
                  </p>
                ) : ids.length === 2 ? (
                  <p className="text-xs text-muted">
                    {name(ids[0]!)} / {name(ids[1]!)} vs the field. Ranked on the intergroup board.
                  </p>
                ) : needsPartners ? (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Partners · tap two for side A</p>
                    <div className="flex flex-wrap gap-2">
                      {ids.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "min-h-11 rounded-full border px-3 text-sm",
                            sideA.includes(id) ? "border-gold bg-gold/15 text-gold" : "border-line text-cream",
                          )}
                          onClick={() =>
                            setSides((prev) => {
                              const cur = prev[g.id] ?? [];
                              const next = cur.includes(id)
                                ? cur.filter((x) => x !== id)
                                : cur.length >= 2
                                  ? [cur[1]!, id]
                                  : [...cur, id];
                              return { ...prev, [g.id]: next };
                            })
                          }
                        >
                          {name(id)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted">
                      {name(sideA[0] ?? 0)} / {name(sideA[1] ?? 0)} vs {name(sideB[0] ?? 0)} / {name(sideB[1] ?? 0)}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    {ids.length} golfers. Pick a game that fits — Wolf for three, Vegas or a pair game for two or four.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Button className="w-full" onClick={() => void postAll()} disabled={busy || filled.length === 0}>
        {busy ? "Setting…" : postedGames ? "Update games" : "Set these games"}
      </Button>
      <div className="flex gap-2">
        <Button variant="navy" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button variant="navy" className="flex-1" onClick={onNext}>
          Next · matches
        </Button>
      </div>
    </div>
  );
}

function matchPayload(
  roundId: number,
  groupId: number,
  ids: number[],
  format: RoundFormat,
  sideA: number[],
) {
  if (format === "wolf") {
    if (ids.length !== 3) return null;
    return { roundId, groupId, kind: "group" as const, format, a1: ids[0]!, a2: ids[1]!, b1: ids[2]!, b2: null };
  }
  if (ids.length === 2) {
    return { roundId, groupId, kind: "group" as const, format, a1: ids[0]!, a2: ids[1]!, b1: null, b2: null };
  }
  if (isVegas(format) && ids.length === 4) {
    return { roundId, groupId, kind: "group" as const, format, a1: ids[0]!, a2: ids[1]!, b1: ids[2]!, b2: ids[3]! };
  }
  if (ids.length === 4) {
    const a = sideA.slice(0, 2);
    const b = ids.filter((id) => !a.includes(id));
    if (a.length !== 2 || b.length !== 2) return null;
    return { roundId, groupId, kind: "group" as const, format, a1: a[0]!, a2: a[1]!, b1: b[0]!, b2: b[1]! };
  }
  return null;
}

function MatchesStep({
  roundId,
  players,
  groups,
  draft,
  matches,
  filledCount,
  postedGames,
  status,
  onBack,
  onPublish,
}: {
  roundId: number;
  players: Player[];
  groups: Array<{ id: number; group_number: number; tee_time: string | null }>;
  draft: Record<number, number[]>;
  matches: DraftMatch[];
  filledCount: number;
  postedGames: number;
  status: string;
  onBack: () => void;
  onPublish: () => void;
}) {
  const qc = useQueryClient();
  const [format, setFormat] = useState<RoundFormat>("fourball");
  const [picked, setPicked] = useState<number[]>([]);
  const name = (id: number) => players.find((p) => p.id === id)?.first_name ?? "?";
  const teeOf = (id: number) => {
    for (const g of groups) {
      if ((draft[g.id] ?? []).includes(id)) return teeLabel(g.group_number, g.tee_time);
    }
    return "—";
  };

  function tap(id: number) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  const sideA = picked.slice(0, 2);
  const sideB = picked.slice(2, 4);
  const canPost = picked.length === 4;
  const sameTee = canPost && new Set(picked.map(teeOf)).size === 1;

  return (
    <div className="space-y-4">
      <section className="panel space-y-2 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Step 3 · Optional</p>
        <h2 className="font-display text-2xl">Match across tees</h2>
        <p className="text-sm text-muted">
          Skip this if the only game is inside the tee. Use it when two from one tee play two from another. Partners
          stay locked for 18. Vegas here does not re-pair from the landing.
        </p>
        <p className="text-xs text-gold">
          {filledCount} tee{filledCount === 1 ? "" : "s"} · {postedGames} game{postedGames === 1 ? "" : "s"} inside
          them · {matches.length} inter-tee match{matches.length === 1 ? "" : "es"}
        </p>
      </section>

      <section className="panel space-y-3 p-4">
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gold">Format for this match</span>
          <select
            className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
            value={format}
            onChange={(e) => setFormat(asFormat(e.target.value))}
          >
            <option value="fourball">{FORMAT_LABEL.fourball}</option>
            <option value="vegas">{FORMAT_LABEL.vegas} · locked partners</option>
            <option value="alternate">{FORMAT_LABEL.alternate}</option>
            <option value="scramble">{FORMAT_LABEL.scramble}</option>
          </select>
        </label>
        <p className="text-[11px] uppercase tracking-[0.14em] text-gold">
          Tap four golfers · first two are side A, next two are side B
        </p>
        <div className="space-y-3">
          {groups
            .filter((g) => (draft[g.id] ?? []).length)
            .map((g) => (
              <div key={g.id}>
                <p className="mb-2 text-xs text-muted">{teeLabel(g.group_number, g.tee_time)}</p>
                <div className="flex flex-wrap gap-2">
                  {(draft[g.id] ?? []).map((id) => {
                    const p = players.find((x) => x.id === id);
                    if (!p) return null;
                    const i = picked.indexOf(id);
                    const badge = i === -1 ? null : i < 2 ? "A" : "B";
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => tap(id)}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm",
                          i >= 0 ? "border-gold bg-gold/15 text-gold" : "border-line text-cream",
                        )}
                      >
                        {p.first_name}
                        {badge ? <span className="text-[10px] uppercase tracking-[0.12em]">{badge}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
        {canPost ? (
          <p className="text-sm">
            {name(sideA[0]!)} / {name(sideA[1]!)} vs {name(sideB[0]!)} / {name(sideB[1]!)}
            {sameTee ? (
              <span className="block text-xs text-muted">
                Those four are on the same tee. The in-tee game is step 2. This match is for across tees.
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-xs text-muted">{picked.length} of 4 selected.</p>
        )}
        <Button
          className="w-full"
          disabled={!canPost}
          onClick={() =>
            createMatch({
              data: {
                roundId,
                groupId: null,
                kind: "inter",
                format,
                a1: sideA[0]!,
                a2: sideA[1]!,
                b1: sideB[0]!,
                b2: sideB[1]!,
              },
            }).then(() => {
              toast("Inter-tee match posted.");
              setPicked([]);
              qc.invalidateQueries({ queryKey: ["draft"] });
              qc.invalidateQueries({ queryKey: ["trip"] });
            })
          }
        >
          Post this match
        </Button>
      </section>

      {matches.length ? (
        <ul className="panel divide-y divide-line overflow-hidden">
          {matches.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-gold">{FORMAT_LABEL[asFormat(m.format)]}</p>
                <p className="text-sm">
                  {name(m.a1)} / {name(m.a2 ?? 0)} vs {name(m.b1 ?? 0)} / {name(m.b2 ?? 0)}
                </p>
                <p className="text-[11px] text-muted">
                  {teeOf(m.a1)} + {teeOf(m.a2 ?? 0)} vs {teeOf(m.b1 ?? 0)} + {teeOf(m.b2 ?? 0)}
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 px-2 text-xs text-muted"
                onClick={() =>
                  deleteMatch({ data: { matchId: m.id } }).then(() => {
                    qc.invalidateQueries({ queryKey: ["draft"] });
                    qc.invalidateQueries({ queryKey: ["trip"] });
                    toast("Match pulled.");
                  })
                }
              >
                Pull
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No inter-tee match yet. Fine. Publish the tee times anyway.</p>
      )}

      <div className="flex gap-2">
        <Button variant="navy" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={onPublish}>
          {status === "published" ? "Publish again" : "Publish pairings"}
        </Button>
      </div>
    </div>
  );
}

function Chip({
  player,
  selected,
  onPick,
}: {
  player: Player;
  selected?: boolean;
  onPick?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("pid", String(player.id))}
      onClick={(e) => {
        e.stopPropagation();
        onPick?.();
      }}
      className={cn(
        "flex min-h-11 cursor-grab items-center gap-2 rounded-full border px-3 py-1 text-sm active:cursor-grabbing",
        selected ? "border-gold bg-gold/15" : "border-line bg-navy",
      )}
    >
      <PlayerAvatar player={player} size={24} />
      {playerName(player)}
    </div>
  );
}

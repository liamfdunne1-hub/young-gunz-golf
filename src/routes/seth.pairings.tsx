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

  const [syncedRound, setSyncedRound] = useState<number | null>(null);

  useEffect(() => {
    if (!q.data || !roundId || syncedRound === roundId) return;
    const next: Record<number, number[]> = {};
    for (const g of q.data.groups) {
      next[g.id] = q.data.groupPlayers.filter((gp) => gp.group_id === g.id).map((gp) => gp.player_id);
    }
    setDraft(next);
    setSyncedRound(roundId);
  }, [q.data, roundId, syncedRound]);

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
      setSyncedRound(null);
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
              setSyncedRound(null);
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
                      setSyncedRound(null);
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
                      {a ? playerName(a) : "?"} & {b ? playerName(b) : "?"}
                    </span>
                    <span className="text-muted">{row.n}×</span>
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

function Chip({
  player,
  selected,
  onPick,
}: {
  player: Player;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("pid", String(player.id))}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
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

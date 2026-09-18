import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  autoMatches,
  copyPrevPairings,
  createMatch,
  getDraftPairings,
  getSethDesk,
  lockGroup,
  publishPairings,
  randomizePairings,
  savePairings,
} from "@/lib/server/api";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/avatar";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { playerName } from "@/lib/utils";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/seth/pairings")({ component: SethPairings });

function SethPairings() {
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const trip = useTrip();
  const qc = useQueryClient();
  const [roundId, setRoundId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, number[]>>({});
  const [confirm, setConfirm] = useState<null | "rand" | "pub">(null);
  const [picked, setPicked] = useState<number | null>(null);

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

  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;
  if (me.isFetched && !me.data?.isAdmin) return <p>Commissioner only.</p>;
  if (!trip.data || !roundId) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  const groups = q.data?.groups ?? [];
  const together = desk.data?.together ?? [];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Draft vs published</p>
        <h1 className="font-display text-4xl">Pairings manager</h1>
        <p className="text-sm text-muted">
          Status: {q.data?.pairingsStatus ?? "draft"}. Rearrange freely. Nobody is notified until you publish.
        </p>
      </header>
      <select
        className="h-11 rounded-[12px] border border-line bg-navy px-3"
        value={roundId}
        onChange={(e) => setRoundId(Number(e.target.value))}
      >
        {trip.data.rounds.map((r) => (
          <option key={r.id} value={r.id}>
            Round {r.round_number} · {r.tee_time}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          Save draft
        </Button>
        <Button size="sm" variant="navy" onClick={() => setConfirm("rand")}>
          Randomize
        </Button>
        <Button
          size="sm"
          variant="navy"
          onClick={() =>
            copyPrevPairings({ data: { roundId } }).then(() => {
              qc.invalidateQueries({ queryKey: ["draft"] });
              toast("Copied previous round.");
            })
          }
        >
          Copy previous
        </Button>
        <Button size="sm" variant="navy" onClick={() => autoMatches({ data: { roundId } }).then(() => toast("Net 2v2 matches posted for every foursome."))}>
          Auto 2v2
        </Button>
        <Button size="sm" onClick={() => setConfirm("pub")}>
          Publish pairings
        </Button>
      </div>

      <section className="panel p-3">
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gold">Unassigned</p>
        <div
          className="flex min-h-16 flex-wrap gap-2"
          onClick={() => {
            if (picked) move(picked, "bench");
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => move(Number(e.dataTransfer.getData("pid")), "bench")}
        >
          {bench.map((p) => (
            <Chip key={p.id} player={p} selected={picked === p.id} onPick={() => setPicked(p.id)} />
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        {groups.map((g) => (
          <div
            key={g.id}
            className="panel p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => move(Number(e.dataTransfer.getData("pid")), g.id)}
            onClick={() => {
              if (picked) move(picked, g.id);
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.14em] text-gold">Group {g.group_number}</p>
              <button
                type="button"
                className="text-[11px] text-muted"
                onClick={() => lockGroup({ data: { groupId: g.id, locked: !g.locked } }).then(() => qc.invalidateQueries({ queryKey: ["draft"] }))}
              >
                {g.locked ? "Locked" : "Lock"}
              </button>
            </div>
            <div className="min-h-32 space-y-2">
              {(draft[g.id] ?? []).map((id) => {
                const p = trip.data!.players.find((x) => x.id === id);
                return p ? (
                  <Chip key={id} player={p} selected={picked === id} onPick={() => setPicked(id)} />
                ) : null;
              })}
            </div>
            {(draft[g.id] ?? []).length === 4 ? (
              <MakeMatch roundId={roundId} groupId={g.id} ids={draft[g.id]} />
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        {together.length} published combinations on file. Spread people around. Tap a golfer, then tap a group — or drag.
      </p>
      {together.length ? (
        <div className="overflow-x-auto rounded-[18px] border border-line">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-navy-2 text-gold">
              <tr>
                <th className="p-2">Pair</th>
                <th className="p-2">Rounds together</th>
              </tr>
            </thead>
            <tbody>
              {together.slice(0, 12).map((row) => {
                const a = trip.data.players.find((p) => p.id === row.a);
                const b = trip.data.players.find((p) => p.id === row.b);
                return (
                  <tr key={`${row.a}-${row.b}`} className="border-t border-line">
                    <td className="p-2">
                      {a ? playerName(a) : row.a} / {b ? playerName(b) : row.b}
                    </td>
                    <td className="p-2 tabular">{row.n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4">
          <div className="panel max-w-sm p-5">
            <h2 className="font-display text-2xl">
              {confirm === "rand" ? "Are you sure? Friendships may be affected." : "Publish pairings and 2v2 net matches. People are about to develop opinions."}
            </h2>
            <div className="mt-4 flex gap-2">
              <Button variant="navy" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    if (confirm === "rand") {
                      const res = await randomizePairings({ data: { roundId } });
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
                {confirm === "rand" ? "Randomize" : "Publish"}
              </Button>
            </div>
          </div>
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
      className={`flex cursor-grab items-center gap-2 rounded-full border px-2 py-1 text-sm active:cursor-grabbing ${
        selected ? "border-gold bg-gold/15" : "border-line bg-navy"
      }`}
    >
      <PlayerAvatar player={player} size={24} />
      {playerName(player)}
    </div>
  );
}

function MakeMatch({ roundId, groupId, ids }: { roundId: number; groupId: number; ids: number[] }) {
  return (
    <Button
      size="sm"
      variant="navy"
      className="mt-2 w-full"
      onClick={() =>
        createMatch({
          data: { roundId, groupId, a1: ids[0], a2: ids[1], b1: ids[2], b2: ids[3] },
        }).then(() => toast("Match created. Partnerships remain temporary."))}
    >
      Make 1-2 vs 3-4
    </Button>
  );
}

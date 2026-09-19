import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addPlayer, deletePlayer, releaseBag, updatePlayer } from "@/lib/server/api";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatHandicap, isPlaceholderEmail, playerName } from "@/lib/utils";
import { useState } from "react";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/seth/players")({ component: SethPlayers });

function SethPlayers() {
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const trip = useTrip();
  const qc = useQueryClient();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const add = useMutation({
    mutationFn: () => addPlayer({ data: { firstName: first.trim(), lastName: last.trim() } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      qc.invalidateQueries({ queryKey: ["seth"] });
      setFirst("");
      setLast("");
      toast(`${playerName(res.player)} is on the field. They claim the bag after they sign in.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;
  if (me.isFetched && !me.data?.isAdmin) return <p>Enter Seth Mode first.</p>;
  if (!trip.data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">The field</p>
        <h1 className="font-display text-4xl">Add a golfer</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          First name and last name. That is the entire job. They sign in, claim the bag in the locker room, and their
          email attaches itself. Stop collecting addresses in a spreadsheet.
        </p>
      </header>

      <form
        className="panel space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!first.trim() || !last.trim()) return;
          add.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>First name</Label>
            <Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Nick" autoComplete="off" />
          </div>
          <div>
            <Label>Last name</Label>
            <Input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Prell" autoComplete="off" />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={add.isPending || !first.trim() || !last.trim()}>
          {add.isPending ? "Adding…" : "Add to the field"}
        </Button>
      </form>

      <p className="text-xs uppercase tracking-[0.16em] text-gold">
        {trip.data.players.length} golfers
      </p>
      {trip.data.players.map((p) => (
        <Editor key={p.id} player={p} onChanged={() => qc.invalidateQueries({ queryKey: ["trip"] })} />
      ))}
    </div>
  );
}

function Editor({ player, onChanged }: { player: Player; onChanged: () => void }) {
  const [idx, setIdx] = useState(String(player.handicap_index));
  const [confirm, setConfirm] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      updatePlayer({
        data: { playerId: player.id, handicapIndex: Number(idx) },
      }),
    onSuccess: () => {
      toast("Handicap saved.");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deletePlayer({ data: { playerId: player.id } }),
    onSuccess: () => {
      toast(`${playerName(player)} is off the field.`);
      onChanged();
    },
    onError: (e: Error) => {
      setConfirm(false);
      toast.error(e.message);
    },
  });
  const disconnect = useMutation({
    mutationFn: () => releaseBag({ data: { playerId: player.id } }),
    onSuccess: (res) => {
      toast(`${res.name} is off that login. The bag is open in the locker room.`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const claimed = Boolean(player.user_id || player.registered_at);
  const emailLabel = isPlaceholderEmail(player.email) ? "Waiting to claim" : player.email;

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl text-cream">{playerName(player)}</p>
          <p className="truncate text-xs text-muted">
            {claimed ? "Claimed" : "Open"} · {emailLabel} · index {formatHandicap(player.handicap_index)}
          </p>
        </div>
      </div>
      <div>
        <Label>Handicap index</Label>
        <Input type="number" step="0.1" value={idx} onChange={(e) => setIdx(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          Save handicap
        </Button>
        {claimed ? (
          <Button size="sm" type="button" variant="navy" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
            {disconnect.isPending ? "Disconnecting…" : "Disconnect bag"}
          </Button>
        ) : null}
        {confirm ? (
          <Button size="sm" type="button" variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {remove.isPending ? "Removing…" : `Yes, delete ${player.first_name}`}
          </Button>
        ) : (
          <Button size="sm" type="button" variant="navy" onClick={() => setConfirm(true)}>
            Delete
          </Button>
        )}
        {confirm ? (
          <Button size="sm" type="button" variant="ghost" onClick={() => setConfirm(false)}>
            Never mind
          </Button>
        ) : null}
      </div>
    </div>
  );
}

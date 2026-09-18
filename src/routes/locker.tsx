import { useState, type FormEvent, useSyncExternalStore } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { claimBag, dropBag } from "@/lib/server/api";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PlayerAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn, formatHandicap, isPlaceholderEmail, playerName } from "@/lib/utils";

export const Route = createFileRoute("/locker")({ component: Locker });

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

function Locker() {
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const trip = useTrip();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );

  const mut = useMutation({
    mutationFn: (data: { playerId?: number; email?: string }) => claimBag({ data }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["trip"] });
      setEmail("");
      setPickedId(null);
      toast(`Bag claimed. You are ${playerName(res.player)} until you hang it up.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hangUp = useMutation({
    mutationFn: () => dropBag(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Bag hung up. You are not on the field.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  if (!user) return <RedirectToSignIn />;

  const players = trip.data?.players ?? [];
  const current = me.data?.player;
  const grokLabel = user.displayName || user.primaryEmail || "Grok user";
  const canSignOut = authEnabled && !gateSession;

  function onEmail(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    mut.mutate({
      email: value,
    });
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Locker room</p>
        <h1 className="font-display text-4xl">Whose bag is this?</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          {current
            ? `You are ${playerName(current)} on the field. Claim attaches your sign-in email to this bag. Switch below or hang it up.`
            : `Signed in as ${grokLabel}. Pick your name. That is how your email gets on the roster — Seth only added first and last.`}
        </p>
      </header>

      {current ? (
        <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <PlayerAvatar player={current} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.16em] text-gold">Currently wearing</p>
            <p className="font-display text-2xl text-cream">{playerName(current)}</p>
            <p className="truncate text-xs text-muted">
              {current.nickname} · {current.email} · index {formatHandicap(current.handicap_index)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-stretch">
            <Button
              type="button"
              variant="navy"
              size="sm"
              disabled={hangUp.isPending}
              onClick={() => hangUp.mutate()}
            >
              {hangUp.isPending ? "Hanging up…" : "Hang up this bag"}
            </Button>
            {canSignOut ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={signingOut}
                onClick={() => {
                  setSigningOut(true);
                  void signOut().catch(() => setSigningOut(false));
                }}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            ) : (
              <p className="text-[11px] leading-snug text-muted sm:max-w-[12rem]">
                Preview login stays. Hang up to stop being {current.first_name}.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="panel space-y-3 p-4">
          <p className="font-display text-2xl">No bag claimed</p>
          <p className="text-sm text-muted">Pick a golfer below. Live scoring will follow that card.</p>
          {canSignOut ? (
            <Button
              type="button"
              variant="navy"
              size="sm"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          ) : null}
        </div>
      )}

      <form className="panel space-y-3 p-5" onSubmit={onEmail}>
        <Label>Already attached email</Label>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <p className="text-xs text-muted">
          Optional. If you claimed once, this finds the bag by the email that stuck to it. Otherwise just tap your
          name below.
        </p>
        <Button type="submit" className="w-full" disabled={mut.isPending}>
          {mut.isPending ? "Claiming…" : "Find this email"}
        </Button>
      </form>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gold">The field</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => {
            const mine = current?.id === p.id;
            const selected = pickedId === p.id;
            const taken = Boolean(p.user_id) && !mine;
            const emailLabel = isPlaceholderEmail(p.email) ? "No email yet" : p.email;
            return (
              <button
                key={p.id}
                type="button"
                disabled={taken || mut.isPending}
                onClick={() => {
                  setPickedId(p.id);
                  mut.mutate({ playerId: p.id });
                }}
                className={cn(
                  "panel flex items-center gap-3 p-3 text-left transition-colors",
                  mine || selected ? "border-gold/60 bg-gold/10" : "hover:border-gold/40",
                  taken && "opacity-50",
                )}
              >
                <PlayerAvatar player={p} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-cream">{playerName(p)}</span>
                  <span className="block truncate text-xs text-muted">
                    {mine ? "Your bag" : taken ? "Claimed" : "Tap to claim"} · {emailLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted">
        Sign in with the email you actually use. Claiming a bag writes that address onto the golfer.{" "}
        <Link to="/login" className="text-gold hover:underline">
          Email sign-in
        </Link>
        {" · "}
        <Link to="/scores" className="text-gold hover:underline">
          Keep your card
        </Link>
      </p>
    </div>
  );
}

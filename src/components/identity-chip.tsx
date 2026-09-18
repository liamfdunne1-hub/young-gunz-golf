import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Shirt } from "lucide-react";
import { toast } from "sonner";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { dropBag } from "@/lib/server/api";
import { useMeQuery } from "@/lib/hooks";
import { PlayerAvatar } from "@/components/avatar";
import { cn, playerName } from "@/lib/utils";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

export function IdentityChip() {
  const user = useCurrentUser();
  const me = useMeQuery();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );

  const hangUp = useMutation({
    mutationFn: () => dropBag(),
    onSuccess: async () => {
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Bag hung up. You are not on the field.");
      void navigate({ to: "/locker" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const player = me.data?.player;
  const label = player ? player.first_name : "Claim bag";
  const canSignOut = authEnabled && !gateSession;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        title={player ? `${playerName(player)} — switch or hang up` : "Claim a bag to keep score"}
        className={cn(
          "inline-flex h-9 max-w-[12rem] items-center gap-2 rounded-full border px-1.5 pr-2",
          player ? "border-line bg-navy-2 text-cream hover:border-gold/50" : "border-gold/50 bg-gold/10 text-gold",
        )}
      >
        {player ? (
          <PlayerAvatar player={player} size={28} />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-gold/20 text-[10px] uppercase tracking-wide">
            YG
          </span>
        )}
        <span className="truncate text-xs uppercase tracking-[0.12em]">{label}</span>
        <ChevronDown size={12} className={cn("shrink-0 opacity-70", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-[14px] border border-line bg-navy-2 p-1.5 shadow-panel"
        >
          {player ? (
            <p className="px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-gold">
              Wearing {player.first_name}
            </p>
          ) : (
            <p className="px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-muted">No bag claimed</p>
          )}
          <Link
            to="/locker"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm text-cream hover:bg-cream/5"
          >
            <Shirt size={14} className="text-gold" />
            {player ? "Switch bags" : "Claim a bag"}
          </Link>
          {player ? (
            <button
              type="button"
              role="menuitem"
              disabled={hangUp.isPending}
              onClick={() => hangUp.mutate()}
              className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm text-cream hover:bg-cream/5 disabled:opacity-50"
            >
              <LogOut size={14} className="text-gold" />
              {hangUp.isPending ? "Hanging up…" : "Hang up this bag"}
            </button>
          ) : null}
          {canSignOut ? (
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm text-cream hover:bg-cream/5 disabled:opacity-50"
            >
              <LogOut size={14} className="text-gold" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : player ? (
            <p className="px-3 py-2 text-[11px] leading-snug text-muted">
              Preview login stays. Hanging up is how you stop being {player.first_name}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

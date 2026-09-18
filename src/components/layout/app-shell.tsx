import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Flag, Home, LayoutGrid, Trophy, CircleDollarSign } from "lucide-react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Crest } from "@/components/crest";
import { AskSeth } from "@/components/ask-seth";
import { IdentityChip } from "@/components/identity-chip";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { SECONDARY_TAGLINES } from "@/lib/constants";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/scores", label: "Scores", icon: Flag },
  { to: "/leaderboard", label: "Board", icon: Trophy },
  { to: "/action", label: "Action", icon: CircleDollarSign },
  { to: "/more", label: "More", icon: LayoutGrid },
] as const;

const DESKTOP_LINKS = [
  { to: "/itinerary", label: "Itinerary" },
  { to: "/players", label: "The Field" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/skins", label: "Skins" },
  { to: "/pairings", label: "Pairings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const me = useMeQuery();
  const trip = useTrip();
  const { isPending } = useCurrentUserState();
  const [tag, setTag] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTag((n) => (n + 1) % SECONDARY_TAGLINES.length), 8000);
    return () => window.clearInterval(t);
  }, []);

  const moreActive = path === "/more" || path.startsWith("/more/");

  return (
    <div className="min-h-dvh bg-navy text-cream">
      <header className="sticky top-0 z-30 border-b border-line bg-navy/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <Crest className="h-9 w-9 shrink-0" />
            <span className="leading-tight">
              <span className="block font-display text-lg tracking-wide">Young Gunz</span>
              <span className="block text-[10px] uppercase tracking-[0.22em] text-gold">Orlando 2026</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-cream/80 xl:flex">
            {DESKTOP_LINKS.map((item) => {
              const active = path === item.to || path.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn("hover:text-gold", active && "text-gold")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/more"
              aria-label="More — itinerary, field, flights, ledger, Seth Mode"
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs uppercase tracking-[0.14em]",
                moreActive
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-gold/50 bg-navy-2 text-gold hover:border-gold hover:bg-gold/10",
              )}
            >
              <LayoutGrid size={14} />
              More
            </Link>
            {isPending ? (
              <div className="size-8 animate-pulse rounded-full bg-cream/10" />
            ) : (
              <>
                <SignedOut>
                  <Link
                    to="/login"
                    className="rounded-full border border-gold/40 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-gold"
                  >
                    Sign in
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link
                    to="/notifications"
                    className="relative grid size-9 place-items-center rounded-[10px] border border-line"
                  >
                    <Bell size={16} />
                    <span className="sr-only">Notifications</span>
                    {(me.data?.unread ?? 0) > 0 ? (
                      <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-orange px-1 text-[10px] text-cream">
                        {me.data?.unread}
                      </span>
                    ) : null}
                  </Link>
                  <IdentityChip />
                </SignedIn>
              </>
            )}
          </div>
        </div>
        <p className="hidden border-t border-line px-4 py-1 text-center text-[11px] tracking-wide text-muted md:block">
          {trip.data?.trip.last_admin_message || SECONDARY_TAGLINES[tag]}
        </p>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:pb-16">{children}</main>

      <AskSeth />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-navy/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-14 min-h-11 flex-col items-center justify-center gap-0.5 text-[10px] uppercase tracking-[0.12em]",
                    active ? "text-gold" : "text-cream/70",
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

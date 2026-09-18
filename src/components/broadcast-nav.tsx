import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/leaderboard", label: "Leaderboards" },
  { to: "/skins", label: "Skins" },
  { to: "/stats", label: "Statistics" },
  { to: "/history", label: "Record Book" },
] as const;

export function BroadcastNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Broadcast desk" className="flex gap-2 overflow-x-auto pb-1">
      {ITEMS.map((item) => {
        const active = path === item.to || path.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "inline-flex h-11 shrink-0 items-center rounded-full px-4 text-xs uppercase tracking-[0.14em]",
              active ? "bg-gold text-navy" : "border border-line text-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

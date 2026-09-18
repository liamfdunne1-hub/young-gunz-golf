import { Crown } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import type { Player } from "@/lib/types";

const TONES = ["#1B4D3E", "#1a3654", "#3a2a12", "#2c3e50", "#3d1f2b", "#1f3b4d", "#2e3d2f", "#4a3728", "#23364a", "#2a2420"];

export function PlayerAvatar({
  player,
  size = 48,
  className,
}: {
  player: Pick<Player, "id" | "first_name" | "last_name" | "slug" | "role">;
  size?: number;
  className?: string;
}) {
  const seth = player.slug === "seth-young" || player.role === "admin";
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className="grid size-full place-items-center rounded-full border text-[0.7em] font-medium tracking-wide text-cream"
        style={{
          background: TONES[player.id % TONES.length],
          borderColor: seth ? "#C4A35A" : "rgba(244,239,228,0.2)",
          fontSize: size * 0.32,
        }}
      >
        {initials(player)}
      </span>
      {seth ? (
        <Crown
          className="absolute -top-1 -right-0.5 text-gold"
          size={Math.max(12, size * 0.34)}
          strokeWidth={1.75}
        />
      ) : null}
    </span>
  );
}

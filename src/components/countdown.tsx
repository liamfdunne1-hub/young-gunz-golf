import { useEffect, useState } from "react";
import { TRIP_START } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function useCountdown(iso = TRIP_START) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(iso).getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds, done: diff === 0 };
}

export function Countdown({ compact = false, className }: { compact?: boolean; className?: string }) {
  const c = useCountdown();
  const cell = (v: number, label: string) => (
    <div className="flex flex-col items-center">
      <span className={cn("tabular font-display text-cream", compact ? "text-lg" : "text-4xl md:text-5xl")}>
        {String(v).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-gold">{label}</span>
    </div>
  );
  return (
    <div className={cn("flex items-end gap-4", className)}>
      {cell(c.days, "Days")}
      {cell(c.hours, "Hrs")}
      {cell(c.minutes, "Min")}
      {cell(c.seconds, "Sec")}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useTrip } from "@/lib/hooks";

export const Route = createFileRoute("/recaps")({ component: Recaps });

function Recaps() {
  const { data, isPending } = useTrip();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Daily recap</p>
        <h1 className="font-display text-4xl">The Desk</h1>
        <p className="text-sm text-muted">Seth can preview and edit before publishing. Until then, this is an empty newsroom with excellent lighting.</p>
      </header>
      {data.recaps.length === 0 ? (
        <div className="panel p-6 text-sm text-muted">No recaps published. Golf has not happened. Journalism is on hold.</div>
      ) : (
        data.recaps.map((r) => (
          <article key={r.id} className="panel p-5">
            <p className="text-xs text-gold">{r.day}</p>
            <h2 className="font-display text-3xl">{r.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p>
            {r.quote ? <p className="mt-3 text-sm italic text-gold">{r.quote}</p> : null}
          </article>
        ))
      )}
    </div>
  );
}

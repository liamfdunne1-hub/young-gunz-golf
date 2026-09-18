import { createFileRoute } from "@tanstack/react-router";
import { useStats } from "@/lib/hooks";
import { playerName } from "@/lib/utils";

export const Route = createFileRoute("/results")({ component: Results });

function Results() {
  const { data, stats, isPending } = useStats();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  const locked = data.trip.status === "finalized";
  const champ = (key: "points" | "grossToPar" | "netToPar" | "birdies" | "skins" | "holesWon") => {
    const sorted = [...stats].sort((a, b) => {
      if (key === "grossToPar" || key === "netToPar") return (a[key] ?? 99) - (b[key] ?? 99);
      return (b[key] ?? 0) - (a[key] ?? 0);
    })[0];
    const p = data.players.find((x) => x.id === sorted?.playerId);
    if (!p) return "TBD";
    if ((sorted?.[key] ?? 0) === 0 && key !== "grossToPar" && key !== "netToPar") return "TBD";
    return playerName(p);
  };
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Official results</p>
        <h1 className="font-display text-4xl">The Damage Report</h1>
        <p className="text-sm text-muted">
          {locked
            ? "Unlike the pairings, this one is actually final."
            : "Seth has not pressed the big red button. These are unofficial projections from a trip that has not started."}
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <Champ k="Low Gross Champion" v={champ("grossToPar")} />
        <Champ k="Low Net Champion" v={champ("netToPar")} />
        <Champ k="Match Points Champion" v={champ("points")} />
        <Champ k="Birdie Champion" v={champ("birdies")} />
        <Champ k="Skins Champion" v={champ("skins")} />
        <Champ k="Most Holes Won" v={champ("holesWon")} />
      </div>
      <section>
        <h2 className="mb-2 font-display text-2xl">Awards</h2>
        <ul className="space-y-2">
          {data.awards.map((a) => {
            const p = data.players.find((x) => x.id === a.player_id);
            return (
              <li key={a.id} className="panel flex justify-between p-4 text-sm">
                <span>{a.name}</span>
                <span className="text-gold">{a.published && p ? playerName(p) : "Unassigned"}</span>
              </li>
            );
          })}
        </ul>
      </section>
      {data.reportCards.length ? (
        <section>
          <h2 className="mb-2 font-display text-2xl">Report cards</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.reportCards.map((r) => {
              const p = data.players.find((x) => x.id === r.player_id);
              return (
                <article key={r.player_id} className="panel p-4">
                  <h3 className="font-display text-2xl">{p ? playerName(p) : "Player"}</h3>
                  <p className="text-sm">Golf {r.golf_grade} · Gambling {r.gambling_grade} · Decisions {r.decisions_grade}</p>
                  <p className="text-sm">Entertainment {r.entertainment_grade} · Seth {r.seth_dependency}</p>
                  <p className="mt-2 text-sm text-muted">{r.comment}</p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Champ({ k, v }: { k: string; v: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-gold">{k}</p>
      <p className="font-display text-3xl">{v}</p>
    </div>
  );
}

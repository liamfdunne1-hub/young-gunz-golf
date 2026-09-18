import { createFileRoute, Link } from "@tanstack/react-router";
import { BroadcastNav } from "@/components/broadcast-nav";
import { useStats } from "@/lib/hooks";
import { formatMoney, playerName } from "@/lib/utils";

export const Route = createFileRoute("/stats")({ component: Stats });

function toPar(n: number | null) {
  if (n == null) return "—";
  if (n === 0) return "E";
  if (n > 0) return `+${n}`;
  return String(n);
}

function Stats() {
  const { data, stats, skins, isPending } = useStats();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  const sethId = data.players.find((p) => p.slug === "seth-young")?.id;
  const ranked = [...stats].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (a.grossToPar ?? 99) - (b.grossToPar ?? 99);
  });

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Over-engineered on purpose</p>
        <h1 className="font-display text-4xl">Trip statistics</h1>
        <BroadcastNav />
      </header>

      <section>
        <h2 className="mb-2 font-display text-2xl">Scoring</h2>
        <div className="overflow-x-auto rounded-[18px] border border-line">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-navy-2 text-[10px] uppercase tracking-[0.12em] text-gold">
              <tr>
                {["Player", "G avg", "N avg", "Best", "Worst", "Birdies", "Eagles", "Pars", "Bogeys", "Dbls+", "Hole"].map((h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => {
                const p = data.players.find((x) => x.id === s.playerId);
                if (!p) return null;
                return (
                  <tr key={s.playerId} className="border-t border-line">
                    <td className="p-3">
                      <Link to="/players/$slug" params={{ slug: p.slug }} className="hover:text-gold">
                        {playerName(p)}
                      </Link>
                    </td>
                    <td className="p-3 tabular">{s.grossAvg?.toFixed(1) ?? "—"}</td>
                    <td className="p-3 tabular">{s.netAvg?.toFixed(1) ?? "—"}</td>
                    <td className="p-3 tabular">{s.bestGross ?? "—"}</td>
                    <td className="p-3 tabular">{s.worstGross ?? "—"}</td>
                    <td className="p-3 tabular">{s.birdies}</td>
                    <td className="p-3 tabular">{s.eagles}</td>
                    <td className="p-3 tabular">{s.pars}</td>
                    <td className="p-3 tabular">{s.bogeys}</td>
                    <td className="p-3 tabular">{s.doubles}</td>
                    <td className="p-3 tabular">{s.worstHole ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-2xl">Matches</h2>
        <div className="overflow-x-auto rounded-[18px] border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-navy-2 text-[10px] uppercase tracking-[0.12em] text-gold">
              <tr>
                {["Player", "Pts", "W-L-T", "Holes won", "Holes lost", "Halved"].map((h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => {
                const p = data.players.find((x) => x.id === s.playerId);
                if (!p) return null;
                return (
                  <tr key={s.playerId} className="border-t border-line">
                    <td className="p-3">{playerName(p)}</td>
                    <td className="p-3 tabular">{s.points}</td>
                    <td className="p-3 tabular">
                      {s.wins}-{s.losses}-{s.ties}
                    </td>
                    <td className="p-3 tabular">{s.holesWon}</td>
                    <td className="p-3 tabular">{s.holesLost}</td>
                    <td className="p-3 tabular">{s.holesHalved}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="font-display text-2xl">Skins</h2>
          <Link to="/skins" className="text-xs uppercase tracking-[0.14em] text-gold">
            Full skins board
          </Link>
        </div>
        <p className="mb-3 text-sm text-muted">
          Gross, full field, unique low. Ties push. Communal pot {skins ? formatMoney(skins.pot) : "—"}. This is not
          gambling — match money is the column next door, and it does not include these numbers.
        </p>
        <div className="overflow-x-auto rounded-[18px] border border-line">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-navy-2 text-[10px] uppercase tracking-[0.12em] text-gold">
              <tr>
                {["Player", "Skins", "Holes", "Pot share"].map((h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...stats]
                .sort((a, b) => b.skins - a.skins)
                .map((s) => {
                  const p = data.players.find((x) => x.id === s.playerId);
                  if (!p) return null;
                  return (
                    <tr key={s.playerId} className="border-t border-line">
                      <td className="p-3">{playerName(p)}</td>
                      <td className="p-3 tabular">{s.skins}</td>
                      <td className="p-3 tabular">{s.skinsHoles}</td>
                      <td className="p-3 tabular">{s.skinsValue ? formatMoney(s.skinsValue) : "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-2xl">Gambling tab</h2>
        <p className="mb-3 text-sm text-muted">
          The Action only. Skins are a separate communal pot and are not added here.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[...stats]
            .sort((a, b) => b.money - a.money)
            .map((s) => {
              const p = data.players.find((x) => x.id === s.playerId);
              if (!p) return null;
              return (
                <div key={s.playerId} className="panel flex items-center justify-between p-3">
                  <span className="text-sm">{playerName(p)}</span>
                  <span className={`tabular ${s.money >= 0 ? "text-gold" : "text-orange"}`}>
                    {s.money >= 0 ? "+" : ""}
                    {formatMoney(s.money)}
                  </span>
                </div>
              );
            })}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-2xl">Versus par</h2>
        <ul className="mt-3 space-y-2">
          {ranked.map((s) => {
            const p = data.players.find((x) => x.id === s.playerId);
            if (!p) return null;
            return (
              <li key={s.playerId} className="flex justify-between text-sm">
                <span>{p.first_name}</span>
                <span className="tabular text-muted">
                  Gross {toPar(s.grossToPar)} · Net {toPar(s.netToPar)} · best hole {toPar(s.bestHoleToPar)} · worst{" "}
                  {toPar(s.worstHoleToPar)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-2xl">Fun department</h2>
        <p className="mt-2 text-sm text-muted">
          Rounds played with Seth are not yet a real sample because pairings are unpublished. The Ask Seth leaderboard
          is already operational, which tells you everything. Commissioner ID: {sethId ?? "missing, which would be a first."}
        </p>
      </section>
    </div>
  );
}

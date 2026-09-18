import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerAvatar } from "@/components/avatar";
import { useStats } from "@/lib/hooks";
import { formatMoney, playerName } from "@/lib/utils";

export const Route = createFileRoute("/ledger")({ component: Ledger });

function Ledger() {
  const { data, stats, isPending } = useStats();
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  const tab = [...stats].sort((a, b) => b.money - a.money);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">The books are public</p>
        <h1 className="font-display text-4xl">Ledger</h1>
        <p className="text-sm text-muted">
          Pools from The Action land here when they settle. Skins are a separate communal pot and never appear.{" "}
          <Link to="/skins" className="text-gold">
            Skins board
          </Link>
          . No house. No rake.
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-display text-2xl">The tab</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {tab.map((row) => {
            const p = data.players.find((x) => x.id === row.playerId);
            if (!p) return null;
            return (
              <div key={p.id} className="panel flex items-center gap-3 p-3">
                <PlayerAvatar player={p} size={36} />
                <span className="flex-1 text-sm">{playerName(p)}</span>
                <span className={`font-display text-2xl tabular ${row.money >= 0 ? "text-gold" : "text-orange"}`}>
                  {row.money >= 0 ? "+" : ""}
                  {formatMoney(row.money)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-2xl">The tape</h2>
        {data.ledger.length === 0 ? (
          <p className="panel p-4 text-sm text-muted">
            Empty. Settled pools from{" "}
            <Link to="/action" className="text-gold">
              The Action
            </Link>{" "}
            land on the tab above when they settle.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.ledger.map((e) => {
              const from = data.players.find((p) => p.id === e.from_player_id);
              const to = data.players.find((p) => p.id === e.to_player_id);
              return (
                <li key={e.id} className="panel p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-gold">{e.kind}</p>
                  <p className="text-sm">
                    {from ? playerName(from) : "—"} → {to ? playerName(to) : "—"}{" "}
                    <span className="tabular text-gold">{formatMoney(e.amount)}</span>
                  </p>
                  <p className="text-xs text-muted">{e.description}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

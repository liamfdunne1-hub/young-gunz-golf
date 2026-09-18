import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BroadcastNav } from "@/components/broadcast-nav";
import { PlayerAvatar } from "@/components/avatar";
import { useStats } from "@/lib/hooks";
import { formatMoney, playerName } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({ component: Boards });

const TABS = ["Match", "Gross", "Net", "Teams", "Birdies"] as const;

function Boards() {
  const { data, stats, skins, teams, isPending } = useStats();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Match");
  const [roundId, setRoundId] = useState<number | "all">("all");
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  const liveRound = data.rounds.find((r) => r.status === "live") ?? data.rounds.find((r) => r.status === "finalized");
  const teamRoundId = roundId === "all" ? liveRound?.id ?? data.rounds[0]?.id : roundId;
  const teamRows = [...teams.filter((t) => t.roundId === teamRoundId)].sort(
    (a, b) => (a.combinedNet ?? 999) - (b.combinedNet ?? 999),
  );

  const rows = [...stats].sort((a, b) => {
    if (tab === "Match") return b.points - a.points || b.holesWon - a.holesWon;
    if (tab === "Gross") return (a.grossToPar ?? 99) - (b.grossToPar ?? 99);
    if (tab === "Net") return (a.netToPar ?? 99) - (b.netToPar ?? 99);
    return b.birdies - a.birdies || b.eagles - a.eagles;
  });

  const skinLead = skins?.standings.find((s) => s.skins > 0);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Broadcast desk</p>
        <h1 className="font-display text-4xl">Leaderboards</h1>
        <BroadcastNav />
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-xs uppercase tracking-[0.14em]",
              tab === t ? "bg-gold text-navy" : "border border-line text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Teams" ? (
        <section className="space-y-3">
          <p className="text-sm text-muted">
            Two-man teams for the day. Combined is both cards added. Best-ball is the better score on each hole.
            Partners change when Seth republishes pairings.
          </p>
          <select
            className="h-11 w-full rounded-[12px] border border-line bg-navy px-3 sm:w-auto"
            value={teamRoundId ?? ""}
            onChange={(e) => setRoundId(Number(e.target.value))}
          >
            {data.rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {teamRows.length === 0 ? (
            <div className="panel p-4 text-sm text-muted">
              No two-man teams for this round yet. In pairings, put two golfers in a group or make a 2v2 match.
            </div>
          ) : (
            <ol className="space-y-2">
              {teamRows.map((t, i) => {
                const pa = data.players.find((p) => p.id === t.a);
                const pb = data.players.find((p) => p.id === t.b);
                return (
                  <li key={t.key} className="panel p-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 tabular text-gold">{i + 1}</span>
                      <div className="flex -space-x-2">
                        {pa ? <PlayerAvatar player={pa} size={32} /> : null}
                        {pb ? <PlayerAvatar player={pb} size={32} /> : null}
                      </div>
                      <span className="flex-1 text-sm">{t.label}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <Stat k="Combined G" v={t.combinedGross ?? "—"} />
                      <Stat k="Combined N" v={t.combinedNet ?? "—"} />
                      <Stat k="Best-ball G" v={t.bestBallGross ?? "—"} />
                      <Stat k="Best-ball N" v={t.bestBallNet ?? "—"} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const p = data.players.find((x) => x.id === r.playerId);
            if (!p) return null;
            const value =
              tab === "Match"
                ? `${r.points} pts · ${r.wins}-${r.losses}-${r.ties} · ${r.holesWon} holes won`
                : tab === "Gross"
                  ? r.grossToPar == null
                    ? "—"
                    : `${r.grossToPar > 0 ? "+" : ""}${r.grossToPar}`
                  : tab === "Net"
                    ? r.netToPar == null
                      ? "—"
                      : `${r.netToPar > 0 ? "+" : ""}${r.netToPar}`
                    : `${r.birdies} birdies · ${r.eagles} eagles`;
            return (
              <li key={r.playerId} className="panel flex items-center gap-3 p-3">
                <span className="w-6 tabular text-gold">{i + 1}</span>
                <PlayerAvatar player={p} size={36} />
                <span className="flex-1 text-sm">{playerName(p)}</span>
                <span className="text-sm tabular text-cream/90">{value}</span>
              </li>
            );
          })}
        </ol>
      )}

      <section className="panel p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Gross skins · separate from gambling</p>
        <h2 className="font-display text-2xl">
          {skinLead
            ? `${data.players.find((p) => p.id === skinLead.playerId)?.first_name ?? "Someone"} · ${skinLead.skins} skins`
            : "No skins awarded"}
        </h2>
        <p className="text-sm text-muted">
          Unique lowest gross on the hole, full field. Ties push. Pot {skins ? formatMoney(skins.pot) : "—"}. Not a bet.
        </p>
        <Link to="/skins" className="mt-2 inline-block text-sm text-gold">
          Open the skins board
        </Link>
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-[10px] border border-line px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{k}</p>
      <p className="font-display text-lg tabular">{v}</p>
    </div>
  );
}

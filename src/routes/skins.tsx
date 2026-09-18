import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BroadcastNav } from "@/components/broadcast-nav";
import { PlayerAvatar } from "@/components/avatar";
import { useStats } from "@/lib/hooks";
import { cn, formatMoney, playerName } from "@/lib/utils";
import type { SkinHole } from "@/lib/golf/skins";

export const Route = createFileRoute("/skins")({ component: SkinsPage });

function SkinsPage() {
  const { data, skins, isPending } = useStats();
  const [roundId, setRoundId] = useState<number | null>(null);
  const [openHole, setOpenHole] = useState<string | null>(null);

  const rounds = data?.rounds ?? [];
  const activeRoundId = roundId ?? rounds[0]?.id ?? null;
  const holes = useMemo(
    () => (skins && activeRoundId ? skins.holes.filter((h) => h.roundId === activeRoundId) : []),
    [skins, activeRoundId],
  );

  if (isPending || !data || !skins) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  const lead = skins.standings.find((s) => s.skins > 0);
  const leadPlayer = lead ? data.players.find((p) => p.id === lead.playerId) : null;
  const selected = holes.find((h) => `${h.roundId}-${h.hole}` === openHole) ?? holes.find((h) => h.status !== "pending") ?? holes[0];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Communal. Gross. No gambling mix.</p>
        <h1 className="font-display text-4xl">Skins</h1>
        <p className="max-w-2xl text-sm text-muted">
          Lowest gross on the hole wins — the entire field, not your foursome. Ties push. Carryovers stack. The pot is
          set in Seth Mode and is not The Action, and not on the ledger.
        </p>
        <BroadcastNav />
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi k="Communal pot" v={formatMoney(skins.pot)} s={`${formatMoney(skins.holeValue)} a hole`} />
        <Kpi
          k="Awarded"
          v={formatMoney(skins.awardedValue)}
          s={leadPlayer ? `${leadPlayer.first_name} leads` : "Nobody has separated"}
        />
        <Kpi k="Sitting in the pot" v={formatMoney(skins.pendingValue + skins.leftoverValue)} s="Pushes and unfinished holes" />
        <Kpi k="Longest carry" v={skins.longestCarry > 1 ? `${skins.longestCarry}` : "—"} s="Skins stacked on one hole" />
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-2xl">Hole by hole</h2>
          <select
            className="h-11 w-full shrink-0 rounded-[12px] border border-line bg-navy px-3 text-sm sm:w-auto"
            value={activeRoundId ?? ""}
            onChange={(e) => {
              setRoundId(Number(e.target.value));
              setOpenHole(null);
            }}
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                R{r.round_number} · {data.courses.find((c) => c.id === r.course_id)?.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
          {holes.map((h) => {
            const key = `${h.roundId}-${h.hole}`;
            const active = selected && h.roundId === selected.roundId && h.hole === selected.hole;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setOpenHole(key)}
                className={cn(
                  "min-h-14 rounded-[10px] border px-1 py-1.5 text-center",
                  h.status === "won" && "border-gold/50 bg-gold/15",
                  h.status === "push" && "border-line bg-navy-2",
                  h.status === "pending" && "border-line",
                  active && "ring-2 ring-gold",
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{h.hole}</p>
                <p className="font-display text-lg tabular leading-none">
                  {h.status === "won" ? h.lowScore : h.status === "push" ? "P" : h.posted ? `${h.posted}/${h.fieldSize}` : "·"}
                </p>
                {h.skinsAtStake > 1 ? <p className="text-[10px] text-gold">{h.skinsAtStake}x</p> : null}
              </button>
            );
          })}
        </div>
        {selected ? <HoleDetail hole={selected} data={data} /> : null}
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl">The board</h2>
          <p className="text-xs text-muted">Unique low wins. Everyone else watches.</p>
        </div>
        <ol className="space-y-2">
          {skins.standings.map((row, i) => {
            const p = data.players.find((x) => x.id === row.playerId);
            if (!p) return null;
            return (
              <li key={row.playerId} className="panel flex items-center gap-3 p-3">
                <span className="w-6 tabular text-gold">{i + 1}</span>
                <PlayerAvatar player={p} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{playerName(p)}</p>
                  <p className="text-[11px] text-muted">
                    {row.holesWon} hole{row.holesWon === 1 ? "" : "s"} won
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl tabular text-gold">{row.skins}</p>
                  <p className="text-[11px] text-muted">{row.value ? formatMoney(row.value) : "—"}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="text-sm text-muted">
        The Action lives on the{" "}
        <Link to="/ledger" className="text-gold">
          public ledger
        </Link>
        . Skins do not.
      </p>
    </div>
  );
}

function HoleDetail({
  hole,
  data,
}: {
  hole: SkinHole;
  data: NonNullable<ReturnType<typeof useStats>["data"]>;
}) {
  const winner = hole.winnerId ? data.players.find((p) => p.id === hole.winnerId) : null;
  const sorted = [...hole.scores].sort((a, b) => a.gross - b.gross);
  const status =
    hole.status === "won" && winner
      ? `${winner.first_name} wins ${hole.skinsAtStake} skin${hole.skinsAtStake === 1 ? "" : "s"} with a ${hole.lowScore}`
      : hole.status === "push"
        ? `Push at ${hole.lowScore}. ${hole.skinsAtStake} skin${hole.skinsAtStake === 1 ? "" : "s"} carry.`
        : `${hole.posted} of ${hole.fieldSize} posted. Unique low still open.`;
  return (
    <div className="panel space-y-3 p-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-gold">
          Round {hole.roundNumber} · Hole {hole.hole} · Par {hole.par}
        </p>
        <p className="font-display text-2xl">{status}</p>
        <p className="text-sm text-muted">{formatMoney(hole.value)} sitting on this hole</p>
      </div>
      {sorted.length ? (
        <ol className="grid gap-2 sm:grid-cols-2">
          {sorted.map((s) => {
            const p = data.players.find((x) => x.id === s.playerId);
            if (!p) return null;
            const tiedLow = hole.lowScore != null && s.gross === hole.lowScore;
            return (
              <li key={s.playerId} className="flex items-center gap-2">
                <PlayerAvatar player={p} size={28} />
                <span className="flex-1 truncate text-sm">{p.first_name}</span>
                <span className={cn("tabular text-sm", tiedLow && "text-gold")}>{s.gross}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted">Nobody has posted this hole. The field is the field.</p>
      )}
    </div>
  );
}

function Kpi({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{k}</p>
      <p className="font-display text-2xl tabular">{v}</p>
      {s ? <p className="text-[11px] text-muted">{s}</p> : null}
    </div>
  );
}

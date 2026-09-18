import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ACTION_TICKER } from "@/lib/constants";
import { poolSummary } from "@/lib/golf/pools";
import { createMarket, placeEntry, setMarketStatus, settleMarket } from "@/lib/server/api";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatMoney, playerName } from "@/lib/utils";

export const Route = createFileRoute("/action")({ component: Action });

function Action() {
  const { data, isPending } = useTrip();
  const me = useMeQuery();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("20");
  const [pick, setPick] = useState<Record<number, number>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => (n + 1) % ACTION_TICKER.length), 5500);
    return () => window.clearInterval(t);
  }, []);

  const mut = useMutation({
    mutationFn: (args: { marketId: number; selectionId: number; amount: number }) => placeEntry({ data: args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Entry recorded. This is not a sportsbook. It is a group chat with math.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markets = useMemo(() => {
    if (!data) return [];
    return data.markets.map((m) => {
      const sels = data.selections.filter((s) => s.market_id === m.id);
      const slices = sels.map((s) => ({
        selectionId: s.id,
        label: s.label,
        amount: data.entrySums.find((e) => e.selection_id === s.id)?.total ?? 0,
      }));
      const total = slices.reduce((n, s) => n + s.amount, 0);
      return { ...m, total, slices: poolSummary(total, slices), sels };
    });
  }, [data]);

  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">The Action</p>
        <h1 className="font-display text-4xl">Completely Recreational Financial Decisions</h1>
        <p className="text-sm text-muted">
          No house. No rake. No vig. No payment processing. The website records voluntary contributions and divides the pool.
        </p>
        <p className="mt-2 text-xs text-gold">{ACTION_TICKER[tick]}</p>
        <p className="mt-3 text-sm">
          Gross skins are a communal pot and live on the{" "}
          <Link to="/skins" className="text-gold">
            skins board
          </Link>
          . This page is extra action you talked yourselves into.
        </p>
      </header>
      <MyAction />
      {markets.map((m) => (
        <article key={m.id} className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-gold">{m.status}</p>
              <h2 className="font-display text-2xl">{m.name}</h2>
            </div>
            <p className="font-display text-2xl tabular">{formatMoney(m.total)}</p>
          </div>
          <ul className="mt-4 space-y-2">
            {m.slices.map((s) => (
              <li key={s.selectionId}>
                <button
                  type="button"
                  onClick={() => setPick((p) => ({ ...p, [m.id]: s.selectionId }))}
                  className={`flex min-h-12 w-full items-center justify-between rounded-[12px] border px-3 py-3 text-left text-sm ${
                    pick[m.id] === s.selectionId ? "border-gold bg-gold/10" : "border-line"
                  }`}
                >
                  <span>{s.label}</span>
                  <span className="tabular text-xs text-muted">
                    {formatMoney(s.amount)} · {(s.pct * 100).toFixed(0)}% · {s.returnPerDollar.toFixed(2)} / $1
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {m.status === "open" && me.data?.player ? (
            <div className="mt-4 flex gap-2">
              <div className="flex-1">
                <Label>Contribution</Label>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <Button
                className="mt-6"
                disabled={!pick[m.id] || mut.isPending}
                onClick={() =>
                  mut.mutate({
                    marketId: m.id,
                    selectionId: pick[m.id],
                    amount: Number(amount),
                  })
                }
              >
                Record
              </Button>
            </div>
          ) : null}
          {me.data?.isAdmin ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="navy"
                onClick={() =>
                  setMarketStatus({ data: { marketId: m.id, status: "closed" } }).then(() => {
                    qc.invalidateQueries({ queryKey: ["trip"] });
                    toast("Market closed.");
                  })
                }
              >
                Close
              </Button>
              <Button
                size="sm"
                variant="navy"
                onClick={() =>
                  setMarketStatus({ data: { marketId: m.id, status: "void" } }).then(() => {
                    qc.invalidateQueries({ queryKey: ["trip"] });
                    toast("Voided. Contributions remain a conversation.");
                  })
                }
              >
                Void
              </Button>
              <Button
                size="sm"
                disabled={!pick[m.id]}
                onClick={() =>
                  settleMarket({ data: { marketId: m.id, winningSelectionId: pick[m.id] } }).then(() => {
                    qc.invalidateQueries({ queryKey: ["trip"] });
                    toast("Settled. The pool has been mathematically redistributed.");
                  })
                }
              >
                Settle winner
              </Button>
            </div>
          ) : null}
        </article>
      ))}
      {me.data?.isAdmin ? <MarketBuilder /> : null}
    </div>
  );
}

function MyAction() {
  const trip = useTrip();
  const me = useMeQuery();
  const data = trip.data;
  const player = me.data?.player;
  if (!data) return null;
  if (!player) {
    return (
      <section className="panel p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-gold">My action</p>
        <h2 className="font-display text-2xl">Your bets live here</h2>
        <p className="mt-1 text-sm text-muted">
          Claim a bag in the locker room and this fills in. Your pool tickets, nothing else.
        </p>
      </section>
    );
  }

  const tickets = data.entries
    .filter((e) => e.player_id === player.id)
    .map((e) => {
      const market = data.markets.find((m) => m.id === e.market_id);
      const sel = data.selections.find((s) => s.id === e.selection_id);
      const slices = data.entrySums.filter((s) => s.market_id === e.market_id);
      const total = slices.reduce((n, s) => n + s.total, 0);
      const onPick = slices.find((s) => s.selection_id === e.selection_id)?.total ?? 0;
      const ret = onPick > 0 ? (e.amount / onPick) * total : 0;
      const won = market?.status === "settled" && market.winning_selection_id === e.selection_id;
      const lost = market?.status === "settled" && market.winning_selection_id !== e.selection_id;
      return { e, market, sel, ret, won, lost };
    });

  const inPlay = tickets.reduce((n, t) => n + t.e.amount, 0);

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-gold">My action</p>
          <h2 className="font-display text-2xl">{playerName(player)}</h2>
        </div>
        <p className="font-display text-2xl tabular">{formatMoney(inPlay)}</p>
      </div>
      <p className="text-xs text-muted">Your tickets. No house. No rake.</p>
      {tickets.length ? (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.e.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{t.market?.name ?? "Market"}</p>
                <p className="text-[11px] text-muted">
                  {t.sel?.label ?? "Pick"} · {formatMoney(t.e.amount)}
                  {t.market?.status === "open" ? ` · would return ${formatMoney(t.ret)}` : ""}
                  {t.won ? " · won" : ""}
                  {t.lost ? " · lost" : ""}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.12em] text-gold">{t.market?.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No tickets yet. Pick a market below.</p>
      )}
    </section>
  );
}

function MarketBuilder() {
  const trip = useTrip();
  const qc = useQueryClient();
  const players = trip.data?.players ?? [];
  const rounds = trip.data?.rounds ?? [];
  const [kind, setKind] = useState<"field" | "ou" | "h2h" | "three" | "match">("field");
  const [scope, setScope] = useState<"trip" | number>("trip");
  const [scoring, setScoring] = useState<"gross" | "net">("net");
  const [prop, setProp] = useState<"low" | "birdies" | "points">("low");
  const [line, setLine] = useState("82");
  const [picks, setPicks] = useState<number[]>([]);
  const [customName, setCustomName] = useState("");

  const roundLabel =
    scope === "trip" ? "the tournament" : rounds.find((r) => r.id === scope)?.name ?? "this round";
  const scoringLabel = scoring === "net" ? "net" : "gross";

  function toggle(id: number, max: number) {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const next = [...prev, id];
      return next.slice(-max);
    });
  }

  const mut = useMutation({
    mutationFn: () => {
      const roundId = scope === "trip" ? null : scope;
      const names = (ids: number[]) =>
        ids.map((id) => {
          const p = players.find((x) => x.id === id);
          return p ? `${p.first_name} ${p.last_name}` : "?";
        });

      if (kind === "field") {
        const title =
          prop === "birdies"
            ? `Most birdies · ${roundLabel}`
            : prop === "points"
              ? `Match points · ${roundLabel}`
              : `Low ${scoringLabel} · ${roundLabel}`;
        return createMarket({
          data: {
            name: customName.trim() || title,
            kind: `field_${scoring}_${prop}`,
            roundId,
          },
        });
      }
      if (kind === "ou") {
        if (picks.length !== 1) throw new Error("Pick one golfer for the over/under.");
        const who = names(picks)[0];
        const n = Number(line);
        if (!n) throw new Error("Give the line a number.");
        return createMarket({
          data: {
            name: customName.trim() || `${who} ${roundLabel} ${scoringLabel} O/U ${n}`,
            kind: `ou_${scoring}`,
            roundId,
            selectionLabels: [`Over ${n}`, `Under ${n}`],
          },
        });
      }
      if (kind === "h2h") {
        if (picks.length !== 2) throw new Error("Pick two golfers.");
        const [a, b] = names(picks);
        return createMarket({
          data: {
            name: customName.trim() || `${a} vs ${b} · ${scoringLabel} · ${roundLabel}`,
            kind: `h2h_${scoring}`,
            roundId,
            selectionLabels: [a, b],
          },
        });
      }
      if (kind === "three") {
        if (picks.length !== 3) throw new Error("Pick three golfers.");
        const label = names(picks).join(" / ");
        return createMarket({
          data: {
            name: customName.trim() || `3-way ${scoringLabel} · ${label} · ${roundLabel}`,
            kind: `three_${scoring}`,
            roundId,
            selectionLabels: [...names(picks), "Tie"],
          },
        });
      }
      if (picks.length !== 4) throw new Error("Pick four golfers: two vs two.");
      const a = `${names(picks.slice(0, 2))[0]} / ${names(picks.slice(0, 2))[1]}`;
      const b = `${names(picks.slice(2))[0]} / ${names(picks.slice(2))[1]}`;
      return createMarket({
        data: {
          name: customName.trim() || `${a} vs ${b} · ${scoringLabel} four-ball · ${roundLabel}`,
          kind: `match_${scoring}`,
          roundId,
          selectionLabels: [a, b, "Push"],
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      setPicks([]);
      setCustomName("");
      toast("Market opened. This is still not a sportsbook.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const maxPicks = kind === "ou" ? 1 : kind === "h2h" ? 2 : kind === "three" ? 3 : kind === "match" ? 4 : 0;

  return (
    <div className="panel space-y-3 p-4">
      <h2 className="font-display text-2xl">Open a market</h2>
      <p className="text-sm text-muted">
        Participant-funded only. No house, no rake. This is extra action.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(
          [
            ["field", "Field / low score"],
            ["ou", "Over / under"],
            ["h2h", "Head-to-head"],
            ["three", "3-way matchup"],
            ["match", "2 vs 2 match"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setPicks([]);
            }}
            className={`rounded-[12px] border px-3 py-2 text-left text-xs ${kind === k ? "border-gold bg-gold/10 text-cream" : "border-line text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Scope</Label>
          <select
            className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
            value={scope}
            onChange={(e) => setScope(e.target.value === "trip" ? "trip" : Number(e.target.value))}
          >
            <option value="trip">Whole tournament</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} only
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Scoring</Label>
          <select
            className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
            value={scoring}
            onChange={(e) => setScoring(e.target.value as "gross" | "net")}
          >
            <option value="net">Net (USGA)</option>
            <option value="gross">Gross</option>
          </select>
        </div>
      </div>
      {kind === "field" ? (
        <div>
          <Label>Prop</Label>
          <select
            className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
            value={prop}
            onChange={(e) => setProp(e.target.value as typeof prop)}
          >
            <option value="low">Low score (every player + The Field)</option>
            <option value="birdies">Most birdies</option>
            <option value="points">Match points</option>
          </select>
        </div>
      ) : null}
      {kind === "ou" ? (
        <div>
          <Label>Line</Label>
          <Input type="number" value={line} onChange={(e) => setLine(e.target.value)} />
        </div>
      ) : null}
      {maxPicks > 0 ? (
        <div>
          <Label>
            Golfers ({picks.length}/{maxPicks}
            {kind === "match" ? " · first two are a team" : ""})
          </Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {players.map((p) => {
              const on = picks.includes(p.id);
              const order = picks.indexOf(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id, maxPicks)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-gold bg-gold/15 text-cream" : "border-line text-muted"}`}
                >
                  {on ? `${order + 1}. ` : ""}
                  {p.first_name} {p.last_name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div>
        <Label>Name override (optional)</Label>
        <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Leave blank to auto-name" />
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? "Opening…" : "Create market"}
      </Button>
    </div>
  );
}

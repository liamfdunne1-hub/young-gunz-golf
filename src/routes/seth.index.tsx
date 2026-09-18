import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  assignAwardsFromData,
  finalizeTrip,
  getSethDesk,
  postAnnouncement,
  remindPlayer,
  saveAward,
  saveRecap,
  saveReportCard,
  setSethPasscode,
  setSkinsPot,
  startRound,
  finalizeRound,
} from "@/lib/server/api";
import { generateRecap } from "@/lib/server/recap-fn";
import { templateRecap } from "@/lib/golf/recap";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatMoney, playerName } from "@/lib/utils";
import { SKINS_POT } from "@/lib/constants";
import { useState } from "react";

export const Route = createFileRoute("/seth/")({ component: SethDesk });

function SethDesk() {
  const me = useMeQuery();
  const trip = useTrip();
  const qc = useQueryClient();
  const desk = useQuery({
    queryKey: ["seth"],
    queryFn: () => getSethDesk(),
    enabled: Boolean(me.data?.isAdmin),
  });
  const [ann, setAnn] = useState({ title: "", body: "", important: true, email: false });
  const [code, setCode] = useState("");
  const [pot, setPot] = useState(String(trip.data?.trip.skins_pot ?? SKINS_POT));
  const post = useMutation({
    mutationFn: () => postAnnouncement({ data: ann }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Posted to the Commissioner’s bulletin.");
      setAnn({ title: "", body: "", important: true, email: false });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const nudge = useMutation({
    mutationFn: (args: { playerId: number; task: string }) => remindPlayer({ data: args }),
    onSuccess: () => toast("Automated commissioner services dispatched."),
    onError: (e: Error) => toast.error(e.message),
  });
  const lockTrip = useMutation({
    mutationFn: () => finalizeTrip(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Unlike the pairings, this one is actually final.");
    },
  });
  const saveCode = useMutation({
    mutationFn: () => setSethPasscode({ data: { passcode: code } }),
    onSuccess: () => {
      setCode("");
      toast("Door code updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const savePot = useMutation({
    mutationFn: () => setSkinsPot({ data: { pot: Number(pot) } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast(`Skins pot is ${formatMoney(res.pot)}. Still not a sportsbook.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = desk.data;
  const players = d?.players ?? trip.data?.players ?? [];
  const flights = d?.flights ?? [];
  const registered = players.filter((p) => p.registered_at || p.user_id).length;
  const flightCount = new Set(flights.filter((f) => f.direction === "arrival").map((f) => f.player_id)).size;
  const tomorrow = d?.rounds.find((r) => r.status !== "finalized");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Young Gunz Command Center</p>
        <h1 className="font-display text-4xl">Seth Mode</h1>
        {trip.data?.trip.last_admin_message ? (
          <p className="text-sm text-gold">{trip.data.trip.last_admin_message}</p>
        ) : null}
      </header>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Kpi k="Players registered" v={`${registered} / ${players.length}`} />
        <Kpi k="Flights submitted" v={`${flightCount} / ${players.length}`} />
        <Kpi k="Tomorrow’s pairings" v={tomorrow?.pairings_status ?? "—"} />
        <Kpi k="Emails in ledger" v={String(d?.emails.length ?? 0)} />
        <Kpi k="Trip status" v={trip.data?.trip.status ?? "upcoming"} />
        <Kpi k="Ask Seths" v={String(trip.data?.askSeth.reduce((s, a) => s + a.n, 0) ?? 0)} />
      </div>
      <nav className="flex flex-wrap gap-2">
        <Link className="rounded-full bg-gold px-4 py-2 text-xs uppercase tracking-[0.14em] text-navy" to="/seth/pairings">
          Pairings manager
        </Link>
        <Link className="rounded-full border border-line px-4 py-2 text-xs uppercase tracking-[0.14em]" to="/seth/courses">
          Scorecards
        </Link>
        <Link className="rounded-full border border-line px-4 py-2 text-xs uppercase tracking-[0.14em]" to="/seth/players">
          Players
        </Link>
        <Link className="rounded-full border border-line px-4 py-2 text-xs uppercase tracking-[0.14em]" to="/seth/emails">
          Email center
        </Link>
        <Link className="rounded-full border border-line px-4 py-2 text-xs uppercase tracking-[0.14em]" to="/skins">
          Skins board
        </Link>
        <Link className="rounded-full border border-line px-4 py-2 text-xs uppercase tracking-[0.14em]" to="/ledger">
          Public ledger
        </Link>
      </nav>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="panel space-y-3 p-4">
          <h2 className="font-display text-2xl">Door code</h2>
          <p className="text-sm text-muted">Required to open Seth Mode on a device. Do not text this to the group chat.</p>
          <Input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="New code" />
          <Button size="sm" variant="navy" disabled={code.trim().length < 4 || saveCode.isPending} onClick={() => saveCode.mutate()}>
            Update code
          </Button>
        </div>
      </section>

      <section className="panel space-y-3 border-gold/30 p-4">
        <h2 className="font-display text-2xl">Gross skins pot</h2>
        <p className="text-sm text-muted">
          Shared communal fund. Lowest gross on the hole, full field. Ties push, skins carry. This is not a bet, not The
          Action, and it never writes to the ledger. {trip.data?.rounds.length ?? 5} rounds × 18 holes.
        </p>
        <Label>Total pot</Label>
        <Input type="number" min={0} value={pot} onChange={(e) => setPot(e.target.value)} />
        <p className="text-xs text-muted">
          {Number(pot) > 0
            ? `${formatMoney(Number(pot) / Math.max(1, (trip.data?.rounds.length ?? 5) * 18))} per hole before carryovers.`
            : "Zero pot still tracks skins. It just pays in humiliation."}
        </p>
        <Button
          size="sm"
          variant="gold"
          disabled={Number.isNaN(Number(pot)) || Number(pot) < 0 || savePot.isPending}
          onClick={() => savePot.mutate()}
        >
          Save skins pot
        </Button>
      </section>

      <section className="panel p-4">
        <h2 className="font-display text-2xl">People Seth currently needs something from</h2>
        <ul className="mt-3 space-y-2">
          {players.map((p) => {
            const hasFlight = flights.some((f) => f.player_id === p.id);
            if (hasFlight && p.user_id) return null;
            const task = !hasFlight ? "Please update your flight information." : "Please actually look at the itinerary.";
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-3 py-2">
                <div>
                  <p className="text-sm">{playerName(p)}</p>
                  <p className="text-xs text-muted">{task}</p>
                </div>
                <Button size="sm" variant="navy" onClick={() => nudge.mutate({ playerId: p.id, task })}>
                  Remind them
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-2xl">Bulletin</h2>
        <div>
          <Label>Title</Label>
          <Input value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ann.email} onChange={(e) => setAnn({ ...ann, email: e.target.checked })} className="accent-gold" />
          Email everyone
        </label>
        <Button disabled={!ann.title || !ann.body || post.isPending} onClick={() => post.mutate()}>
          Post announcement
        </Button>
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-2xl">Rounds</h2>
        {d?.rounds.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2">
            <p className="text-sm">
              {r.name} · {r.pairings_status} · {r.status}
            </p>
            <div className="flex gap-2">
              <RoundBtn roundId={r.id} kind="start" />
              <RoundBtn roundId={r.id} kind="final" />
            </div>
          </div>
        ))}
      </section>

      <RecapBox />
      <AwardsBox />
      <CardsBox />

      <div className="panel p-4">
        <h2 className="font-display text-2xl">Finalize Young Gunz 2026</h2>
        <p className="my-2 text-sm text-muted">Are you sure? Unlike the pairings, this one is actually final.</p>
        <Button variant="danger" onClick={() => lockTrip.mutate()} disabled={lockTrip.isPending}>
          Finalize trip
        </Button>
      </div>
    </div>
  );
}

function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{k}</p>
      <p className="font-display text-2xl capitalize">{v}</p>
    </div>
  );
}

function RoundBtn({ roundId, kind }: { roundId: number; kind: "start" | "final" }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => (kind === "start" ? startRound({ data: { roundId } }) : finalizeRound({ data: { roundId } })),
    onSuccess: () => {
      qc.invalidateQueries();
      toast(kind === "start" ? "Round is live." : "Round finalized. Recaps and emails queued.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant={kind === "final" ? "gold" : "navy"} onClick={() => mut.mutate()}>
      {kind === "start" ? "Start" : "Finalize"}
    </Button>
  );
}

function RecapBox() {
  const trip = useTrip();
  const qc = useQueryClient();
  const days = [...new Set((trip.data?.rounds ?? []).map((r) => r.date))];
  const [form, setForm] = useState({
    day: days[0] ?? "2026-11-12",
    title: "Friday Recap",
    body: "",
    quote: "",
    publish: false,
  });
  const mut = useMutation({
    mutationFn: () => saveRecap({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast(form.publish ? "Recap published and emailed." : "Recap saved as a draft.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const gen = useMutation({
    mutationFn: () => generateRecap({ data: { day: form.day } }),
    onSuccess: (draft) => {
      if (!draft.usedAi) return;
      setForm((f) => ({ ...f, title: draft.title, body: draft.body, quote: draft.quote }));
      toast("Grok rewrote the recap. Edit anything that is too mean.");
    },
    onError: () => undefined,
  });
  return (
    <section className="panel space-y-3 p-4">
      <h2 className="font-display text-2xl">Daily recap</h2>
      <p className="text-sm text-muted">
        Built from scores, matches, skins, and Ask Seths. Finalize a round and a draft appears. Press generate to rewrite it.
      </p>
      <select
        className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
        value={form.day}
        onChange={(e) => setForm({ ...form, day: e.target.value })}
      >
        {(days.length ? days : [form.day]).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Generate from the golf, then edit." />
      <Input value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} placeholder="Moment of the day" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-gold" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
        Publish and email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="navy"
          disabled={gen.isPending}
          onClick={() => {
            if (trip.data) {
              const draft = templateRecap(trip.data, form.day);
              setForm((f) => ({ ...f, title: draft.title, body: draft.body, quote: draft.quote }));
              toast("Written from the cards. Grok will polish it if a key is saved.");
            }
            gen.mutate();
          }}
        >
          {gen.isPending ? "Writing…" : "Generate from the golf"}
        </Button>
        <Button type="button" onClick={() => mut.mutate()} disabled={mut.isPending || !form.body.trim()}>
          Save recap
        </Button>
      </div>
    </section>
  );
}

function AwardsBox() {
  const trip = useTrip();
  const qc = useQueryClient();
  const [awardId, setAwardId] = useState<number | "">("");
  const [playerId, setPlayerId] = useState<number | "">("");
  const auto = useMutation({
    mutationFn: () => assignAwardsFromData(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      const n = res.applied.length;
      toast(n ? `Assigned ${n} awards from the cards.` : "Nothing to award yet. Someone has to play golf.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mut = useMutation({
    mutationFn: () => {
      const award = trip.data?.awards.find((a) => a.id === awardId);
      if (!award || awardId === "" || playerId === "") throw new Error("Pick an award and a victim.");
      return saveAward({
        data: {
          awardId: award.id,
          name: award.name,
          description: award.description,
          category: award.category,
          playerId: Number(playerId),
          published: true,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Award assigned. Humiliation is now official.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="panel space-y-3 p-4">
      <h2 className="font-display text-2xl">Awards</h2>
      <p className="text-sm text-muted">
        Low gross, net, matches, birdies, skins, holes won, blow-ups, and the Seth button assign themselves from the data.
        Fun awards use scouting until golf exists. You can still override anyone.
      </p>
      <Button variant="gold" onClick={() => auto.mutate()} disabled={auto.isPending}>
        {auto.isPending ? "Reading the cards…" : "Award from the numbers"}
      </Button>
      <ul className="space-y-1 text-sm">
        {(trip.data?.awards ?? []).map((a) => {
          const p = trip.data?.players.find((x) => x.id === a.player_id);
          return (
            <li key={a.id} className="flex justify-between gap-3">
              <span>{a.name}</span>
              <span className="text-gold">{a.published && p ? playerName(p) : "Open"}</span>
            </li>
          );
        })}
      </ul>
      <select
        className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
        value={awardId}
        onChange={(e) => setAwardId(e.target.value ? Number(e.target.value) : "")}
      >
        <option value="">Override award</option>
        {trip.data?.awards.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value ? Number(e.target.value) : "")}
      >
        <option value="">Select golfer</option>
        {trip.data?.players.map((p) => (
          <option key={p.id} value={p.id}>
            {playerName(p)}
          </option>
        ))}
      </select>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        Assign and publish
      </Button>
    </section>
  );
}

function CardsBox() {
  const trip = useTrip();
  const [playerId, setPlayerId] = useState<number | "">("");
  const [form, setForm] = useState({
    golf: "B+",
    gambling: "C-",
    decisions: "D",
    entertainment: "A",
    sethDependency: "Concerning",
    comment: "Would be invited again.",
    published: false,
  });
  const mut = useMutation({
    mutationFn: () => {
      if (playerId === "") throw new Error("Pick a golfer.");
      return saveReportCard({ data: { playerId: Number(playerId), ...form } });
    },
    onSuccess: () => toast("Report card saved."),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="panel space-y-3 p-4">
      <h2 className="font-display text-2xl">Report cards</h2>
      <select
        className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value ? Number(e.target.value) : "")}
      >
        <option value="">Select golfer</option>
        {trip.data?.players.map((p) => (
          <option key={p.id} value={p.id}>
            {playerName(p)}
          </option>
        ))}
      </select>
      {(["golf", "gambling", "decisions", "entertainment", "sethDependency"] as const).map((k) => (
        <Input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      ))}
      <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-gold"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
        />
        Publish
      </label>
      <Button onClick={() => mut.mutate()}>Save report card</Button>
    </section>
  );
}

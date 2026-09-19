import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  finalizeTrip,
  getSethDesk,
  saveRecap,
  setSethPasscode,
  startRound,
  finalizeRound,
} from "@/lib/server/api";
import { generateRecap, generateTestRecap } from "@/lib/server/recap-fn";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { playerName } from "@/lib/utils";
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
  const [code, setCode] = useState("");
  const saveCode = useMutation({
    mutationFn: () => setSethPasscode({ data: { passcode: code } }),
    onSuccess: () => {
      setCode("");
      toast("Door code updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const lockTrip = useMutation({
    mutationFn: () => finalizeTrip(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Unlike the pairings, this one is actually final.");
    },
  });
  const d = desk.data;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Young Gunz Command Center</p>
        <h1 className="font-display text-4xl">Seth Mode</h1>
      </header>
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
      </nav>
      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-2xl">Door code</h2>
        <Input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="New code" />
        <Button size="sm" variant="navy" disabled={code.trim().length < 4 || saveCode.isPending} onClick={() => saveCode.mutate()}>
          Update code
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
      <div className="panel p-4">
        <h2 className="font-display text-2xl">Finalize Young Gunz 2026</h2>
        <Button variant="danger" onClick={() => lockTrip.mutate()} disabled={lockTrip.isPending}>
          Finalize trip
        </Button>
      </div>
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
      setForm((f) => ({ ...f, title: draft.title, body: draft.body, quote: draft.quote }));
      toast(draft.usedAi ? "Grok rewrote the recap." : "Written from the cards. No xAI rewrite.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const testAi = useMutation({
    mutationFn: () => generateTestRecap(),
    onSuccess: (draft) => {
      setForm((f) => ({
        ...f,
        day: draft.day || f.day,
        title: draft.title,
        body: draft.body,
        quote: draft.quote,
        publish: false,
      }));
      toast(
        draft.usedAi
          ? "xAI test recap with fake cards. Not emailed. Not saved until you click Save."
          : draft.note ?? "xAI key missing — template used fake cards instead.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="panel space-y-3 p-4">
      <h2 className="font-display text-2xl">Daily recap</h2>
      <p className="text-sm text-muted">
        Generate from real golf, or Test xAI recap to invent 18 holes for everyone. Test never emails and never writes the database until Save.
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
      <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      <Input value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-gold" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
        Publish and email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="navy" disabled={gen.isPending} onClick={() => gen.mutate()}>
          {gen.isPending ? "Writing…" : "Generate from the golf"}
        </Button>
        <Button type="button" variant="navy" disabled={testAi.isPending} onClick={() => testAi.mutate()}>
          {testAi.isPending ? "Faking 18 holes…" : "Test xAI recap"}
        </Button>
        <Button type="button" onClick={() => mut.mutate()} disabled={mut.isPending || !form.body.trim()}>
          Save recap
        </Button>
      </div>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveFlight } from "@/lib/server/api";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { playerName } from "@/lib/utils";

export const Route = createFileRoute("/flights")({ component: Flights });

const STATUSES = ["unknown", "in_air", "landed", "delayed", "missing", "at_the_bar", "seth_is_looking"] as const;
const LABELS: Record<(typeof STATUSES)[number], string> = {
  unknown: "Unknown",
  in_air: "In the air",
  landed: "Landed",
  delayed: "Delayed",
  missing: "Missing",
  at_the_bar: "At the bar",
  seth_is_looking: "Seth is looking for them",
};

function Flights() {
  const { data, isPending } = useTrip();
  const me = useMeQuery();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    direction: "arrival" as "arrival" | "departure",
    airport: "",
    airline: "",
    flightNumber: "",
    departsAt: "",
    arrivesAt: "",
    terminal: "",
    status: "unknown",
  });
  const mut = useMutation({
    mutationFn: () => saveFlight({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Flight saved. Mom can stop guessing.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Arrival night</p>
        <h1 className="font-display text-4xl">Flights</h1>
        <p className="text-sm text-muted">Wednesday, November 11. Everyone flies in the night before golf begins. In theory.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {data.players.map((p) => {
          const arrival = data.flights.find((f) => f.player_id === p.id && f.direction === "arrival");
          const status = (arrival?.status ?? "unknown") as (typeof STATUSES)[number];
          return (
            <div key={p.id} className="panel p-4">
              <p className="font-display text-xl">{playerName(p)}</p>
              <p className="text-xs uppercase tracking-[0.14em] text-gold">{LABELS[status] ?? status}</p>
              <p className="mt-1 text-sm text-muted">
                {arrival
                  ? `${arrival.airline ?? ""} ${arrival.flight_number ?? ""} · ${arrival.airport ?? "?"} → MCO ${arrival.arrives_at ?? ""}`
                  : "No flight on file. Seth is not surprised."}
              </p>
            </div>
          );
        })}
      </div>
      {me.data?.player ? (
        <form
          className="panel grid gap-3 p-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <h2 className="font-display text-2xl md:col-span-2">Your details</h2>
          <div>
            <Label>Direction</Label>
            <select
              className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value as "arrival" | "departure" })}
            >
              <option value="arrival">Arrival</option>
              <option value="departure">Departure</option>
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select
              className="h-11 w-full rounded-[12px] border border-line bg-navy px-3"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Departure airport</Label>
            <Input value={form.airport} onChange={(e) => setForm({ ...form, airport: e.target.value })} />
          </div>
          <div>
            <Label>Airline</Label>
            <Input value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })} />
          </div>
          <div>
            <Label>Flight number</Label>
            <Input value={form.flightNumber} onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} />
          </div>
          <div>
            <Label>Departs</Label>
            <Input value={form.departsAt} onChange={(e) => setForm({ ...form, departsAt: e.target.value })} placeholder="6:10 PM" />
          </div>
          <div>
            <Label>Orlando arrival</Label>
            <Input value={form.arrivesAt} onChange={(e) => setForm({ ...form, arrivesAt: e.target.value })} placeholder="8:45 PM" />
          </div>
          <div>
            <Label>Terminal</Label>
            <Input value={form.terminal} onChange={(e) => setForm({ ...form, terminal: e.target.value })} />
          </div>
          <Button type="submit" className="md:col-span-2" disabled={mut.isPending}>
            Save flight
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted">Sign in to add your flight so Seth does not have to text you.</p>
      )}
    </div>
  );
}

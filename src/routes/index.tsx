import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Crest } from "@/components/crest";
import { Countdown } from "@/components/countdown";
import { PlayerAvatar } from "@/components/avatar";
import { ACTION_TICKER, PRIMARY_TAGLINE, SECONDARY_TAGLINES, SETH_TITLES } from "@/lib/constants";
import { useMeQuery, useStats } from "@/lib/hooks";
import { formatHandicap, playerName } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { data, stats, isPending } = useStats();
  const me = useMeQuery();
  const [tag, setTag] = useState(0);
  const [title, setTitle] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const a = window.setInterval(() => setTag((n) => (n + 1) % SECONDARY_TAGLINES.length), 7000);
    const b = window.setInterval(() => setTitle((n) => (n + 1) % SETH_TITLES.length), 4000);
    const c = window.setInterval(() => setTick((n) => (n + 1) % ACTION_TICKER.length), 6000);
    return () => {
      window.clearInterval(a);
      window.clearInterval(b);
      window.clearInterval(c);
    };
  }, []);

  const nextRound = useMemo(() => {
    if (!data) return null;
    return data.rounds.find((r) => r.status !== "finalized") ?? data.rounds[0];
  }, [data]);

  const nextCourse = data?.courses.find((c) => c.id === nextRound?.course_id);
  const mom = data?.announcements[0];
  const player = me.data?.player;
  const greeting = player ? `Good ${hourWord()}, ${player.first_name}` : "Young Gunz";
  const myFlight = data?.flights.find((f) => f.player_id === player?.id && f.direction === "arrival");

  const myGroup = useMemo(() => {
    if (!data || !player || !nextRound) return null;
    const gps = data.groupPlayers.filter((g) => {
      const group = data.groups.find((x) => x.id === g.group_id);
      return group?.round_id === nextRound.id;
    });
    const mine = gps.find((g) => g.player_id === player.id);
    if (!mine) return null;
    return gps
      .filter((g) => g.group_id === mine.group_id)
      .map((g) => data.players.find((p) => p.id === g.player_id))
      .filter(Boolean);
  }, [data, player, nextRound]);

  if (isPending || !data) {
    return (
      <div className="space-y-4">
        <div className="h-72 animate-pulse rounded-[28px] bg-navy-2" />
        <div className="h-32 animate-pulse rounded-[18px] bg-navy-2" />
      </div>
    );
  }

  const pointsLead = [...stats].sort((a, b) => b.points - a.points)[0];
  const skinsLead = [...stats].sort((a, b) => b.skins - a.skins)[0];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-line">
        <img src="/images/hero.jpg" alt="Florida championship golf at dusk" className="h-[28rem] w-full object-cover md:h-[34rem]" />
        <div className="hero-scrim absolute inset-0" />
        <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-10">
          <div className="max-w-2xl rounded-[22px] bg-navy/70 p-5 shadow-panel md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <Crest className="h-16 w-16 md:h-20 md:w-20" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Private Golf Society</p>
                <p className="text-xs text-cream/70">Seth Young · {SETH_TITLES[title]}</p>
              </div>
            </div>
            <p className="text-sm text-cream/80">{greeting}</p>
            <h1 className="font-display text-5xl leading-[0.9] text-cream md:text-7xl">
              Young Gunz
              <span className="block text-3xl text-gold md:text-5xl">Orlando 2026</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-cream/80 md:text-base">{PRIMARY_TAGLINE}</p>
            <p className="mt-1 max-w-xl text-xs text-gold/90">{SECONDARY_TAGLINES[tag]}</p>
            <div className="mt-6">
              <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-gold">Until someone says “Are we playing it down?”</p>
              <Countdown />
            </div>
          </div>
        </div>
      </section>

      {player ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DashCard k="Handicap" v={formatHandicap(player.handicap_index)} />
          <DashCard
            k="Next round"
            v={nextCourse?.name.split(" ")[0] ?? "TBD"}
            s={nextRound ? `${nextRound.date} · ${nextRound.tee_time}` : ""}
          />
          <DashCard
            k="Your pairing"
            v={myGroup ? myGroup.map((p) => p!.first_name).join(" / ") : "Not yet announced"}
            s={myGroup ? "" : "Waiting for Seth to rearrange everyone for the 14th time."}
          />
          <DashCard
            k="Your flight"
            v={myFlight?.airport ? `${myFlight.airport} → MCO` : "Not filed"}
            s={myFlight?.flight_number ?? "Seth is waiting on this."}
          />
        </section>
      ) : null}

      {nextRound && nextCourse ? (
        <section className="panel overflow-hidden">
          <div className="grid md:grid-cols-2">
            <img src={nextCourse.image_url ?? "/images/hero.jpg"} alt={nextCourse.name} className="h-52 w-full object-cover md:h-full" />
            <div className="p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Next round</p>
              <h2 className="font-display text-3xl">{nextCourse.name}</h2>
              <p className="text-sm text-muted">
                {nextRound.date} · {nextRound.tee_time}
              </p>
              <p className="mt-2 text-sm text-cream/80">{nextRound.theme}</p>
              {nextRound.tee_time === "6:50 AM" ? (
                <p className="mt-3 font-display text-2xl text-orange">YES. 6:50 AM.</p>
              ) : null}
              <Link to="/pairings" className="mt-4 inline-flex text-sm text-gold hover:underline">
                View pairings
              </Link>
              <Link to="/scores" className="mt-2 ml-4 inline-flex text-sm text-gold hover:underline">
                Keep your card
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {mom ? (
        <section className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Commissioner’s Bulletin</p>
          <h2 className="font-display text-2xl">{mom.title}</h2>
          <p className="mt-1 text-sm text-cream/80">{mom.body}</p>
          {data.announcements.length > 1 ? (
            <ul className="mt-4 space-y-2 border-t border-line pt-3">
              {data.announcements.slice(1, 4).map((a) => (
                <li key={a.id} className="text-sm text-muted">
                  <span className="text-gold">{a.title}</span>
                  {" — "}
                  {a.body}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-3xl">The Field</h2>
          <Link to="/players" className="text-xs uppercase tracking-[0.16em] text-gold">
            Full profiles
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {data.players.map((p) => (
            <Link key={p.id} to="/players/$slug" params={{ slug: p.slug }} className="panel min-w-[148px] p-3">
              <PlayerAvatar player={p} size={44} />
              <p className="mt-2 text-sm">{playerName(p)}</p>
              <p className="text-[11px] text-gold">{formatHandicap(p.handicap_index)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-line bg-navy-2">
        <div className="ticker flex gap-12 whitespace-nowrap px-4 py-3 text-xs uppercase tracking-[0.16em] text-gold">
          <span>{ACTION_TICKER[tick]}</span>
          <span>No house. No rake. No vig.</span>
          <span>Completely Recreational Financial Decisions.</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Match points</p>
          <h3 className="font-display text-2xl">
            {pointsLead && pointsLead.points > 0
              ? data.players.find((p) => p.id === pointsLead.playerId)?.first_name
              : "Nobody yet"}
          </h3>
          <p className="text-sm text-muted">
            {pointsLead && pointsLead.points > 0
              ? `${pointsLead.points} pts`
              : "Pairings are not set. Matches do not exist. Seth is thinking."}
          </p>
          <Link to="/leaderboard" className="mt-3 inline-block text-sm text-gold">
            Leaderboards
          </Link>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Gross skins</p>
          <h3 className="font-display text-2xl">
            {skinsLead && skinsLead.skins > 0
              ? data.players.find((p) => p.id === skinsLead.playerId)?.first_name
              : "The pot is intact"}
          </h3>
          <p className="text-sm text-muted">
            Unique lowest gross, full field. Ties push. Not a bet. Not on the ledger.
          </p>
          <Link to="/skins" className="mt-3 inline-block text-sm text-gold">
            Skins board
          </Link>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold">The Action</p>
          <h3 className="font-display text-2xl">{data.markets.filter((m) => m.status === "open").length} live markets</h3>
          <p className="text-sm text-muted">Participant-funded. The website is not a sportsbook. It is a ledger with opinions.</p>
          <Link to="/action" className="mt-3 inline-block text-sm text-gold">
            Open the window
          </Link>
        </div>
      </section>
    </div>
  );
}

function DashCard({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{k}</p>
      <p className="font-display text-2xl leading-tight">{v}</p>
      {s ? <p className="mt-1 text-xs text-muted">{s}</p> : null}
    </div>
  );
}

function hourWord() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

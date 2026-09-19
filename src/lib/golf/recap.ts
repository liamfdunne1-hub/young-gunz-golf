import { deriveStats, type Bootstrap } from "@/lib/golf/derive";
import { playerName } from "@/lib/utils";

export type RecapDraft = {
  day: string;
  title: string;
  body: string;
  quote: string;
};

function nameOf(data: Bootstrap, id: number | null | undefined): string {
  if (id == null) return "nobody";
  const p = data.players.find((x) => x.id === id);
  return p ? playerName(p) : "nobody";
}

function disastersForDay(data: Bootstrap, day: string) {
  const rounds = data.rounds.filter((r) => r.date === day);
  const roundIds = new Set(rounds.map((r) => r.id));
  const scores = data.scores.filter((s) => roundIds.has(s.round_id) && s.gross != null);
  const disasters: { name: string; hole: number; gross: number }[] = [];
  for (const s of scores) {
    const gross = s.gross ?? 0;
    if (gross >= 6) disasters.push({ name: nameOf(data, s.player_id), hole: s.hole, gross });
  }
  disasters.sort((a, b) => b.gross - a.gross);
  return disasters.slice(0, 6);
}

export function recapFacts(data: Bootstrap, day: string) {
  const rounds = data.rounds.filter((r) => r.date === day);
  const roundIds = new Set(rounds.map((r) => r.id));
  const stats = deriveStats(data);
  const scores = data.scores.filter((s) => roundIds.has(s.round_id));
  const matches = data.matches.filter((m) => roundIds.has(m.round_id));
  const posted = new Set(scores.map((s) => s.player_id)).size;
  const disasters = disastersForDay(data, day);
  const lowGross = [...stats].filter((s) => s.bestGross != null).sort((a, b) => (a.bestGross ?? 99) - (b.bestGross ?? 99))[0];
  const lowNet = [...stats].filter((s) => s.netAvg != null).sort((a, b) => (a.netAvg ?? 99) - (b.netAvg ?? 99))[0];
  const birds = [...stats].sort((a, b) => b.birdies - a.birdies)[0];
  const blow = [...stats].filter((s) => s.worstHole != null).sort((a, b) => (b.worstHole ?? 0) - (a.worstHole ?? 0))[0];
  const skins = [...stats].sort((a, b) => b.skins - a.skins)[0];
  const seth = [...stats].sort((a, b) => b.askSeth - a.askSeth)[0];
  const matchLines = matches
    .filter((m) => m.status === "final" || m.winner_side)
    .map((m) => {
      const a = m.a2 ? `${nameOf(data, m.a1)} / ${nameOf(data, m.a2)}` : nameOf(data, m.a1);
      const b = m.b2 ? `${nameOf(data, m.b1)} / ${nameOf(data, m.b2)}` : nameOf(data, m.b1);
      if (!m.winner_side) return `${a} halved ${b}${m.result ? ` (${m.result})` : ""}`;
      const win = m.winner_side === "a" ? a : b;
      return `${win} ${m.result ?? "won"} vs ${m.winner_side === "a" ? b : a}`;
    });
  const roundNotes = rounds.map((r) => {
    const course = data.courses.find((c) => c.id === r.course_id);
    return { name: r.name, course: course?.name ?? "Unknown course", teeTime: r.tee_time, status: r.status, theme: r.theme };
  });
  const upcoming = data.rounds
    .filter((r) => r.date > day || (r.date === day && !roundIds.has(r.id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.round_number - b.round_number)
    .find((r) => r.status !== "finalized");
  const nextCourse = upcoming ? data.courses.find((c) => c.id === upcoming.course_id) : null;
  return {
    day,
    field: data.players.length,
    posted,
    rounds: roundNotes,
    lowGross: lowGross ? { name: nameOf(data, lowGross.playerId), score: lowGross.bestGross } : null,
    lowNet: lowNet ? { name: nameOf(data, lowNet.playerId), score: lowNet.netAvg } : null,
    birdies: birds && birds.birdies > 0 ? { name: nameOf(data, birds.playerId), n: birds.birdies } : null,
    blowUp: blow?.worstHole ? { name: nameOf(data, blow.playerId), score: blow.worstHole } : null,
    skins: skins && skins.skins > 0 ? { name: nameOf(data, skins.playerId), n: skins.skins } : null,
    askSeth: seth && seth.askSeth > 0 ? { name: nameOf(data, seth.playerId), n: seth.askSeth } : null,
    matches: matchLines,
    scoresPosted: scores.length,
    disasters,
    next: upcoming
      ? {
          name: upcoming.name,
          date: upcoming.date,
          teeTime: upcoming.tee_time,
          course: nextCourse?.name ?? "a course Seth has not emotionally prepared you for",
          theme: upcoming.theme,
        }
      : null,
  };
}

export async function orlandoWeather(isoDate: string): Promise<string> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", "28.3852");
    url.searchParams.set("longitude", "-81.5639");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode");
    url.searchParams.set("timezone", "America/New_York");
    url.searchParams.set("start_date", isoDate);
    url.searchParams.set("end_date", isoDate);
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error("weather");
    const json = (await res.json()) as {
      daily?: {
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
        weathercode?: number[];
      };
    };
    const hi = json.daily?.temperature_2m_max?.[0];
    const lo = json.daily?.temperature_2m_min?.[0];
    const rain = json.daily?.precipitation_probability_max?.[0];
    const code = json.daily?.weathercode?.[0];
    const sky =
      code != null && code >= 80
        ? "storms looking for a backswing"
        : code != null && code >= 61
          ? "rain with a personal vendetta"
          : code != null && code >= 1
            ? "clouds that will be blamed for everything"
            : "cruel, photogenic sun";
    if (hi == null) return "Orlando will be humid. This is not news.";
    return `${Math.round(lo ?? hi)}\u2013${Math.round(hi)}\u00b0F, ${sky}${rain && rain >= 30 ? `, ${rain}% chance it rains on the guy who left his cover in the cart` : ""}.`;
  } catch {
    return "Forecast unavailable. Assume humidity, bad decisions, and someone asking if that is a water hazard.";
  }
}

export function fakeQuotes(facts: ReturnType<typeof recapFacts>): string[] {
  const bank = [
    (d: { name: string; hole: number; gross: number }) => `${d.name}, after a ${d.gross} on ${d.hole}: \u201cThat green is illegal.\u201d`,
    (d: { name: string; hole: number; gross: number }) => `${d.name} on ${d.hole}: \u201cI flushed it.\u201d The card says ${d.gross}.`,
    (d: { name: string; hole: number; gross: number }) => `${d.name}, walking off ${d.hole}: \u201cWind.\u201d There was no wind. There was a ${d.gross}.`,
  ];
  const picks = facts.disasters.slice(0, 3);
  if (!picks.length && facts.blowUp) return [`${facts.blowUp.name}, probably: \u201cThat never happens at my home course.\u201d`];
  return picks.map((d, i) => bank[i % bank.length](d));
}

export function templateRecap(data: Bootstrap, day: string, weather?: string): RecapDraft {
  const f = recapFacts(data, day);
  const weekday = new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const courseLine = f.rounds.map((r) => r.course).join(" then ") || "a course Seth has not named";
  const lines: string[] = [];
  lines.push(`${weekday} at ${courseLine}. ${f.posted} of ${f.field} cards in. Journalism continues, unfortunately.`);
  if (f.lowGross) lines.push(`Low gross on file: ${f.lowGross.name} (${f.lowGross.score}). The Handicap Committee has been copied.`);
  else lines.push("Nobody has finished 18 holes yet. The record book is yawning.");
  if (f.lowNet) lines.push(`Net honors: ${f.lowNet.name}. USGA 90% did some work.`);
  if (f.birdies) lines.push(`Birdie leader ${f.birdies.name} with ${f.birdies.n}.`);
  if (f.skins) lines.push(`Skins: ${f.skins.name} has ${f.skins.n}. Unique low. Ties pushed.`);
  if (f.blowUp) lines.push(`Blow-up of the day belongs to ${f.blowUp.name} with a ${f.blowUp.score}.`);
  if (f.matches.length) lines.push(`Matches: ${f.matches.slice(0, 4).join("; ")}.`);
  if (f.askSeth) lines.push(`${f.askSeth.name} asked Seth ${f.askSeth.n} times.`);
  const quotes = fakeQuotes(f);
  if (quotes.length) {
    lines.push("Unofficial quotes the desk is treating as on the record:");
    for (const q of quotes) lines.push(q);
  }
  if (f.next) {
    const wx = weather ?? "Humidity with a chance of excuses.";
    const when = new Date(`${f.next.date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });
    lines.push(`Coming up: ${f.next.name} at ${f.next.course}${f.next.teeTime ? `, ${f.next.teeTime}` : ""}. ${when}. Weather: ${wx} Pack sunscreen and a better attitude.`);
  } else {
    lines.push("No next round on the sheet. Either you survived the trip or Seth has not updated the itinerary.");
  }
  return {
    day,
    title: `${weekday.split(",")[0]} Recap \u2014 Young Gunz Orlando`,
    body: lines.join("\n\n"),
    quote: quotes[0] ?? "Ten golfers. Zero accountability. The website is doing its best.",
  };
}

export function recapSystemPrompt(): string {
  return `You are the official recap desk for Young Gunz Orlando 2026, a 10-man golf trip.
Voice: dry, absurd, ESPN-meets-commissioner. Personalized. Never invent scores or hole numbers.
Facts in the user JSON are the only numbers you may use. disasters[] are real blow-up holes. weather is a string if present.
Write two short paragraphs on today, two or three funny unofficial quotes tied to named golfers and real disaster holes, then a Coming up blurb with the weather string and a jab.
Return JSON only: {"title":"...","body":"...","quote":"..."}. Body uses \\n\\n between paragraphs.`;
}

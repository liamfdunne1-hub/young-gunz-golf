import { deriveStats, type Bootstrap } from "@/lib/golf/derive";
import { playerName } from "@/lib/utils";
import { forceParagraphs } from "@/lib/golf/paragraphs";
import { fakeQuotes } from "@/lib/golf/quotes";
import { recapSystemPrompt as loudPrompt } from "@/lib/golf/voice";

export type RecapDraft = {
  day: string;
  title: string;
  body: string;
  quote: string;
};

export { forceParagraphs, fakeQuotes };
export function recapSystemPrompt() {
  return loudPrompt();
}

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
        ? "pop-up storms hunting mid-handicaps"
        : code != null && code >= 61
          ? "rain that will be blamed on the guy who washed his ball"
          : code != null && code >= 1
            ? "clouds, excuses, and a 2pm beer"
            : "that bright Florida bastard of a sun";
    if (hi == null) return "Orlando will be humid enough to steam a brat.";
    return `${Math.round(lo ?? hi)}-${Math.round(hi)}F, ${sky}${rain && rain >= 30 ? `, ${rain}% chance it soaks the idiot who left his cover in the cart` : ""}.`;
  } catch {
    return "Forecast desk is drunk. Assume humidity, a breeze that only exists after a snap-hook, and someone asking if that's a water hazard.";
  }
}

export function templateRecap(data: Bootstrap, day: string, weather?: string): RecapDraft {
  const f = recapFacts(data, day);
  const weekday = new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const courseLine = f.rounds.map((r) => r.course).join(" then ") || "whatever swamp Seth booked";
  const quotes = fakeQuotes(f);
  const paras = [
    `${weekday} at ${courseLine}. ${f.posted} of ${f.field} grown-ass men turned in a card and immediately started lying.`,
    f.lowGross
      ? `Low gross is ${f.lowGross.name} at ${f.lowGross.score}. Either he striped it or the rest of you played like hungover amateurs. Both can be true.`
      : "Nobody finished 18. Cowards.",
    f.skins ? `Skins sit with ${f.skins.name} (${f.skins.n}). Unique low. Ties pushed. Not a casino, just ritual humiliation.` : "Skins are still arguing with themselves.",
    quotes[0],
    f.blowUp ? `Biggest dumpster fire: ${f.blowUp.name} and a ${f.blowUp.score}. Hide the beers and the index.` : "",
    quotes[1],
    f.matches.length ? `Matches: ${f.matches.slice(0, 3).join("; ")}.` : "Match play is waiting on Seth like a bar tab.",
    quotes[2],
    f.askSeth ? `${f.askSeth.name} mashed the Seth button ${f.askSeth.n} times like it was a mulligan dispenser.` : "",
  ].filter(Boolean) as string[];
  if (f.next) {
    const wx = weather ?? "Humidity with a chance of excuses.";
    const when = new Date(`${f.next.date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });
    paras.push(`Coming up: ${f.next.name} at ${f.next.course}${f.next.teeTime ? `, ${f.next.teeTime}` : ""} on ${when}.`);
    paras.push(`Weather desk: ${wx} Ice the lower back. Stretch the ego.`)
  } else {
    paras.push("No next round on the sheet. Ice your lower back and lie to each other at dinner.");
  }
  return {
    day,
    title: `${weekday.split(",")[0]} Recap - Young Gunz Orlando`,
    body: forceParagraphs(paras.join("\n\n")),
    quote: quotes[0] ?? "Ten middle-aged men. One itinerary. Zero shame.",
  };
}

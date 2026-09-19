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

export function fakeQuotes(facts: ReturnType<typeof recapFacts>): string[] {
  const bank = [
    (d: { name: string; hole: number; gross: number }) =>
      `${d.name} walked off ${d.hole} after a ${d.gross} and said, "That pin is a war crime." Nobody argued. The card already had.`,
    (d: { name: string; hole: number; gross: number }) =>
      `${d.name} flushed a provisional on ${d.hole}, posted a ${d.gross}, and muttered, "That's good." It was not good.`,
    (d: { name: string; hole: number; gross: number }) =>
      `On ${d.hole} ${d.name} announced "wind" after a ${d.gross}. There was no wind. There was beer. There was a ${d.gross}.`,
  ];
  const picks = facts.disasters.slice(0, 3);
  if (!picks.length && facts.blowUp) {
    return [`${facts.blowUp.name} looked at a ${facts.blowUp.score} and said, "That never happens at my home course." Home course is a myth they tell their wives.`];
  }
  return picks.map((d, i) => bank[i % bank.length](d));
}

export function forceParagraphs(body: string): string {
  const cleaned = body.replace(/\r\n/g, "\n").trim();
  const existing = cleaned.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (existing.length >= 4) return existing.join("\n\n");
  const sentences = cleaned
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?"])\s+(?=[A-Z0-9])/)n    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return (chunks.length ? chunks : existing).join("\n\n");
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
    `${weekday} at ${courseLine}. ${f.posted} of ${f.field} grown men turned in a card.`,
    f.lowGross
      ? `Low gross is ${f.lowGross.name} at ${f.lowGross.score}, which is either impressive or a crime against the index.`
      : "Nobody finished 18. Cowards.",
    f.skins ? `Skins sit with ${f.skins.name} (${f.skins.n}). Unique low. Ties pushed. Not a casino.` : "Skins are still arguing with themselves.",
    quotes[0],
    f.blowUp ? `The blow-up belongs to ${f.blowUp.name} and a ${f.blowUp.score}.` : "",
    quotes[1],
    f.matches.length ? `Matches: ${f.matches.slice(0, 3).join("; ")}.` : "Match play is waiting on Seth like everything else.",
    quotes[2],
    f.askSeth ? `${f.askSeth.name} hit the Seth button ${f.askSeth.n} times like it was a mulligan.` : "",
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
    paras.push(`Weather desk: ${wx} Stretch something that is not your index.`);
  } else {
    paras.push("No next round on the sheet. Go ice your lower back and lie to each other at dinner.");
  }
  return {
    day,
    title: `${weekday.split(",")[0]} Recap - Young Gunz Orlando`,
    body: forceParagraphs(paras.join("\n\n")),
    quote: quotes[0] ?? "Ten middle-aged men. One itinerary. Zero shame.",
  };
}

export function recapSystemPrompt(): string {
  return `You write the Young Gunz Orlando 2026 recap. Ten white middle-aged guys on a golf trip who like each other, drink, and talk shit. You are the drunk uncle commissioner with a press pass.

Be ridiculously funny. Profanity is fine (shit, damn, hell, ass, bastard). No slurs. No punching down on anyone's body, wife, kids, or job. Roast the golf and the excuses.

NEVER invent scores or hole numbers. disasters[] are the only blow-up holes you may quote. Weave 2-3 fake cart quotes into the story. Not a quote list.

FORMAT IS MANDATORY: 5 to 7 SHORT paragraphs. Each paragraph is 1-3 sentences. Separate every paragraph with a blank line (\\n\\n). No walls of text. No bullets.

Order:
1) Where they played and how many cards
2) Low gross / skins
3) A quote baked into a blow-up
4) Matches or another quote
5) Coming up + weather jab

Return JSON only: {"title":"...","body":"...","quote":"..."}.`;
}

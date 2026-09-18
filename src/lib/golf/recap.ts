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

export function recapFacts(data: Bootstrap, day: string) {
  const rounds = data.rounds.filter((r) => r.date === day);
  const roundIds = new Set(rounds.map((r) => r.id));
  const stats = deriveStats(data);
  const scores = data.scores.filter((s) => roundIds.has(s.round_id));
  const matches = data.matches.filter((m) => roundIds.has(m.round_id));
  const posted = new Set(scores.map((s) => s.player_id)).size;

  const lowGross = [...stats].filter((s) => s.bestGross != null).sort((a, b) => (a.bestGross ?? 99) - (b.bestGross ?? 99))[0];
  const lowNet = [...stats].filter((s) => s.netAvg != null).sort((a, b) => (a.netAvg ?? 99) - (b.netAvg ?? 99))[0];
  const birds = [...stats].sort((a, b) => b.birdies - a.birdies)[0];
  const blow = [...stats].filter((s) => s.worstHole != null).sort((a, b) => (b.worstHole ?? 0) - (a.worstHole ?? 0))[0];
  const skins = [...stats].sort((a, b) => b.skins - a.skins)[0];
  const seth = [...stats].sort((a, b) => b.askSeth - a.askSeth)[0];

  const matchLines = matches
    .filter((m) => m.status === "final" || m.winner_side)
    .map((m) => {
      const a = `${nameOf(data, m.a1)} / ${nameOf(data, m.a2)}`;
      const b = `${nameOf(data, m.b1)} / ${nameOf(data, m.b2)}`;
      if (!m.winner_side) return `${a} halved ${b}${m.result ? ` (${m.result})` : ""}`;
      const win = m.winner_side === "a" ? a : b;
      return `${win} ${m.result ?? "won"} vs ${m.winner_side === "a" ? b : a}`;
    });

  const roundNotes = rounds.map((r) => {
    const course = data.courses.find((c) => c.id === r.course_id);
    return {
      name: r.name,
      course: course?.name ?? "Unknown course",
      teeTime: r.tee_time,
      status: r.status,
      theme: r.theme,
    };
  });

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
  };
}

export function templateRecap(data: Bootstrap, day: string): RecapDraft {
  const f = recapFacts(data, day);
  const weekday = new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const courseLine = f.rounds.map((r) => r.course).join(" then ") || "a course Seth has not named";
  const lines: string[] = [];
  lines.push(
    `${weekday} at ${courseLine}. ${f.posted} of ${f.field} cards in. Journalism continues, unfortunately.`,
  );
  if (f.lowGross) {
    lines.push(`Low gross on file: ${f.lowGross.name} (${f.lowGross.score}). The Handicap Committee has been copied, which is not a compliment.`);
  } else {
    lines.push("Nobody has finished 18 holes yet. The record book is yawning.");
  }
  if (f.lowNet) lines.push(`Net honors: ${f.lowNet.name}. USGA 90% did some work.`);
  if (f.birdies) lines.push(`Birdie leader ${f.birdies.name} with ${f.birdies.n}. Do not congratulate them in person.`);
  if (f.skins) lines.push(`Skins: ${f.skins.name} has ${f.skins.n}. Unique low. Ties pushed. Not a bet.`);
  if (f.blowUp) lines.push(`Blow-up of the day belongs to ${f.blowUp.name} with a ${f.blowUp.score}. The card does not lie.`);
  if (f.matches.length) {
    lines.push(`Matches: ${f.matches.slice(0, 4).join("; ")}.`);
  } else {
    lines.push("Match play is still waiting on Seth, which is to say it is waiting on Seth.");
  }
  if (f.askSeth) {
    lines.push(`${f.askSeth.name} asked Seth ${f.askSeth.n} times. The tee time remains on the itinerary.`);
  }
  const quote = f.blowUp
    ? `${f.blowUp.name}, probably: “That never happens at my home course.”`
    : f.askSeth
      ? `Please stop asking Seth. ${f.askSeth.name} will not.`
      : "Ten golfers. Zero accountability. The website is doing its best.";
  return {
    day,
    title: `${weekday.split(",")[0]} Recap — Young Gunz Orlando`,
    body: lines.join("\n\n"),
    quote,
  };
}

export function recapSystemPrompt(): string {
  return `You are the official recap desk for Young Gunz Orlando 2026, a 10-man golf trip.
Voice: dry, absurd, ESPN-meets-commissioner. Personalized. Never invent scores.
Facts in the user JSON are the only numbers you may use. If golf has not happened, say so.
Write 3 short paragraphs, then a one-line pull quote attributed in spirit (not a fake quote if nobody spoke).
Do not mention software, databases, or that you are an AI.
Return JSON only: {"title":"...","body":"...","quote":"..."}. Body uses \\n\\n between paragraphs.`;
}

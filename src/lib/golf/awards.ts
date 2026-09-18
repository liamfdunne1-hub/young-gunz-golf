import { deriveStats, type Bootstrap, type PlayerStats } from "@/lib/golf/derive";
import { playerName } from "@/lib/utils";

export type AwardPick = {
  name: string;
  description: string;
  category: "major" | "fun";
  playerId: number;
  reason: string;
  overwrite: boolean;
};

function nameOf(data: Bootstrap, id: number): string {
  const p = data.players.find((x) => x.id === id);
  return p ? playerName(p) : "Unknown";
}

function extreme(
  stats: PlayerStats[],
  key: keyof PlayerStats,
  dir: "min" | "max",
): PlayerStats | null {
  const eligible = stats.filter((s) => {
    const v = s[key];
    return typeof v === "number" && Number.isFinite(v);
  });
  if (!eligible.length) return null;
  return eligible.reduce((best, s) => {
    const bv = best[key] as number;
    const sv = s[key] as number;
    if (dir === "min") return sv < bv ? s : best;
    return sv > bv ? s : best;
  });
}

function metricLeader(data: Bootstrap, key: keyof Bootstrap["players"][number]["joke_metrics"]): number | null {
  if (!data.players.length) return null;
  return data.players.reduce((best, p) => (p.joke_metrics[key] > best.joke_metrics[key] ? p : best)).id;
}

export function pickAwards(data: Bootstrap): AwardPick[] {
  const stats = deriveStats(data);
  const golfOn = stats.some((s) => s.roundsPlayed > 0);
  const picks: AwardPick[] = [];

  const push = (
    name: string,
    description: string,
    category: "major" | "fun",
    playerId: number | null,
    reason: string,
    overwrite: boolean,
  ) => {
    if (playerId == null) return;
    picks.push({ name, description, category, playerId, reason, overwrite });
  };

  if (golfOn) {
    const lowGross = extreme(stats, "grossTotal", "min");
    if (lowGross?.grossTotal != null) {
      push(
        "Low Gross Champion",
        "Lowest combined gross for the trip.",
        "major",
        lowGross.playerId,
        `${nameOf(data, lowGross.playerId)} at ${lowGross.grossTotal}`,
        true,
      );
    }
    const lowNet = extreme(stats, "netTotal", "min");
    if (lowNet?.netTotal != null) {
      push(
        "Low Net Champion",
        "Lowest combined net for the trip.",
        "major",
        lowNet.playerId,
        `${nameOf(data, lowNet.playerId)} at ${lowNet.netTotal}`,
        true,
      );
    }
    const match = extreme(stats, "points", "max");
    if (match && match.points > 0) {
      push(
        "Match Play Champion",
        "Most match points.",
        "major",
        match.playerId,
        `${nameOf(data, match.playerId)} with ${match.points} pts`,
        true,
      );
    }
    const birds = extreme(stats, "birdies", "max");
    if (birds && birds.birdies > 0) {
      push(
        "Birdie King",
        "Most birdies. Zac is not allowed to look smug.",
        "major",
        birds.playerId,
        `${nameOf(data, birds.playerId)} with ${birds.birdies}`,
        true,
      );
    }
    const skins = extreme(stats, "skins", "max");
    if (skins && skins.skins > 0) {
      push(
        "Skins King",
        "Most unique-low holes. Ties never counted.",
        "major",
        skins.playerId,
        `${nameOf(data, skins.playerId)} with ${skins.skins} skins`,
        true,
      );
    }
    const holes = extreme(stats, "holesWon", "max");
    if (holes && holes.holesWon > 0) {
      push(
        "Most Holes Won",
        "Match-play holes taken. Halves do not impress anyone.",
        "major",
        holes.playerId,
        `${nameOf(data, holes.playerId)} won ${holes.holesWon} holes`,
        true,
      );
    }
    const blow = extreme(stats, "worstHole", "max");
    if (blow?.worstHole != null && blow.worstHole >= 7) {
      push(
        "The Blow-Up Award",
        "Highest number posted on a single hole. Congratulations.",
        "fun",
        blow.playerId,
        `${nameOf(data, blow.playerId)} wrote down a ${blow.worstHole}`,
        true,
      );
    }
    const doubles = extreme(stats, "doubles", "max");
    if (doubles && doubles.doubles > 0) {
      push(
        "Most Doubles",
        "Double bogey or worse. Volume scoring.",
        "fun",
        doubles.playerId,
        `${nameOf(data, doubles.playerId)} stacked ${doubles.doubles}`,
        true,
      );
    }
  }

  const seth = extreme(stats, "askSeth", "max");
  if (seth && seth.askSeth > 0) {
    push(
      "Most Dependent on Seth",
      "Ask Seth button leader. This is not an honor.",
      "fun",
      seth.playerId,
      `${nameOf(data, seth.playerId)} asked ${seth.askSeth} times`,
      true,
    );
  }

  const byHcp = [...data.players].sort((a, b) => a.handicap_index - b.handicap_index);
  if (byHcp[0]) {
    push(
      "The Young Gun Award",
      "For the player who still thinks this is a big deal.",
      "fun",
      byHcp[0].id,
      `Lowest index: ${byHcp[0].handicap_index}`,
      false,
    );
  }
  if (byHcp.at(-1) && byHcp.at(-1)!.id !== byHcp[0]?.id) {
    const old = byHcp.at(-1)!;
    push(
      "The Old Man Award",
      "Earliest bedtime. Loudest knees.",
      "fun",
      old.id,
      `Highest index: ${old.handicap_index}`,
      false,
    );
  }

  const beers = metricLeader(data, "alcohol");
  push(
    "Most Dangerous After Two Beers",
    "Self-explanatory. Will be observed.",
    "fun",
    beers,
    "Highest alcohol-tolerance scouting score.",
    false,
  );
  const ob = metricLeader(data, "loseSomething");
  push(
    "Most Creative Interpretation of Out of Bounds",
    "If you can argue it, you can win it.",
    "fun",
    ob,
    "Most likely to lose a ball and the argument.",
    false,
  );
  const greens = metricLeader(data, "lipOut");
  push(
    "Most Likely to Blame the Greens",
    "They were fine.",
    "fun",
    greens,
    "Lip-out complaint leader in the scouting report.",
    false,
  );
  push(
    "The “I Had That Line” Award",
    "You did not.",
    "fun",
    greens,
    "Same man who saw the putt drop in an alternate universe.",
    false,
  );
  const good = metricLeader(data, "thatsGood");
  push(
    "The “That Never Happens at My Home Course” Award",
    "It happens everywhere.",
    "fun",
    good,
    "Concession and excuse velocity.",
    false,
  );

  return picks;
}

/** USGA / WHS Course Handicap. Plus indexes are stored as negative numbers. */
export function courseHandicap(
  handicapIndex: number,
  slope: number,
  rating: number,
  par: number,
): number {
  return Math.round(handicapIndex * (slope / 113) + (rating - par));
}

/** Four-Ball Match Play allowance — USGA / WHS Appendix C. */
export const FOUR_BALL_MATCH_ALLOWANCE = 90;

export function playingHandicap(courseHcp: number, allowancePct = FOUR_BALL_MATCH_ALLOWANCE): number {
  return Math.round(courseHcp * (allowancePct / 100));
}

/**
 * Match-play stroke allocation: the lowest Playing Handicap in the group
 * plays off scratch; everyone else receives the difference (USGA match play).
 */
export function matchPlayOff(playingHandicaps: number[]): number[] {
  if (!playingHandicaps.length) return [];
  const low = Math.min(...playingHandicaps);
  return playingHandicaps.map((h) => h - low);
}

/**
 * Strokes received on a hole. Positive = deducted from gross.
 * Plus handicaps return a negative stroke on the easiest holes (SI 18 first).
 */
export function strokesOnHole(playingHcp: number, strokeIndex: number): number {
  if (playingHcp === 0) return 0;
  if (playingHcp > 0) {
    const full = Math.floor(playingHcp / 18);
    const rem = playingHcp % 18;
    return full + (strokeIndex <= rem ? 1 : 0);
  }
  const plus = -playingHcp;
  const full = Math.floor(plus / 18);
  const rem = plus % 18;
  const easyRank = 19 - strokeIndex;
  return -(full + (easyRank <= rem ? 1 : 0));
}

export function netScore(gross: number, strokes: number): number {
  return gross - strokes;
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  FOUR_BALL_MATCH_ALLOWANCE,
  courseHandicap,
  matchPlayOff,
  playingHandicap,
  strokesOnHole,
} from "./handicap.ts";

test("USGA course handicap: Index × (Slope/113) + (Rating − Par)", () => {
  // 12.4 × 131/113 + (72.9 − 72) = 14.372 + 0.9 = 15.272 → 15
  assert.equal(courseHandicap(12.4, 131, 72.9, 72), 15);
});

test("four-ball match play uses 90% playing handicap", () => {
  assert.equal(FOUR_BALL_MATCH_ALLOWANCE, 90);
  assert.equal(playingHandicap(15), 14);
  assert.equal(playingHandicap(8, 90), 7);
});

test("lowest playing handicap plays off scratch in the match", () => {
  assert.deepEqual(matchPlayOff([14, 11, 7, 18]), [7, 4, 0, 11]);
});

test("strokes fall on the hardest holes by stroke index", () => {
  assert.equal(strokesOnHole(4, 1), 1);
  assert.equal(strokesOnHole(4, 4), 1);
  assert.equal(strokesOnHole(4, 5), 0);
  assert.equal(strokesOnHole(22, 4), 2);
});

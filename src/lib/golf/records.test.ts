import assert from "node:assert/strict";
import test from "node:test";
import { matchHoleTallies } from "./match.ts";

const players = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
const matches = [{ a1: 1, a2: 2, b1: 3, b2: 4, round_id: 9 }];

test("match hole tallies count best-ball holes won and lost", () => {
  const tallies = matchHoleTallies({
    players,
    matches,
    scores: [
      { player_id: 1, round_id: 9, hole_number: 1, net: 3 },
      { player_id: 2, round_id: 9, hole_number: 1, net: 5 },
      { player_id: 3, round_id: 9, hole_number: 1, net: 4 },
      { player_id: 4, round_id: 9, hole_number: 1, net: 4 },
    ],
  });
  const a = tallies.find((t) => t.playerId === 1);
  const b = tallies.find((t) => t.playerId === 3);
  assert.equal(a?.won, 1);
  assert.equal(a?.lost, 0);
  assert.equal(b?.won, 0);
  assert.equal(b?.lost, 1);
});

test("halved holes count for both sides", () => {
  const tallies = matchHoleTallies({
    players,
    matches,
    scores: [
      { player_id: 1, round_id: 9, hole_number: 1, net: 4 },
      { player_id: 2, round_id: 9, hole_number: 1, net: 5 },
      { player_id: 3, round_id: 9, hole_number: 1, net: 4 },
      { player_id: 4, round_id: 9, hole_number: 1, net: 6 },
    ],
  });
  assert.equal(tallies.every((t) => t.halved === 1 && t.won === 0 && t.lost === 0), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { deriveSideFive, sideMargin } from "./sides.ts";

const players = [
  { id: 1, slug: "liam-dunne", side: "a" },
  { id: 2, slug: "zac-novak", side: "a" },
  { id: 3, slug: "seth-young", side: "b" },
  { id: 4, slug: "drew-schneider", side: "b" },
];

const rounds = [{ id: 1, tee_id: 9 }];
const holes = [
  { tee_id: 9, number: 1, par: 4 },
  { tee_id: 9, number: 2, par: 3 },
];

test("5v5 adds each side's net to par", () => {
  const sides = deriveSideFive(
    {
      players,
      rounds,
      holes,
      scores: [
        { round_id: 1, player_id: 1, hole_number: 1, gross: 5, net: 4 },
        { round_id: 1, player_id: 2, hole_number: 1, gross: 4, net: 4 },
        { round_id: 1, player_id: 3, hole_number: 1, gross: 6, net: 5 },
        { round_id: 1, player_id: 4, hole_number: 1, gross: 5, net: 5 },
      ],
    },
    1,
  );
  const a = sides.find((s) => s.side === "a")!;
  const b = sides.find((s) => s.side === "b")!;
  assert.equal(a.netToPar, 0);
  assert.equal(b.netToPar, 2);
  assert.equal(sideMargin(sides), "A by 2");
});

test("unscored side waits instead of inventing a total", () => {
  const sides = deriveSideFive({ players, rounds, holes, scores: [] }, "all");
  assert.equal(sides[0]?.netToPar, null);
  assert.equal(sideMargin(sides), "Waiting on cards");
});

import assert from "node:assert/strict";
import test from "node:test";
import { computeSkins, skinsHoleValue } from "./skins.ts";

const field = [1, 2, 3, 4];
const round = { id: 10, roundNumber: 1, status: "live" };

function hole(n: number, par = 4) {
  return { roundId: 10, roundNumber: 1, hole: n, par, status: "live" };
}

function score(playerId: number, n: number, gross: number) {
  return { roundId: 10, playerId, hole: n, gross };
}

function eighteenHoles() {
  return Array.from({ length: 18 }, (_, i) => hole(i + 1));
}

test("unique lowest gross wins the skin", () => {
  const scores = [
    score(1, 1, 3),
    score(2, 1, 4),
    score(3, 1, 5),
    score(4, 1, 4),
  ];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [round],
    holes: eighteenHoles(),
    scores,
  });
  const h1 = board.holes[0];
  assert.equal(h1.status, "won");
  assert.equal(h1.winnerId, 1);
  assert.equal(h1.skinsAtStake, 1);
  assert.equal(h1.lowScore, 3);
  assert.equal(board.standings[0].playerId, 1);
  assert.equal(board.standings[0].skins, 1);
});

test("ties for low push and nobody wins the hole", () => {
  const scores = [
    score(1, 1, 4),
    score(2, 1, 4),
    score(3, 1, 5),
    score(4, 1, 6),
  ];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [round],
    holes: eighteenHoles(),
    scores,
  });
  const h1 = board.holes[0];
  assert.equal(h1.status, "push");
  assert.equal(h1.winnerId, null);
  assert.deepEqual(h1.tiedPlayerIds.slice().sort(), [1, 2]);
  assert.equal(board.standings.every((s) => s.skins === 0), true);
});

test("pushed skins carry to the next unique winner", () => {
  const scores = [
    score(1, 1, 4),
    score(2, 1, 4),
    score(3, 1, 5),
    score(4, 1, 5),
    score(1, 2, 5),
    score(2, 2, 4),
    score(3, 2, 6),
    score(4, 2, 5),
  ];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [round],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holes[0].status, "push");
  assert.equal(board.holes[1].status, "won");
  assert.equal(board.holes[1].winnerId, 2);
  assert.equal(board.holes[1].skinsAtStake, 2);
  const winner = board.standings.find((s) => s.playerId === 2);
  assert.equal(winner?.skins, 2);
  assert.equal(winner?.holesWon, 1);
});

test("three-hole carry stacks until someone separates", () => {
  const scores = [];
  for (const h of [1, 2, 3]) {
    scores.push(score(1, h, 4), score(2, h, 4), score(3, h, 5), score(4, h, 5));
  }
  scores.push(score(1, 4, 3), score(2, 4, 4), score(3, 4, 4), score(4, 4, 5));
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [round],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holes[3].status, "won");
  assert.equal(board.holes[3].winnerId, 1);
  assert.equal(board.holes[3].skinsAtStake, 4);
  assert.equal(board.longestCarry, 4);
});

test("incomplete field leaves the hole pending", () => {
  const scores = [score(1, 1, 3), score(2, 1, 4), score(3, 1, 5)];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [round],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holes[0].status, "pending");
  assert.equal(board.holes[0].posted, 3);
  assert.equal(board.holes[0].fieldSize, 4);
  assert.equal(board.standings.every((s) => s.skins === 0), true);
});

test("finalized rounds drop players who never posted a card", () => {
  const scores = [
    score(1, 1, 3),
    score(2, 1, 4),
    score(3, 1, 5),
  ];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [{ ...round, status: "finalized" }],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holes[0].status, "won");
  assert.equal(board.holes[0].winnerId, 1);
  assert.equal(board.holes[0].fieldSize, 3);
});

test("pending hole does not provisionally push onto the next hole", () => {
  const scores = [
    score(1, 1, 3),
    score(2, 1, 4),
    // player 3 and 4 missing hole 1
    score(1, 2, 3),
    score(2, 2, 4),
    score(3, 2, 5),
    score(4, 2, 5),
  ];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [round],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holes[0].status, "pending");
  assert.equal(board.holes[1].status, "won");
  assert.equal(board.holes[1].skinsAtStake, 1);
  assert.equal(board.holes[1].winnerId, 1);
});

test("pot splits evenly across every hole of the trip", () => {
  assert.equal(skinsHoleValue(180, 1), 10);
  assert.equal(skinsHoleValue(180, 5), 2);
  const scores = [
    score(1, 1, 3),
    score(2, 1, 4),
    score(3, 1, 5),
    score(4, 1, 4),
  ];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [round],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holeValue, 10);
  assert.equal(board.standings[0].value, 10);
});

test("carried win pays stacked hole values", () => {
  const scores = [
    score(1, 1, 4),
    score(2, 1, 4),
    score(3, 1, 5),
    score(4, 1, 5),
    score(1, 2, 3),
    score(2, 2, 4),
    score(3, 2, 4),
    score(4, 2, 5),
  ];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [round],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holes[1].value, 20);
  assert.equal(board.awardedValue, 20);
});

test("round-to-round carry when 18 pushes into the next round", () => {
  const holes = [
    ...Array.from({ length: 18 }, (_, i) => ({
      roundId: 10,
      roundNumber: 1,
      hole: i + 1,
      par: 4,
      status: "finalized",
    })),
    ...Array.from({ length: 18 }, (_, i) => ({
      roundId: 11,
      roundNumber: 2,
      hole: i + 1,
      par: 4,
      status: "live",
    })),
  ];
  const scores = [];
  for (let n = 1; n <= 18; n += 1) {
    scores.push(score(1, n, 4), score(2, n, 4), score(3, n, 5), score(4, n, 5));
  }
  scores.push(
    { roundId: 11, playerId: 1, hole: 1, gross: 3 },
    { roundId: 11, playerId: 2, hole: 1, gross: 4 },
    { roundId: 11, playerId: 3, hole: 1, gross: 4 },
    { roundId: 11, playerId: 4, hole: 1, gross: 5 },
  );
  const board = computeSkins({
    pot: 360,
    fieldIds: field,
    rounds: [
      { id: 10, roundNumber: 1, status: "finalized" },
      { id: 11, roundNumber: 2, status: "live" },
    ],
    holes,
    scores,
  });
  const r2h1 = board.holes.find((h) => h.roundId === 11 && h.hole === 1);
  assert.equal(r2h1?.status, "won");
  assert.equal(r2h1?.skinsAtStake, 19);
  assert.equal(r2h1?.winnerId, 1);
});

test("pushed skin sits on the next hole until someone wins it", () => {
  const scores = [
    score(1, 1, 4),
    score(2, 1, 4),
    score(3, 1, 5),
    score(4, 1, 5),
  ];
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [{ ...round, status: "finalized" }],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holes[0].status, "push");
  assert.equal(board.holes[1].status, "pending");
  assert.equal(board.holes[1].skinsAtStake, 2);
  assert.equal(board.awardedValue, 0);
  assert.equal(board.standings.every((s) => s.skins === 0), true);
});

test("a fully pushed round leaves the whole pot unclaimed", () => {
  const scores = [];
  for (let n = 1; n <= 18; n += 1) {
    scores.push(score(1, n, 4), score(2, n, 4), score(3, n, 5), score(4, n, 5));
  }
  const board = computeSkins({
    pot: 180,
    fieldIds: field,
    rounds: [{ ...round, status: "finalized" }],
    holes: eighteenHoles(),
    scores,
  });
  assert.equal(board.holes.every((h) => h.status === "push"), true);
  assert.equal(board.leftoverSkins, 18);
  assert.equal(board.awardedValue, 0);
  assert.equal(board.leftoverValue, 180);
});

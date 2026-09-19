import assert from "node:assert/strict";
import test from "node:test";
import { computeRotatingVegas, computeVegas } from "./match.ts";

test("locked 2v2 vegas accumulates the swing", () => {
  const standing = computeVegas([
    {
      aNets: [4, 5],
      bNets: [4, 5],
      aBirdie: false,
      bBirdie: false,
      aEagle: false,
      bEagle: false,
    },
    {
      aNets: [3, 5],
      bNets: [4, 5],
      aBirdie: true,
      bBirdie: false,
      aEagle: false,
      bEagle: false,
    },
  ]);
  assert.equal(standing.thru, 2);
  assert.equal(standing.leader, "A");
  assert.equal(standing.holesUp, 19);
  assert.equal(standing.result, "A 19");
});

test("rotating vegas re-pairs each hole and books individual points", () => {
  const names = (id: number) => ({ 1: "Seth", 2: "Mike", 3: "Tom", 4: "Jed" }[id] ?? "?");
  const standing = computeRotatingVegas(
    [1, 2, 3, 4],
    [
      {
        a1: 1,
        a2: 2,
        b1: 3,
        b2: 4,
        nets: { 1: 4, 2: 5, 3: 4, 4: 5 },
        birdie: { 1: false, 2: false, 3: false, 4: false },
        eagle: { 1: false, 2: false, 3: false, 4: false },
      },
      {
        a1: 1,
        a2: 3,
        b1: 2,
        b2: 4,
        nets: { 1: 3, 2: 4, 3: 5, 4: 5 },
        birdie: { 1: true, 2: false, 3: false, 4: false },
        eagle: { 1: false, 2: false, 3: false, 4: false },
      },
    ],
    names,
  );
  // Hole 1 even. Hole 2: A 35 vs flipped B 54 → +19 to 1 and 3, −19 to 2 and 4.
  assert.equal(standing.thru, 2);
  assert.equal(standing.points.get(1), 19);
  assert.equal(standing.points.get(3), 19);
  assert.equal(standing.points.get(2), -19);
  assert.equal(standing.points.get(4), -19);
  assert.equal(standing.result, "Seth 19 · Tom 19 · Mike -19 · Jed -19");
});

test("rotating vegas stops at the first hole without a split", () => {
  const standing = computeRotatingVegas([1, 2, 3, 4], [
    {
      a1: 1,
      a2: 2,
      b1: 3,
      b2: 4,
      nets: { 1: 4, 2: 4, 3: 5, 4: 5 },
      birdie: { 1: false, 2: false, 3: false, 4: false },
      eagle: { 1: false, 2: false, 3: false, 4: false },
    },
    null,
  ]);
  assert.equal(standing.thru, 1);
  assert.equal(standing.points.get(1), 11);
  assert.equal(standing.closed, false);
});

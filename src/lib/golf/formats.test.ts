import assert from "node:assert/strict";
import test from "node:test";
import {
  allowanceForFormat,
  defaultFormatForSize,
  foursomesTeamHandicap,
  isInterMatch,
  isRotatingVegas,
  scrambleTeamHandicap,
  strokeDotsOnHole,
  teamPlayingHandicap,
  teeLabel,
  vegasCombine,
  vegasFlip,
  vegasHoleResult,
  wolfOfHole,
} from "./formats.ts";

test("four-ball and vegas allowance is 90; wolf/alternate/scramble freeze at 100", () => {
  assert.equal(allowanceForFormat("fourball"), 90);
  assert.equal(allowanceForFormat("vegas"), 90);
  assert.equal(allowanceForFormat("wolf"), 100);
  assert.equal(allowanceForFormat("alternate"), 100);
  assert.equal(allowanceForFormat("scramble"), 100);
});

test("foursomes team handicap is 50% of combined course handicaps", () => {
  assert.equal(foursomesTeamHandicap(12, 8), 10);
  assert.equal(foursomesTeamHandicap(15, 10), 13);
});

test("scramble team handicap is 35% low + 15% high", () => {
  // 0.35*8 + 0.15*14 = 2.8 + 2.1 = 4.9 → 5
  assert.equal(scrambleTeamHandicap(8, 14), 5);
  assert.equal(scrambleTeamHandicap(14, 8), 5);
});

test("team playing handicap routes by format", () => {
  assert.equal(teamPlayingHandicap("alternate", 12, 8), 10);
  assert.equal(teamPlayingHandicap("scramble", 8, 14), 5);
});

test("wolf rotates every hole", () => {
  assert.equal(wolfOfHole([1, 2, 3], 1), 1);
  assert.equal(wolfOfHole([1, 2, 3], 2), 2);
  assert.equal(wolfOfHole([1, 2, 3], 3), 3);
  assert.equal(wolfOfHole([1, 2, 3], 4), 1);
  assert.equal(wolfOfHole([1, 2, 3], 18), 3);
});

test("stroke dots follow stroke index", () => {
  assert.equal(strokeDotsOnHole(4, 1), 1);
  assert.equal(strokeDotsOnHole(4, 5), 0);
  assert.equal(strokeDotsOnHole(22, 4), 2);
  assert.equal(strokeDotsOnHole(0, 1), 0);
});

test("three-man groups default to wolf; pairs skip wolf", () => {
  assert.equal(defaultFormatForSize(3, "fourball"), "wolf");
  assert.equal(defaultFormatForSize(2, "wolf"), "fourball");
  assert.equal(defaultFormatForSize(2, "vegas"), "vegas");
  assert.equal(defaultFormatForSize(4, "scramble"), "scramble");
});

test("vegas combines low digit first", () => {
  assert.equal(vegasCombine(4, 5), 45);
  assert.equal(vegasCombine(5, 4), 45);
  assert.equal(vegasCombine(3, 3), 33);
});

test("vegas flip reverses the digits", () => {
  assert.equal(vegasFlip(45), 54);
  assert.equal(vegasFlip(33), 33);
  assert.equal(vegasFlip(54), 45);
});

test("vegas birdie reverses the other side; eagle doubles the swing", () => {
  const even = vegasHoleResult({
    aNets: [4, 5],
    bNets: [4, 5],
    aBirdie: false,
    bBirdie: false,
    aEagle: false,
    bEagle: false,
  });
  assert.equal(even.aNumber, 45);
  assert.equal(even.bNumber, 45);
  assert.equal(even.aPoints, 0);

  const birdie = vegasHoleResult({
    aNets: [3, 5],
    bNets: [4, 5],
    aBirdie: true,
    bBirdie: false,
    aEagle: false,
    bEagle: false,
  });
  // A 35 vs flipped B 54 → A wins 19
  assert.equal(birdie.aNumber, 35);
  assert.equal(birdie.bNumber, 54);
  assert.equal(birdie.aPoints, 19);

  const eagle = vegasHoleResult({
    aNets: [2, 5],
    bNets: [4, 5],
    aBirdie: true,
    bBirdie: false,
    aEagle: true,
    bEagle: false,
  });
  // A 25 vs flipped B 54 = 29, doubled → 58
  assert.equal(eagle.aNumber, 25);
  assert.equal(eagle.bNumber, 54);
  assert.equal(eagle.aPoints, 58);
});

test("in-tee 4-man vegas rotates; inter-tee vegas is locked", () => {
  assert.equal(isRotatingVegas("vegas", { kind: "group", group_id: 1, a2: 2, b1: 3, b2: 4 }), true);
  assert.equal(isRotatingVegas("vegas", { kind: "inter", group_id: null, a2: 2, b1: 3, b2: 4 }), false);
  assert.equal(isRotatingVegas("fourball", { kind: "group", group_id: 1, a2: 2, b1: 3, b2: 4 }), false);
  assert.equal(isInterMatch({ kind: "inter", group_id: null }), true);
  assert.equal(isInterMatch({ kind: "group", group_id: 1 }), false);
});

test("tee label prefers the time Seth typed", () => {
  assert.equal(teeLabel(1, "8:12 AM"), "Tee 1 · 8:12 AM");
  assert.equal(teeLabel(2, "  "), "Tee 2");
  assert.equal(teeLabel(3, null), "Tee 3");
});

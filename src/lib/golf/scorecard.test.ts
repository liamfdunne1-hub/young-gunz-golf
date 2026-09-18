import assert from "node:assert/strict";
import test from "node:test";
import {
  blankScorecard,
  duplicateStrokeIndexes,
  scorecardTotals,
  validateScorecard,
} from "./scorecard.ts";

test("blank cards wait for yardages before they are legal", () => {
  const card = blankScorecard();
  assert.equal(card.length, 18);
  assert.equal(card[17].strokeIndex, 18);
  assert.match(validateScorecard(card) ?? "", /yardage/);
});

test("filled sequential card is a par 72", () => {
  const card = blankScorecard().map((h) => ({ ...h, yardage: 400 }));
  assert.equal(validateScorecard(card), null);
  const t = scorecardTotals(card);
  assert.equal(t.total.par, 72);
  assert.equal(t.front.par, 36);
  assert.equal(t.back.yards, 3600);
});

test("duplicate stroke indexes fail and are listed", () => {
  const card = blankScorecard().map((h) => ({ ...h, yardage: 400 }));
  card[1] = { ...card[1], strokeIndex: 1 };
  assert.match(validateScorecard(card) ?? "", /Stroke indexes/);
  assert.deepEqual([...duplicateStrokeIndexes(card)].sort(), [1]);
});

test("par and yardage bounds", () => {
  const card = blankScorecard().map((h) => ({ ...h, yardage: 400 }));
  card[0] = { ...card[0], par: 2 };
  assert.match(validateScorecard(card) ?? "", /par/);
  card[0] = { ...card[0], par: 4, yardage: 10 };
  assert.match(validateScorecard(card) ?? "", /yardage/);
});

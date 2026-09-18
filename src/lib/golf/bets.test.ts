import assert from "node:assert/strict";
import test from "node:test";
import { netFromTransfers, settleMatchBet } from "./bets.ts";

test("winning side collects $20 a man, losers pay $20 a man", () => {
  const xfer = settleMatchBet({ a1: 1, a2: 2, b1: 3, b2: 4, winner: "A", stake: 20 });
  assert.equal(xfer.length, 4);
  assert.equal(netFromTransfers(1, xfer), 20);
  assert.equal(netFromTransfers(2, xfer), 20);
  assert.equal(netFromTransfers(3, xfer), -20);
  assert.equal(netFromTransfers(4, xfer), -20);
});

test("halved match is a push", () => {
  assert.deepEqual(settleMatchBet({ a1: 1, a2: 2, b1: 3, b2: 4, winner: null, stake: 20 }), []);
});

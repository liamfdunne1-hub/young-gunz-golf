/** Automatic 2v2 match bets posted from pairings. No house, no rake. */

export const DEFAULT_MATCH_STAKE = 20;

export type MatchBetTransfer = {
  fromPlayerId: number;
  toPlayerId: number;
  amount: number;
};

/**
 * Each player on the losing side pays `stake`. That pot is split evenly
 * across the two winners. A halved match is a push — nothing moves.
 */
export function settleMatchBet(args: {
  a1: number;
  a2: number;
  b1: number;
  b2: number;
  winner: "A" | "B" | null;
  stake: number;
}): MatchBetTransfer[] {
  if (!args.winner || !(args.stake > 0)) return [];
  const winners = args.winner === "A" ? [args.a1, args.a2] : [args.b1, args.b2];
  const losers = args.winner === "A" ? [args.b1, args.b2] : [args.a1, args.a2];
  const share = args.stake / winners.length;
  const out: MatchBetTransfer[] = [];
  for (const fromPlayerId of losers) {
    for (const toPlayerId of winners) {
      out.push({ fromPlayerId, toPlayerId, amount: share });
    }
  }
  return out;
}

export function netFromTransfers(playerId: number, transfers: MatchBetTransfer[]): number {
  let n = 0;
  for (const t of transfers) {
    if (t.toPlayerId === playerId) n += t.amount;
    if (t.fromPlayerId === playerId) n -= t.amount;
  }
  return n;
}

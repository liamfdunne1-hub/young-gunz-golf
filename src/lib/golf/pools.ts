/** Participant-funded pari-mutuel. No house, no rake, no vig. */

export type PoolSlice = {
  selectionId: number;
  label: string;
  amount: number;
};

export function poolSummary(total: number, slices: PoolSlice[]) {
  return slices.map((s) => {
    const pct = total > 0 ? s.amount / total : 0;
    const returnPerDollar = s.amount > 0 ? total / s.amount : 0;
    return { ...s, pct, returnPerDollar };
  });
}

/**
 * Individual distribution =
 *   contribution ÷ total on winning selection × total pool
 */
export function settlePool(args: {
  totalPool: number;
  winningTotal: number;
  contribution: number;
}): number {
  if (args.winningTotal <= 0) return 0;
  return (args.contribution / args.winningTotal) * args.totalPool;
}

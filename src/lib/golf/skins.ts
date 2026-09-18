/** Gross skins. Lowest score on the hole, full field. Ties push. No gambling mix. */

export const DEFAULT_SKINS_POT = 180;
export const HOLES_PER_ROUND = 18;

export type SkinStatus = "pending" | "won" | "push";

export type SkinHoleInput = {
  roundId: number;
  roundNumber: number;
  hole: number;
  par: number;
  status: string;
};

export type SkinScoreInput = {
  roundId: number;
  playerId: number;
  hole: number;
  gross: number;
};

export type SkinHole = {
  roundId: number;
  roundNumber: number;
  hole: number;
  par: number;
  status: SkinStatus;
  winnerId: number | null;
  lowScore: number | null;
  tiedPlayerIds: number[];
  posted: number;
  fieldSize: number;
  skinsAtStake: number;
  value: number;
  scores: { playerId: number; gross: number }[];
};

export type SkinStanding = {
  playerId: number;
  skins: number;
  holesWon: number;
  value: number;
};

export type SkinsBoard = {
  pot: number;
  holeValue: number;
  totalHoles: number;
  holes: SkinHole[];
  standings: SkinStanding[];
  leftoverSkins: number;
  leftoverValue: number;
  awardedValue: number;
  pendingSkins: number;
  pendingValue: number;
  longestCarry: number;
};

export function skinsHoleValue(pot: number, roundCount: number): number {
  const holes = Math.max(1, roundCount) * HOLES_PER_ROUND;
  if (!(pot > 0)) return 0;
  return pot / holes;
}

function fieldForRound(args: {
  fieldIds: number[];
  roundId: number;
  roundStatus: string;
  scores: SkinScoreInput[];
}): number[] {
  if (args.roundStatus === "finalized") {
    const played = new Set(
      args.scores.filter((s) => s.roundId === args.roundId).map((s) => s.playerId),
    );
    const present = args.fieldIds.filter((id) => played.has(id));
    return present.length >= 2 ? present : args.fieldIds;
  }
  return args.fieldIds;
}

/**
 * Award gross skins hole-by-hole across the trip.
 * Unique lowest gross wins the hole (plus any carry). Two or more tied for
 * low → push, skins carry to the next hole. Incomplete field → pending.
 */
export function computeSkins(args: {
  pot: number;
  fieldIds: number[];
  rounds: { id: number; roundNumber: number; status: string }[];
  holes: SkinHoleInput[];
  scores: SkinScoreInput[];
}): SkinsBoard {
  const rounds = [...args.rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const totalHoles = Math.max(1, rounds.length) * HOLES_PER_ROUND;
  const holeValue = skinsHoleValue(args.pot, rounds.length || 1);
  const board: SkinHole[] = [];
  let carry = 0;

  for (const round of rounds) {
    const field = fieldForRound({
      fieldIds: args.fieldIds,
      roundId: round.id,
      roundStatus: round.status,
      scores: args.scores,
    });
    for (let n = 1; n <= HOLES_PER_ROUND; n += 1) {
      const meta = args.holes.find((h) => h.roundId === round.id && h.hole === n);
      const posted = args.scores
        .filter((s) => s.roundId === round.id && s.hole === n && field.includes(s.playerId))
        .map((s) => ({ playerId: s.playerId, gross: s.gross }));
      const skinsAtStake = carry + 1;
      const value = skinsAtStake * holeValue;
      const complete = field.length >= 2 && posted.length >= field.length;

      if (!complete) {
        board.push({
          roundId: round.id,
          roundNumber: round.roundNumber,
          hole: n,
          par: meta?.par ?? 4,
          status: "pending",
          winnerId: null,
          lowScore: posted.length ? Math.min(...posted.map((s) => s.gross)) : null,
          tiedPlayerIds: [],
          posted: posted.length,
          fieldSize: field.length,
          skinsAtStake,
          value,
          scores: posted,
        });
        // Pending does not push. Carry stays on this hole until it resolves.
        carry = 0;
        continue;
      }

      const low = Math.min(...posted.map((s) => s.gross));
      const tied = posted.filter((s) => s.gross === low).map((s) => s.playerId);
      if (tied.length === 1) {
        board.push({
          roundId: round.id,
          roundNumber: round.roundNumber,
          hole: n,
          par: meta?.par ?? 4,
          status: "won",
          winnerId: tied[0],
          lowScore: low,
          tiedPlayerIds: tied,
          posted: posted.length,
          fieldSize: field.length,
          skinsAtStake,
          value,
          scores: posted,
        });
        carry = 0;
      } else {
        board.push({
          roundId: round.id,
          roundNumber: round.roundNumber,
          hole: n,
          par: meta?.par ?? 4,
          status: "push",
          winnerId: null,
          lowScore: low,
          tiedPlayerIds: tied,
          posted: posted.length,
          fieldSize: field.length,
          skinsAtStake,
          value,
          scores: posted,
        });
        carry = skinsAtStake;
      }
    }
  }

  const byPlayer = new Map<number, SkinStanding>();
  for (const id of args.fieldIds) {
    byPlayer.set(id, { playerId: id, skins: 0, holesWon: 0, value: 0 });
  }
  let awardedValue = 0;
  let pendingSkins = 0;
  let pendingValue = 0;
  let longestCarry = 0;
  for (const hole of board) {
    longestCarry = Math.max(longestCarry, hole.skinsAtStake);
    if (hole.status === "won" && hole.winnerId != null) {
      const row = byPlayer.get(hole.winnerId) ?? {
        playerId: hole.winnerId,
        skins: 0,
        holesWon: 0,
        value: 0,
      };
      row.skins += hole.skinsAtStake;
      row.holesWon += 1;
      row.value += hole.value;
      byPlayer.set(hole.winnerId, row);
      awardedValue += hole.value;
    } else if (hole.status === "pending") {
      pendingSkins += hole.skinsAtStake;
      pendingValue += hole.value;
    }
  }

  const leftoverSkins = carry;
  const leftoverValue = leftoverSkins * holeValue;

  const standings = [...byPlayer.values()].sort((a, b) => {
    if (b.skins !== a.skins) return b.skins - a.skins;
    if (b.value !== a.value) return b.value - a.value;
    return a.playerId - b.playerId;
  });

  return {
    pot: args.pot,
    holeValue,
    totalHoles,
    holes: board,
    standings,
    leftoverSkins,
    leftoverValue,
    awardedValue,
    pendingSkins,
    pendingValue,
    longestCarry,
  };
}

export type ScorecardHole = {
  number: number;
  par: number;
  yardage: number;
  strokeIndex: number;
};

export function blankScorecard(): ScorecardHole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: 4,
    yardage: 0,
    strokeIndex: i + 1,
  }));
}

export function scorecardTotals(holes: ScorecardHole[]) {
  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number >= 10);
  const sum = (rows: ScorecardHole[]) => ({
    par: rows.reduce((s, h) => s + h.par, 0),
    yards: rows.reduce((s, h) => s + h.yardage, 0),
  });
  return { front: sum(front), back: sum(back), total: sum(holes) };
}

export function duplicateStrokeIndexes(holes: ScorecardHole[]): Set<number> {
  const counts = new Map<number, number>();
  for (const h of holes) {
    counts.set(h.strokeIndex, (counts.get(h.strokeIndex) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, n]) => n > 1).map(([si]) => si),
  );
}

export function validateScorecard(holes: ScorecardHole[]): string | null {
  if (holes.length !== 18) return "Eighteen holes. This is golf.";
  const numbers = holes.map((h) => h.number).sort((a, b) => a - b);
  for (let i = 0; i < 18; i++) {
    if (numbers[i] !== i + 1) return "Holes must be numbered 1 through 18.";
  }
  const indexes = holes.map((h) => h.strokeIndex);
  const unique = new Set(indexes);
  if (unique.size !== 18) return "Stroke indexes must be 1 through 18 with no duplicates.";
  for (const h of holes) {
    if (h.strokeIndex < 1 || h.strokeIndex > 18) return `Hole ${h.number}: stroke index must be 1–18.`;
    if (h.par < 3 || h.par > 6) return `Hole ${h.number}: par must be 3–6.`;
    if (h.yardage < 50 || h.yardage > 800) return `Hole ${h.number}: yardage looks wrong.`;
  }
  return null;
}

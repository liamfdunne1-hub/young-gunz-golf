const KEY = "yg-score-queue";

export type PendingScore = {
  roundId: number;
  playerId: number;
  hole: number;
  gross: number;
};

export function readScoreQueue(): PendingScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingScore[]) : [];
  } catch {
    return [];
  }
}

export function enqueueScore(entry: PendingScore) {
  const next = readScoreQueue().filter(
    (e) => !(e.roundId === entry.roundId && e.playerId === entry.playerId && e.hole === entry.hole),
  );
  next.push(entry);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function writeScoreQueue(entries: PendingScore[]) {
  window.localStorage.setItem(KEY, JSON.stringify(entries));
}

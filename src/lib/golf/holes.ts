import type { Bootstrap } from "@/lib/golf/derive";
import { playerName } from "@/lib/utils";

function nameOf(data: Bootstrap, id: number | null | undefined): string {
  if (id == null) return "nobody";
  const p = data.players.find((x) => x.id === id);
  return p ? playerName(p) : "nobody";
}

export function holesForDay(data: Bootstrap, day: string) {
  const rounds = data.rounds.filter((r) => r.date === day);
  const roundIds = new Set(rounds.map((r) => r.id));
  const scores = data.scores.filter((s) => roundIds.has(s.round_id) && s.gross != null);
  const disasters: { name: string; hole: number; gross: number }[] = [];
  const heroes: { name: string; hole: number; gross: number }[] = [];
  for (const s of scores) {
    const gross = s.gross ?? 0;
    const bit = { name: nameOf(data, s.player_id), hole: s.hole, gross };
    if (gross >= 6) disasters.push(bit);
    if (gross <= 3) heroes.push(bit);
  }
  disasters.sort((a, b) => b.gross - a.gross);
  heroes.sort((a, b) => a.gross - b.gross);
  return { disasters: disasters.slice(0, 6), heroes: heroes.slice(0, 6) };
}

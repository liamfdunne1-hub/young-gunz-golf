import type { recapFacts } from "@/lib/golf/recap";

export function fakeQuotes(facts: ReturnType<typeof recapFacts>): string[] {
  const bank = [
    (d: { name: string; hole: number; gross: number }) =>
      `${d.name} walked off ${d.hole} with a ${d.gross} looking like he\u2019d been caught cheating on a diet. \u201cThat pin is bullshit,\u201d he said. The pin was innocent. ${d.name} was not.`,
    (d: { name: string; hole: number; gross: number }) =>
      `${d.name} flushed a provisional on ${d.hole}, posted a ${d.gross}, and muttered \u201cthat\u2019s good.\u201d Nobody conceded shit. The hole already had his lunch money.`,
    (d: { name: string; hole: number; gross: number }) =>
      `On ${d.hole} ${d.name} blamed \u201cwind\u201d after a ${d.gross}. There was no wind. There was a beer, a snap-hook, and a man lying to his friends.`,
  ];
  const picks = facts.disasters.slice(0, 3);
  if (!picks.length && facts.blowUp) {
    return [
      `${facts.blowUp.name} stared at a ${facts.blowUp.score} and said it never happens at his home course. Home course is a fairy tale he tells after the third IPA.`,
    ];
  }
  return picks.map((d, i) => bank[i % bank.length](d));
}

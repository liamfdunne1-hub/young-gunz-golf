type RecapBits = {
  disasters: { name: string; hole: number; gross: number }[];
  blowUp: { name: string; score: number | null } | null;
};

export function fakeQuotes(facts: RecapBits): string[] {
  const bank = [
    (d: { name: string; hole: number; gross: number }) =>
      `${d.name} walked off ${d.hole} with a ${d.gross} looking like he'd been caught. "That pin is bullshit," he said. The pin was innocent. ${d.name} was not.`,
    (d: { name: string; hole: number; gross: number }) =>
      `${d.name} flushed a provisional on ${d.hole}, posted a ${d.gross}, and muttered "that's good." Nobody conceded shit.`,
    (d: { name: string; hole: number; gross: number }) =>
      `On ${d.hole} ${d.name} blamed "wind" after a ${d.gross}. There was no wind. There was a beer and a snap-hook.`,
  ];
  const picks = facts.disasters.slice(0, 3);
  if (!picks.length && facts.blowUp) {
    return [
      `${facts.blowUp.name} stared at a ${facts.blowUp.score} and said it never happens at his home course. Home course is a fairy tale after the third IPA.`,
    ];
  }
  return picks.map((d, i) => bank[i % bank.length](d));
}

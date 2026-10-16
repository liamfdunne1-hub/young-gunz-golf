/** Trip sides. Plus indexes are stored negative (Zac +2.2 is -2.2). */
export type Side = "a" | "b";

export type RosterSpot = {
  slug: string;
  index: number;
  side: Side;
  order: number;
};

export const ROSTER: RosterSpot[] = [
  { slug: "liam-dunne", index: 7.5, side: "a", order: 1 },
  { slug: "zac-novak", index: -2.2, side: "a", order: 2 },
  { slug: "robert-robinson", index: 6.9, side: "a", order: 3 },
  { slug: "john-v", index: 5.2, side: "a", order: 4 },
  { slug: "addison-shelton", index: 1.6, side: "a", order: 5 },
  { slug: "seth-young", index: 4.6, side: "b", order: 1 },
  { slug: "drew-schneider", index: 1.0, side: "b", order: 2 },
  { slug: "jw", index: 6.3, side: "b", order: 3 },
  { slug: "nick-prell", index: 2.1, side: "b", order: 4 },
  { slug: "kyle-longacre", index: 4.3, side: "b", order: 5 },
];

export const SIDE_LABEL: Record<Side, string> = {
  a: "Side A",
  b: "Side B",
};

export function spotOf(slug: string): RosterSpot | undefined {
  return ROSTER.find((r) => r.slug === slug);
}

export function playersOnSide<T extends { slug: string; side?: string | null }>(
  players: T[],
  side: Side,
): T[] {
  const order = new Map(ROSTER.filter((r) => r.side === side).map((r) => [r.slug, r.order]));
  return players
    .filter((p) => (p.side ?? spotOf(p.slug)?.side) === side)
    .sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));
}

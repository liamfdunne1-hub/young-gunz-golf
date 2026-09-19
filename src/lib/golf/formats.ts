import { playingHandicap, strokesOnHole } from "./handicap.ts";

export const ROUND_FORMATS = ["fourball", "alternate", "scramble", "wolf", "vegas"] as const;
export type RoundFormat = (typeof ROUND_FORMATS)[number];

export const GROUP_SHAPES = ["foursomes", "pairs"] as const;
export type GroupShape = (typeof GROUP_SHAPES)[number];

export const MATCH_KINDS = ["group", "inter"] as const;
export type MatchKind = (typeof MATCH_KINDS)[number];

export const MAX_GROUPS = 5;

export const FORMAT_LABEL: Record<RoundFormat, string> = {
  fourball: "Two-man best ball",
  alternate: "Alternate shot",
  scramble: "Two-man scramble",
  wolf: "Wolf",
  vegas: "Vegas",
};

export const FORMAT_DETAIL: Record<RoundFormat, string> = {
  fourball: "Net four-ball. 90% of course handicap, play off the low man. Best net of the pair wins the hole.",
  alternate: "Foursomes. One ball, partners alternate shots. Team handicap is 50% of combined course handicaps.",
  scramble: "Two-man scramble. Team handicap is 35% of the lower course handicap plus 15% of the higher.",
  wolf: "Three-man Wolf. Own balls, net match play at 100%. Wolf rotates. Pick a partner or go lone wolf.",
  vegas:
    "Own balls. In a tee time, partners re-form every hole from where the drives land. Combine the two net scores (low first). Birdie reverses the other side. Eagle doubles the swing. USGA 90%. An inter-tee match locks partners for 18.",
};

export const SHAPE_LABEL: Record<GroupShape, string> = {
  foursomes: "4-3-3 · three tee times",
  pairs: "2-2-2-2-2 · five tee times",
};

export const SHAPE_DETAIL: Record<GroupShape, string> = {
  foursomes: "Tee times of a foursome and two threesomes. The game inside a tee time is separate from an inter-tee match.",
  pairs: "Five tee times of two. Each pair plays its own game. Inter-tee matches are posted separately.",
};

export const SHAPE_SIZES: Record<GroupShape, number[]> = {
  foursomes: [4, 3, 3],
  pairs: [2, 2, 2, 2, 2],
};

/** WHS / USGA Appendix C individual allowance used when freezing player handicaps. */
export function allowanceForFormat(format: RoundFormat): number {
  if (format === "fourball" || format === "vegas") return 90;
  return 100;
}

export function isRoundFormat(value: string | null | undefined): value is RoundFormat {
  return ROUND_FORMATS.includes(value as RoundFormat);
}

export function asFormat(value: string | null | undefined, fallback: RoundFormat = "fourball"): RoundFormat {
  return isRoundFormat(value) ? value : fallback;
}

export function isGroupShape(value: string | null | undefined): value is GroupShape {
  return GROUP_SHAPES.includes(value as GroupShape);
}

export function asShape(value: string | null | undefined, fallback: GroupShape = "foursomes"): GroupShape {
  return isGroupShape(value) ? value : fallback;
}

export function asKind(value: string | null | undefined, fallback: MatchKind = "group"): MatchKind {
  return value === "inter" || value === "group" ? value : fallback;
}

export function isInterMatch(m: { kind?: string | null; group_id?: number | null }): boolean {
  if (m.kind === "inter") return true;
  if (m.kind === "group") return false;
  return m.group_id == null;
}

/** In-tee 4-man Vegas: partners come from the landing, every hole. Inter-tee Vegas locks 2v2. */
export function isRotatingVegas(
  format: RoundFormat,
  m: { kind?: string | null; group_id?: number | null; a2?: number | null; b1?: number | null; b2?: number | null },
): boolean {
  return isVegas(format) && Boolean(m.a2 && m.b1 && m.b2) && !isInterMatch(m);
}

export function teeLabel(groupNumber: number, teeTime?: string | null): string {
  const t = teeTime?.trim();
  return t ? `Tee ${groupNumber} · ${t}` : `Tee ${groupNumber}`;
}

/** Foursomes match play: 50% of combined course handicaps. */
export function foursomesTeamHandicap(ch1: number, ch2: number): number {
  return Math.round(0.5 * (ch1 + ch2));
}

/** Two-person scramble: 35% of the lower CH + 15% of the higher CH. */
export function scrambleTeamHandicap(ch1: number, ch2: number): number {
  const low = Math.min(ch1, ch2);
  const high = Math.max(ch1, ch2);
  return Math.round(0.35 * low + 0.15 * high);
}

export function teamPlayingHandicap(format: RoundFormat, ch1: number, ch2: number): number {
  if (format === "alternate") return foursomesTeamHandicap(ch1, ch2);
  if (format === "scramble") return scrambleTeamHandicap(ch1, ch2);
  return playingHandicap(Math.round((ch1 + ch2) / 2), 90);
}

export function isTeamFormat(format: RoundFormat): boolean {
  return format === "alternate" || format === "scramble";
}

export function isVegas(format: RoundFormat): boolean {
  return format === "vegas";
}

export function formatsForGroupSize(n: number): RoundFormat[] {
  if (n === 3) return ["wolf"];
  if (n === 2 || n === 4) return ["fourball", "alternate", "scramble", "vegas"];
  return [];
}

export function defaultFormatForSize(n: number, roundFormat: RoundFormat): RoundFormat {
  const allowed = formatsForGroupSize(n);
  if (allowed.includes(roundFormat)) return roundFormat;
  if (n === 3) return "wolf";
  return "fourball";
}

/** Wolf of the hole, rotating in group order. */
export function wolfOfHole(playerIds: number[], hole: number): number {
  if (!playerIds.length) return 0;
  return playerIds[(hole - 1) % playerIds.length]!;
}

export function strokeDotsOnHole(playingHcp: number, strokeIndex: number): number {
  const n = strokesOnHole(playingHcp, strokeIndex);
  return n > 0 ? n : 0;
}

/** Combine two hole scores into a Vegas number. Lower score is the tens digit. */
export function vegasCombine(a: number, b: number): number {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return 10 * low + high;
}

/** Reverse the digits — the birdie/eagle penalty on the other side. */
export function vegasFlip(n: number): number {
  return 10 * (n % 10) + Math.floor(n / 10);
}

export function vegasHoleResult(args: {
  aNets: [number, number];
  bNets: [number, number];
  aBirdie: boolean;
  bBirdie: boolean;
  aEagle: boolean;
  bEagle: boolean;
}): { aNumber: number; bNumber: number; aPoints: number } {
  let a = vegasCombine(args.aNets[0], args.aNets[1]);
  let b = vegasCombine(args.bNets[0], args.bNets[1]);
  if (args.aBirdie || args.aEagle) b = vegasFlip(b);
  if (args.bBirdie || args.bEagle) a = vegasFlip(a);
  let aPoints = b - a;
  if (args.aEagle || args.bEagle) aPoints *= 2;
  return { aNumber: a, bNumber: b, aPoints };
}

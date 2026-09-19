type HoleBit = { name: string; hole: number; gross: number };

type RecapBits = {
  disasters: HoleBit[];
  heroes?: HoleBit[];
  blowUp: { name: string; score: number | null } | null;
};

export function fakeQuotes(facts: RecapBits): string[] {
  const out: string[] = [];
  const bad = facts.disasters[0];
  const worse = facts.disasters[1];
  const good = facts.heroes?.[0];
  const jabber = facts.heroes?.[1]?.name || facts.disasters[2]?.name;

  if (good) {
    out.push(
      `${good.name} on ${good.hole} after a ${good.gross}: "That's how a man hits it." He said this to nobody, then immediately three-putted the next one.`,
    );
  }
  if (bad) {
    const speaker = jabber && jabber !== bad.name ? jabber : "the group";
    out.push(
      `${speaker} watching ${bad.name} post a ${bad.gross} on ${bad.hole}: "My mother-in-law could have gotten that airborne." ${bad.name} blamed the wind. There was no wind.`,
    );
  }
  if (worse) {
    out.push(
      `${worse.name} on ${worse.hole} after a ${worse.gross}: "That's good." Nobody picked it up. The hole already had his balls in its pocket.`,
    );
  }
  if (!out.length && facts.blowUp) {
    out.push(
      `${facts.blowUp.name} after a ${facts.blowUp.score}: "Never happens at home." Home is a rumor.`,
    );
  }
  return out.slice(0, 3);
}

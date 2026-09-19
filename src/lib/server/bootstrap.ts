import { withDb, mapPlayer, type PlayerRow } from "@/lib/server/db";
import { num } from "@/lib/utils";
import { DEFAULT_MATCH_STAKE } from "@/lib/golf/bets";
import { DEFAULT_SKINS_POT } from "@/lib/golf/skins";
import { FOUR_BALL_MATCH_ALLOWANCE } from "@/lib/golf/handicap";
import { asFormat, asShape, asKind } from "@/lib/golf/formats";

export async function loadBootstrap() {
  const sql = await withDb();
  const [trip] = await sql<{
    id: number;
    slug: string;
    name: string;
    location: string;
    start_date: string;
    end_date: string;
    tagline: string;
    status: string;
    last_admin_message: string | null;
    finalized_at: string | null;
    match_stake: string | number | null;
    skins_pot: string | number | null;
  }>`select * from trips order by id limit 1`;

  const playerRows = await sql<PlayerRow>`select * from players order by role desc, last_name`;
  const players = playerRows.map(mapPlayer);

  const courses = await sql<{
    id: number;
    name: string;
    slug: string;
    address: string;
    city: string;
    designer: string | null;
    image_url: string | null;
    par: number;
    description: string;
    theme: string | null;
  }>`select * from courses order by id`;

  const tees = await sql<{
    id: number;
    course_id: number;
    name: string;
    color: string;
    rating: string | number;
    slope: number;
    yardage: number;
  }>`select * from tees order by yardage desc`;

  const holes = await sql<{
    id: number;
    tee_id: number;
    number: number;
    par: number;
    yardage: number;
    stroke_index: number;
  }>`select * from holes order by tee_id, number`;

  const rounds = await sql<{
    id: number;
    course_id: number;
    tee_id: number;
    round_number: number;
    name: string;
    date: string;
    tee_time: string;
    theme: string | null;
    notes: string | null;
    status: string;
    pairings_status: string;
    allowance_pct: number;
    format: string | null;
    group_shape: string | null;
  }>`select * from rounds order by round_number`;

  const publishedRoundIds = rounds.filter((r) => r.pairings_status === "published").map((r) => r.id);

  const groupsAll = await sql<{
    id: number;
    round_id: number;
    group_number: number;
    locked: boolean;
    format: string | null;
    tee_time: string | null;
  }>`
    select * from groups where group_number <= 5 order by round_id, group_number
  `;
  const groups = groupsAll.filter((g) => publishedRoundIds.includes(g.round_id));
  const groupIds = groups.map((g) => g.id);
  const groupPlayersAll = await sql<{ group_id: number; player_id: number; position: number }>`
    select group_id, player_id, position from group_players
  `;
  const groupPlayers = groupPlayersAll.filter((gp) => groupIds.includes(gp.group_id));

  const matches = await sql<{
    id: number;
    round_id: number;
    group_id: number | null;
    kind: string | null;
    a1: number;
    a2: number | null;
    b1: number | null;
    b2: number | null;
    status: string;
    result: string | null;
    winner_side: string | null;
    holes_up: number | null;
    thru: number | null;
    stake: string | number | null;
    bet_status: string;
    format: string | null;
  }>`select * from matches order by id`;

  const scores = await sql<{
    round_id: number;
    player_id: number;
    hole_number: number;
    gross: number;
    net: number;
    strokes: number;
  }>`select round_id, player_id, hole_number, gross, net, strokes from scores`;

  const announcements = await sql<{
    id: number;
    title: string;
    body: string;
    important: boolean;
    created_at: string;
    author_player_id: number | null;
  }>`select id, title, body, important, created_at, author_player_id from announcements order by created_at desc`;

  const itinerary = await sql<{
    id: number;
    day: string;
    start_time: string | null;
    title: string;
    subtitle: string | null;
    body: string | null;
    kind: string;
    course_id: number | null;
    round_id: number | null;
    sort: number;
  }>`select * from itinerary_items order by sort`;

  const markets = await sql<{
    id: number;
    round_id: number | null;
    name: string;
    kind: string;
    status: string;
    winning_selection_id: number | null;
  }>`select id, round_id, name, kind, status, winning_selection_id from markets order by id`;

  const selections = await sql<{
    id: number;
    market_id: number;
    label: string;
    player_id: number | null;
  }>`select * from market_selections`;

  const entrySums = await sql<{
    market_id: number;
    selection_id: number;
    total: string | number;
    n: number;
  }>`
    select market_id, selection_id, sum(amount) as total, count(*)::int as n
    from pool_entries group by market_id, selection_id
  `;

  const entries = await sql<{
    id: number;
    market_id: number;
    selection_id: number;
    player_id: number;
    amount: string | number;
  }>`select id, market_id, selection_id, player_id, amount from pool_entries order by id desc`;

  const awards = await sql<{
    id: number;
    name: string;
    description: string;
    category: string;
    player_id: number | null;
    published: boolean;
  }>`select * from awards order by id`;

  const recaps = await sql<{
    id: number;
    day: string;
    title: string;
    body: string;
    quote: string | null;
    published: boolean;
  }>`select * from recaps where published = true order by day`;

  const photos = await sql<{
    id: number;
    round_id: number | null;
    player_id: number | null;
    url: string;
    caption: string | null;
    featured: boolean;
  }>`select id, round_id, player_id, url, caption, featured from photos order by created_at desc`;

  const flights = await sql<{
    player_id: number;
    direction: string;
    airport: string | null;
    airline: string | null;
    flight_number: string | null;
    departs_at: string | null;
    arrives_at: string | null;
    terminal: string | null;
    status: string;
  }>`select player_id, direction, airport, airline, flight_number, departs_at, arrives_at, terminal, status from flights`;

  const askSeth = await sql<{ player_id: number; n: number }>`
    select player_id, count(*)::int as n from ask_seth_events group by player_id
  `;

  const contributions = await sql<{ player_id: number; total: string | number }>`
    select player_id, sum(amount) as total from pool_entries group by player_id
  `;
  const settlements = await sql<{ player_id: number; total: string | number }>`
    select player_id, sum(amount) as total from pool_settlements group by player_id
  `;

  const reportCards = await sql<{
    player_id: number;
    golf_grade: string | null;
    gambling_grade: string | null;
    decisions_grade: string | null;
    entertainment_grade: string | null;
    seth_dependency: string | null;
    comment: string | null;
    published: boolean;
  }>`select * from report_cards`;

  const teamScores = await sql<{
    match_id: number;
    round_id: number;
    side: string;
    hole_number: number;
    gross: number;
    net: number;
    strokes: number;
  }>`select match_id, round_id, side, hole_number, gross, net, strokes from team_scores`.catch(() => []);

  const wolfPicks = await sql<{
    round_id: number;
    group_id: number;
    hole_number: number;
    wolf_player_id: number;
    partner_player_id: number | null;
    lone: boolean;
  }>`select round_id, group_id, hole_number, wolf_player_id, partner_player_id, lone from wolf_picks`.catch(() => []);

  const vegasSplits = await sql<{
    round_id: number;
    group_id: number;
    hole_number: number;
    a1: number;
    a2: number;
    b1: number;
    b2: number;
  }>`select round_id, group_id, hole_number, a1, a2, b1, b2 from vegas_splits`.catch(() => []);

  const roundHandicaps = await sql<{
    round_id: number;
    player_id: number;
    handicap_index: string | number;
    course_handicap: number;
    playing_handicap: number;
  }>`select round_id, player_id, handicap_index, course_handicap, playing_handicap from round_handicaps`;

  const ledger = await sql<{
    id: number;
    kind: string;
    round_id: number | null;
    match_id: number | null;
    market_id: number | null;
    from_player_id: number | null;
    to_player_id: number | null;
    amount: string | number;
    description: string;
    created_at: string;
  }>`
    select id, kind, round_id, match_id, market_id, from_player_id, to_player_id, amount, description, created_at
    from ledger_entries
    order by created_at desc
    limit 300
  `;

  return {
    trip: {
      id: trip.id,
      slug: trip.slug,
      name: trip.name,
      location: trip.location,
      start_date: trip.start_date,
      end_date: trip.end_date,
      tagline: trip.tagline,
      status: trip.status,
      last_admin_message: trip.last_admin_message,
      finalized_at: trip.finalized_at,
      match_stake: num(trip?.match_stake, DEFAULT_MATCH_STAKE),
      skins_pot: num(trip?.skins_pot, DEFAULT_SKINS_POT),
    },
    players,
    courses,
    tees: tees.map((t) => ({ ...t, rating: num(t.rating) })),
    holes,
    rounds: rounds.map((r) => ({
      ...r,
      allowance_pct: r.allowance_pct || FOUR_BALL_MATCH_ALLOWANCE,
      format: asFormat(r.format),
      group_shape: asShape(r.group_shape),
    })),
    groups: groups.map((g) => ({ ...g, format: g.format ? asFormat(g.format) : null, tee_time: g.tee_time ?? null })),
    groupPlayers,
    matches: matches.map((m) => ({
      ...m,
      format: asFormat(m.format),
      kind: asKind(m.kind, m.group_id == null ? "inter" : "group"),
      stake: num(m.stake, DEFAULT_MATCH_STAKE),
      bet_status: m.bet_status ?? "open",
    })),
    scores,
    announcements,
    itinerary,
    markets,
    selections,
    entrySums: entrySums.map((e) => ({ ...e, total: num(e.total) })),
    entries: entries.map((e) => ({ ...e, amount: num(e.amount) })),
    awards: awards.filter((a) => a.published || !a.player_id || true).map((a) => ({
      ...a,
      player_id: a.published ? a.player_id : a.player_id,
    })),
    recaps,
    photos,
    flights,
    askSeth,
    contributions: contributions.map((c) => ({ player_id: c.player_id, total: num(c.total) })),
    settlements: settlements.map((s) => ({ player_id: s.player_id, total: num(s.total) })),
    reportCards: reportCards.filter((r) => r.published),
    roundHandicaps: roundHandicaps.map((h) => ({
      ...h,
      handicap_index: num(h.handicap_index),
    })),
    ledger: ledger.map((e) => ({ ...e, amount: num(e.amount) })),
    teamScores,
    wolfPicks,
    vegasSplits,
  };
}

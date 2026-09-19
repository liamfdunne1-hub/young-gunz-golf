export type Role = "admin" | "player";

export type JokeMetrics = {
  driving: number;
  irons: number;
  putting: number;
  alcohol: number;
  lipOut: number;
  thatsGood: number;
  breakfastBall: number;
  cart: number;
  wakeup: number;
  loseSomething: number;
  sethDependency: number;
};

export type Player = {
  id: number;
  user_id: string | null;
  first_name: string;
  last_name: string;
  nickname: string | null;
  email: string;
  slug: string;
  role: Role;
  handicap_index: number;
  course_handicap: number | null;
  playing_handicap: number | null;
  tee_name: string;
  scouting_report: string;
  threat_level: string | null;
  joke_metrics: JokeMetrics;
  registered_at: string | null;
};

export type Course = {
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
};

export type Tee = {
  id: number;
  course_id: number;
  name: string;
  color: string;
  rating: number;
  slope: number;
  yardage: number;
};

export type Hole = {
  id: number;
  tee_id: number;
  number: number;
  par: number;
  yardage: number;
  stroke_index: number;
};

export type RoundFormat = "fourball" | "alternate" | "scramble" | "wolf" | "vegas";
export type GroupShape = "foursomes" | "pairs";
export type MatchKind = "group" | "inter";

export type Round = {
  id: number;
  course_id: number;
  tee_id: number;
  round_number: number;
  name: string;
  date: string;
  tee_time: string;
  theme: string | null;
  notes: string | null;
  status: "upcoming" | "live" | "finalized";
  pairings_status: "draft" | "published";
  allowance_pct: number;
  format: RoundFormat;
  group_shape: GroupShape;
  course_name: string;
  course_slug: string;
  course_image: string | null;
};

export type MatchRow = {
  id: number;
  round_id: number;
  group_id: number | null;
  kind: MatchKind;
  format: RoundFormat;
  a1: number;
  a2: number | null;
  b1: number | null;
  b2: number | null;
  status: string;
  result: string | null;
  winner_side: string | null;
  holes_up: number | null;
  thru: number | null;
  stake: number;
  bet_status: string;
};

export type LedgerEntry = {
  id: number;
  kind: string;
  round_id: number | null;
  match_id: number | null;
  market_id: number | null;
  from_player_id: number | null;
  to_player_id: number | null;
  amount: number;
  description: string;
  created_at: string;
};

export type RoundHandicap = {
  round_id: number;
  player_id: number;
  handicap_index: number;
  course_handicap: number;
  playing_handicap: number;
};

export type Me = {
  userId: string;
  email: string | null;
  name: string | null;
  player: Player | null;
  isAdmin: boolean;
};

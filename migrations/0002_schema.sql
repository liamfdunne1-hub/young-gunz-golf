-- Young Gunz Orlando 2026 — trip schema
-- Seeded in application code (src/lib/seed.ts) so hole/player copy stays maintainable.

create table if not exists trips (
  id serial primary key,
  slug text not null unique,
  name text not null,
  location text not null,
  start_date date not null,
  end_date date not null,
  tagline text not null,
  status text not null default 'upcoming',
  finalized_at timestamptz,
  last_admin_message text,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  user_id text,
  first_name text not null,
  last_name text not null,
  nickname text,
  email text not null,
  slug text not null,
  role text not null default 'player',
  handicap_index numeric not null,
  course_handicap integer,
  playing_handicap integer,
  tee_name text not null default 'Blue',
  scouting_report text not null default '',
  threat_level text,
  joke_metrics jsonb not null default '{}',
  invite_token text unique,
  invited_at timestamptz,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, slug),
  unique (trip_id, email)
);
create index if not exists players_user_id_idx on players (user_id);
create index if not exists players_trip_id_idx on players (trip_id);

create table if not exists courses (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  name text not null,
  slug text not null,
  address text not null,
  city text not null,
  designer text,
  image_url text,
  par integer not null default 72,
  description text not null default '',
  theme text,
  unique (trip_id, slug)
);

create table if not exists tees (
  id serial primary key,
  course_id integer not null references courses(id) on delete cascade,
  name text not null,
  color text not null,
  rating numeric not null,
  slope integer not null,
  yardage integer not null
);

create table if not exists holes (
  id serial primary key,
  tee_id integer not null references tees(id) on delete cascade,
  number integer not null,
  par integer not null,
  yardage integer not null,
  stroke_index integer not null,
  unique (tee_id, number)
);

create table if not exists rounds (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  course_id integer not null references courses(id),
  tee_id integer not null references tees(id),
  round_number integer not null,
  name text not null,
  date date not null,
  tee_time text not null,
  theme text,
  notes text,
  status text not null default 'upcoming',
  pairings_status text not null default 'draft',
  allowance_pct integer not null default 100,
  published_at timestamptz,
  finalized_at timestamptz,
  unique (trip_id, round_number)
);

create table if not exists groups (
  id serial primary key,
  round_id integer not null references rounds(id) on delete cascade,
  group_number integer not null,
  locked boolean not null default false,
  unique (round_id, group_number)
);

create table if not exists group_players (
  id serial primary key,
  group_id integer not null references groups(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  position integer not null default 0,
  unique (group_id, player_id)
);

create table if not exists matches (
  id serial primary key,
  round_id integer not null references rounds(id) on delete cascade,
  group_id integer references groups(id) on delete set null,
  a1 integer not null references players(id),
  a2 integer not null references players(id),
  b1 integer not null references players(id),
  b2 integer not null references players(id),
  status text not null default 'pending',
  result text,
  winner_side text,
  holes_up integer,
  thru integer
);

create table if not exists round_handicaps (
  id serial primary key,
  round_id integer not null references rounds(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  tee_id integer not null references tees(id),
  handicap_index numeric not null,
  course_handicap integer not null,
  playing_handicap integer not null,
  unique (round_id, player_id)
);

create table if not exists scores (
  id serial primary key,
  round_id integer not null references rounds(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  hole_number integer not null,
  gross integer not null,
  net integer not null,
  strokes integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (round_id, player_id, hole_number)
);
create index if not exists scores_round_idx on scores (round_id);

create table if not exists announcements (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  author_player_id integer references players(id),
  title text not null,
  body text not null,
  important boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id serial primary key,
  player_id integer not null references players(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_player_idx on notifications (player_id, created_at desc);

create table if not exists notification_prefs (
  player_id integer primary key references players(id) on delete cascade,
  pairings boolean not null default true,
  tee_times boolean not null default true,
  results boolean not null default true,
  pools boolean not null default true,
  announcements boolean not null default true,
  recaps boolean not null default true
);

create table if not exists flights (
  id serial primary key,
  player_id integer not null references players(id) on delete cascade,
  direction text not null,
  airport text,
  airline text,
  flight_number text,
  departs_at text,
  arrives_at text,
  terminal text,
  status text not null default 'unknown',
  rental text,
  notes text,
  unique (player_id, direction)
);

create table if not exists itinerary_items (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  day date not null,
  start_time text,
  title text not null,
  subtitle text,
  body text,
  kind text not null default 'note',
  course_id integer references courses(id),
  round_id integer references rounds(id),
  sort integer not null default 0
);

create table if not exists markets (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  round_id integer references rounds(id),
  name text not null,
  kind text not null,
  status text not null default 'open',
  winning_selection_id integer,
  created_at timestamptz not null default now()
);

create table if not exists market_selections (
  id serial primary key,
  market_id integer not null references markets(id) on delete cascade,
  label text not null,
  player_id integer references players(id)
);

create table if not exists pool_entries (
  id serial primary key,
  market_id integer not null references markets(id) on delete cascade,
  selection_id integer not null references market_selections(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists pool_settlements (
  id serial primary key,
  market_id integer not null references markets(id) on delete cascade,
  player_id integer not null references players(id),
  amount numeric not null
);

create table if not exists emails (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  to_player_id integer references players(id),
  to_email text not null,
  subject text not null,
  html text not null,
  type text not null,
  status text not null default 'queued',
  scheduled_at timestamptz,
  sent_at timestamptz,
  related_round_id integer references rounds(id),
  created_at timestamptz not null default now()
);

create table if not exists awards (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  name text not null,
  description text not null default '',
  category text not null default 'fun',
  player_id integer references players(id),
  published boolean not null default false
);

create table if not exists recaps (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  day date not null,
  title text not null,
  body text not null,
  quote text,
  published boolean not null default false,
  published_at timestamptz
);

create table if not exists photos (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  round_id integer references rounds(id),
  player_id integer references players(id),
  url text not null,
  caption text,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ask_seth_events (
  id serial primary key,
  player_id integer not null references players(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists handicap_overrides (
  id serial primary key,
  player_id integer not null references players(id) on delete cascade,
  round_id integer references rounds(id),
  handicap_index numeric not null,
  course_handicap integer,
  playing_handicap integer,
  reason text,
  actor_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists report_cards (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  golf_grade text,
  gambling_grade text,
  decisions_grade text,
  entertainment_grade text,
  seth_dependency text,
  comment text,
  published boolean not null default false,
  unique (trip_id, player_id)
);

create table if not exists audit_logs (
  id serial primary key,
  actor_user_id text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

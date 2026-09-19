-- Round formats, team scores, and Wolf picks.

alter table rounds add column if not exists format text not null default 'fourball';

alter table groups add column if not exists format text;

alter table matches add column if not exists format text not null default 'fourball';

alter table matches alter column a2 drop not null;
alter table matches alter column b1 drop not null;
alter table matches alter column b2 drop not null;

create table if not exists team_scores (
  id serial primary key,
  round_id integer not null references rounds(id) on delete cascade,
  match_id integer not null references matches(id) on delete cascade,
  side text not null,
  hole_number integer not null,
  gross integer not null,
  net integer not null,
  strokes integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (match_id, side, hole_number)
);

create table if not exists wolf_picks (
  id serial primary key,
  round_id integer not null references rounds(id) on delete cascade,
  group_id integer not null references groups(id) on delete cascade,
  hole_number integer not null,
  wolf_player_id integer not null references players(id),
  partner_player_id integer references players(id),
  lone boolean not null default false,
  unique (round_id, group_id, hole_number)
);

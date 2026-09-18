-- Public match ledger + Seth Mode passcode + USGA four-ball default allowance.

alter table trips add column if not exists seth_passcode_hash text;
alter table trips add column if not exists match_stake numeric not null default 20;

alter table matches add column if not exists stake numeric not null default 20;
alter table matches add column if not exists bet_status text not null default 'open';

create table if not exists ledger_entries (
  id serial primary key,
  trip_id integer not null references trips(id) on delete cascade,
  kind text not null,
  round_id integer references rounds(id) on delete set null,
  match_id integer references matches(id) on delete set null,
  market_id integer references markets(id) on delete set null,
  from_player_id integer references players(id),
  to_player_id integer references players(id),
  amount numeric not null,
  description text not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_trip_idx on ledger_entries (trip_id, created_at desc);

-- Four-ball match play (USGA / WHS Appendix C) is 90% of course handicap.
update rounds set allowance_pct = 90 where allowance_pct = 100;

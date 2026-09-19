-- Tee-time labels on groups, match kind (in-tee vs inter-tee), hole-by-hole Vegas splits.

alter table groups add column if not exists tee_time text;

alter table matches add column if not exists kind text not null default 'group';

update matches set kind = 'inter' where group_id is null and kind is distinct from 'inter';
update matches set kind = 'group' where group_id is not null and kind is distinct from 'group';

create table if not exists vegas_splits (
  id serial primary key,
  round_id integer not null references rounds(id) on delete cascade,
  group_id integer not null references groups(id) on delete cascade,
  hole_number integer not null,
  a1 integer not null references players(id),
  a2 integer not null references players(id),
  b1 integer not null references players(id),
  b2 integer not null references players(id),
  unique (round_id, group_id, hole_number)
);

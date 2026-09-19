-- Five group slots per round, and a pairing shape (4-3-3 vs five pairs).

alter table rounds add column if not exists group_shape text not null default 'foursomes';

insert into groups (round_id, group_number)
select r.id, n.n
from rounds r
cross join (values (1), (2), (3), (4), (5)) as n(n)
where not exists (
  select 1 from groups g where g.round_id = r.id and g.group_number = n.n
);

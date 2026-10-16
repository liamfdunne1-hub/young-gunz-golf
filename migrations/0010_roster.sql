-- 5v5 sides, and a one-shot marker so the posted indexes apply once.

alter table players add column if not exists side text;
alter table trips add column if not exists roster_rev integer not null default 0;

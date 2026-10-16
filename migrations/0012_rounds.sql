-- One-shot marker so a test "live" round can be put back to upcoming.

alter table trips add column if not exists rounds_rev integer not null default 0;

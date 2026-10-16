-- One-shot marker so posted test scores can be cleared once.

alter table trips add column if not exists scores_rev integer not null default 0;

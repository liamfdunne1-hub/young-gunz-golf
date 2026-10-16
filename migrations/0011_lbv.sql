-- One-shot marker so the Palm → Lake Buena Vista swap applies once.

alter table trips add column if not exists courses_rev integer not null default 0;

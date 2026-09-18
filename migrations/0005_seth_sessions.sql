-- Seth Mode is a door code, not a bag. Anyone who unlocks can operate the desk.

create table if not exists seth_sessions (
  user_id text primary key,
  unlocked_at timestamptz not null default now()
);

-- Mail + recap AI keys live on the trip so Seth can paste them in Seth Mode.
-- Never returned on public bootstrap.

alter table trips add column if not exists email_provider text not null default 'none';
alter table trips add column if not exists email_api_key text;
alter table trips add column if not exists email_from text;
alter table trips add column if not exists smtp_host text;
alter table trips add column if not exists smtp_port integer;
alter table trips add column if not exists smtp_user text;
alter table trips add column if not exists smtp_pass text;
alter table trips add column if not exists xai_api_key text;

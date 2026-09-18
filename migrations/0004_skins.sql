-- Gross skins: communal pot, separate from match bets and The Action.
-- Unique lowest gross on a hole wins. Ties push. Carryovers stack.

alter table trips add column if not exists skins_pot numeric not null default 180;

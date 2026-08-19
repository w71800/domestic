drop index if exists public.household_members_line_user_id_idx;

alter table public.households
  add column if not exists last_line_group_id text,
  add column if not exists unbound_at timestamptz;

update public.households
set last_line_group_id = line_group_id
where line_group_id is not null
  and last_line_group_id is null;

create unique index if not exists households_last_line_group_id_idx
  on public.households (last_line_group_id)
  where last_line_group_id is not null;


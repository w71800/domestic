create table public.household_accounts (
  household_id uuid not null references public.households (id) on delete cascade,
  type public.bill_type not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, type),
  check (char_length(btrim(value)) > 0),
  check (char_length(value) <= 64)
);

create trigger household_accounts_set_updated_at
before update on public.household_accounts
for each row
execute procedure public.set_updated_at();

alter table public.household_accounts enable row level security;

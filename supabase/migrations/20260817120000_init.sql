create extension if not exists pgcrypto;

create type public.bill_type as enum (
  'water',
  'electricity',
  'gas',
  'management',
  'other'
);

create type public.reminder_kind as enum ('d7', 'd3', 'd0');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  line_group_id text unique,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  line_user_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (household_id, line_user_id)
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type public.bill_type not null,
  amount integer not null check (amount > 0),
  due_date date not null,
  paid_date date,
  period_start date not null,
  period_end date not null,
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index bills_household_unpaid_due_idx
  on public.bills (household_id, due_date)
  where paid_date is null;

create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  kind public.reminder_kind not null,
  sent_at timestamptz not null default now(),
  unique (bill_id, kind)
);

create table public.line_follows (
  line_user_id text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bills_set_updated_at
before update on public.bills
for each row
execute procedure public.set_updated_at();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.bills enable row level security;
alter table public.reminder_logs enable row level security;
alter table public.line_follows enable row level security;

insert into public.households (name) values ('家裡');

-- 本機開發用假成員。正式環境請改成家人的 LINE userId（可從 LIFF 未授權畫面或 line_follows 取得）。
insert into public.household_members (household_id, line_user_id, display_name)
select id, 'U-dev-local', '本機開發'
from public.households
where name = '家裡'
limit 1
on conflict do nothing;

insert into public.bills (
  household_id,
  type,
  amount,
  due_date,
  period_start,
  period_end,
  notes
)
select
  id,
  'electricity',
  1862,
  (current_date + 7),
  date_trunc('month', current_date)::date,
  date_trunc('month', current_date)::date,
  '範例電費'
from public.households
where name = '家裡'
limit 1;

insert into public.bills (
  household_id,
  type,
  amount,
  due_date,
  period_start,
  period_end,
  notes
)
select
  id,
  'water',
  430,
  (current_date + 3),
  (date_trunc('month', current_date) - interval '1 month')::date,
  date_trunc('month', current_date)::date,
  '範例水費（跨月）'
from public.households
where name = '家裡'
limit 1;

insert into public.bills (
  household_id,
  type,
  amount,
  due_date,
  paid_date,
  period_start,
  period_end,
  notes
)
select
  id,
  'management',
  3200,
  (current_date - 10),
  (current_date - 12),
  (date_trunc('month', current_date) - interval '1 month')::date,
  (date_trunc('month', current_date) - interval '1 month')::date,
  '已繳範例'
from public.households
where name = '家裡'
limit 1;

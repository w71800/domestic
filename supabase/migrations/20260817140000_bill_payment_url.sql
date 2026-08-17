alter table public.bills
  add column payment_url text;

alter table public.bills
  add constraint bills_payment_url_http
  check (
    payment_url is null
    or payment_url ~* '^https?://'
  );

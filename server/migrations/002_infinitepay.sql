alter table public.gift_orders
  add column payment_provider text not null default 'mercado_pago'
    check (payment_provider in ('mercado_pago', 'infinitepay')),
  add column infinitepay_slug text unique,
  add column infinitepay_transaction_id text unique,
  add column checkout_url text;

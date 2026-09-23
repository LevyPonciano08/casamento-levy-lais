alter table public.gifts
  drop constraint if exists gifts_price_cents_check,
  drop constraint if exists quota_minimum_is_valid;

alter table public.gifts
  add constraint gifts_price_cents_check
    check (price_cents between 1 and 100000000),
  add constraint quota_minimum_is_valid
    check (
      (gift_mode = 'unit' and minimum_contribution_cents is null)
      or
      (gift_mode = 'quota' and minimum_contribution_cents between 1 and price_cents)
    );

alter table public.gift_orders
  drop constraint if exists gift_orders_amount_cents_check;

alter table public.gift_orders
  add constraint gift_orders_amount_cents_check
    check (amount_cents between 1 and 100000000);

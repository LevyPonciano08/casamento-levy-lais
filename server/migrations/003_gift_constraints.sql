alter table gifts add constraint unlimited_purchases_unit_only check (not unlimited_purchases or gift_mode='unit');
alter table gifts drop constraint quota_minimum_is_valid;
alter table gifts add constraint quota_minimum_is_valid check (
  (gift_mode='unit' and minimum_contribution_cents is null) or
  (gift_mode='quota' and minimum_contribution_cents is not null and minimum_contribution_cents between 1 and price_cents)
);

alter table public.gifts
  add column if not exists unlimited_purchases boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.gifts
  add constraint unlimited_purchases_unit_only
  check (not unlimited_purchases or gift_mode = 'unit');

create or replace function public.reserve_gift_order(
  p_gift_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_message text default '',
  p_public_name boolean default false,
  p_amount_cents integer default null,
  p_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_gift public.gifts%rowtype;
  committed_quantity integer;
  committed_amount bigint;
  final_amount integer;
  final_quantity integer;
  new_order_id uuid := gen_random_uuid();
begin
  if char_length(trim(p_guest_name)) not between 2 and 120 then
    raise exception 'invalid_guest_name';
  end if;
  if char_length(trim(p_guest_email)) not between 5 and 254 then
    raise exception 'invalid_guest_email';
  end if;
  if char_length(coalesce(p_guest_message, '')) > 1000 then
    raise exception 'invalid_guest_message';
  end if;

  select * into selected_gift
  from public.gifts
  where id = p_gift_id and is_active = true and archived_at is null
  for update;

  if not found then
    raise exception 'gift_not_available';
  end if;

  if selected_gift.gift_mode = 'unit' then
    final_quantity := greatest(1, least(coalesce(p_quantity, 1), 100));
    if not selected_gift.unlimited_purchases then
      select coalesce(sum(quantity), 0)::integer into committed_quantity
      from public.gift_orders
      where gift_id = selected_gift.id
        and (
          status = 'approved'
          or (status in ('created', 'pending') and expires_at > now())
        );

      if committed_quantity + final_quantity > selected_gift.quantity_total then
        raise exception 'gift_not_available';
      end if;
    end if;
    if selected_gift.price_cents::bigint * final_quantity > 100000000 then
      raise exception 'invalid_order_amount';
    end if;
    final_amount := (selected_gift.price_cents::bigint * final_quantity)::integer;
  else
    final_quantity := 1;
    select coalesce(sum(amount_cents), 0)::bigint into committed_amount
    from public.gift_orders
    where gift_id = selected_gift.id
      and (
        status = 'approved'
        or (status in ('created', 'pending') and expires_at > now())
      );

    final_amount := coalesce(p_amount_cents, 0);
    if final_amount < selected_gift.minimum_contribution_cents
      or committed_amount + final_amount > selected_gift.price_cents then
      raise exception 'invalid_contribution_amount';
    end if;
  end if;

  insert into public.gift_orders (
    id, gift_id, guest_name, guest_email, guest_message, public_name,
    amount_cents, quantity, external_reference
  ) values (
    new_order_id, selected_gift.id, trim(p_guest_name), lower(trim(p_guest_email)),
    trim(coalesce(p_guest_message, '')), coalesce(p_public_name, false),
    final_amount, final_quantity, new_order_id::text
  );

  return new_order_id;
end;
$$;

create or replace view public.gift_catalog
with (security_barrier = true)
as
select
  g.id,
  g.title,
  g.description,
  g.category,
  g.gift_mode,
  g.price_cents,
  g.minimum_contribution_cents,
  g.quantity_total,
  g.image_path,
  g.sort_order,
  case when g.unlimited_purchases then 100
    else greatest(g.quantity_total - coalesce(s.committed_quantity, 0), 0)
  end as available_quantity,
  greatest(g.price_cents - coalesce(s.committed_amount, 0), 0) as remaining_amount_cents,
  g.unlimited_purchases
from public.gifts g
left join lateral (
  select
    coalesce(sum(o.quantity) filter (where g.gift_mode = 'unit'), 0)::integer as committed_quantity,
    coalesce(sum(o.amount_cents) filter (where g.gift_mode = 'quota'), 0)::bigint as committed_amount
  from public.gift_orders o
  where o.gift_id = g.id
    and (
      o.status = 'approved'
      or (o.status in ('created', 'pending') and o.expires_at > now())
    )
) s on true
where g.is_active = true and g.archived_at is null;

-- Keep the payment history attached to the old gifts while removing them
-- from both the public catalog and the administrative product list.
update public.gifts
set is_active = false, archived_at = now()
where id in (
  'dff3c89c-c369-4735-b569-a919c18030e7',
  '59c682f6-c0e4-4a35-8389-71816c7de8f8'
);

insert into public.gifts (
  title, description, category, gift_mode, price_cents,
  quantity_total, unlimited_purchases, is_active, sort_order
)
values (
  'TESTE — Pagamento repetido',
  'Produto para testar pagamentos. Continua disponível após cada compra.',
  'Teste', 'unit', 500, 1, true, true, 0
);

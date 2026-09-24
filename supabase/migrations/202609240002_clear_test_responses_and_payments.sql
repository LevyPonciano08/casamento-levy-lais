-- Clear the requested local records. This does not affect Mercado Pago transactions.
do $$
declare
  removed_responses integer;
begin
  lock table public.rsvp_responses, public.payment_events, public.gift_orders
    in access exclusive mode;

  if (select count(*) from public.rsvp_responses) <> 1
     or (select count(*) from public.payment_events) <> 5
     or (select count(*) from public.gift_orders) <> 9 then
    raise exception 'Data changed since the cleanup audit; inspect before deleting';
  end if;

  delete from public.rsvp_responses
    where id = '8904fc47-c684-4016-979b-c16b04c0f950'::uuid;
  get diagnostics removed_responses = row_count;
  if removed_responses <> 1 then
    raise exception 'The audited RSVP response was not found';
  end if;

  delete from public.payment_events;
  delete from public.gift_orders;
end;
$$;

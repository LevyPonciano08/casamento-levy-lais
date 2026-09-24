create table public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  submission_key uuid not null unique,
  guest_name text not null check (char_length(guest_name) between 2 and 120),
  attending boolean not null,
  guest_message text not null default '' check (char_length(guest_message) <= 300),
  created_at timestamptz not null default now()
);

create index rsvp_responses_created_idx on public.rsvp_responses(created_at desc);

alter table public.rsvp_responses enable row level security;
revoke all on public.rsvp_responses from anon, authenticated;
grant select on public.rsvp_responses to authenticated;

create policy "Admins can read RSVP responses"
on public.rsvp_responses for select to authenticated
using (public.is_registry_admin());

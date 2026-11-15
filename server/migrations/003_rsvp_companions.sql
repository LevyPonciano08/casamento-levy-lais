alter table public.rsvp_responses
  add column companions text[] not null default '{}'::text[]
  check (cardinality(companions) <= 20 and char_length(array_to_string(companions, E'\n')) <= 2419);

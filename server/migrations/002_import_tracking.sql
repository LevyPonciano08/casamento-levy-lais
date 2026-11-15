alter table gift_images add column source_path text unique;
create table migration_imports (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('public','full')),
  counts jsonb not null,
  imported_at timestamptz not null default now()
);

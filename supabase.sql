-- Run this in Supabase SQL editor
create table if not exists public.clients (
  id text primary key,
  name text not null,
  phone text,
  goal int not null default 10,
  punches int not null default 0,
  total_rewards int not null default 0,
  last_visit timestamptz,
  public_slug text unique not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.clients enable row level security;

-- Allow anonymous SELECT (read) so public links work.
-- Security model relies on unguessable public_slug.
create policy "Public read clients"
on public.clients for select
to anon
using ( true );

-- Allow service role (or anon via anon key we use here) to upsert from the app.
-- You can tighten this by creating an authenticated user; for simplicity we allow anon insert/update.
create policy "Anon upsert clients"
on public.clients for insert
to anon
with check ( true );

create policy "Anon update clients"
on public.clients for update
to anon
using ( true )
with check ( true );

create policy "Anon delete clients"
on public.clients for delete
to anon
using ( true );

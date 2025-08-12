-- Full-state backup table
create table if not exists public.states (
  owner_key text primary key,
  payload jsonb not null,
  updated_at timestamptz default now()
);
alter table public.states enable row level security;
create policy if not exists "Anon upsert states" on public.states for insert to anon with check ( true );
create policy if not exists "Anon update states" on public.states for update to anon using ( true ) with check ( true );
create policy if not exists "Anon read states" on public.states for select to anon using ( true );

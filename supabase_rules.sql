-- Rules table
create table if not exists public.rules (
  id text primary key,
  owner_key text not null,
  punches int not null,
  label text not null,
  updated_at timestamptz default now()
);
alter table public.rules enable row level security;
create policy if not exists "Anon upsert rules" on public.rules for insert to anon with check ( true );
create policy if not exists "Anon update rules" on public.rules for update to anon using ( true ) with check ( true );
create policy if not exists "Anon read rules" on public.rules for select to anon using ( true );
create policy if not exists "Anon delete rules" on public.rules for delete to anon using ( true );

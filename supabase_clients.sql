-- Clients table (with owner_key)
create table if not exists public.clients (
  id text primary key,
  owner_key text,
  name text not null,
  phone text,
  goal int not null default 10,
  punches int not null default 0,
  total_rewards int not null default 0,
  last_visit timestamptz,
  public_slug text unique not null,
  updated_at timestamptz default now()
);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='clients' and column_name='owner_key') then
    alter table public.clients add column owner_key text;
  end if;
end $$;
alter table public.clients enable row level security;
create policy if not exists "Public read clients" on public.clients for select to anon using ( true );
create policy if not exists "Anon upsert clients" on public.clients for insert to anon with check ( true );
create policy if not exists "Anon update clients" on public.clients for update to anon using ( true ) with check ( true );
create policy if not exists "Anon delete clients" on public.clients for delete to anon using ( true );

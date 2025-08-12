-- v3.0: Non-destructive redeem support
alter table public.clients add column if not exists redeem_tallies jsonb;
alter table public.clients add column if not exists last_redeem_label text;
alter table public.clients add column if not exists last_redeem_at timestamptz;

-- Branding table (appearance settings for share page)
create table if not exists public.branding (
  owner_key text primary key,
  business_name text,
  brand_color text,
  header_text_color text,
  header_bg_color text,
  share_theme text,
  share_font text,
  emoji_headings boolean,
  card_style text,
  show_badges boolean,
  show_upcoming boolean,
  header_logo_data text, -- data URL (compressed)
  bg_image_data text,    -- data URL (compressed)
  updated_at timestamptz default now()
);
alter table public.branding enable row level security;
create policy if not exists "Anon upsert branding" on public.branding for insert to anon with check ( true );
create policy if not exists "Anon update branding" on public.branding for update to anon using ( true ) with check ( true );
create policy if not exists "Anon read branding" on public.branding for select to anon using ( true );

create extension if not exists pgcrypto;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text, author text, place text not null, decade text, year text,
  title text, quote text, story text not null, lat double precision, lng double precision,
  images jsonb not null default '[]'::jsonb, video_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected'))
);

alter table public.stories enable row level security;

drop policy if exists "public can read approved stories" on public.stories;
create policy "public can read approved stories" on public.stories for select using (status='approved');

drop policy if exists "public can submit stories" on public.stories;
create policy "public can submit stories" on public.stories for insert with check (status='pending');

insert into storage.buckets (id,name,public) values ('media','media',true) on conflict (id) do update set public=true;

drop policy if exists "public can upload media" on storage.objects;
create policy "public can upload media" on storage.objects for insert to anon,authenticated with check (bucket_id='media');

drop policy if exists "public can read media" on storage.objects;
create policy "public can read media" on storage.objects for select to anon,authenticated using (bucket_id='media');

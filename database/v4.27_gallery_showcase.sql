-- MedScores V4.82
-- Gallery Showcase: private year-level galleries + private Supabase Storage.
-- Run this once in the Supabase SQL Editor before deploying the Gallery code.

create extension if not exists pgcrypto;

create table if not exists public.gallery_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.admin_profiles(id) on delete cascade,
  title text not null,
  event_name text not null,
  activity_date date not null,
  caption text,
  year_level text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.gallery_posts(id) on delete cascade,
  storage_path text not null unique,
  original_name text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_posts_owner_year_status_date
  on public.gallery_posts (owner_id, year_level, status, activity_date desc);

create index if not exists idx_gallery_photos_gallery_order
  on public.gallery_photos (gallery_id, sort_order);

alter table public.gallery_posts enable row level security;
alter table public.gallery_photos enable row level security;

-- Academic/gallery metadata is intentionally server-only. There are no
-- anon/authenticated table policies; Next.js routes use the server secret key.

drop trigger if exists gallery_posts_touch_updated_at on public.gallery_posts;
create trigger gallery_posts_touch_updated_at
before update on public.gallery_posts
for each row execute function public.touch_updated_at();

-- Private bucket. Students receive short-lived signed URLs only after the
-- Student Portal verifies their session and matching registered year level.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-images',
  'gallery-images',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

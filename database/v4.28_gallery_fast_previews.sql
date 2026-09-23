-- MedScores V4.84
-- Faster Gallery: lightweight display previews while original HD files stay untouched.
-- Run this once AFTER v4.27_gallery_showcase.sql.

alter table public.gallery_photos
  add column if not exists preview_path text;

create unique index if not exists idx_gallery_photos_preview_path
  on public.gallery_photos (preview_path)
  where preview_path is not null;

-- Existing rows remain valid. After deploying V4.84, open Admin > Gallery and
-- use "Optimize existing photos" once. New uploads automatically create previews.

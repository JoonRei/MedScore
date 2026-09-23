-- MedScores V4.87
-- Responsive gallery image variants for faster phones/tablets.
-- Run once AFTER v4.28_gallery_fast_previews.sql.

alter table public.gallery_photos
  add column if not exists preview_small_path text;

create unique index if not exists idx_gallery_photos_preview_small_path
  on public.gallery_photos (preview_small_path)
  where preview_small_path is not null;

-- New uploads automatically create both 640px and 1280px WEBP previews.
-- Existing photos can be upgraded from Admin > Gallery > Optimize existing photos.

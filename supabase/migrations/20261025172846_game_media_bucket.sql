-- Public storage bucket for the media of imported SIGame packs (.siq).
--
-- The server uploads files with the service-role key (which bypasses RLS);
-- browsers only read them through the public URL
-- (/storage/v1/object/public/game-media/...). No policies are created on
-- storage.objects for this bucket, so anon and authenticated users can't
-- upload, change, delete or list files.
--
-- 50 MB per file (the importer skips larger files) and only the picture,
-- audio and video types the importer uploads (app/models/siq/media-types.ts).
-- Additive: creates the bucket only if it doesn't exist yet.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-media',
  'game-media',
  true,
  52428800,
  array[
    'audio/aac',
    'audio/flac',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'image/avif',
    'image/bmp',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/ogg',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do nothing;

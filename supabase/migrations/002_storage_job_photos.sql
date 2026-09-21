-- PSG Job Tracker — private Storage bucket for job photos
-- Run after 001_init.sql in the Supabase SQL Editor.
--
-- WHY THIS FILE NO LONGER CREATES POLICIES HERE:
-- Error 42501 "must be owner of table objects" happens because
-- storage.objects is owned by supabase_storage_admin. On newer Supabase
-- projects the SQL Editor role cannot ALTER that table AND, on some
-- projects, cannot CREATE/DROP POLICY on it either.
--
-- This script only creates the private "job-photos" bucket (allowed).
-- Create the four policies in Dashboard → Storage → Policies (or via
-- Connect → Session pooler → psql). Exact policy specs are in the
-- comments at the bottom of this file.

-- ---------------------------------------------------------------------------
-- Bucket: private job-photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, null, null)
on conflict (id) do update
  set public = excluded.public;

comment on column public.job_photos.storage_path is
  'Object key in the private job-photos bucket. Set on capture so the photo syncs across devices.';
comment on column public.job_photos.local_uri is
  'Optional same-device URI. New captures leave this null and set storage_path instead.';

-- ---------------------------------------------------------------------------
-- POLICIES — do these in Dashboard → Storage → job-photos → Policies
-- (New policy → For full customization → paste each USING / WITH CHECK)
--
-- 1) Name: job_photos_storage_select
--    Allowed operation: SELECT
--    Target roles: authenticated
--    USING: (bucket_id = 'job-photos')
--
-- 2) Name: job_photos_storage_insert
--    Allowed operation: INSERT
--    Target roles: authenticated
--    WITH CHECK: (bucket_id = 'job-photos')
--
-- 3) Name: job_photos_storage_update
--    Allowed operation: UPDATE
--    Target roles: authenticated
--    USING: (bucket_id = 'job-photos')
--    WITH CHECK: (bucket_id = 'job-photos')
--
-- 4) Name: job_photos_storage_delete
--    Allowed operation: DELETE
--    Target roles: authenticated
--    USING: (bucket_id = 'job-photos')
--
-- Optional (if Session pooler psql works for you) — same four policies:
--   create policy "job_photos_storage_select" on storage.objects
--     for select to authenticated using (bucket_id = 'job-photos');
--   create policy "job_photos_storage_insert" on storage.objects
--     for insert to authenticated with check (bucket_id = 'job-photos');
--   create policy "job_photos_storage_update" on storage.objects
--     for update to authenticated
--     using (bucket_id = 'job-photos') with check (bucket_id = 'job-photos');
--   create policy "job_photos_storage_delete" on storage.objects
--     for delete to authenticated using (bucket_id = 'job-photos');

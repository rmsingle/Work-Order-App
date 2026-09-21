-- PSG Job Tracker — private Storage bucket for job photos
-- Run after 001_init.sql (SQL Editor or supabase db push).

-- ---------------------------------------------------------------------------
-- Bucket: private job-photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do update set public = false;

comment on column public.job_photos.storage_path is
  'Object key in the private job-photos bucket. Set on capture so the photo syncs across devices.';
comment on column public.job_photos.local_uri is
  'Optional same-device URI. New captures leave this null and set storage_path instead.';

alter table storage.objects enable row level security;

-- ---------------------------------------------------------------------------
-- storage.objects policies — authenticated CRUD on job-photos only
-- ---------------------------------------------------------------------------
drop policy if exists "job_photos_storage_select" on storage.objects;
create policy "job_photos_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'job-photos');

drop policy if exists "job_photos_storage_insert" on storage.objects;
create policy "job_photos_storage_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos');

drop policy if exists "job_photos_storage_update" on storage.objects;
create policy "job_photos_storage_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'job-photos')
  with check (bucket_id = 'job-photos');

drop policy if exists "job_photos_storage_delete" on storage.objects;
create policy "job_photos_storage_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos');

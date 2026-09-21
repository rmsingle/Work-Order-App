-- PSG Job Tracker — initial schema (CompanyCam-style photos primary)
-- Paste into Supabase SQL Editor and run once.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'employee'
    check (role in ('owner_admin', 'employee', 'customer')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  property_address text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_updated_at_idx on public.jobs (updated_at desc);
create index if not exists jobs_status_idx on public.jobs (status);

-- ---------------------------------------------------------------------------
-- job_notes
-- ---------------------------------------------------------------------------
create table if not exists public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_notes_job_id_idx on public.job_notes (job_id, created_at desc);

-- ---------------------------------------------------------------------------
-- job_photos (CompanyCam-style primary artifact)
-- storage_path = Supabase Storage object path when bucket is wired
-- local_uri    = device/local URI stub until upload pipeline exists
-- ---------------------------------------------------------------------------
create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text,
  local_uri text,
  lat double precision,
  lng double precision,
  caption text,
  kind text not null default 'general'
    check (kind in ('before', 'after', 'general')),
  pair_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint job_photos_has_uri check (storage_path is not null or local_uri is not null)
);

create index if not exists job_photos_job_id_idx on public.job_photos (job_id, created_at desc);
create index if not exists job_photos_pair_id_idx on public.job_photos (pair_id)
  where pair_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at trigger for jobs
-- ---------------------------------------------------------------------------
create or replace function public.set_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_jobs_updated_at();

-- ---------------------------------------------------------------------------
-- Auth → profile row on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
begin
  meta_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'PSG User'
  );

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    meta_name,
    new.phone,
    'employee'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS — shared authenticated access (roles tighten later)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_notes enable row level security;
alter table public.job_photos enable row level security;

-- profiles
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- jobs
drop policy if exists "jobs_select_authenticated" on public.jobs;
create policy "jobs_select_authenticated"
  on public.jobs for select to authenticated using (true);

drop policy if exists "jobs_insert_authenticated" on public.jobs;
create policy "jobs_insert_authenticated"
  on public.jobs for insert to authenticated with check (true);

drop policy if exists "jobs_update_authenticated" on public.jobs;
create policy "jobs_update_authenticated"
  on public.jobs for update to authenticated using (true) with check (true);

-- job_notes
drop policy if exists "job_notes_select_authenticated" on public.job_notes;
create policy "job_notes_select_authenticated"
  on public.job_notes for select to authenticated using (true);

drop policy if exists "job_notes_insert_authenticated" on public.job_notes;
create policy "job_notes_insert_authenticated"
  on public.job_notes for insert to authenticated with check (true);

drop policy if exists "job_notes_update_authenticated" on public.job_notes;
create policy "job_notes_update_authenticated"
  on public.job_notes for update to authenticated using (true) with check (true);

-- job_photos
drop policy if exists "job_photos_select_authenticated" on public.job_photos;
create policy "job_photos_select_authenticated"
  on public.job_photos for select to authenticated using (true);

drop policy if exists "job_photos_insert_authenticated" on public.job_photos;
create policy "job_photos_insert_authenticated"
  on public.job_photos for insert to authenticated with check (true);

drop policy if exists "job_photos_update_authenticated" on public.job_photos;
create policy "job_photos_update_authenticated"
  on public.job_photos for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Optional sample NC jobs (no created_by — works before first login)
-- Addresses are SAMPLE placeholders for Winston-Salem area demos.
-- ---------------------------------------------------------------------------
insert into public.jobs (title, property_address, status)
select * from (values
  ('HVAC filter change — Gilmer sample', 'Gilmer Ave, Winston-Salem, NC (SAMPLE)', 'open'),
  ('Unit turn punch — Raintree sample', 'Raintree Rd, Winston-Salem, NC (SAMPLE)', 'in_progress'),
  ('Exterior repair — Queen sample', 'Queen St, Winston-Salem, NC (SAMPLE)', 'open')
) as v(title, property_address, status)
where not exists (select 1 from public.jobs limit 1);

-- ---------------------------------------------------------------------------
-- Optional: Storage bucket for job photos (wire from app later)
-- Uncomment after creating project; or create bucket "job-photos" in Dashboard.
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public)
-- values ('job-photos', 'job-photos', false)
-- on conflict (id) do nothing;

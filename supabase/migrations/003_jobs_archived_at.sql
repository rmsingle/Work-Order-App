-- Soft-archive jobs so they leave the Jobs dashboard without deleting photos or notes.
-- Paste into the Supabase SQL Editor after 001 and 002. Safe to re-run.

alter table public.jobs
  add column if not exists archived_at timestamptz;

comment on column public.jobs.archived_at is
  'When set, the job is archived and hidden from the Jobs dashboard. Null means active.';

create index if not exists jobs_active_updated_at_idx
  on public.jobs (updated_at desc)
  where archived_at is null;

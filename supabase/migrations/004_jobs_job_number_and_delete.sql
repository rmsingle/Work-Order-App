-- Stable display numbers and permanent delete.
-- Paste into the Supabase SQL Editor after 001, 002, and 003. Safe to re-run.

alter table public.jobs
  add column if not exists job_number integer;

comment on column public.jobs.job_number is
  'Stable display number. Assigned once. Archive and delete do not renumber other jobs.';

with base as (
  select coalesce(max(job_number), 0) as floor
  from public.jobs
),
numbered as (
  select
    j.id,
    b.floor + row_number() over (order by j.created_at asc, j.id asc) as n
  from public.jobs j
  cross join base b
  where j.job_number is null
)
update public.jobs j
set job_number = numbered.n
from numbered
where j.id = numbered.id;

create sequence if not exists public.jobs_job_number_seq;

alter sequence public.jobs_job_number_seq owned by public.jobs.job_number;

do $$
declare
  floor_n bigint;
  seq_n bigint;
  called boolean;
begin
  select coalesce(max(job_number), 0) into floor_n from public.jobs;
  select last_value, is_called into seq_n, called from public.jobs_job_number_seq;
  if not called then
    seq_n := seq_n - 1;
  end if;
  perform setval('public.jobs_job_number_seq', greatest(floor_n, seq_n) + 1, false);
end $$;

alter table public.jobs
  alter column job_number set default nextval('public.jobs_job_number_seq');

alter table public.jobs
  alter column job_number set not null;

create unique index if not exists jobs_job_number_uidx on public.jobs (job_number);

grant select, insert, update, delete on public.jobs to authenticated;
grant select, insert, update, delete on public.job_notes to authenticated;
grant select, insert, update, delete on public.job_photos to authenticated;
grant usage, select on sequence public.jobs_job_number_seq to authenticated;

drop policy if exists "jobs_delete_authenticated" on public.jobs;
create policy "jobs_delete_authenticated"
  on public.jobs for delete to authenticated using (true);

drop policy if exists "job_notes_delete_authenticated" on public.job_notes;
create policy "job_notes_delete_authenticated"
  on public.job_notes for delete to authenticated using (true);

drop policy if exists "job_photos_delete_authenticated" on public.job_photos;
create policy "job_photos_delete_authenticated"
  on public.job_photos for delete to authenticated using (true);

notify pgrst, 'reload schema';

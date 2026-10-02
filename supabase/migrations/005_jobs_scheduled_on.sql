-- Week board date + invoice label + stable seed key.
-- Paste into the Supabase SQL Editor after 001–004. Safe to re-run.

alter table public.jobs
  add column if not exists scheduled_on date;

comment on column public.jobs.scheduled_on is
  'Calendar day this job sits on in the week and month boards. Null uses the local day of created_at.';

alter table public.jobs
  add column if not exists invoice_ref text;

comment on column public.jobs.invoice_ref is
  'Bill.com invoice number(s) when this job was billed. Null means not flagged. Paid/unpaid is not a balance.';

alter table public.jobs
  add column if not exists seed_key text;

comment on column public.jobs.seed_key is
  'Stable id for scripts/seed current work. Null on jobs created in the app.';

create unique index if not exists jobs_seed_key_uidx on public.jobs (seed_key);

create index if not exists jobs_scheduled_on_idx on public.jobs (scheduled_on);

notify pgrst, 'reload schema';

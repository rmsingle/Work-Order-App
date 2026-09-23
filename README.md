# PSG Job Tracker

Property maintenance job tracker for **Property Services Group LLC** (PSG / Rob Singletary, Winston-Salem, NC).

Working name: **PSG Job Tracker**  
Stack: Expo SDK 57 (React Native + TypeScript) · Expo Router · Supabase  
Targets: iOS, Android, and a public web app (static export on Vercel, opened in a phone browser)

CompanyCam-style MVP: **photos are the primary artifact** on each job (GPS + timestamp + optional caption). Each work item is one spaced two-column row: the original photo and its note on the left, and either **Mark complete** or the completion photo on the right. Field notes that are not on a photo are listed as text.

## What works

| Feature | Status |
| --- | --- |
| Phone + password sign-in | Working — US phone maps to `{10digits}@psg-jobs.app`, then `signInWithPassword` |
| Email sign-in | Working as a secondary option. The login screen does not offer public sign-up |
| Session persistence | Working (AsyncStorage / localStorage) |
| Sign out | Working |
| Jobs list (day columns, job number, address, status, pull-to-refresh) | Working — gold **New Job** at the top. Active jobs sit in columns by the local day of `created_at`. The current week stays visible, including empty days. Archived jobs stay below the board |
| New Job (title + property address + photos) | Working — gold button opens the sheet; photos upload to `job-photos` after the job row exists |
| Job detail — centered header title, two-column rows, Open in Google Maps beside the address | Working |
| Fast Capture (camera / library) | Working — uploads to Storage and sets `storage_path` |
| GPS lat/lng on photos | Working when permission granted; null if denied |
| Before / after pairs (`pair_id` on the photo rows) | Working — one row per item; completion photo fills the right column |
| Mark complete on each original photo | Working — button sits in the right column until the completion photo replaces it, then `jobs.status = done` |
| Archive job | Working — confirm, then set `jobs.archived_at`. The active list hides that job. Archived jobs are listed below it |
| Delete job | Working — confirm, then the job, its notes, and its photos are removed |
| Job numbers | Working — each job keeps a `job_number` (`#1`, `#2`, …). New jobs take the next number. Archive and delete do not renumber the rest |
| Field notes (`job_notes`, text only) | Working |
| Add note (author from profile) | Working |
| Configure Supabase screen when env missing | Working |
| Supabase Storage upload (`job-photos` private bucket) | Working — `storage_path` set; signed URLs for display |
| Role-gated UI / customer invites | **Next pass** — `profiles.role` is stored; the UI does not gate on it |
| Quotes / invoices / scheduling / payments | Out of scope |

## Project structure

App files live at the repository root (Work-Order-App):

```
app/
  _layout.tsx
  index.tsx                 # session redirect or Configure Supabase
  (auth)/login.tsx          # phone + password (email as a fallback)
  (app)/_layout.tsx         # auth gate + stack
  (app)/jobs/index.tsx      # day-column jobs dashboard + New Job
  (app)/jobs/[id].tsx       # photo-first detail + Add photo at the top
components/                 # ConfigureSupabase, StatusBadge, BeforeAfterPair, ArchiveJobButton, DeleteJobButton
contexts/AuthContext.tsx
constants/theme.ts          # navy / gold / white
lib/
  supabase.ts
  storage.ts                # upload + signed URLs
  photo-storage.ts          # bucket name, object path, display URL
  types.ts
  photos.ts                 # camera, library, GPS, pair ids
  phoneAuth.ts              # US phone → `{digits}@psg-jobs.app` login email
  archive-job.ts            # confirm before archiving a job
  delete-job.ts             # confirm, then permanently delete a job
  dialog.ts                 # web confirm/alert called on window (native uses Alert)
  job-number.ts             # #N label; detect a database that has not added job_number yet
  timeline.ts
supabase/migrations/
  001_init.sql
  002_storage_job_photos.sql
  003_jobs_archived_at.sql
  004_jobs_job_number_and_delete.sql
supabase/002_storage_policies_for_dashboard.txt
.env.example
vercel.json               # Vercel install, web export, dist, SPA rewrite
README.md
```

## CompanyCam pattern → tables / screens

| Pattern | Implementation |
| --- | --- |
| Project / job site | `jobs` + Jobs list + New Job + Job detail header. Each card and the detail screen show a stable `#N`. **Archive job** sets `archived_at` and the active list hides that job. **Delete job** removes it after confirm |
| Photo as primary artifact | `job_photos.storage_path` + two-column rows (`contentFit="contain"`) |
| Geotag + timestamp | `lat`, `lng`, `created_at` |
| Caption | `caption` (optional) |
| Before / after | `kind` + `pair_id`. Left column is the original; the right column is Mark complete until the after photo replaces it |
| Field notes | `job_notes` listed as text under Notes. Photos are not repeated there |
| Fast Capture | **Add photo** is the gold button under the job title on the detail page (not in the header). The sheet offers **Use camera** and **Choose from library** only (web: photos or files). Photos save as `kind = general`. The jobs list cards have no Add photo control. **New Job** can attach several photos in the create sheet; they upload with the same `job-photos` pipeline after the job exists. Detail upload takes a note, then camera or library. |
| Mark complete | On each original photo, in the right-hand column. Opens the upload sheet for a completion photo (`kind = after`, shared `pair_id`). After upload, that photo replaces the button. **Upload and mark complete** sets `jobs.status` to `done`. Cancel does not change status |
| Notes / comments | `job_notes` + add-note form |

## Rob checklist (Supabase dashboard)

Do these clicks once. The repo cannot create the project, turn on providers, or hold API keys. Nothing below belongs in git.

1. **Create the project.** [supabase.com](https://supabase.com) → New project. Pick the org, name, database password, and region. Wait until the project is healthy.
2. **Copy the client credentials.** Open **Connect**, or **Settings → API Keys** (older projects: **Project Settings → API**).
   - Project URL → `EXPO_PUBLIC_SUPABASE_URL`
   - **Publishable** key (`sb_publishable_…`) or the legacy **anon** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Do **not** copy the secret key (`sb_secret_…`) or `service_role`. Those bypass RLS. The app refuses to start if one of those is pasted into `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. **Put them in `.env` on your machine only.**

   ```bash
   cp .env.example .env
   ```

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

   `.env` is gitignored. Commit `.env.example` only.
4. **Enable Email.** **Authentication → Providers** (sometimes **Sign In / Providers**) → **Email** → turn it on → Save.
   - If **Confirm email** stays on, sign-up will not open the jobs list until the inbox link is clicked. Turn **Confirm email** off when you want a session immediately after sign-up.
5. **Create employee logins in Supabase.** **Authentication → Users → Add user.** The email is the 10-digit US phone plus `@psg-jobs.app` (example: `3365462585@psg-jobs.app`). Set a password. Employees sign in on the app with that phone number and password. The app calls `signInWithPassword` on the synthetic email. They do not create their own accounts. SMS OTP is not used for this login.
6. **Run the SQL, in order.** **SQL Editor** → New query → paste `supabase/migrations/001_init.sql` → **Run**. Then a new query → paste `supabase/migrations/002_storage_job_photos.sql` → **Run**. Then paste `supabase/migrations/003_jobs_archived_at.sql` → **Run**. Then paste `supabase/migrations/004_jobs_job_number_and_delete.sql` → **Run**.
   - `001` creates profiles, jobs, notes, photos, RLS, the signup trigger, and three sample Winston-Salem jobs.
   - `002` creates the **private** `job-photos` bucket only. It does not create storage policies. The SQL Editor cannot `ALTER` or `CREATE POLICY` on `storage.objects` (error 42501; that table is owned by `supabase_storage_admin`). Re-run `002` if you already applied an older `001` that left the bucket commented out.
   - `003` adds nullable `jobs.archived_at`. The active Jobs list only shows rows where that column is null. If you already ran `001`, run `003` once so **Archive job** can save.
   - `004` adds `jobs.job_number` (unique, assigned by a sequence, backfilled in `created_at` order) and DELETE policies so **Delete job** can remove a job, its notes, and its photos. Run `004` once on a database that already has `001`–`003`. Numbers stay put when other jobs are archived or deleted.
7. **Add the four storage policies.** After `002`, open **Dashboard → Storage → Policies** for the `job-photos` bucket and add these four policies. Role is **authenticated**. Each expression is `bucket_id = 'job-photos'`:
   - `job_photos_storage_select` — SELECT, USING
   - `job_photos_storage_insert` — INSERT, WITH CHECK
   - `job_photos_storage_update` — UPDATE, USING and WITH CHECK
   - `job_photos_storage_delete` — DELETE, USING
   Exact expressions are in `supabase/002_storage_policies_for_dashboard.txt`.
8. **Confirm the bucket.** **Storage → Files** (or **Storage → Buckets**) should list `job-photos` and it should be **private**. Do not flip it to public. If `002` failed, fix the SQL error and run it again. Do not create a second public bucket by hand. Uploads also need the four `job_photos_storage_*` policies from the previous step.
9. **Restart the app** so Expo reloads `.env`:

   ```bash
   npx expo start
   ```

Sign in with the phone number and password from the Supabase user (or **Sign in with email**). Open a job from the list, then tap **Add photo**. Write a note, choose the picture, then **Upload photo**. The photo row’s `storage_path` should look like `{job_id}/{uuid}.jpg`, and `caption` should be the note you typed. A second signed-in device should see that photo after opening the job again. Rows that only have `local_uri` (captured before this storage pass) do not sync.

10. **After the first Vercel deploy**, add that production URL in Supabase. **Authentication → URL Configuration**: set **Site URL** to the production URL, and add the same URL under **Redirect URLs**. Details are in [Deploy the web app on Vercel](#deploy-the-web-app-on-vercel).

## Setup

### 1. Install

```bash
npm install
```

### 2. Run

```bash
npx expo start
```

Expo SDK 57 / React Native 0.86 prefers Node `^20.19.4` or `^22.13`.

Then press `i` (iOS simulator), `a` (Android), or `w` (web).

Typecheck and confirm app writes still match the SQL:

```bash
npm run typecheck
npm run check:schema
```

## Deploy the web app on Vercel

Phone browsers load a static Expo web export. `app.json` sets `web.output` to `single`, so `npx expo export -p web` writes one `dist/index.html` plus JS and CSS. Job URLs such as `/jobs/<id>` are not known at build time, so Vercel rewrites every path that is not a real file to `/`, which serves that `index.html`. Expo Router then opens the screen. Do not deploy this from a laptop; create the Vercel project and let it build from git.

`vercel.json` at the repo root is the project config. In the Vercel dashboard, set **Framework Preset** to **Other** and use these three settings (they match the file):

| Setting | Value |
| --- | --- |
| Install Command | `npm ci` |
| Build Command | `npx expo export -p web` |
| Output Directory | `dist` |

`npm run build` and `npm run export:web` run the same export locally.

### Environment variables

In **Vercel → Project → Settings → Environment Variables**, set these for Production (and Preview, if preview URLs should log in). Expo inlines `EXPO_PUBLIC_*` **at build time**. Set them before the first deploy, and redeploy after any change.

| Name | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL (`https://<ref>.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_…`) or the legacy **anon** key |

Never set `service_role` or a secret key (`sb_secret_…`). Those bypass row level security. The app refuses to start if one is used as `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

`.env` stays gitignored. Commit `.env.example` only. Do not paste real keys into the repo.

### Supabase Auth URL

After the first deploy, open **Authentication → URL Configuration** and add the production URL (for example `https://<project>.vercel.app`):

- **Site URL** — the production URL
- **Redirect URLs** — the same production URL, plus any preview URL you will actually use

Email confirmation and auth redirects use that list. Without it, a link in an email can send someone to localhost.

## Schema (summary)

- **profiles** — `id` = `auth.users.id`, `full_name`, `phone`, `role` (`owner_admin` \| `employee` \| `customer`)
- **jobs** — `job_number` (stable `#N`), title, property_address, status (`open` \| `in_progress` \| `done` \| `cancelled`), created_by, timestamps, `archived_at` (null = on the active dashboard). There is no scheduled or due date. The Jobs screen groups active jobs by the local calendar day of `created_at` and always shows the current Monday–Sunday week. Insert sends `title`, `property_address`, `status`, `created_by`; the database assigns the next `job_number`. Archive sets `archived_at`. Delete removes the row after confirm
- **job_notes** — job_id, author_id, body, created_at. The app selects and inserts notes. It does not edit or delete them
- **job_photos** — job_id, storage_path (bucket object key), local_uri (legacy only), lat, lng, caption, kind (`before`|`after`|`general`), pair_id, created_by, created_at. Capture inserts `storage_path` and leaves `local_uri` null
- **storage** — private bucket `job-photos` (`002_storage_job_photos.sql`). After `002`, add the four `job_photos_storage_*` policies in **Dashboard → Storage → Policies** (authenticated select/insert/update/delete on that bucket only). Display uses 1-hour signed URLs
- Trigger: new `auth.users` → `profiles` row
- RLS: authenticated select/insert/update on jobs, notes, photos, plus delete (`004`) so a job can be removed permanently (shared foundation; roles tighten later)
- Seed: 3 SAMPLE Winston-Salem area jobs (Gilmer / Raintree / Queen)

## Brand

Simple navy / gold / white styling for Property Services Group LLC.

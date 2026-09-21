# PSG Job Tracker

Property maintenance job tracker for **Property Services Group LLC** (PSG / Rob Singletary, Winston-Salem, NC).

Working name: **PSG Job Tracker**  
Stack: Expo SDK 57 (React Native + TypeScript) · Expo Router · Supabase  
Targets: iOS, Android, web

CompanyCam-style MVP: **photos are the primary artifact** on each job (GPS + timestamp + optional caption), with a chronological timeline of photos + notes, before/after pairing, and a Fast Capture action.

## What works

| Feature | Status |
| --- | --- |
| Email sign-in / sign-up | Working (Supabase Auth) |
| Phone OTP sign-in | Working after Phone + an SMS provider are enabled in Supabase |
| Session persistence | Working (AsyncStorage / localStorage) |
| Sign out | Working |
| Jobs list (title, address, status, updated_at, pull-to-refresh, empty state) | Working |
| New Job (title + property address) | Working |
| Job detail — photo gallery strip | Working |
| Fast Capture (camera / library) | Working — uploads to Storage and sets `storage_path` |
| GPS lat/lng on photos | Working when permission granted; null if denied |
| Before / after pairs (`pair_id`, side-by-side UI) | Working |
| Timeline (photos + notes, newest first) | Working |
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
  (auth)/login.tsx          # email or phone
  (app)/_layout.tsx         # auth gate + stack
  (app)/jobs/index.tsx      # jobs dashboard + New Job
  (app)/jobs/[id].tsx       # photo-first detail + Capture FAB
components/                 # ConfigureSupabase, StatusBadge, BeforeAfterPair
contexts/AuthContext.tsx
constants/theme.ts          # navy / gold / white
lib/
  supabase.ts
  storage.ts                # upload + signed URLs
  photo-storage.ts          # bucket name, object path, display URL
  types.ts
  photos.ts                 # camera, library, GPS, pair ids
  timeline.ts
supabase/migrations/
  001_init.sql
  002_storage_job_photos.sql
.env.example
README.md
```

## CompanyCam pattern → tables / screens

| Pattern | Implementation |
| --- | --- |
| Project / job site | `jobs` + Jobs list + New Job + Job detail header |
| Photo as primary artifact | `job_photos.storage_path` + gallery strip |
| Geotag + timestamp | `lat`, `lng`, `created_at` |
| Caption | `caption` (optional) |
| Before / after | `kind` + `pair_id`; `BeforeAfterPair` UI |
| Activity feed | Timeline merges `job_photos` + `job_notes` |
| Fast Capture | Gold FAB → camera/library sheet → Storage upload |
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
5. **Enable Phone OTP.** Same Providers page → **Phone** → turn it on → Save.
   - Phone will not send a code until an SMS provider is filled in on that screen (Twilio, Vonage, MessageBird, or TextLocal). That account is yours; this repo does not configure it.
   - The login screen expects E.164 numbers (`+13365551234`).
6. **Run the SQL, in order.** **SQL Editor** → New query → paste `supabase/migrations/001_init.sql` → **Run**. Then a new query → paste `supabase/migrations/002_storage_job_photos.sql` → **Run**.
   - `001` creates profiles, jobs, notes, photos, RLS, the signup trigger, and three sample Winston-Salem jobs.
   - `002` creates the **private** `job-photos` bucket and the storage policies the app needs to upload and sign URLs. Re-run it if you already applied an older `001` that left the bucket commented out.
7. **Confirm the bucket.** **Storage → Files** (or **Storage → Buckets**) should list `job-photos` and it should be **private**. Do not flip it to public. If `002` failed, fix the SQL error and run it again. Do not create a second public bucket by hand.
8. **Restart the app** so Expo reloads `.env`:

   ```bash
   npx expo start
   ```

Sign up with email (or phone, after the SMS provider is saved). Open a job (or tap **New Job**), then **Capture**. The photo row’s `storage_path` should look like `{job_id}/{uuid}.jpg`. A second signed-in device should see that photo after opening the job again. Rows that only have `local_uri` (captured before this storage pass) do not sync.

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

## Schema (summary)

- **profiles** — `id` = `auth.users.id`, `full_name`, `phone`, `role` (`owner_admin` \| `employee` \| `customer`)
- **jobs** — title, property_address, status, created_by, timestamps. The app selects jobs, inserts a new job (`title`, `property_address`, `status`, `created_by`), and updates `updated_at`
- **job_notes** — job_id, author_id, body, created_at. The app selects and inserts notes. It does not edit or delete them
- **job_photos** — job_id, storage_path (bucket object key), local_uri (legacy only), lat, lng, caption, kind (`before`|`after`|`general`), pair_id, created_by, created_at. Capture inserts `storage_path` and leaves `local_uri` null
- **storage** — private bucket `job-photos` (`002_storage_job_photos.sql`). Authenticated select/insert/update/delete on that bucket only. Display uses 1-hour signed URLs
- Trigger: new `auth.users` → `profiles` row
- RLS: authenticated select/insert/update on jobs, notes, photos (shared foundation; roles tighten later)
- Seed: 3 SAMPLE Winston-Salem area jobs (Gilmer / Raintree / Queen)

## Brand

Simple navy / gold / white styling for Property Services Group LLC.

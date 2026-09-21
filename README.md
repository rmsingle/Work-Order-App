# PSG Job Tracker

Property maintenance job tracker for **Property Services Group LLC** (PSG / Rob Singletary, Winston-Salem, NC).

Working name: **PSG Job Tracker**  
Stack: Expo SDK 57 (React Native + TypeScript) · Expo Router · Supabase  
Targets: iOS, Android, web

CompanyCam-style MVP: **photos are the primary artifact** on each job (GPS + timestamp + optional caption), with a chronological timeline of photos + notes, before/after pairing, and a Fast Capture action.

## What works (pass 1)

| Feature | Status |
| --- | --- |
| Email sign-in / sign-up | Working (Supabase Auth) |
| Phone OTP sign-in | Working if Phone provider enabled in Supabase |
| Session persistence | Working (AsyncStorage / localStorage) |
| Sign out | Working |
| Jobs list (title, address, status, updated_at, pull-to-refresh, empty state) | Working |
| Job detail — photo gallery strip | Working |
| Fast Capture (camera / library) | Working — saves `local_uri` |
| GPS lat/lng on photos | Working when permission granted; null if denied |
| Before / after pairs (`pair_id`, side-by-side UI) | Working |
| Timeline (photos + notes, newest first) | Working |
| Add note (author from profile) | Working |
| Configure Supabase screen when env missing | Working |
| Supabase Storage upload to bucket | **Stubbed** — schema has `storage_path`; app writes `local_uri` until bucket wiring |
| Role-gated UI / customer invites | **Next pass** — not in this MVP |
| Quotes / invoices / scheduling / payments | Out of scope |

## Project structure

App files live at the repository root (Work-Order-App):

```
app/
  _layout.tsx
  index.tsx                 # session redirect or Configure Supabase
  (auth)/login.tsx          # email or phone
  (app)/_layout.tsx         # auth gate + stack
  (app)/jobs/index.tsx      # jobs dashboard
  (app)/jobs/[id].tsx       # photo-first detail + Capture FAB
components/                 # ConfigureSupabase, StatusBadge, BeforeAfterPair
contexts/AuthContext.tsx
constants/theme.ts          # navy / gold / white
lib/
  supabase.ts
  types.ts
  photos.ts                 # camera, library, GPS, pair ids
  timeline.ts
supabase/migrations/001_init.sql
.env.example
README.md
```

## CompanyCam pattern → tables / screens

| Pattern | Implementation |
| --- | --- |
| Project / job site | `jobs` + Jobs list + Job detail header |
| Photo as primary artifact | `job_photos` + gallery strip on detail |
| Geotag + timestamp | `lat`, `lng`, `created_at` |
| Caption | `caption` (optional) |
| Before / after | `kind` + `pair_id`; `BeforeAfterPair` UI |
| Activity feed | Timeline merges `job_photos` + `job_notes` |
| Fast Capture | Gold FAB → camera/library sheet |
| Notes / comments | `job_notes` + add-note form |

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run `supabase/migrations/001_init.sql`.
3. **Authentication → Providers**: enable Email; optionally enable Phone (Twilio/MessageBird/etc.).
4. (Optional later) Storage → create private bucket `job-photos` for `storage_path` uploads.

### 3. Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Values: Supabase → Project Settings → API.

**Never commit real secrets.** `.env` is gitignored.

### 4. Run

```bash
npx expo start
```

Expo SDK 57 / React Native 0.86 prefers Node `^20.19.4` or `^22.13`.

Then press `i` (iOS simulator), `a` (Android), or `w` (web).

Typecheck:

```bash
npm run typecheck
```

## Schema (summary)

- **profiles** — `id` = `auth.users.id`, `full_name`, `phone`, `role` (`owner_admin` \| `employee` \| `customer`)
- **jobs** — title, property_address, status, created_by, timestamps
- **job_notes** — job_id, author_id, body, created_at
- **job_photos** — job_id, storage_path, local_uri, lat, lng, caption, kind (`before`|`after`|`general`), pair_id, created_by, created_at
- Trigger: new `auth.users` → `profiles` row
- RLS: authenticated select/insert/update on jobs, notes, photos (shared foundation; roles tighten later)
- Seed: 3 SAMPLE Winston-Salem area jobs (Gilmer / Raintree / Queen)

## Brand

Simple navy / gold / white styling for Property Services Group LLC.

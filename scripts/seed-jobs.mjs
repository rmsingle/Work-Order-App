#!/usr/bin/env node
/**
 * Apply the current-work seed to Supabase.
 *
 * Preferred (no secret key on a laptop):
 *   1. Supabase → SQL Editor
 *   2. Paste and run supabase/migrations/005_jobs_scheduled_on.sql
 *   3. Paste and run supabase/migrations/006_seed_current_work.sql
 *
 * Optional, if you already have a Postgres connection string:
 *   SUPABASE_DB_URL="postgresql://..." node scripts/seed-jobs.mjs
 *
 * Do not put the service-role key or database URL in the app or in git.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = [
  'supabase/migrations/005_jobs_scheduled_on.sql',
  'supabase/migrations/006_seed_current_work.sql',
];

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
if (!dbUrl) {
  console.log('No SUPABASE_DB_URL or DATABASE_URL set.');
  console.log('Paste these files into the Supabase SQL Editor, in order:');
  for (const file of files) console.log(`  ${file}`);
  process.exit(0);
}

for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${file}`);
    process.exit(1);
  }
  console.log(`Applying ${file}`);
  const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', full], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`psql failed on ${file}`);
    process.exit(result.status ?? 1);
  }
}

console.log('Schedule columns and current-work rows are applied.');

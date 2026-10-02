import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/006_seed_current_work.sql'), 'utf8');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const units = [
  '101',
  '106',
  '115',
  '204',
  '315',
  '414',
  '517',
  '601',
  '708',
  '716',
  '811',
  '816',
  '820',
  '912',
  '1008',
  '1019',
  '1103',
  '1306',
  '1313',
  '1404',
  '1407',
  '1410',
  '1503',
  '1504',
  '1506',
  '1511',
  '1513',
];

for (const unit of units) {
  const title = `NC Unit ${unit} —`;
  if (!sql.includes(title)) fail(`seed is missing ${title}`);
  if (!sql.includes(`'nc-${unit}'`)) fail(`seed is missing seed_key nc-${unit}`);
}

if (!sql.includes("'nc-walk-2026-10-02'")) fail('seed is missing the Oct 2 walk verification job');
if (!sql.includes('verify units called complete')) fail('walk job title missing');

for (const banned of ['1006', 'Gilmer', 'Queen', 'Raintree', 'Triad', 'Clint']) {
  if (sql.includes(banned)) fail(`seed must not mention ${banned}`);
}

const doneCount = (sql.match(/'done'/g) ?? []).length;
if (doneCount !== 2) fail(`expected paint-done units 708 and 912 only, found ${doneCount}`);

if (!sql.includes("date '2026-09-14'")) fail('912 must stay on Sep 14');
if (!sql.includes("date '2026-09-15'")) fail('708 must stay on Sep 15');
for (const day of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']) {
  if (!sql.includes(`date '${day}'`)) fail(`current week is missing ${day}`);
}

if (!sql.includes('2026280') || !sql.includes('2026281')) fail('Sep 30 invoice numbers must be on the seed');

const byDay = new Map();
for (const match of sql.matchAll(/'((?:nc|audit)-[^']+)'[\s\S]*?date '(\d{4}-\d{2}-\d{2})'/g)) {
  const day = match[2];
  const keys = byDay.get(day) ?? [];
  keys.push(match[1]);
  byDay.set(day, keys);
}
const expectDay = {
  '2026-09-28': 5,
  '2026-09-29': 5,
  '2026-09-30': 6,
  '2026-10-01': 5,
  '2026-10-02': 5,
};
for (const [day, min] of Object.entries(expectDay)) {
  const count = byDay.get(day)?.length ?? 0;
  if (count < min) fail(`${day} has ${count} jobs, wanted at least ${min}`);
}
if (!byDay.get('2026-10-02')?.includes('nc-walk-2026-10-02')) fail('walk note must sit on Oct 2');
if (!byDay.get('2026-09-14')?.includes('nc-912')) fail('912 must stay on Sep 14');
if (!byDay.get('2026-09-15')?.includes('nc-708')) fail('708 must stay on Sep 15');
if (byDay.get('2026-10-02')?.includes('nc-1103')) fail('1103 is scheduled on Oct 1, not crowded onto Friday');
if (!sql.includes('on conflict (seed_key)')) fail('seed must upsert on seed_key');
if (!sql.includes("body like 'Seed:%'")) fail('re-running the seed must replace only seed notes');

console.log(`seed sql has ${units.length} Northcliffe units plus the walk note`);

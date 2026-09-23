import assert from 'node:assert/strict';
import { buildJobDayColumns, currentWeekDays, formatBoardRange, localDayKey } from '../lib/job-board.ts';

const now = new Date(2026, 8, 23, 15, 30, 0);
const week = currentWeekDays(now);
assert.equal(week.length, 7);
assert.equal(localDayKey(week[0]), '2026-09-21');
assert.equal(localDayKey(week[6]), '2026-09-27');
assert.equal(week[0].getDay(), 1);

const columns = buildJobDayColumns(
  [
    { id: 'wed-b', created_at: new Date(2026, 8, 23, 18, 0, 0).toISOString(), job_number: 8 },
    { id: 'wed-a', created_at: new Date(2026, 8, 23, 9, 0, 0).toISOString(), job_number: 3 },
    { id: 'old', created_at: new Date(2026, 8, 1, 12, 0, 0).toISOString(), job_number: 1 },
  ],
  now
);

const keys = columns.map((column) => column.key);
assert.ok(keys.includes('2026-09-01'));
assert.ok(keys.includes('2026-09-21'));
assert.ok(keys.includes('2026-09-27'));
assert.equal(keys.includes('2026-09-02'), false);
assert.deepEqual(keys, [...keys].sort());

const wednesday = columns.find((column) => column.key === '2026-09-23');
assert.ok(wednesday);
assert.equal(wednesday.isToday, true);
assert.equal(wednesday.weekday, 'Wed');
assert.equal(wednesday.dayNum, '23');
assert.deepEqual(
  wednesday.jobs.map((job) => job.id),
  ['wed-a', 'wed-b']
);

const thursday = columns.find((column) => column.key === '2026-09-24');
assert.ok(thursday);
assert.equal(thursday.jobs.length, 0);

assert.equal(formatBoardRange(columns), 'Sep 1–27, 2026');
assert.equal(
  formatBoardRange([
    { date: new Date(2026, 8, 28) },
    { date: new Date(2026, 9, 2) },
  ]),
  'Sep 28 – Oct 2, 2026'
);

console.log('job day columns match created_at local days');

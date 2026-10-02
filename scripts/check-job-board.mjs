import assert from 'node:assert/strict';
import {
  buildJobDayColumns,
  buildMonthCells,
  currentWeekDays,
  formatBoardRange,
  jobBoardDayKey,
  jobCardFace,
  localDayKey,
} from '../lib/job-board.ts';

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
    {
      id: 'moved',
      created_at: new Date(2026, 7, 1, 12, 0, 0).toISOString(),
      scheduled_on: '2026-09-23',
      job_number: 2,
    },
  ],
  now
);

const keys = columns.map((column) => column.key);
assert.deepEqual(keys, [
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
]);
assert.equal(keys.includes('2026-09-01'), false);

const wednesday = columns.find((column) => column.key === '2026-09-23');
assert.ok(wednesday);
assert.equal(wednesday.isToday, true);
assert.equal(wednesday.weekday, 'Wed');
assert.equal(wednesday.dayNum, '23');
assert.deepEqual(
  wednesday.jobs.map((job) => job.id),
  ['moved', 'wed-a', 'wed-b']
);

const thursday = columns.find((column) => column.key === '2026-09-24');
assert.ok(thursday);
assert.equal(thursday.jobs.length, 0);

assert.equal(formatBoardRange(columns), 'Sep 21–27, 2026');
assert.equal(
  formatBoardRange([
    { date: new Date(2026, 8, 28) },
    { date: new Date(2026, 9, 4) },
  ]),
  'Sep 28–Oct 4, 2026'
);

assert.equal(jobBoardDayKey({ id: 'x', created_at: '2026-09-14T16:00:00.000Z', scheduled_on: '2026-10-02' }), '2026-10-02');

const today = new Date(2026, 9, 2, 9, 0, 0);
const month = buildMonthCells(
  [{ id: 'friday', created_at: '2026-09-01T12:00:00.000Z', scheduled_on: '2026-10-02', job_number: 4 }],
  today,
  today
);
assert.equal(month[0].date.getDay(), 1);
assert.equal(localDayKey(month[0].date), '2026-09-28');
const friday = month.find((cell) => cell.key === '2026-10-02');
assert.ok(friday);
assert.equal(friday.isToday, true);
assert.equal(friday.inMonth, true);
assert.deepEqual(
  friday.jobs.map((job) => job.id),
  ['friday']
);

const face = jobCardFace({
  title: 'NC Unit 1103 — paint + vinyl',
  property_address: 'Northcliffe Forest Apartments Unit 1103, Winston-Salem, NC',
});
assert.equal(face.task, 'paint + vinyl');
assert.equal(face.unit, 'Unit 1103');
assert.equal(face.place, 'Northcliffe');

console.log('week and month boards group by scheduled_on');

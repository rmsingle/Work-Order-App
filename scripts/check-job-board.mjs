import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BOARD_MAX_WIDTH,
  WEEK_COLUMN_GAP,
  WEEK_FIT_MIN_WIDTH,
  boardChrome,
  buildJobDayColumns,
  buildMonthCells,
  currentWeekDays,
  fittedWeekColumnWidth,
  formatBoardRange,
  formatDayTitle,
  jobBoardDayKey,
  jobCardFace,
  localDayKey,
  splitRowWidths,
  visibleWeekColumns,
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

assert.equal(formatDayTitle(wednesday.date), 'Wednesday, Sep 23');
assert.equal(formatDayTitle(new Date(2026, 9, 2)), 'Friday, Oct 2');

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

const visible = visibleWeekColumns(columns);
assert.equal(visible.length, 6);
assert.ok(visible.every((column) => column.date.getDay() !== 0));
assert.equal(visible[0].key, '2026-09-21');
assert.equal(visible[5].key, '2026-09-26');
assert.equal(formatBoardRange(visible), 'Sep 21–26, 2026');
assert.equal(visibleWeekColumns(columns, true).length, 7);

const face = jobCardFace({
  title: 'NC Unit 1103 — paint + vinyl',
  property_address: 'Northcliffe Forest Apartments Unit 1103, Winston-Salem, NC',
});
assert.equal(face.task, 'paint + vinyl');
assert.equal(face.unit, 'Unit 1103');
assert.equal(face.place, 'Northcliffe');
assert.equal(face.address, 'Unit 1103, Winston-Salem');

const other = jobCardFace({
  title: 'NC Unit 1019 — cabinets + vents',
  property_address: 'Northcliffe Forest Apartments Unit 1019, Winston-Salem, NC',
});
assert.equal(other.unit, 'Unit 1019');
assert.equal(other.task, 'cabinets + vents');
assert.equal(other.address, 'Unit 1019, Winston-Salem');
assert.notEqual(face.unit, other.unit);
assert.notEqual(face.task, other.task);
assert.notEqual(face.address, other.address);

const walk = jobCardFace({
  title: 'NC — verify units called complete',
  property_address: 'Northcliffe Forest Apartments, Winston-Salem, NC',
});
assert.equal(walk.unit, 'NC');
assert.equal(walk.task, 'verify units called complete');
assert.equal(walk.address, 'Northcliffe Forest Apartments, Winston-Salem');

assert.equal(
  jobCardFace({
    title: 'CGC 1612 — double door + lock',
    property_address: '1600 N Main Street, Unit 1612, High Point, NC',
  }).address,
  'Unit 1612, High Point'
);
assert.equal(
  jobCardFace({
    title: 'Wachovia 322 — pull-cord lights',
    property_address: 'Wachovia House, Unit 322',
  }).address,
  'Wachovia House, Unit 322'
);

function assertWeekFits(windowWidth) {
  const chrome = boardChrome(windowWidth);
  assert.equal(chrome.fitWeek, true);
  assert.ok(chrome.frameWidth <= BOARD_MAX_WIDTH);
  assert.ok(chrome.frameWidth <= windowWidth);
  assert.ok(windowWidth - chrome.frameWidth >= 0);
  const column = fittedWeekColumnWidth(chrome.innerWidth);
  const row = column * 7 + WEEK_COLUMN_GAP * 6;
  assert.ok(row <= chrome.innerWidth, `${windowWidth}px week row ${row} exceeds inner ${chrome.innerWidth}`);
  assert.ok(chrome.innerWidth <= chrome.frameWidth);
  assert.ok(chrome.frameWidth <= windowWidth);
  const month = splitRowWidths(chrome.innerWidth, 7);
  assert.equal(
    month.reduce((sum, width) => sum + width, 0),
    chrome.innerWidth
  );
  return { chrome, column };
}

const laptop = assertWeekFits(1280);
assert.equal(laptop.chrome.frameWidth, BOARD_MAX_WIDTH);
assert.ok(1280 - laptop.chrome.frameWidth >= 64, '1280px viewport keeps side gutters');
assert.ok(laptop.column >= 140, 'day columns stay readable at 1280');
const sixDayColumn = fittedWeekColumnWidth(laptop.chrome.innerWidth, WEEK_COLUMN_GAP, 6);
const sixDayRow = sixDayColumn * 6 + WEEK_COLUMN_GAP * 5;
assert.ok(sixDayRow <= laptop.chrome.innerWidth, 'Monday–Saturday still fits the centered frame');
assert.ok(sixDayColumn > laptop.column, 'hiding Sunday gives each day a wider card');

const wide = assertWeekFits(1440);
assert.equal(wide.chrome.frameWidth, BOARD_MAX_WIDTH);
assert.equal(wide.column, laptop.column, 'wider than the max, the board stays the same width');
assert.ok(1440 - wide.chrome.frameWidth >= 200);

assertWeekFits(1366);
const narrowLaptop = assertWeekFits(WEEK_FIT_MIN_WIDTH);
assert.ok(narrowLaptop.column >= 110, 'columns compress instead of overflowing just below a laptop width');

for (const width of [390, 768, WEEK_FIT_MIN_WIDTH - 1]) {
  const chrome = boardChrome(width);
  assert.equal(chrome.fitWeek, false, `${width}px stays a phone-style scroller`);
  assert.equal(chrome.frameWidth, width);
  const month = splitRowWidths(chrome.innerWidth, 7);
  assert.equal(
    month.reduce((sum, cell) => sum + cell, 0),
    chrome.innerWidth
  );
  assert.ok(chrome.innerWidth <= width);
}

const phoneNative = splitRowWidths(boardChrome(390).innerWidth, 7, 4);
assert.equal(
  phoneNative.reduce((sum, cell) => sum + cell, 0) + 4 * 7,
  boardChrome(390).innerWidth
);

const boardSource = fs.readFileSync(new URL('../app/(app)/jobs/index.tsx', import.meta.url), 'utf8');
assert.match(boardSource, /onOpenDay/);
assert.match(boardSource, /Open \$\{formatDayTitle/);
assert.match(boardSource, /overflow: shellOverflow/);
assert.match(boardSource, /'clip' as 'hidden'/);
assert.match(boardSource, /visibleWeekColumns/);
assert.match(boardSource, /showSunday/);
assert.match(boardSource, /Show Sun/);
assert.match(boardSource, /face\.address/);
assert.match(boardSource, /const \[showSunday, setShowSunday\] = useState\(false\)/);
assert.doesNotMatch(boardSource, /flex: \{ flex: 1, backgroundColor: colors\.offWhite, width: '100%', overflow: 'hidden' \}/);

const detailSource = fs.readFileSync(new URL('../app/(app)/jobs/[id].tsx', import.meta.url), 'utf8');
assert.match(detailSource, /boardChrome/);
assert.match(detailSource, /frameWidth/);
assert.match(detailSource, /styles\.detailFrame/);
assert.match(detailSource, /\[styles\.sheet, frameStyle\]/);

console.log('week and month boards group by scheduled_on');

export type BoardJob = {
  id: string;
  created_at: string;
  scheduled_on?: string | null;
  job_number?: number | null;
  title?: string;
  property_address?: string | null;
};

export type DayColumn<T extends BoardJob> = {
  key: string;
  date: Date;
  weekday: string;
  dayNum: string;
  monthLabel: string;
  isToday: boolean;
  jobs: T[];
};

export type MonthCell<T extends BoardJob> = DayColumn<T> & {
  inMonth: boolean;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Monday-first labels for the month grid header. */
export const MONDAY_FIRST_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local calendar day as YYYY-MM-DD. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDay(iso: string): Date | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday through Sunday that contains `now`, in local time. */
export function currentWeekDays(now = new Date()): Date[] {
  const start = startOfDay(now);
  const weekday = start.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + delta);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/**
 * Board day for a job. `scheduled_on` (YYYY-MM-DD) wins.
 * Jobs created in the app with no schedule fall back to the local day of `created_at`.
 */
export function jobBoardDayKey(job: BoardJob): string | null {
  const scheduled = job.scheduled_on?.trim().slice(0, 10);
  if (scheduled && /^\d{4}-\d{2}-\d{2}$/.test(scheduled)) return scheduled;
  const created = parseLocalDay(job.created_at);
  return created ? localDayKey(created) : null;
}

function compareJobs(a: BoardJob, b: BoardJob) {
  const aNumber = a.job_number ?? Number.MAX_SAFE_INTEGER;
  const bNumber = b.job_number ?? Number.MAX_SAFE_INTEGER;
  if (aNumber !== bNumber) return aNumber - bNumber;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function columnFor<T extends BoardJob>(date: Date, todayKey: string, jobs: T[]): DayColumn<T> {
  return {
    key: localDayKey(date),
    date,
    weekday: WEEKDAYS[date.getDay()] ?? '',
    dayNum: String(date.getDate()),
    monthLabel: MONTHS[date.getMonth()] ?? '',
    isToday: localDayKey(date) === todayKey,
    jobs: [...jobs].sort(compareJobs),
  };
}

function groupByBoardDay<T extends BoardJob>(jobs: T[]): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const job of jobs) {
    const key = jobBoardDayKey(job);
    if (!key) continue;
    const bucket = byDay.get(key);
    if (bucket) bucket.push(job);
    else byDay.set(key, [job]);
  }
  return byDay;
}

/**
 * One Monday–Sunday week of day columns. Empty days stay on the board.
 * `anchor` picks the week. `today` marks the Today column (defaults to `anchor`
 * so a single date argument still means "this week, and that day is today").
 */
export function buildJobDayColumns<T extends BoardJob>(
  jobs: T[],
  anchor = new Date(),
  today = anchor
): DayColumn<T>[] {
  const byDay = groupByBoardDay(jobs);
  const todayKey = localDayKey(startOfDay(today));
  return currentWeekDays(anchor).map((date) => columnFor(date, todayKey, byDay.get(localDayKey(date)) ?? []));
}

/** Month grid, weeks starting Monday, including the leading and trailing days. */
export function buildMonthCells<T extends BoardJob>(
  jobs: T[],
  anchor: Date,
  today = new Date()
): MonthCell<T>[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = currentWeekDays(firstOfMonth)[0];
  const end = currentWeekDays(lastOfMonth)[6];
  const byDay = groupByBoardDay(jobs);
  const todayKey = localDayKey(startOfDay(today));
  const cells: MonthCell<T>[] = [];
  for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    const column = columnFor(cursor, todayKey, byDay.get(localDayKey(cursor)) ?? []);
    cells.push({ ...column, inMonth: cursor.getMonth() === firstOfMonth.getMonth() });
  }
  return cells;
}

export function formatBoardRange(columns: { date: Date }[]): string {
  if (columns.length === 0) return '';
  const first = columns[0].date;
  const last = columns[columns.length - 1].date;
  const sameYear = first.getFullYear() === last.getFullYear();
  const sameMonth = sameYear && first.getMonth() === last.getMonth();
  if (sameMonth) {
    return `${MONTHS[first.getMonth()]} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`;
  }
  if (sameYear) {
    return `${MONTHS[first.getMonth()]} ${first.getDate()}–${MONTHS[last.getMonth()]} ${last.getDate()}, ${first.getFullYear()}`;
  }
  return `${MONTHS[first.getMonth()]} ${first.getDate()}, ${first.getFullYear()}–${MONTHS[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
}

export function formatMonthTitle(anchor: Date): string {
  return `${MONTHS_LONG[anchor.getMonth()]} ${anchor.getFullYear()}`;
}

/** "Friday, Oct 2" for the day drill-in title and press label. */
export function formatDayTitle(date: Date): string {
  return `${WEEKDAYS_LONG[date.getDay()] ?? ''}, ${MONTHS[date.getMonth()] ?? ''} ${date.getDate()}`;
}

/**
 * Widest the jobs board and job page grow on a laptop.
 * A 1280px window then keeps about 40px of gutter on each side — half of the
 * previous 80px gutters — instead of stretching the week wall to wall.
 */
export const BOARD_MAX_WIDTH = 1200;

/**
 * Horizontal padding inside the Sign out and Back pressables.
 * {@link headerControlInset} subtracts this so the label, not the padding, meets the content edge.
 */
export const HEADER_BUTTON_PAD = 12;

/** At this window width and above, the visible week days share one row (no horizontal scroll). */
export const WEEK_FIT_MIN_WIDTH = 960;

export const WEEK_COLUMN_GAP = 10;

/** Matches the horizontal inset on the toolbar, week row, and month grid. */
export const BOARD_SECTION_INSET = 16;

const WEEK_DAY_COUNT = 7;

export type BoardChrome = {
  /** All seven days are on screen together. */
  fitWeek: boolean;
  /** Centered shell width. Full viewport below {@link WEEK_FIT_MIN_WIDTH}. */
  frameWidth: number;
  /** Readable column width while the week is a horizontal scroller (phones). */
  scrollColumnWidth: number;
  /** Inner width of the week row and month grid after the section inset. */
  innerWidth: number;
};

/**
 * Empty space on one side of the centered frame.
 * Zero when the frame already fills the window (phones, and laptops at or under the max width).
 */
export function sideGutter(windowWidth: number): number {
  const width = Math.max(0, Math.floor(windowWidth));
  const chrome = boardChrome(width);
  if (!chrome.fitWeek) return 0;
  return Math.max(0, Math.floor((width - chrome.frameWidth) / 2));
}

/**
 * How far Sign out and Back move in from the viewport edge.
 * Their labels then line up with the board content, on the frame, not in the side gutters.
 */
export function headerControlInset(windowWidth: number): number {
  return sideGutter(windowWidth) + Math.max(0, BOARD_SECTION_INSET - HEADER_BUTTON_PAD);
}

export function boardChrome(windowWidth: number): BoardChrome {
  const width = Math.max(0, Math.floor(windowWidth));
  const fitWeek = width >= WEEK_FIT_MIN_WIDTH;
  const frameWidth = fitWeek ? Math.min(BOARD_MAX_WIDTH, width) : width;
  const slots = width >= 700 ? 2.2 : 1.7;
  const scrollColumnWidth = Math.max(
    168,
    Math.min(220, Math.floor((Math.max(width, 1) - 24) / slots))
  );
  return {
    fitWeek,
    frameWidth,
    scrollColumnWidth,
    innerWidth: Math.max(0, frameWidth - BOARD_SECTION_INSET * 2),
  };
}

/**
 * Equal day-column width inside a fitted week row, including the gaps between columns.
 * `dayCount` is 6 for the Monday–Saturday board and 7 when Sunday is shown.
 */
export function fittedWeekColumnWidth(
  innerWidth: number,
  gap = WEEK_COLUMN_GAP,
  dayCount = WEEK_DAY_COUNT
): number {
  const days = Math.max(1, Math.floor(dayCount));
  const budget = Math.max(0, Math.floor(innerWidth) - gap * (days - 1));
  return Math.floor(budget / days);
}

/** Week board columns. Sunday stays off unless `showSunday` is set. The month grid is unchanged. */
export function visibleWeekColumns<T extends BoardJob>(
  columns: DayColumn<T>[],
  showSunday = false
): DayColumn<T>[] {
  if (showSunday) return columns;
  return columns.filter((column) => column.date.getDay() !== 0);
}

/**
 * Integer cell widths that sum to `total` after optional per-cell border outset
 * (native borders sit outside the width; web is border-box so outset is 0).
 */
export function splitRowWidths(total: number, count: number, outsetPerCell = 0): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  const budget = Math.max(0, Math.floor(total) - outsetPerCell * safeCount);
  const base = Math.floor(budget / safeCount);
  let extra = budget - base * safeCount;
  return Array.from({ length: safeCount }, () => {
    const width = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    return width;
  });
}

export type JobCardFace = {
  /** Trade or scope, from the title after the dash. */
  task: string;
  /** Unit label parsed from the title, or the property name when the title has no unit. */
  unit: string;
  /** Short property name, such as Northcliffe. */
  place: string;
  /** Real slice of `property_address`. Includes the unit when the address has one. */
  address: string;
};

function propertyPlace(address: string | null | undefined, title: string): string {
  if ((address && /northcliffe/i.test(address)) || /^NC\b/.test(title)) return 'Northcliffe';
  if (!address?.trim()) return 'PSG';
  const first = address.split(',')[0]?.trim();
  return first || 'PSG';
}

function tidyUnit(match: string): string {
  return match.replace(/\s+/g, ' ').replace(/^unit/i, 'Unit');
}

/**
 * Short real slice of the property address so same-property jobs still differ.
 * "Northcliffe Forest Apartments Unit 1103, Winston-Salem, NC" → "Unit 1103, Winston-Salem".
 */
function addressSnippet(address: string | null | undefined): string {
  const raw = address?.trim() ?? '';
  if (!raw) return '';
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const unitMatch = raw.match(/\bunit\s+[A-Za-z0-9-]+\b/i);
  const unit = unitMatch ? tidyUnit(unitMatch[0]) : '';
  const state = parts.length >= 2 && /^[A-Za-z]{2}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : '';
  const city = state ? parts[parts.length - 2] : '';
  if (unit && city && !/^unit\b/i.test(city)) return `${unit}, ${city}`;
  if (unit && parts.length >= 2 && !/^unit\b/i.test(parts[0])) return `${parts[0]}, ${unit}`;
  if (unit) return unit;
  if (state && city) return `${parts[0]}, ${city}`;
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return parts[0] ?? raw;
}

/** Card lines from the job title and address: scope, unit, property, address snippet. */
export function jobCardFace(job: { title: string; property_address?: string | null }): JobCardFace {
  const place = propertyPlace(job.property_address, job.title);
  const address = addressSnippet(job.property_address) || place;
  const titled = job.title.match(/^(.*?)\s+[—–-]\s+(.+)$/);
  if (!titled) {
    return { task: job.title, unit: place, place, address };
  }
  const head = titled[1].trim();
  const task = titled[2].trim();
  const unitMatch = head.match(/unit\s+(.+)$/i);
  return {
    task,
    unit: unitMatch ? `Unit ${unitMatch[1].trim()}` : head,
    place,
    address,
  };
}

export type DayJob = {
  id: string;
  created_at: string;
  job_number?: number | null;
};

export type DayColumn<T extends DayJob> = {
  key: string;
  date: Date;
  weekday: string;
  dayNum: string;
  monthLabel: string;
  isToday: boolean;
  jobs: T[];
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local calendar day as YYYY-MM-DD. There is no scheduled date on a job, so this is the work-day key. */
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
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = start.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + delta);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function compareJobs(a: DayJob, b: DayJob) {
  const aNumber = a.job_number ?? Number.MAX_SAFE_INTEGER;
  const bNumber = b.job_number ?? Number.MAX_SAFE_INTEGER;
  if (aNumber !== bNumber) return aNumber - bNumber;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function columnFor(date: Date, todayKey: string, jobs: DayJob[]): DayColumn<DayJob> {
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

/**
 * Active jobs grouped by the local calendar day of `created_at`.
 * The current Monday–Sunday week is always present, including empty days.
 * Days outside that week appear only when they have a job, so a long gap does not fill the board.
 */
export function buildJobDayColumns<T extends DayJob>(jobs: T[], now = new Date()): DayColumn<T>[] {
  const byDay = new Map<string, T[]>();
  for (const job of jobs) {
    const day = parseLocalDay(job.created_at);
    if (!day) continue;
    const key = localDayKey(day);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(job);
    else byDay.set(key, [job]);
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = localDayKey(today);
  const week = currentWeekDays(today);
  const keys = new Set(week.map((day) => localDayKey(day)));
  for (const key of byDay.keys()) keys.add(key);

  const dates = [...keys]
    .map((key) => {
      const [y, m, d] = key.split('-').map((part) => Number(part));
      return new Date(y, (m || 1) - 1, d || 1);
    })
    .sort((a, b) => a.getTime() - b.getTime());

  return dates.map((date) => columnFor(date, todayKey, byDay.get(localDayKey(date)) ?? []) as DayColumn<T>);
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
    return `${MONTHS[first.getMonth()]} ${first.getDate()} – ${MONTHS[last.getMonth()]} ${last.getDate()}, ${first.getFullYear()}`;
  }
  return `${MONTHS[first.getMonth()]} ${first.getDate()}, ${first.getFullYear()} – ${MONTHS[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
}

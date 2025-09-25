import Airtable, { FieldSet } from 'airtable';

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  throw new Error('Airtable credentials are not configured');
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

const SESSIONS_TABLE = process.env.AIRTABLE_TABLE_SESSIONS || 'Session';

interface SessionFields extends FieldSet {
  year?: number;
  month?: number;
  day?: number;
  hours?: number;
  username?: string;
  sitename?: string;
  workdescription?: string;
  clockInAt?: string;
  clockOutAt?: string;
  projectName?: string;
}

export type SessionSummaryDay = {
  date: string;
  hours: number;
  sessions: number;
};

export type CalendarSummary = {
  year: number;
  month: number;
  days: SessionSummaryDay[];
};

export type DaySessionDetail = {
  username: string;
  sitename: string;
  workdescription: string;
  clockInAt: string;
  clockOutAt: string;
  hours: number;
  projectName?: string;
};

export type DaySessionsResponse = {
  date: string;
  sessions: DaySessionDetail[];
};

const withRetry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
};

const toDateString = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const roundHours = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
};

const fetchSessions = async (filterByFormula: string) => {
  const records = await withRetry(() =>
    base<SessionFields>(SESSIONS_TABLE)
      .select({
        filterByFormula,
        pageSize: 100,
      })
      .all(),
  );
  return records;
};

export const getSessionsByMonth = async ({
  year,
  month,
}: {
  year: number;
  month: number;
}): Promise<CalendarSummary> => {
  const records = await fetchSessions(`AND({year}=${year},{month}=${month})`);
  const map = new Map<string, { hours: number; sessions: number }>();
  records.forEach((record) => {
    const { fields } = record;
    const day = typeof fields.day === 'number' ? fields.day : null;
    if (!day) {
      return;
    }
    const key = toDateString(year, month, day);
    const entry = map.get(key) ?? { hours: 0, sessions: 0 };
    entry.hours += roundHours(fields.hours);
    entry.sessions += 1;
    map.set(key, entry);
  });

  const days: SessionSummaryDay[] = Array.from(map.entries())
    .map(([date, value]) => ({ date, hours: roundHours(value.hours), sessions: value.sessions }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { year, month, days };
};

export const getDaySessions = async (date: string): Promise<DaySessionsResponse> => {
  const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) {
    throw new Error('Invalid date string');
  }
  const records = await fetchSessions(`AND({year}=${year},{month}=${month},{day}=${day})`);
  const sessions: DaySessionDetail[] = records.map((record) => {
    const { fields } = record;
    const hours = roundHours(fields.hours);
    const detail: DaySessionDetail = {
      username: fields.username ?? '不明ユーザー',
      sitename: fields.sitename ?? '未割当',
      workdescription: fields.workdescription ?? '',
      clockInAt: fields.clockInAt ?? '',
      clockOutAt: fields.clockOutAt ?? '',
      hours,
    };
    if (fields.projectName) {
      detail.projectName = fields.projectName;
    }
    return detail;
  });

  return { date, sessions };
};

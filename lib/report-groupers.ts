import type { ReportRow } from '@/lib/reports/pair';

export const STANDARD_WORK_MINUTES = 7.5 * 60;

export type ReportRowGroup = {
  key: string;
  year: number;
  month: number;
  day: number;
  dateLabel: string;
  totalWorkingMinutes: number;
  totalOvertimeMinutes: number;
  count: number;
  items: ReportRow[];
};

export function normalizeWorkingMinutes(minutes: number | null | undefined): number {
  if (minutes == null) {
    return 0;
  }
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  return Math.min(safe, STANDARD_WORK_MINUTES);
}

function parseOvertimeMinutes(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const normalized = value.trim().replace(/h$/i, '');
  if (!normalized) {
    return 0;
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.round(parsed * 60));
}

function toKey(row: ReportRow): string | null {
  const { year, month, day } = row;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sortGroupItems(items: ReportRow[]): ReportRow[] {
  return [...items].sort((a, b) => {
    const aStart = a.startJst ?? '';
    const bStart = b.startJst ?? '';
    if (aStart && bStart && aStart !== bStart) {
      return aStart.localeCompare(bStart, 'ja');
    }
    const aEnd = a.endJst ?? '';
    const bEnd = b.endJst ?? '';
    if (aEnd && bEnd && aEnd !== bEnd) {
      return aEnd.localeCompare(bEnd, 'ja');
    }
    return 0;
  });
}

export function groupReportRowsByDate(rows: ReportRow[]): ReportRowGroup[] {
  const map = new Map<string, ReportRowGroup>();

  for (const row of rows ?? []) {
    const key = toKey(row);
    if (!key) {
      continue;
    }
    const entry = map.get(key) ?? {
      key,
      year: row.year,
      month: row.month,
      day: row.day,
      dateLabel: key,
      totalWorkingMinutes: 0,
      totalOvertimeMinutes: 0,
      count: 0,
      items: [],
    } satisfies ReportRowGroup;

    entry.items.push(row);
    entry.count += 1;
    entry.totalWorkingMinutes += normalizeWorkingMinutes(row.minutes);
    entry.totalOvertimeMinutes += parseOvertimeMinutes(row.overtimeHours);

    map.set(key, entry);
  }

  const groups = Array.from(map.values());
  groups.forEach((group) => {
    group.items = sortGroupItems(group.items);
  });

  groups.sort((a, b) => {
    if (a.key === b.key) {
      return 0;
    }
    return a.key < b.key ? 1 : -1;
  });

  return groups;
}

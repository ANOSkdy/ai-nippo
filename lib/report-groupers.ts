import type { ReportRow } from '@/lib/reports/pair';
import { getTimeCalcConfig, roundToStep, type RoundMode } from '@/src/lib/timecalc';

export const STANDARD_WORK_MINUTES = 7.5 * 60;

export type ReportRowWithStats = ReportRow & {
  workingMinutes: number;
  overtimeMinutes: number;
  rawDurationMinutes: number;
};

export type ReportRowGroup = {
  key: string;
  year: number;
  month: number;
  day: number;
  dateLabel: string;
  totalWorkingMinutes: number;
  totalOvertimeMinutes: number;
  count: number;
  startJst?: string | null;
  endJst?: string | null;
  items: ReportRowWithStats[];
};

type DecoratedRow = {
  row: ReportRow;
  startMs: number | null;
  endMs: number | null;
  rawDurationMinutes: number;
};

function toMinutes(value: number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  if (Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  return 0;
}

function toTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function computeRawDuration(row: ReportRow): number {
  if (row.durationMinutes != null) {
    return toMinutes(row.durationMinutes);
  }
  const start = toTimestampMs((row as Record<string, unknown>).startTimestampMs);
  const end = toTimestampMs((row as Record<string, unknown>).endTimestampMs);
  if (start != null && end != null && end > start) {
    return Math.max(0, Math.round((end - start) / 60000));
  }
  return toMinutes(row.minutes);
}

function formatTimeFromMs(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) {
    return null;
  }
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: 'hour' | 'minute') => parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour');
  const minute = pick('minute');
  if (!hour || !minute) {
    return null;
  }
  return `${hour}:${minute}`;
}

function roundMinutes(value: number, enabled: boolean, step: number, mode: RoundMode): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (!enabled) {
    return Math.max(0, Math.round(value));
  }
  const rounded = roundToStep(value, step, mode);
  return Math.max(0, Math.round(rounded));
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
      startJst: undefined,
      endJst: undefined,
      items: [],
    } satisfies ReportRowGroup;

    (entry.items as unknown as ReportRow[]).push(row);
    entry.count += 1;
    map.set(key, entry);
  }

  const config = getTimeCalcConfig();
  const breakMinutes = config.breakMinutes > 0 ? config.breakMinutes : 90;
  const roundStep = config.roundMinutes > 0 ? config.roundMinutes : 15;
  const roundMode = config.roundMode;
  const roundingEnabled = config.enabled !== false;

  const groups = Array.from(map.values());

  groups.forEach((group) => {
    const sortedBase = sortGroupItems(group.items as unknown as ReportRow[]);
    const decorated: DecoratedRow[] = sortedBase.map((row) => ({
      row,
      startMs: toTimestampMs((row as Record<string, unknown>).startTimestampMs),
      endMs: toTimestampMs((row as Record<string, unknown>).endTimestampMs),
      rawDurationMinutes: computeRawDuration(row),
    }));

    let breakTargetIndex = -1;
    let maxDuration = -1;
    decorated.forEach((item, index) => {
      if (item.rawDurationMinutes > maxDuration) {
        maxDuration = item.rawDurationMinutes;
        breakTargetIndex = index;
      }
    });
    const hasBreakTarget = breakTargetIndex >= 0 && maxDuration > 0;

    let earliestStartMs: number | null = null;
    let earliestStartLabel: string | null = null;
    let latestEndMs: number | null = null;
    let latestEndLabel: string | null = null;

    decorated.forEach((item) => {
      if (item.startMs != null) {
        if (earliestStartMs == null || item.startMs < earliestStartMs) {
          earliestStartMs = item.startMs;
          earliestStartLabel = item.row.startJst ?? null;
        }
      }
      if (item.endMs != null) {
        if (latestEndMs == null || item.endMs > latestEndMs) {
          latestEndMs = item.endMs;
          latestEndLabel = item.row.endJst ?? null;
        }
      }
    });

    const computedItems: ReportRowWithStats[] = decorated.map((item, index) => {
      const applyBreak = hasBreakTarget && index === breakTargetIndex;
      const base = applyBreak ? Math.max(0, item.rawDurationMinutes - breakMinutes) : item.rawDurationMinutes;
      const roundedWorking = roundMinutes(base, roundingEnabled, roundStep, roundMode);
      const overtimeRaw = Math.max(0, roundedWorking - STANDARD_WORK_MINUTES);
      const roundedOvertime = roundMinutes(overtimeRaw, roundingEnabled, roundStep, roundMode);
      const displayWorking = Math.max(
        0,
        Math.min(STANDARD_WORK_MINUTES, roundedWorking - roundedOvertime),
      );
      return {
        ...(item.row as ReportRow),
        workingMinutes: displayWorking,
        overtimeMinutes: roundedOvertime,
        rawDurationMinutes: item.rawDurationMinutes,
      } satisfies ReportRowWithStats;
    });

    let summaryWorkingMinutes = 0;
    if (earliestStartMs != null && latestEndMs != null && latestEndMs > earliestStartMs) {
      const spanMinutes = Math.max(0, Math.round((latestEndMs - earliestStartMs) / 60000));
      const spanAfterBreak = Math.max(0, spanMinutes - breakMinutes);
      summaryWorkingMinutes = roundMinutes(spanAfterBreak, roundingEnabled, roundStep, roundMode);
    }
    const summaryOvertimeRaw = Math.max(0, summaryWorkingMinutes - STANDARD_WORK_MINUTES);
    const summaryOvertimeMinutes = roundMinutes(summaryOvertimeRaw, roundingEnabled, roundStep, roundMode);
    const summaryWorkingDisplay = Math.max(
      0,
      Math.min(STANDARD_WORK_MINUTES, summaryWorkingMinutes - summaryOvertimeMinutes),
    );

    group.items = computedItems;
    group.totalWorkingMinutes = summaryWorkingDisplay;
    group.totalOvertimeMinutes = summaryOvertimeMinutes;
    group.startJst = earliestStartLabel ?? formatTimeFromMs(earliestStartMs);
    group.endJst = latestEndLabel ?? formatTimeFromMs(latestEndMs);
  });

  groups.sort((a, b) => {
    if (a.key === b.key) {
      return 0;
    }
    return a.key < b.key ? 1 : -1;
  });

  return groups;
}

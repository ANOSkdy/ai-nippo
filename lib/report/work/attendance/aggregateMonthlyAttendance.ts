import { getTimeCalcConfig, hoursFromMinutes, roundToStep } from '@/src/lib/timecalc';
import { getStandardBreakMinutes } from './breakRules';
import { buildMonthDays, type AttendanceDay } from './dateUtils';
import { normalizeSessionStatus } from './normalize';
import type { AttendanceSession } from './sessions';

export type AttendanceDaySummary = {
  date: string;
  activeMinutes: number;
  grossMinutes: number;
  gapMinutes: number;
  standardBreakMinutes: number;
  deductBreakMinutes: number;
  netMinutes: number;
  roundedMinutes: number;
  roundedHours: number;
  sessionsCount: number;
  anomalies: string[];
};

export type AttendanceUserRow = {
  userId: number | null;
  name: string;
  daily: Record<
    string,
    {
      hours: number;
      minutesRounded: number;
      breakDeductMin: number;
      sessionsCount: number;
      hasAnomaly: boolean;
    }
  >;
  totals: {
    hours: number;
    minutesRounded: number;
    workDays: number;
    breakDeductMin: number;
    overtimeHours: number;
  };
};

export type MonthlyAttendanceResponse = {
  days: AttendanceDay[];
  rows: AttendanceUserRow[];
  dayTotals: Record<string, { hours: number; minutesRounded: number }>;
  generatedAt: string;
};

export type AttendanceInterval = { startMs: number; endMs: number };

export type AttendanceUser = {
  userId: number | null;
  name: string | null;
  userRecordId?: string | null;
};

const OVERTIME_THRESHOLD_MINUTES = 7.5 * 60;

function roundMinutes(value: number): number {
  const config = getTimeCalcConfig();
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (!config.enabled) {
    return Math.max(0, Math.round(value));
  }
  const rounded = roundToStep(value, config.roundMinutes, config.roundMode);
  return Math.max(0, Math.round(rounded));
}

/**
 * 同一日のセッション区間をマージして重複を除外する。
 */
export function mergeIntervals(intervals: AttendanceInterval[]): AttendanceInterval[] {
  const valid = intervals
    .filter((interval) => Number.isFinite(interval.startMs) && Number.isFinite(interval.endMs))
    .filter((interval) => interval.endMs > interval.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const merged: AttendanceInterval[] = [];
  for (const interval of valid) {
    const current = merged[merged.length - 1];
    if (!current || interval.startMs > current.endMs) {
      merged.push({ ...interval });
      continue;
    }
    current.endMs = Math.max(current.endMs, interval.endMs);
  }
  return merged;
}

/**
 * 日別の稼働集計を算出する。
 */
export function computeDailyAttendance(sessionsForDay: AttendanceSession[]): AttendanceDaySummary {
  const anomalies: string[] = [];
  const intervals: AttendanceInterval[] = [];

  for (const session of sessionsForDay) {
    const statusNormalized = session.statusNormalized ?? normalizeSessionStatus(session.status);
    if (statusNormalized === 'unknown' || statusNormalized === 'other') {
      const statusLabel = session.statusRaw ?? session.status ?? statusNormalized;
      anomalies.push(`status:${statusLabel}:${session.id}`);
    }
    if (session.startMs == null || session.endMs == null) {
      anomalies.push(`missing-range:${session.id}`);
      continue;
    }
    if (session.endMs <= session.startMs) {
      anomalies.push(`invalid-range:${session.id}`);
      continue;
    }
    intervals.push({ startMs: session.startMs, endMs: session.endMs });
  }

  const merged = mergeIntervals(intervals);
  const activeMinutes = merged.reduce(
    (total, interval) => total + Math.round((interval.endMs - interval.startMs) / 60000),
    0,
  );

  const earliestStart = merged.length > 0 ? Math.min(...merged.map((i) => i.startMs)) : null;
  const latestEnd = merged.length > 0 ? Math.max(...merged.map((i) => i.endMs)) : null;
  const grossMinutes =
    earliestStart != null && latestEnd != null
      ? Math.max(0, Math.round((latestEnd - earliestStart) / 60000))
      : 0;

  const gapMinutes = Math.max(0, grossMinutes - activeMinutes);
  const standardBreakMinutes = getStandardBreakMinutes(grossMinutes);
  const deductBreakMinutes = Math.max(0, standardBreakMinutes - gapMinutes);
  const netMinutes = Math.max(0, activeMinutes - deductBreakMinutes);
  const roundedMinutes = roundMinutes(netMinutes);

  return {
    date: sessionsForDay[0]?.date ?? '',
    activeMinutes,
    grossMinutes,
    gapMinutes,
    standardBreakMinutes,
    deductBreakMinutes,
    netMinutes,
    roundedMinutes,
    roundedHours: hoursFromMinutes(roundedMinutes),
    sessionsCount: sessionsForDay.length,
    anomalies,
  } satisfies AttendanceDaySummary;
}

function resolveUserKey(session: AttendanceSession): string {
  if (session.userId != null) {
    return `userId:${session.userId}`;
  }
  if (session.userRecordId) {
    return `record:${session.userRecordId}`;
  }
  if (session.userName) {
    return `name:${session.userName}`;
  }
  return 'unknown';
}

function buildUserMap(users: AttendanceUser[]): Map<string, AttendanceUser> {
  const map = new Map<string, AttendanceUser>();
  for (const user of users) {
    if (user.userId != null) {
      map.set(`userId:${user.userId}`, user);
    }
    if (user.userRecordId) {
      map.set(`record:${user.userRecordId}`, user);
    }
  }
  return map;
}

/**
 * 月次勤怠の集計データを作成する。
 */
export function aggregateMonthlyAttendance(
  sessions: AttendanceSession[],
  users: AttendanceUser[],
  month: string,
): MonthlyAttendanceResponse {
  const days = buildMonthDays(month);
  const dayTotals = new Map<string, { minutesRounded: number }>();
  const userMap = buildUserMap(users);
  const grouped = new Map<string, Map<string, AttendanceSession[]>>();

  for (const session of sessions) {
    if (!session.date) {
      continue;
    }
    const userKey = resolveUserKey(session);
    const byUser = grouped.get(userKey) ?? new Map<string, AttendanceSession[]>();
    const entries = byUser.get(session.date) ?? [];
    entries.push(session);
    byUser.set(session.date, entries);
    grouped.set(userKey, byUser);
  }

  const rows: AttendanceUserRow[] = [];

  for (const [userKey, dayMap] of grouped.entries()) {
    const userInfo = userMap.get(userKey);
    const sampleSession = dayMap.values().next().value?.[0] as AttendanceSession | undefined;
    const userId = userInfo?.userId ?? sampleSession?.userId ?? null;
    const name = userInfo?.name ?? sampleSession?.userName ?? '未登録ユーザー';

    const daily: AttendanceUserRow['daily'] = {};
    let totalMinutes = 0;
    let totalBreakDeduct = 0;
    let workDays = 0;
    let overtimeMinutesTotal = 0;

    for (const [date, sessionsForDay] of dayMap.entries()) {
      const summary = computeDailyAttendance(sessionsForDay);
      const minutesRounded = summary.roundedMinutes;
      const hours = hoursFromMinutes(minutesRounded);
      const hasAnomaly = summary.anomalies.length > 0;
      const overtimeMinutes = Math.max(0, minutesRounded - OVERTIME_THRESHOLD_MINUTES);

      daily[date] = {
        hours,
        minutesRounded,
        breakDeductMin: summary.deductBreakMinutes,
        sessionsCount: summary.sessionsCount,
        hasAnomaly,
      };

      totalMinutes += minutesRounded;
      totalBreakDeduct += summary.deductBreakMinutes;
      if (minutesRounded > 0) {
        workDays += 1;
      }
      overtimeMinutesTotal += overtimeMinutes;

      const dayTotal = dayTotals.get(date) ?? { minutesRounded: 0 };
      dayTotal.minutesRounded += minutesRounded;
      dayTotals.set(date, dayTotal);
    }

    rows.push({
      userId,
      name,
      daily,
      totals: {
        hours: hoursFromMinutes(totalMinutes),
        minutesRounded: totalMinutes,
        workDays,
        breakDeductMin: totalBreakDeduct,
        overtimeHours: hoursFromMinutes(overtimeMinutesTotal),
      },
    });
  }

  rows.sort((a, b) => {
    const nameA = a.name ?? '';
    const nameB = b.name ?? '';
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB, 'ja');
    }
    const idA = a.userId ?? 0;
    const idB = b.userId ?? 0;
    return idA - idB;
  });

  const dayTotalsRecord: Record<string, { hours: number; minutesRounded: number }> = {};
  for (const day of days) {
    const total = dayTotals.get(day.date) ?? { minutesRounded: 0 };
    dayTotalsRecord[day.date] = {
      minutesRounded: total.minutesRounded,
      hours: hoursFromMinutes(total.minutesRounded),
    };
  }

  return {
    days,
    rows,
    dayTotals: dayTotalsRecord,
    generatedAt: new Date().toISOString(),
  } satisfies MonthlyAttendanceResponse;
}

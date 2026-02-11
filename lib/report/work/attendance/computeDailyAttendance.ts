import { getTimeCalcConfig, hoursFromMinutes, roundToStep } from '@/src/lib/timecalc';
import { getStandardBreakMinutes } from './breakRules';
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
  breakPolicyApplied: boolean;
};

export type AttendanceInterval = { startMs: number; endMs: number };

export type ComputeDailyAttendanceOptions = {
  skipStandardBreakDeduction?: boolean;
};

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

export function computeDailyAttendance(
  sessionsForDay: AttendanceSession[],
  options?: ComputeDailyAttendanceOptions,
): AttendanceDaySummary {
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
  const skipBreak = Boolean(options?.skipStandardBreakDeduction);
  const deductBreakMinutes = skipBreak ? 0 : Math.max(0, standardBreakMinutes - gapMinutes);
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
    breakPolicyApplied: !skipBreak,
  } satisfies AttendanceDaySummary;
}

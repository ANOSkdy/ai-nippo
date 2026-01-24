'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildAttendanceQuery, type AttendanceFilters } from './buildAttendanceQuery';

export type AttendanceDay = {
  date: string;
  day: number;
  weekdayJa: string;
  isWeekend: boolean;
  isHoliday: boolean;
};

export type AttendanceDailyCell = {
  hours: number;
  minutesRounded: number;
  breakDeductMin: number;
  sessionsCount: number;
  hasAnomaly: boolean;
};

export type AttendanceTotals = {
  hours: number;
  minutesRounded: number;
  workDays: number;
  breakDeductMin: number;
  overtimeHours: number;
};

export type AttendanceRow = {
  userId: number | null;
  name: string;
  daily: Record<string, AttendanceDailyCell>;
  totals: AttendanceTotals;
};

export type MonthlyAttendanceResponse = {
  days: AttendanceDay[];
  rows: AttendanceRow[];
  dayTotals: Record<string, { hours: number; minutesRounded: number }>;
  generatedAt: string;
};

type FetchState = 'idle' | 'loading' | 'success' | 'error';

type UseMonthlyAttendance = {
  data: MonthlyAttendanceResponse | null;
  state: FetchState;
  error: string | null;
  reload: () => void;
};

export function useMonthlyAttendance(filters: AttendanceFilters): UseMonthlyAttendance {
  const [data, setData] = useState<MonthlyAttendanceResponse | null>(null);
  const [state, setState] = useState<FetchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((prev) => prev + 1), []);

  const query = useMemo(() => buildAttendanceQuery(filters), [filters]);

  useEffect(() => {
    if (!filters.month) {
      return;
    }

    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setState('loading');
      setError(null);
      try {
        const response = await fetch(`/api/report/work/attendance?${query}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`attendance monthly error: ${response.status}`);
        }
        const payload = (await response.json()) as MonthlyAttendanceResponse;
        if (!active) return;
        setData(payload);
        setState('success');
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        console.error('[attendance][monthly] failed to load', err);
        setError('勤怠データの取得に失敗しました。');
        setState('error');
      }
    };

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [filters.month, query, reloadToken]);

  return { data, state, error, reload };
}

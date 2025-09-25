'use client';

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import DayDrawer from './DayDrawer';

type DaySummary = {
  date: string;
  hours: number;
  sessions: number;
};

type CalendarResponse = {
  year: number;
  month: number;
  days: DaySummary[];
};

type CalendarMonthProps = {
  initialYear: number;
  initialMonth: number;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

function formatMonth(year: number, month: number): string {
  return `${year}年${String(month).padStart(2, '0')}月`;
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function summarizeTotals(days: DaySummary[]): { hours: number; sessions: number } {
  return days.reduce(
    (acc, day) => {
      return {
        hours: acc.hours + day.hours,
        sessions: acc.sessions + day.sessions,
      };
    },
    { hours: 0, sessions: 0 },
  );
}

function LoadingSkeleton(): ReactElement {
  return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }): ReactElement {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-red-700"
        >
          再試行
        </button>
      </div>
    </div>
  );
}

export default function CalendarMonth({ initialYear, initialMonth }: CalendarMonthProps): ReactElement {
  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadCalendar = useCallback(
    async (year: number, month: number) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/dashboard/calendar?year=${year}&month=${month}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`failed with status ${response.status}`);
        }
        const json = (await response.json()) as CalendarResponse;
        setCalendar(json);
      } catch (err) {
        console.error('Failed to fetch calendar', err);
        setError('カレンダーデータの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadCalendar(currentYear, currentMonth);
  }, [currentMonth, currentYear, loadCalendar]);

  const summaries = useMemo(() => new Map(calendar?.days.map((day) => [day.date, day]) ?? []), [calendar]);

  const totals = useMemo(() => summarizeTotals(calendar?.days ?? []), [calendar]);

  const firstDay = useMemo(() => new Date(currentYear, currentMonth - 1, 1).getDay(), [currentMonth, currentYear]);
  const daysInMonth = useMemo(() => new Date(currentYear, currentMonth, 0).getDate(), [currentMonth, currentYear]);

  const grid = useMemo(() => {
    const items: Array<string | null> = [];
    for (let i = 0; i < firstDay; i += 1) {
      items.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      items.push(toDateString(currentYear, currentMonth, day));
    }
    while (items.length % 7 !== 0) {
      items.push(null);
    }
    return items;
  }, [currentMonth, currentYear, daysInMonth, firstDay]);

  const handlePrev = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev === 1) {
        setCurrentYear((year) => year - 1);
        return 12;
      }
      return prev - 1;
    });
  }, []);

  const handleNext = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev === 12) {
        setCurrentYear((year) => year + 1);
        return 1;
      }
      return prev + 1;
    });
  }, []);

  const openDrawer = useCallback((date: string) => {
    setDrawerDate(date);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerDate(null);
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-md">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">稼働状況</h3>
          <p className="text-sm text-gray-500">セッション数と稼働時間を月次で確認できます。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
            aria-label="前の月へ"
          >
            前へ
          </button>
          <span className="text-sm font-medium text-gray-700" aria-live="polite">
            {formatMonth(currentYear, currentMonth)}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
            aria-label="次の月へ"
          >
            次へ
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-6 text-sm text-gray-600">
        <span>総稼働時間: {totals.hours.toFixed(2)} h</span>
        <span>総セッション数: {totals.sessions} 件</span>
      </div>

      {loading && <LoadingSkeleton />}
      {!loading && error && <ErrorBanner message={error} onRetry={() => void loadCalendar(currentYear, currentMonth)} />}

      {!loading && !error && (
        <div className="grid grid-cols-7 gap-2" role="grid" aria-label="月次カレンダー">
          {WEEKDAYS.map((label) => (
            <div key={label} className="text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
              {label}
            </div>
          ))}
          {grid.map((date, index) => {
            if (!date) {
              return <div key={`blank-${index}`} className="h-24 rounded-2xl bg-transparent" aria-hidden />;
            }
            const summary = summaries.get(date);
            const dayNumber = Number(date.split('-')[2]);
            return (
              <button
                key={date}
                type="button"
                onClick={() => openDrawer(date)}
                className="flex h-24 flex-col justify-between rounded-2xl border border-gray-100 p-3 text-left transition hover:border-primary hover:shadow"
              >
                <span className="text-sm font-semibold text-gray-800">{dayNumber}</span>
                <div className="text-xs text-gray-500">
                  <div>{(summary?.hours ?? 0).toFixed(2)} h</div>
                  <div>{summary?.sessions ?? 0} 件</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <DayDrawer date={drawerDate} open={drawerOpen} onClose={closeDrawer} />
    </section>
  );
}

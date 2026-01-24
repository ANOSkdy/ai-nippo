'use client';

import type { AttendanceDay, AttendanceRow } from './useMonthlyAttendance';

export type AttendanceMatrixProps = {
  days: AttendanceDay[];
  rows: AttendanceRow[];
  onSelectCell: (payload: { userId: number | null; userName: string; date: string }) => void;
};

const SUMMARY_COLUMNS = [
  { key: 'hours', label: '合計h' },
  { key: 'workDays', label: '出勤日数' },
  { key: 'breakDeductMin', label: '休憩控除h' },
  { key: 'overtimeHours', label: '時間外h' },
] as const;

const SUMMARY_COLUMN_WIDTH = 96;

function formatHours(value: number, showZeroAsDash = false): string {
  if (!Number.isFinite(value) || value === 0) {
    return showZeroAsDash ? '–' : '0.00';
  }
  return value.toFixed(2);
}

function formatBreakHours(minutes: number): string {
  if (!Number.isFinite(minutes)) return '0.00';
  if (minutes === 0) return '0.00';
  return (minutes / 60).toFixed(2);
}

export default function AttendanceMatrix({ days, rows, onSelectCell }: AttendanceMatrixProps) {
  return (
    <div className="overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-max border-collapse text-xs text-gray-700">
        <thead>
          <tr>
            <th
              className="sticky left-0 top-0 z-30 border-b border-r border-gray-200 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-600"
              style={{ minWidth: 160 }}
            >
              従業員
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                className={`sticky top-0 z-20 border-b border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-600 ${
                  day.isWeekend ? 'bg-rose-50' : 'bg-white'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-sm font-semibold">{day.day}</span>
                  <span className="text-[10px] text-gray-400">{day.weekdayJa}</span>
                </div>
              </th>
            ))}
            {SUMMARY_COLUMNS.map((column, index) => (
              <th
                key={column.key}
                className="sticky top-0 z-30 border-b border-l border-gray-200 bg-white px-2 py-2 text-center text-xs font-semibold text-gray-600"
                style={{
                  right: `${(SUMMARY_COLUMNS.length - 1 - index) * SUMMARY_COLUMN_WIDTH}px`,
                  minWidth: SUMMARY_COLUMN_WIDTH,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.userId ?? 'unknown'}-${row.name}`} className="border-b border-gray-100">
              <th
                className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-800"
                style={{ minWidth: 160 }}
              >
                {row.name}
              </th>
              {days.map((day) => {
                const cell = row.daily[day.date];
                const hours = cell?.hours ?? 0;
                const hasAnomaly = cell?.hasAnomaly ?? false;
                const isClickable = row.userId != null;
                return (
                  <td
                    key={`${row.name}-${day.date}`}
                    className={`border-r border-gray-100 p-0 text-center text-xs ${
                      day.isWeekend ? 'bg-rose-50' : 'bg-white'
                    } ${isClickable ? 'hover:bg-indigo-50' : 'text-gray-400'}`}
                  >
                    <button
                      type="button"
                      className={`h-full w-full px-2 py-2 text-xs ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                      disabled={!isClickable}
                      onClick={() => {
                        if (!isClickable) return;
                        onSelectCell({ userId: row.userId, userName: row.name, date: day.date });
                      }}
                      aria-label={`${row.name} ${day.date} ${formatHours(hours, true)}`}
                    >
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <span>{formatHours(hours, true)}</span>
                        {hasAnomaly ? <span className="text-amber-600">⚠︎</span> : null}
                      </span>
                    </button>
                  </td>
                );
              })}
              {SUMMARY_COLUMNS.map((column, index) => {
                let value = '0';
                switch (column.key) {
                  case 'hours':
                    value = formatHours(row.totals.hours, false);
                    break;
                  case 'workDays':
                    value = `${row.totals.workDays}`;
                    break;
                  case 'breakDeductMin':
                    value = formatBreakHours(row.totals.breakDeductMin);
                    break;
                  case 'overtimeHours':
                    value = formatHours(row.totals.overtimeHours, false);
                    break;
                  default:
                    value = '0';
                }
                return (
                  <td
                    key={`${row.name}-${column.key}`}
                    className="sticky z-20 border-l border-gray-200 bg-white px-2 py-2 text-center text-xs font-semibold text-gray-700"
                    style={{
                      right: `${(SUMMARY_COLUMNS.length - 1 - index) * SUMMARY_COLUMN_WIDTH}px`,
                      minWidth: SUMMARY_COLUMN_WIDTH,
                    }}
                  >
                    <span className="tabular-nums">{value}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

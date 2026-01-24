export const SUMMARY_COLUMNS = [
  { key: 'hours', label: '合計h' },
  { key: 'workDays', label: '出勤日数' },
  { key: 'breakDeductMin', label: '休憩控除h' },
  { key: 'overtimeHours', label: '時間外h' },
] as const;

export const SUMMARY_COLUMN_WIDTH = 96;
export const BASE_HOURS_PER_DAY = 7.5;

export type SummaryColumnKey = (typeof SUMMARY_COLUMNS)[number]['key'];

export function formatAttendanceHours(value: number, showZeroAsDash = false): string {
  if (!Number.isFinite(value) || value === 0) {
    return showZeroAsDash ? '–' : '0.00';
  }
  return value.toFixed(2);
}

export function formatBreakHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes === 0) {
    return '0.00';
  }
  return (minutes / 60).toFixed(2);
}

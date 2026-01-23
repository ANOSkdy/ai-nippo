export type AttendanceDay = {
  date: string;
  day: number;
  weekdayJa: string;
  isWeekend: boolean;
  isHoliday: boolean;
};

const WEEKDAY_JA_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  weekday: 'short',
  timeZone: 'Asia/Tokyo',
});
const WEEKDAY_EN_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'Asia/Tokyo',
});

function formatDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 月文字列 (YYYY-MM) をパースして年月を返す。
 */
export function parseMonth(month: string): { year: number; month: number } | null {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const parsedMonth = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(parsedMonth)) {
    return null;
  }
  if (parsedMonth < 1 || parsedMonth > 12) {
    return null;
  }
  return { year, month: parsedMonth };
}

/**
 * 月初〜月末のYYYY-MM-DD範囲を返す。
 */
export function getMonthDateRange(month: string): { startDate: string; endDate: string } | null {
  const parsed = parseMonth(month);
  if (!parsed) {
    return null;
  }
  const { year, month: monthNum } = parsed;
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return {
    startDate: formatDate(year, monthNum, 1),
    endDate: formatDate(year, monthNum, lastDay),
  };
}

/**
 * 月の全日付を返す。
 */
export function buildMonthDays(month: string): AttendanceDay[] {
  const parsed = parseMonth(month);
  if (!parsed) {
    return [];
  }
  const { year, month: monthNum } = parsed;
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const days: AttendanceDay[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = formatDate(year, monthNum, day);
    const dateValue = new Date(`${date}T00:00:00+09:00`);
    const weekdayJa = WEEKDAY_JA_FORMATTER.format(dateValue);
    const weekdayEn = WEEKDAY_EN_FORMATTER.format(dateValue);
    const isWeekend = weekdayEn === 'Sun' || weekdayEn === 'Sat';
    days.push({
      date,
      day,
      weekdayJa,
      isWeekend,
      isHoliday: false,
    });
  }
  return days;
}

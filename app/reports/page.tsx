import Link from 'next/link';
import ReportsTabs from '@/components/reports/ReportsTabs';
import { usersTable } from '@/lib/airtable';
import { groupByUserDate, type SessionRecord } from '@/app/(protected)/reports/_lib/groupByUserDate';
import SessionBreakdown from '@/components/reports/SessionBreakdown';
import PrintA4Button from '@/components/PrintA4Button';
import { fetchSessionReportRows, type SessionReportRow } from '@/src/lib/sessions-reports';

import './print-a4.css';

type SearchParams = Record<string, string | string[] | undefined>;

async function fetchUsers(): Promise<string[]> {
  const records = await usersTable
    .select({ fields: ['name'], sort: [{ field: 'name', direction: 'asc' }] })
    .all();
  const names = new Set<string>();
  for (const record of records) {
    const name = typeof record.fields.name === 'string' ? record.fields.name : null;
    if (name) {
      names.add(name);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'ja'));
}

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDateTimeJst(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) {
    return null;
  }
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = dateTimeFormatter.formatToParts(date);
  const pick = (type: 'year' | 'month' | 'day' | 'hour' | 'minute') =>
    parts.find((part) => part.type === type)?.value ?? '';
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  const hour = pick('hour');
  const minute = pick('minute');
  if (!year || !month || !day || !hour || !minute) {
    return null;
  }
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function formatSessionDateTime(raw: string | null | undefined, ms: number | null | undefined): string | null {
  const formatted = formatDateTimeJst(ms);
  if (formatted) {
    return formatted;
  }
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed ? trimmed : null;
}

function getSessionDatePart(session: SessionReportRow, part: 'year' | 'month' | 'day'): number | null {
  const direct = session[part];
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return direct;
  }
  if (session.date) {
    const segments = session.date.split('-');
    const index = part === 'year' ? 0 : part === 'month' ? 1 : 2;
    const raw = segments[index];
    if (raw) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function toSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function toNumberValue(value: string | string[] | undefined): number | undefined {
  const single = toSingleValue(value).trim();
  if (!single) return undefined;
  const parsed = Number.parseInt(single, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

type Filters = {
  user: string;
  site: string;
  year?: number;
  month?: number;
  day?: number;
};

export default async function ReportsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ?? {};
  const filters: Filters = {
    user: toSingleValue(params.user).trim(),
    site: toSingleValue(params.site).trim(),
    year: toNumberValue(params.year),
    month: toNumberValue(params.month),
    day: toNumberValue(params.day),
  };

  const users = await fetchUsers();
  const sessionsRaw: SessionReportRow[] = filters.user
    ? await fetchSessionReportRows({ userName: filters.user })
    : [];

  const completedSessions = sessionsRaw.filter((session) => session.isCompleted && session.date);

  const filteredSessions = completedSessions.filter((session) => {
    const year = getSessionDatePart(session, 'year');
    const month = getSessionDatePart(session, 'month');
    const day = getSessionDatePart(session, 'day');
    if (filters.year && year !== filters.year) return false;
    if (filters.month && month !== filters.month) return false;
    if (filters.day && day !== filters.day) return false;
    if (filters.site && session.siteName !== filters.site) return false;
    return true;
  });

  const availableYears = Array.from(
    new Set(
      completedSessions
        .map((session) => getSessionDatePart(session, 'year'))
        .filter((value): value is number => value != null),
    ),
  ).sort((a, b) => a - b);
  const availableMonths = Array.from(
    new Set(
      completedSessions
        .map((session) => getSessionDatePart(session, 'month'))
        .filter((value): value is number => value != null),
    ),
  ).sort((a, b) => a - b);
  const availableDays = Array.from(
    new Set(
      completedSessions
        .map((session) => getSessionDatePart(session, 'day'))
        .filter((value): value is number => value != null),
    ),
  ).sort((a, b) => a - b);
  const availableSites = Array.from(
    new Set(
      completedSessions
        .map((session) => session.siteName)
        .filter((name): name is string => Boolean(name && name.trim())),
    ),
  ).sort((a, b) => a.localeCompare(b, 'ja'));

  const sessionRecords: SessionRecord[] = filteredSessions.map((session) => ({
    user: session.userId ?? session.userRecordId ?? session.userName ?? '',
    date: session.date!,
    start: formatSessionDateTime(session.start, session.startMs),
    end: formatSessionDateTime(session.end, session.endMs),
    durationMin: session.durationMin ?? 0,
    siteName: session.siteName,
    workDescription: session.workDescription,
    machineId: session.machineId ?? session.machineRecordId ?? null,
    machineName: session.machineName,
    autoGenerated: session.autoGenerated,
  }));

  const daily = groupByUserDate(sessionRecords);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <ReportsTabs />
      <div className="report-print space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">個別集計</h1>
          <p className="text-sm text-gray-600">従業員ごとの IN/OUT ペアリングから稼働時間を算出します。</p>
        </header>

        <div className="_print-toolbar _print-hidden">
          <PrintA4Button />
        </div>

        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <div className="flex flex-col">
            <label htmlFor="user" className="text-sm font-medium text-gray-700">
              従業員名
            </label>
            <select
              id="user"
              name="user"
              defaultValue={filters.user}
              className="mt-1 min-w-[200px] rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              aria-describedby="user-helper"
            >
              <option value="">-- 選択してください --</option>
              {users.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <span id="user-helper" className="mt-1 text-xs text-gray-500">
              対象の従業員を選ぶとグリッドが表示されます。
            </span>
          </div>

          <div className="flex flex-col">
            <label htmlFor="site" className="text-sm font-medium text-gray-700">
              現場名
            </label>
            <select
              id="site"
              name="site"
              defaultValue={filters.site}
              disabled={!filters.user}
              className="mt-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">-- すべて --</option>
              {availableSites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="year" className="text-sm font-medium text-gray-700">
              年
            </label>
            <select
              id="year"
              name="year"
              defaultValue={filters.year?.toString() ?? ''}
              disabled={!filters.user}
              className="mt-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">-- すべて --</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="month" className="text-sm font-medium text-gray-700">
              月
            </label>
            <select
              id="month"
              name="month"
              defaultValue={filters.month?.toString() ?? ''}
              disabled={!filters.user}
              className="mt-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">-- すべて --</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="day" className="text-sm font-medium text-gray-700">
              日
            </label>
            <select
              id="day"
              name="day"
              defaultValue={filters.day?.toString() ?? ''}
              disabled={!filters.user}
              className="mt-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">-- すべて --</option>
              {availableDays.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded border border-indigo-500 bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              絞り込み
            </button>
          </div>
        </form>

        <div className="flex items-center justify-between text-xs text-gray-500 _print-hidden">
          <span>※ ソート機能は提供していません。上部のフィルターで条件を指定してください。</span>
          <Link href="/reports" className="text-indigo-600 underline">
            条件をクリア
          </Link>
        </div>

        {filters.user && (
          <section className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-sm text-gray-700">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    日付
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    始業時間
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    終業時間
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    合計(h)
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    控除後(h)
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    超過(h)
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    セッション数
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    現場数
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    内訳
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-sm text-gray-900">
                {daily.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500">
                      条件に一致するデータがありません。
                    </td>
                  </tr>
                ) : (
                  daily.map((day) => {
                    const uniqueSites = new Set(
                      day.sessions
                        .map((session) => (session.siteName ?? '').trim())
                        .filter((name) => name.length > 0),
                    );
                    const totalHours = day.totalMin / 60;
                    return (
                      <tr key={`${day.userKey}-${day.date}`} className="odd:bg-white even:bg-gray-50 print:break-inside-avoid">
                        <td className="px-4 py-3 whitespace-nowrap">{day.date}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{day.earliestStart ?? ''}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{day.latestEnd ?? ''}</td>
                        <td className="px-4 py-3 text-right">{totalHours.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{day.workedH.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{day.overH.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{day.sessions.length}</td>
                        <td className="px-4 py-3 text-right">{uniqueSites.size}</td>
                        <td className="px-4 py-3 align-top">
                          <SessionBreakdown sessions={day.sessions} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}

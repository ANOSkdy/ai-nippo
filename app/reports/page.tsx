import Link from 'next/link';

import ReportsTabs from '@/components/reports/ReportsTabs';
import PrintA4Button from '@/components/PrintA4Button';
import {
  buildReportContext,
  formatHoursFromMinutes,
  formatMinutesSummary,
  formatTotalWorkHours,
  formatWorkingHours,
  groupTotalMinutes,
  parseFilters,
  type SearchParams,
  fetchUsers,
} from './_utils/reportData';

import './print-a4.css';

export default async function ReportsPage({ searchParams }: { searchParams?: SearchParams }) {
  const filters = parseFilters(searchParams);

  const {
    groups,
    autoCount,
    overallMinutes,
    totalRecords,
    totalDisplayedHours,
    totalOvertimeHours,
    availableYears,
    availableMonths,
    availableDays,
    availableSites,
  } = await buildReportContext(filters);

  const totalWorkHoursText = formatTotalWorkHours(totalDisplayedHours);
  const totalOvertimeHoursText = formatTotalWorkHours(totalOvertimeHours);

  const users = await fetchUsers();

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <ReportsTabs />
      <div className="report-print space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">個別集計</h1>
          <p className="text-sm text-gray-600">従業員ごとの IN/OUT ペアリングから稼働時間を算出します。</p>
        </header>

        <div className="_print-toolbar _print-hidden">
          <PrintA4Button printPath="/reports/print" />
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

          <div className="flex flex-col">
            <label htmlFor="auto" className="text-sm font-medium text-gray-700">
              自動退勤
            </label>
            <select
              id="auto"
              name="auto"
              defaultValue={filters.auto ?? 'all'}
              disabled={!filters.user}
              className="mt-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="all">すべて</option>
              <option value="only">自動のみ</option>
              <option value="exclude">自動を除外</option>
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
          <span>※ グリッドの列構成・表記は現行と同じです。必要に応じて上部のフィルターをご利用ください。</span>
          <Link href="/reports" className="text-indigo-600 underline">
            条件をクリア
          </Link>
        </div>

        {filters.user && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <div className="space-x-2">
                <span>
                  合計時間:{' '}
                  <strong className="tabular-nums">{formatMinutesSummary(overallMinutes)}</strong>
                </span>
                <span className="text-xs text-gray-500">(表示: {totalWorkHoursText})</span>
                <span className="text-xs text-gray-500">超過: {totalOvertimeHoursText}</span>
              </div>
              <div className="space-x-2">
                <span>
                  計 <strong className="tabular-nums">{totalRecords}</strong>件
                </span>
                {autoCount > 0 ? (
                  <span className="text-xs text-gray-500">自動退勤 {autoCount} 件を含みます</span>
                ) : null}
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                条件に一致するデータがありません。
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => {
                  const summaryMinutes = groupTotalMinutes(group);
                  const groupWorkingText = formatWorkingHours(group.totalWorkingMinutes);
                  const groupOvertimeText = formatHoursFromMinutes(group.totalOvertimeMinutes);
                  const groupTotalHoursText = formatHoursFromMinutes(summaryMinutes);
                  const groupAutoCount = group.items.filter((item) => item.autoGenerated).length;

                  return (
                    <details key={group.key} className="rounded border bg-white">
                      <summary className="grid cursor-pointer grid-cols-[120px,1fr,96px,96px,120px,120px,120px,72px] items-center gap-2 px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{group.dateLabel}</span>
                        <span className="truncate text-sm text-gray-700">{filters.user || '—'}</span>
                        <span className="text-sm text-gray-700 tabular-nums">{group.startJst ?? '—'}</span>
                        <span className="text-sm text-gray-700 tabular-nums">{group.endJst ?? '—'}</span>
                        <span className="text-right text-sm font-semibold text-gray-900 tabular-nums">
                          {formatWorkingHours(group.totalWorkingMinutes)}
                        </span>
                        <span className="text-right text-sm text-gray-700 tabular-nums">
                          {formatHoursFromMinutes(group.totalOvertimeMinutes)}
                        </span>
                        <span className="text-right text-sm font-semibold text-gray-900 tabular-nums">
                          {groupTotalHoursText}
                        </span>
                        <span className="text-right text-sm text-gray-600 tabular-nums">{group.count}件</span>
                      </summary>
                      <div className="space-y-3 border-t px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                          <span>稼働合計 (表示): {groupWorkingText}</span>
                          <span>超過: {groupOvertimeText}</span>
                          {groupAutoCount > 0 ? (
                            <span className="text-xs text-gray-500">自動退勤 {groupAutoCount} 件</span>
                          ) : null}
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200">
                          <thead className="bg-gray-50">
                            <tr className="text-sm text-gray-700">
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                年
                              </th>
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                月
                              </th>
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                日
                              </th>
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                現場名
                              </th>
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                元請・代理人
                              </th>
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                始業時間
                              </th>
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                終業時間
                              </th>
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                稼働時間
                              </th>
                              <th scope="col" className="px-4 py-3 text-left font-semibold">
                                超過
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white text-sm text-gray-900">
                            {group.items.map((row, index) => (
                              <tr
                                key={`${row.year}-${row.month}-${row.day}-${row.siteName}-${index}`}
                                className="odd:bg-white even:bg-gray-50"
                              >
                                <td className="px-4 py-3">{row.year}</td>
                                <td className="px-4 py-3">{row.month}</td>
                                <td className="px-4 py-3">{row.day}</td>
                                <td className="px-4 py-3">{row.siteName}</td>
                                <td className="px-4 py-3">{row.clientName ?? '-'}</td>
                                <td className="px-4 py-3">{row.startJst ?? ''}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-start gap-2">
                                    <span>{row.endJst ?? ''}</span>
                                    {row.autoGenerated ? (
                                      <span
                                        className="badge-auto inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-red-500 bg-red-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                                        aria-label="自動退勤で生成された記録"
                                        role="img"
                                      />
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3">{formatWorkingHours(row.workingMinutes)}</td>
                                <td className="px-4 py-3">{formatHoursFromMinutes(row.overtimeMinutes)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr className="text-sm text-gray-700">
                              <td className="px-4 py-3 font-semibold" colSpan={7}>
                                日計
                              </td>
                              <td className="px-4 py-3">
                                <span>{groupWorkingText}</span>
                                {groupAutoCount > 0 ? (
                                  <span className="ml-2 text-xs text-gray-500">（自動{groupAutoCount}件）</span>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">{groupOvertimeText}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

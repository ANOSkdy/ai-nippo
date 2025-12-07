import type { CSSProperties } from 'react';

import AutoPrintOnMount from '@/components/AutoPrintOnMount';
import { buildSiteReport } from '@/app/(protected)/reports/sites/_lib/buildSiteReport';
import { formatQuarterHours } from '../_lib/gridUtils';

import '../sites.css';
import '../../../../reports/print-a4.css';

type SearchParams = Record<string, string | string[] | undefined>;

type ParsedParams = {
  year: number;
  month: number;
  siteId: string;
  machineIds: string[];
  employees: string[];
};

const PRINT_COLUMNS_PER_PAGE = 12;

function toSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function parseParams(searchParams?: SearchParams): ParsedParams {
  const year = Number.parseInt(toSingleValue(searchParams?.year), 10);
  const month = Number.parseInt(toSingleValue(searchParams?.month), 10);
  const siteId = toSingleValue(searchParams?.siteId).trim();
  const rawMachineIds = searchParams?.machineIds;
  const rawEmployees = searchParams?.employees;

  const machineIds = (Array.isArray(rawMachineIds) ? rawMachineIds : rawMachineIds?.split(',') ?? [])
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const employees = (Array.isArray(rawEmployees) ? rawEmployees : rawEmployees?.split(',') ?? [])
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return { year, month, siteId, machineIds, employees };
}

export default async function SiteReportPrintPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { year, month, siteId, machineIds, employees } = parseParams(searchParams);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !siteId) {
    return (
      <main className="report-print mx-auto max-w-5xl space-y-4 p-6">
        <p className="text-sm text-gray-700">印刷に必要な条件が不足しています（年月・現場）。</p>
      </main>
    );
  }

  const report = await buildSiteReport({ year, month, siteId, machineIds });
  const selectedEmployees = new Set(employees.map((name) => name.trim()).filter(Boolean));
  const hasEmployeeFilter = selectedEmployees.size > 0;

  const indexedColumns = report.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => !hasEmployeeFilter || selectedEmployees.has(column.userName));

  const printColumnChunks = [] as Array<typeof indexedColumns>;
  for (let i = 0; i < indexedColumns.length; i += PRINT_COLUMNS_PER_PAGE) {
    printColumnChunks.push(indexedColumns.slice(i, i + PRINT_COLUMNS_PER_PAGE));
  }

  const totalsByColumnKey = new Map<string, number>();
  report.days.forEach((day) => {
    day.values.forEach((value, idx) => {
      const col = report.columns[idx];
      if (!col) return;
      totalsByColumnKey.set(col.key, (totalsByColumnKey.get(col.key) ?? 0) + value);
    });
  });

  const getMachineRefs = (columnKey: string) => {
    const column = report.columns.find((col) => col.key === columnKey);
    if (!column) return [] as Array<{ machineId: string | number; machineName: string | null }>;
    const ids = Array.isArray(column.machineIds) ? column.machineIds : column.machineId ? [column.machineId] : [];
    const names = Array.isArray(column.machineNames)
      ? column.machineNames
      : column.machineName
        ? [column.machineName]
        : [];
    return ids.map((machineId, index) => ({ machineId, machineName: names[index] ?? null }));
  };

  return (
    <main className="report-print mx-auto w-full max-w-screen-xl space-y-2 p-2 text-[10px] leading-[1.25]">
      <AutoPrintOnMount />
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">現場別集計 印刷</h1>
        <p className="text-[10px] text-gray-700">
          {report.site.name || '（現場不明）'} / {report.site.client || '元請未設定'}
        </p>
        <p className="text-[9px] text-gray-600">{report.year}年 {report.month}月</p>
        {hasEmployeeFilter ? (
          <p className="text-[9px] text-gray-600">表示対象: {Array.from(selectedEmployees).join(', ')}</p>
        ) : null}
      </header>

      {indexedColumns.length === 0 ? (
        <p className="text-sm text-gray-700">対象の列がありません。フィルター条件を確認してください。</p>
      ) : (
        <div className="print-table-wrapper">
          {printColumnChunks.map((chunk, chunkIndex) => {
            const chunkStyle = {
              '--reports-min-cols': String(2 + chunk.length),
            } as CSSProperties & { '--reports-min-cols': string };
            const blockClassName = chunkIndex === 0 ? 'print-table-block' : 'print-table-block print-break-before';
            return (
              <div key={`print-chunk-${chunkIndex}`} className={blockClassName}>
                <table
                  className="compact-table table-unified text-[10px] leading-[1.25] print-avoid-break"
                  style={chunkStyle}
                >
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="col-narrow border px-1.5 py-0.5 text-right">日</th>
                      <th className="col-narrow border px-1.5 py-0.5 text-center">曜</th>
                      {chunk.map(({ column }) => (
                        <th key={`print-user-${column.key}`} className="border px-1.5 py-0.5 text-left">
                          {column.userName}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-gray-50">
                      <th className="col-narrow border px-1.5 py-0.5" />
                      <th className="col-narrow border px-1.5 py-0.5" />
                      {chunk.map(({ column }) => {
                        const machines = getMachineRefs(column.key);
                        return (
                          <th key={`print-work-${column.key}`} className="border px-1.5 py-0.5 text-left">
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] leading-tight">
                              {machines.length > 0 ? (
                                machines.map((machine) => (
                                  <span key={machine.machineId} className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
                                    {machine.machineId}
                                    {machine.machineName ? ` (${machine.machineName})` : ''}
                                  </span>
                                ))
                              ) : (
                                <span className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">機械未設定</span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {report.days.map((row) => {
                      return (
                        <tr key={`${row.date}-chunk-${chunkIndex}`}>
                          <td className="col-narrow border px-1.5 py-0.5 text-right">{row.day}</td>
                          <td className="col-narrow border px-1.5 py-0.5 text-center">{row.dow}</td>
                          {chunk.map(({ column, index }) => (
                            <td key={`${row.date}-print-${column.key}`} className="border px-1.5 py-0.5 text-right tabular-nums">
                              {formatQuarterHours(row.values[index])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100">
                      <td className="col-narrow border px-1.5 py-0.5 font-semibold">稼働合計</td>
                      <td className="col-narrow border px-1.5 py-0.5" />
                      {chunk.map(({ column }) => {
                        const total = totalsByColumnKey.get(column.key);
                        const safeTotal = typeof total === 'number' && Number.isFinite(total) ? total : 0;
                        return (
                          <td key={`print-total-${column.key}`} className="border px-1.5 py-0.5 text-right tabular-nums font-semibold">
                            {formatQuarterHours(safeTotal)}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

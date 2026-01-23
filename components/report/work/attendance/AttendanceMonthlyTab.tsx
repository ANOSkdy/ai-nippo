'use client';

import { useEffect, useMemo, useState } from 'react';
import AttendanceDetailSheet from './AttendanceDetailSheet';
import AttendanceMatrix from './AttendanceMatrix';
import { useMonthlyAttendance, type AttendanceRow } from './useMonthlyAttendance';

const today = new Date();
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

type SiteMaster = {
  id: string;
  fields: {
    name?: string;
  };
};

type MachineMaster = {
  id: string;
  fields?: {
    machineid?: string | null;
    name?: string | null;
  };
};

function toText(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export default function AttendanceMonthlyTab() {
  const [month, setMonth] = useState(defaultMonth);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [sites, setSites] = useState<SiteMaster[]>([]);
  const [machines, setMachines] = useState<MachineMaster[]>([]);
  const [siteId, setSiteId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [machineId, setMachineId] = useState('');

  const [selectedCell, setSelectedCell] = useState<{
    userId: number | null;
    userName: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadMasters() {
      try {
        const machineResponsePromise = fetch('/api/masters/machines', {
          cache: 'no-store',
          credentials: 'same-origin',
        }).catch((error) => {
          console.warn('[attendance] failed to fetch machine masters', error);
          return null;
        });
        const [siteRes, machineRes] = await Promise.all([
          fetch('/api/masters/sites', { cache: 'no-store', credentials: 'same-origin' }),
          machineResponsePromise,
        ]);
        if (!siteRes.ok) {
          throw new Error('Failed to load site masters');
        }
        const sitesJson = (await siteRes.json()) as SiteMaster[] | null;
        if (!active) return;
        setSites(Array.isArray(sitesJson) ? sitesJson : []);
        if (machineRes?.ok) {
          const json = await machineRes.json();
          if (!active) return;
          const list: MachineMaster[] = Array.isArray(json?.records)
            ? json.records
            : Array.isArray(json)
              ? json
              : [];
          setMachines(list);
        } else if (machineRes && !machineRes.ok) {
          console.warn('[attendance] machine masters responded with non-ok status', machineRes.status);
          if (active) {
            setMachines([]);
          }
        }
      } catch (err) {
        console.error('[attendance] failed to load masters', err);
      }
    }
    loadMasters();
    return () => {
      active = false;
    };
  }, []);

  const siteOptions = useMemo(() => {
    return sites
      .map((site) => ({ id: site.id, name: toText(site.fields?.name) }))
      .filter((site) => site.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [sites]);

  const machineOptions = useMemo(() => {
    return machines
      .map((machine) => ({
        id: toText(machine.fields?.machineid),
        name: toText(machine.fields?.name),
      }))
      .filter((machine) => machine.id.length > 0)
      .sort((a, b) => a.id.localeCompare(b.id, 'ja'));
  }, [machines]);

  const filters = useMemo(
    () => ({
      month,
      siteId: siteId || undefined,
      siteName: !siteId && siteName ? siteName : undefined,
      machineId: machineId || undefined,
    }),
    [machineId, month, siteId, siteName],
  );

  const { data, state, error, reload } = useMonthlyAttendance(filters);

  const filteredRows = useMemo<AttendanceRow[]>(() => {
    if (!data?.rows) return [];
    if (!employeeQuery) return data.rows;
    const keyword = employeeQuery.trim().toLowerCase();
    if (!keyword) return data.rows;
    return data.rows.filter((row) => row.name.toLowerCase().includes(keyword));
  }, [data?.rows, employeeQuery]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">勤怠（月次）</h1>
        <p className="text-sm text-gray-500">稼働時間を月次マトリクスで確認できます。</p>
      </header>

      <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          月
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          従業員検索
          <input
            type="text"
            placeholder="名前で検索"
            value={employeeQuery}
            onChange={(event) => setEmployeeQuery(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          現場
          {siteOptions.length > 0 ? (
            <select
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
                setSiteName('');
              }}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- すべて --</option>
              {siteOptions.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="現場名を入力"
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          )}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          機械
          {machineOptions.length > 0 ? (
            <select
              value={machineId}
              onChange={(event) => setMachineId(event.target.value)}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- すべて --</option>
              {machineOptions.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name ? `${machine.name} (${machine.id})` : machine.id}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="機械IDを入力"
              value={machineId}
              onChange={(event) => setMachineId(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          )}
        </label>
      </div>

      {state === 'loading' ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100" />
          <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-gray-100" />
          <p className="mt-4">読み込み中…</p>
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p>{error ?? '勤怠データの取得に失敗しました。'}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            再試行
          </button>
        </div>
      ) : null}

      {state === 'success' && data ? (
        filteredRows.length > 0 ? (
          <AttendanceMatrix
            days={data.days}
            rows={filteredRows}
            onSelectCell={(payload) => setSelectedCell(payload)}
          />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
            該当する勤怠データがありません。
          </div>
        )
      ) : null}

      <AttendanceDetailSheet
        open={Boolean(selectedCell)}
        onClose={() => setSelectedCell(null)}
        date={selectedCell?.date ?? null}
        userId={selectedCell?.userId ?? null}
        userName={selectedCell?.userName ?? null}
        filters={{
          siteId: filters.siteId,
          siteName: filters.siteName,
          machineId: filters.machineId,
        }}
      />
    </section>
  );
}

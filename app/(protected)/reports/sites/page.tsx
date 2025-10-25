'use client';

import './sites.css';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import ReportsTabs from '@/components/reports/ReportsTabs';
import PrintControls from '@/components/PrintControls';
import MachineCheckboxGroup from './_components/MachineCheckboxGroup';
import MachinePivotGrid from './_components/MachinePivotGrid';
import { getJstParts } from '@/lib/jstDate';
import { type SessionLike } from './_lib/gridUtils';

type SiteMaster = {
  id: string;
  fields: {
    name: string;
    client?: string;
  };
};

type MachineMaster = {
  id: string;
  fields?: {
    machineid?: string | null;
    name?: string | null;
  };
};

type ReportColumnSession = {
  user?: string | number;
  machineId?: string | number | null;
  machineID?: string | number | null;
  machineName?: string | null;
  machine?: unknown;
  durationMin?: number | null;
  durationMinutes?: number | null;
  minutes?: number | null;
  mins?: number | null;
  hours?: number | null;
  durationHours?: number | null;
  totalHours?: number | null;
  date?: string;
  [key: string]: unknown;
};

type ReportColumn = {
  key: string;
  userName: string;
  workDescription: string;
  machineId?: string | number | null;
  machineIds?: Array<string | number | null>;
  machineName?: string | null;
  machineNames?: Array<string | null>;
  sessions?: ReportColumnSession[];
};

type ReportResponse = {
  site?: {
    client?: string;
  };
  columns?: ReportColumn[];
};

const today = new Date();
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
function toText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

const normalizeKey = (key: string) => key.replace(/[\s_()\-]/g, '').toLowerCase();

const coerceId = (value: unknown): string | number | null => {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const coerced = coerceId(item);
      if (coerced != null) {
        return coerced;
      }
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('id' in record) {
      const coerced = coerceId(record.id);
      if (coerced != null) {
        return coerced;
      }
    }
    if ('value' in record) {
      const coerced = coerceId(record.value);
      if (coerced != null) {
        return coerced;
      }
    }
  }
  return null;
};

const coerceName = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const coerced = coerceName(item);
      if (coerced) {
        return coerced;
      }
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = [
      'name',
      'machineName',
      'machinename',
      'label',
      'displayName',
      'displayname',
      'title',
    ];
    for (const key of keys) {
      if (key in record) {
        const coerced = coerceName(record[key]);
        if (coerced) {
          return coerced;
        }
      }
    }
  }
  return null;
};

const pickFirstId = (...values: unknown[]): string | number | null => {
  for (const value of values) {
    const coerced = coerceId(value);
    if (coerced != null) {
      return coerced;
    }
  }
  return null;
};

const pickFirstName = (...values: unknown[]): string | null => {
  for (const value of values) {
    const coerced = coerceName(value);
    if (coerced) {
      return coerced;
    }
  }
  return null;
};

const coerceDurationMin = (session: ReportColumnSession): number | null => {
  const candidates = [
    session.durationMin,
    session.durationMinutes,
    session.minutes,
    session.mins,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
};

const coerceHours = (session: ReportColumnSession): number | null => {
  const candidates = [session.hours, session.durationHours, session.totalHours];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
};

const coerceDateJst = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
    try {
      const { year, month, day } = getJstParts(value as string | number | Date);
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } catch {
      return null;
    }
  }
  return null;
};

const pickFirstDate = (...values: unknown[]): string | null => {
  for (const value of values) {
    const coerced = coerceDateJst(value);
    if (coerced) {
      return coerced;
    }
  }
  return null;
};

function extractSessionsFromColumns(columns: ReportColumn[]): SessionLike[] {
  const result: SessionLike[] = [];
  columns.forEach((column) => {
    if (!Array.isArray(column.sessions)) {
      return;
    }
    const baseUserName = typeof column.userName === 'string' && column.userName.trim().length > 0
      ? column.userName.trim()
      : '不明ユーザー';
    column.sessions.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const session = entry as ReportColumnSession;
      const record = session as Record<string, unknown>;
      const normalizedValues = new Map<string, unknown>();
      for (const [key, value] of Object.entries(record)) {
        const normalized = normalizeKey(key);
        if (!normalizedValues.has(normalized)) {
          normalizedValues.set(normalized, value);
        }
      }

      const readNormalized = (...keys: string[]) => {
        for (const key of keys) {
          const normalized = normalizeKey(key);
          if (normalizedValues.has(normalized)) {
            return normalizedValues.get(normalized);
          }
        }
        return undefined;
      };

      const machineField = record.machine;
      const machineId =
        pickFirstId(
          session.machineId,
          session.machineID,
          readNormalized('machineid'),
          readNormalized('machinecode'),
          readNormalized('machinenumber'),
          readNormalized('machinecodefrommachine'),
          typeof machineField === 'object' && machineField !== null && !Array.isArray(machineField)
            ? (machineField as Record<string, unknown>).id
            : undefined,
        );
      const machineName =
        pickFirstName(
          session.machineName,
          readNormalized('machinename'),
          readNormalized('machinelabel'),
          readNormalized('machinedisplayname'),
          readNormalized('machinenamejapanese'),
          typeof machineField === 'object' && machineField !== null && !Array.isArray(machineField)
            ? machineField
            : undefined,
        );

      const durationMin = coerceDurationMin(session);
      const hours = coerceHours(session);
      const resolvedMin = durationMin ?? (typeof hours === 'number' ? hours * 60 : 0);

      const date = pickFirstDate(
        session.date,
        readNormalized('date'),
        readNormalized('workdate'),
        readNormalized('startdate'),
        readNormalized('jstdate'),
      );

      const userId =
        typeof session.user === 'string' || typeof session.user === 'number'
          ? session.user
          : column.key;

      if (!date) {
        return;
      }

      result.push({
        date,
        user: userId,
        userName: baseUserName,
        machineId: machineId ?? null,
        machineName: machineName ?? null,
        durationMin: resolvedMin ?? 0,
      });
    });
  });
  return result;
}

export default function SiteReportPage() {
  const [monthValue, setMonthValue] = useState(defaultMonth);
  const [sites, setSites] = useState<SiteMaster[]>([]);
  const [machines, setMachines] = useState<MachineMaster[]>([]);
  const [siteId, setSiteId] = useState('');
  const [siteClient, setSiteClient] = useState('');
  const [machineFilter, setMachineFilter] = useState<string[]>([]);

  const [sessions, setSessions] = useState<SessionLike[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function loadMasters() {
      try {
        const machineResponsePromise = fetch('/api/masters/machines', {
          cache: 'no-store',
          credentials: 'same-origin',
        }).catch((error) => {
          console.warn('[reports][sites] failed to fetch machine masters', error);
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
          console.warn('[reports][sites] machine masters responded with non-ok status', machineRes.status);
          if (active) {
            setMachines([]);
          }
        }
      } catch (err) {
        console.error('[reports][sites] failed to load masters', err);
      }
    }
    loadMasters();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!siteId) {
      setSiteClient('');
      return;
    }
    const site = sites.find((item) => item.id === siteId);
    setSiteClient(site?.fields?.client ?? '');
  }, [siteId, sites]);

  const { year, month } = useMemo(() => {
    const [yearText, monthText] = monthValue.split('-');
    const parsedYear = Number(yearText);
    const parsedMonth = Number(monthText);
    if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
      return { year: Number.NaN, month: Number.NaN };
    }
    return { year: parsedYear, month: parsedMonth };
  }, [monthValue]);

  const derivedMachineLabels = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((session) => {
      if (session.machineId == null) {
        return;
      }
      const idText = typeof session.machineId === 'number' ? String(session.machineId) : String(session.machineId);
      if (!idText) {
        return;
      }
      const nameText =
        typeof session.machineName === 'string' && session.machineName.trim().length > 0
          ? session.machineName.trim()
          : '';
      if (!map.has(idText) || (!map.get(idText) && nameText)) {
        map.set(idText, nameText);
      }
    });
    return map;
  }, [sessions]);

  const machineOptions = useMemo(() => {
    const map = new Map<string, string>();
    derivedMachineLabels.forEach((label, id) => {
      map.set(id, label);
    });
    machines.forEach((machine) => {
      const machineIdRaw =
        typeof machine.fields?.machineid === 'string' ? machine.fields.machineid.trim() : '';
      const fallbackId = typeof machine.id === 'string' ? machine.id.trim() : String(machine.id);
      const id = machineIdRaw || fallbackId;
      if (!id) {
        return;
      }
      const nameRaw =
        typeof machine.fields?.name === 'string' ? machine.fields.name.trim() : '';
      const existing = map.get(id) ?? '';
      const label = nameRaw || existing || id;
      map.set(id, label);
    });
    return Array.from(map.entries())
      .filter(([id]) => id.trim().length > 0)
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([id, name]) => ({
        id,
        name: name.trim().length > 0 ? name : id,
      }));
  }, [derivedMachineLabels, machines]);

  const employeeOptions = useMemo(() => {
    const names = new Set<string>();
    sessions.forEach((session) => {
      if (session.userName) {
        names.add(session.userName);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [sessions]);

  useEffect(() => {
    setEmployeeFilter((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const valid = prev.filter((name) => employeeOptions.includes(name));
      return valid.length === prev.length ? prev : valid;
    });
  }, [employeeOptions]);

  const selectedEmployeeSet = useMemo(() => new Set(employeeFilter), [employeeFilter]);
  const hasEmployeeFilter = selectedEmployeeSet.size > 0;

  const filteredSessions = useMemo(() => {
    if (!hasEmployeeFilter) {
      return sessions;
    }
    return sessions.filter((session) => {
      if (!session.userName) {
        return false;
      }
      return selectedEmployeeSet.has(session.userName);
    });
  }, [hasEmployeeFilter, selectedEmployeeSet, sessions]);

  const handleEmployeeFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions)
      .map((option) => option.value)
      .filter((name) => name);
    setEmployeeFilter(values);
  };

  const handleEmployeeFilterReset = () => {
    setEmployeeFilter([]);
  };

  async function loadReport() {
    if (!siteId || !Number.isFinite(year) || !Number.isFinite(month)) {
      return;
    }
    setLoading(true);
    setError(null);
    setReportLoaded(false);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        siteId,
      });
      machineFilter.forEach((id) => {
        const normalized = typeof id === 'string' ? id.trim() : String(id).trim();
        if (normalized) {
          params.append('machineIds', normalized);
        }
      });
      const response = await fetch(`/api/reports/sites?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error(`Failed to load report: ${response.status}`);
      }
      const data = (await response.json()) as ReportResponse;
      const columnList = Array.isArray(data.columns) ? data.columns : [];
      setSessions(extractSessionsFromColumns(columnList));
      setEmployeeFilter([]);
      if (data.site?.client) {
        setSiteClient(data.site.client);
      }
      setReportLoaded(true);
    } catch (err) {
      console.error('[reports][sites] failed to load report', err);
      setError('集計の取得に失敗しました。条件を確認して再試行してください。');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  const isReady = Boolean(siteId) && Number.isFinite(year) && Number.isFinite(month);

  return (
    <div className="p-4 space-y-6">
      <div className="print-hide">
        <ReportsTabs />
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">現場別集計</h1>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 print-hide">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">年月</span>
            <input
              type="month"
              className="rounded border px-3 py-2"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">現場名</span>
            <select
              className="rounded border px-3 py-2"
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
            >
              <option value="">（選択してください）</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {toText(site.fields.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">元請・代理人（自動）</span>
            <input
              className="rounded border px-3 py-2 bg-gray-50"
              value={siteClient}
              placeholder="現場を選択すると自動入力"
              readOnly
            />
          </label>
          <div className="xl:col-span-2">
            <MachineCheckboxGroup
              options={machineOptions}
              value={machineFilter}
              onChange={setMachineFilter}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 print-hide">
          <button
            type="button"
            onClick={loadReport}
            disabled={!isReady || loading}
            className="rounded bg-indigo-600 px-4 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '集計中…' : '集計する'}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      {reportLoaded ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-3 print-hide">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">従業員名（複数選択可）</span>
              <select
                multiple
                size={Math.min(6, Math.max(4, employeeOptions.length))}
                className="rounded border px-2 py-1 min-w-48"
                value={employeeFilter}
                onChange={handleEmployeeFilterChange}
              >
                {employeeOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-1 flex-wrap items-start gap-3">
              <button
                type="button"
                onClick={handleEmployeeFilterReset}
                className="rounded border px-3 py-1 text-sm"
                disabled={!hasEmployeeFilter}
              >
                全員を表示
              </button>
              <PrintControls className="ml-auto" title="現場別集計（A4）" />
            </div>
          </div>
          <div className="screen-table-wrapper">
            {filteredSessions.length > 0 ? (
              <MachinePivotGrid sessions={filteredSessions} />
            ) : (
              <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                該当する稼働データがありません。
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">条件を選択し「集計する」を押すと結果が表示されます。</p>
      )}
    </div>
  );
}

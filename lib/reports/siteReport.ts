import { sitesTable } from '@/lib/airtable';
import { compareMachineId } from '@/lib/utils/sort';
import { fetchSessionReportRows, type SessionReportRow } from '@/src/lib/sessions-reports';
import { applyTimeCalcV2FromMinutes, shouldSkipDailyBreakByUsername } from '@/src/lib/timecalc';
import type { SiteFields } from '@/types';

const DOW = ['日', '月', '火', '水', '木', '金', '土'] as const;

function formatYmd(year: number, month: number, day: number) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function normalizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSameSiteName(a: string, b: string) {
  if (!a || !b) {
    return false;
  }
  return a.trim().localeCompare(b.trim(), 'ja', { sensitivity: 'base' }) === 0;
}

function normalizeMachineIdValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  return null;
}

function resolveSessionUserKey(session: SessionReportRow) {
  if (session.userRecordId) {
    return session.userRecordId;
  }
  if (session.userId != null) {
    return `user:${session.userId}`;
  }
  if (session.userName) {
    return `name:${session.userName}`;
  }
  return session.id;
}

export type ReportColumn = {
  key: string;
  userRecId?: string;
  userName: string;
  workDescription: string;
  machineId?: string | number;
  machineName?: string | null;
  machineIds: Array<string | number>;
  machineNames: string[];
};

export type DayRow = {
  date: string;
  day: number;
  dow: string;
  values: number[];
};

type ColumnAccumulator = {
  key: string;
  userRecId?: string;
  userName: string;
  skipBreakDeduction: boolean;
  workDescription: string;
  machineId: string | null;
  machineName: string | null;
};

export type SiteReportResult = {
  year: number;
  month: number;
  site: { id: string; name: string; client: string };
  columns: ReportColumn[];
  days: DayRow[];
};

export async function buildSiteReport({
  year,
  month,
  siteId,
  machineIds = [],
}: {
  year: number;
  month: number;
  siteId: string;
  machineIds?: string[];
}): Promise<SiteReportResult> {
  const daysInMonth = new Date(year, month, 0).getDate();

  let siteName = '';
  let client = '';
  try {
    const siteRecord = await sitesTable.find(siteId);
    const fields = siteRecord?.fields as SiteFields | undefined;
    if (fields) {
      siteName = fields.name ?? '';
      client = fields.client ?? '';
    }
  } catch (error) {
    console.warn('[reports][sites] failed to load site', error);
  }

  const machineIdSet = new Set(machineIds);
  const normalizedSiteName = normalizeText(siteName);
  const sessions = await fetchSessionReportRows({ year, month });

  const columnMap = new Map<string, ColumnAccumulator>();
  const minutesByKey = new Map<string, number>();

  for (const session of sessions) {
    if (!session.isCompleted || !session.date || session.year !== year || session.month !== month) {
      continue;
    }
    const matchesSite =
      (!!session.siteRecordId && session.siteRecordId === siteId) ||
      (!!normalizedSiteName && !!session.siteName && isSameSiteName(session.siteName, normalizedSiteName));
    if (!matchesSite) {
      continue;
    }

    if (machineIdSet.size > 0) {
      const matchesMachine = [session.machineId, session.machineRecordId].some((candidate) => {
        const normalized = normalizeMachineIdValue(candidate);
        return normalized != null && machineIdSet.has(normalized);
      });
      if (!matchesMachine) {
        continue;
      }
    }

    const rawMinutes =
      session.durationMin ?? (session.hours != null ? Math.round(session.hours * 60) : null);
    const minutes = typeof rawMinutes === 'number' ? Math.round(rawMinutes) : 0;
    if (minutes <= 0 || minutes >= 24 * 60) {
      continue;
    }

    const workDescription = session.workDescription?.trim() || '（未設定）';

    const userName = session.userName?.trim() || '不明ユーザー';
    const skipBreakDeduction = shouldSkipDailyBreakByUsername(
      session.userName ?? (session.userId != null ? String(session.userId) : ''),
    );
    const userKey = resolveSessionUserKey(session);
    const machineNameValue = session.machineName?.trim() || null;
    const normalizedMachineId = normalizeMachineIdValue(session.machineId);
    const machineKey = normalizedMachineId ?? (machineNameValue ? `name:${machineNameValue}` : 'machine:unknown');
    const columnKey = `${userKey}__${workDescription}__${machineKey}`;
    if (!columnMap.has(columnKey)) {
      columnMap.set(columnKey, {
        key: columnKey,
        userRecId: session.userRecordId ?? undefined,
        userName,
        skipBreakDeduction,
        workDescription,
        machineId: normalizedMachineId,
        machineName: machineNameValue,
      });
    }

    const column = columnMap.get(columnKey);
    if (!column) {
      continue;
    }

    if (!column.machineId && normalizedMachineId) {
      column.machineId = normalizedMachineId;
    }

    const machineName = machineNameValue;
    if (!column.machineName && machineName) {
      column.machineName = machineName;
    }

    const groupKey = `${session.date}|${columnKey}`;
    minutesByKey.set(groupKey, (minutesByKey.get(groupKey) ?? 0) + minutes);
  }

  const columns = Array.from(columnMap.values())
    .sort((a, b) => {
      const aHasMachine = !!a.machineId;
      const bHasMachine = !!b.machineId;
      if (aHasMachine && bHasMachine) {
        const diff = compareMachineId(
          { machineId: a.machineId!, machineName: a.machineName },
          { machineId: b.machineId!, machineName: b.machineName },
        );
        if (diff !== 0) {
          return diff;
        }
      } else if (aHasMachine) {
        return -1;
      } else if (bHasMachine) {
        return 1;
      }
      const userDiff = a.userName.localeCompare(b.userName, 'ja');
      if (userDiff !== 0) {
        return userDiff;
      }
      return a.workDescription.localeCompare(b.workDescription, 'ja');
    })
    .map<ReportColumn>((column) => ({
      key: column.key,
      userRecId: column.userRecId,
      userName: column.userName,
      workDescription: column.workDescription,
      machineId: column.machineId ?? undefined,
      machineName: column.machineName,
      machineIds: column.machineId ? [column.machineId] : [],
      machineNames: column.machineName ? [column.machineName] : [],
    }));

  const hoursByKey = new Map<string, number>();
  for (const [groupKey, totalMinutes] of minutesByKey.entries()) {
    const [, columnKey] = groupKey.split('|');
    const column = columnMap.get(columnKey ?? '');
    const { hours } = applyTimeCalcV2FromMinutes(totalMinutes, {
      breakMinutes: column?.skipBreakDeduction ? 0 : undefined,
    });
    hoursByKey.set(groupKey, hours);
  }

  const days: DayRow[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = formatYmd(year, month, day);
    const dow = DOW[new Date(`${date}T00:00:00+09:00`).getDay()];
    const values = columns.map((column) => hoursByKey.get(`${date}|${column.key}`) ?? 0);
    days.push({ date, day, dow, values });
  }

  return {
    year,
    month,
    site: { id: siteId, name: siteName, client },
    columns,
    days,
  };
}

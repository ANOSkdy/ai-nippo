import { sitesTable, withRetry } from '@/lib/airtable';
import type { ReportRow } from '@/lib/reports/pair';
import { fetchSessionReportRows, type SessionReportRow } from '@/src/lib/sessions-reports';
import { normalizeDailyMinutes } from '@/src/lib/timecalc';

type SortKey = 'year' | 'month' | 'day' | 'siteName';

function normalizeLookupText(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const [first] = value;
    if (typeof first === 'string') {
      const trimmed = first.trim();
      return trimmed ? trimmed : null;
    }
    if (first && typeof first === 'object') {
      const name = (first as { name?: unknown; value?: unknown }).name ??
        (first as { name?: unknown; value?: unknown }).value ??
        String(first);
      const trimmed = String(name).trim();
      return trimmed ? trimmed : null;
    }
    if (first != null) {
      const trimmed = String(first).trim();
      return trimmed ? trimmed : null;
    }
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

type DailyAggregate = {
  totalMinutes: number;
  clientName?: string | null;
};

const STANDARD_WORK_MINUTES = 7.5 * 60;

function toDayKey(session: SessionReportRow): string | null {
  if (typeof session.date === 'string' && session.date.trim().length > 0) {
    return session.date.trim();
  }
  const { year, month, day } = session;
  if (!year || !month || !day) {
    return null;
  }
  const yearStr = year.toString().padStart(4, '0');
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  return `${yearStr}-${monthStr}-${dayStr}`;
}

function buildDailyAggregates(sessions: SessionReportRow[]): Map<string, DailyAggregate> {
  const aggregates = new Map<string, DailyAggregate>();
  for (const session of sessions) {
    const key = toDayKey(session);
    if (!key) {
      continue;
    }
    const entry = aggregates.get(key) ?? { totalMinutes: 0 };

    const rawDuration = session.durationMin;
    if (typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0) {
      entry.totalMinutes += rawDuration;
    }

    const clientName = normalizeLookupText((session as Record<string, unknown>).clientName);
    if (!entry.clientName && clientName) {
      entry.clientName = clientName;
    }

    aggregates.set(key, entry);
  }
  return aggregates;
}

function formatHoursDecimal(minutes: number): string {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const hours = safeMinutes / 60;
  const rounded = Math.round(hours * 100) / 100;
  const text = rounded.toFixed(2).replace(/\.0+$/, '').replace(/\.([1-9])0$/, '.$1');
  return `${text}h`;
}

function formatTimestampJstFromMs(timestampMs: number | null | undefined): string | null {
  if (timestampMs == null || !Number.isFinite(timestampMs)) {
    return null;
  }
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: 'hour' | 'minute') =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour');
  const minute = pick('minute');
  if (!hour || !minute) {
    return null;
  }
  return `${hour}:${minute}`;
}

function formatTimestampJst(
  value: string | null | undefined,
  fallbackMs?: number | null | undefined,
): string | null {
  const msCandidate = fallbackMs != null && Number.isFinite(fallbackMs) ? fallbackMs : null;
  if (msCandidate != null) {
    return formatTimestampJstFromMs(msCandidate);
  }
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return formatTimestampJstFromMs(parsed);
}

function pickFirstStringField(fields: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

function chunkArray<T>(values: T[], size: number): T[][] {
  if (size <= 0) {
    return [values];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchSiteClientNames(sessions: SessionReportRow[]): Promise<Map<string, string>> {
  const siteIds = new Set<string>();
  for (const session of sessions) {
    const directClient = normalizeLookupText((session as Record<string, unknown>).clientName);
    if (directClient) {
      continue;
    }
    if (session.siteRecordId) {
      siteIds.add(session.siteRecordId);
    }
  }

  if (siteIds.size === 0) {
    return new Map();
  }

  const result = new Map<string, string>();
  const idList = Array.from(siteIds);
  const chunks = chunkArray(idList, 10);

  for (const chunk of chunks) {
    if (chunk.length === 0) {
      continue;
    }
    const conditions = chunk.map((id) => `RECORD_ID()='${id}'`).join(',');
    const formula = chunk.length === 1 ? conditions : `OR(${conditions})`;
    const records = await withRetry(() =>
      sitesTable.select({ fields: ['clientName', 'client'], filterByFormula: formula }).all(),
    );
    for (const record of records) {
      const fields = record.fields as Record<string, unknown>;
      const client =
        pickFirstStringField(fields, ['clientName', 'client', 'client name', 'client_name']) ?? null;
      if (client) {
        result.set(record.id, client);
      }
    }
  }

  return result;
}

export async function getReportRowsByUserName(
  userName: string,
  sort?: SortKey,
  order: 'asc' | 'desc' = 'asc',
): Promise<ReportRow[]> {
  const trimmedName = userName.trim();
  if (!trimmedName) {
    return [];
  }

  const sessions = await fetchSessionReportRows({ userName: trimmedName });
  const completedSessions = sessions.filter(
    (session) => session.isCompleted && session.year && session.month && session.day,
  );

  if (completedSessions.length === 0) {
    return [];
  }

  const aggregates = buildDailyAggregates(completedSessions);
  const siteClientNames = await fetchSiteClientNames(completedSessions);

  const dailySummaries = new Map<
    string,
    { workingMinutes: number; overtimeMinutes: number }
  >();
  for (const [dayKey, aggregate] of aggregates.entries()) {
    const normalizedMinutes = normalizeDailyMinutes(aggregate.totalMinutes);
    const workingMinutes = Math.min(normalizedMinutes, STANDARD_WORK_MINUTES);
    const overtimeMinutes = Math.max(0, normalizedMinutes - STANDARD_WORK_MINUTES);
    dailySummaries.set(dayKey, {
      workingMinutes,
      overtimeMinutes,
    });
  }

  const rows = completedSessions
    .map<ReportRow>((session) => {
      const key = toDayKey(session);
      const aggregate = key ? aggregates.get(key) : undefined;
      const summary = key ? dailySummaries.get(key) : undefined;
      const siteClientName = session.siteRecordId ? siteClientNames.get(session.siteRecordId) : null;
      const directClientName = normalizeLookupText((session as Record<string, unknown>).clientName);
      const resolvedClientName =
        directClientName ?? aggregate?.clientName ?? siteClientName ?? undefined;
      const startJst = formatTimestampJst(session.start, session.startMs);
      const endJst = formatTimestampJst(session.end, session.endMs);
      const minutes = summary?.workingMinutes ?? 0;
      const overtimeMinutes = summary?.overtimeMinutes ?? 0;
      const overtimeHours = formatHoursDecimal(overtimeMinutes);

      return {
        year: session.year ?? 0,
        month: session.month ?? 0,
        day: session.day ?? 0,
        siteName: session.siteName ?? '',
        clientName: resolvedClientName ?? undefined,
        minutes,
        startJst,
        endJst,
        overtimeHours,
      } satisfies ReportRow;
    })
    .filter((row) => row.year > 0 && row.month > 0 && row.day > 0);

  if (sort) {
    const dir = order === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      const aValue = a[sort];
      const bValue = b[sort];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue, 'ja');
        return dir === 1 ? result : -result;
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const result = aValue - bValue;
        return dir === 1 ? result : -result;
      }
      return 0;
    });
  }

  return rows;
}

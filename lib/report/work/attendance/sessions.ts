import { usersTable, withRetry } from '@/lib/airtable';
import type { UserFields } from '@/types';
import { AirtableError, listRecords } from '@/src/lib/airtable/client';

const SESSIONS_TABLE = 'Sessions';

export type AttendanceSession = {
  id: string;
  date: string | null;
  start: string | null;
  end: string | null;
  startMs: number | null;
  endMs: number | null;
  durationMin: number | null;
  siteName: string | null;
  workDescription: string | null;
  userId: number | null;
  userRecordId: string | null;
  userName: string | null;
  machineId: string | null;
  machineName: string | null;
  status: string | null;
};

export type AttendanceSessionQuery = {
  startDate: string;
  endDate: string;
  userId?: number | null;
  siteName?: string | null;
  machineId?: string | null;
};

type SessionFields = Record<string, unknown>;

type RawSessionRecord = {
  id: string;
  createdTime: string;
  fields: SessionFields;
};

function normalizeFieldKey(key: string): string {
  return key.trim().toLowerCase();
}

function getFieldValue<T = unknown>(fields: SessionFields, fieldName: string): T | undefined {
  const target = normalizeFieldKey(fieldName);
  for (const [key, value] of Object.entries(fields)) {
    if (normalizeFieldKey(key) === target) {
      return value as T;
    }
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractLookupText(value: unknown): string | null {
  const direct = asString(value);
  if (direct) {
    return direct;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = extractLookupText(entry);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const source =
      (value as { name?: unknown }).name ??
      (value as { value?: unknown }).value ??
      (value as { text?: unknown }).text ??
      (value as { label?: unknown }).label ??
      null;
    if (source != null) {
      return extractLookupText(source);
    }
  }
  return null;
}

function pickFirstString(fields: SessionFields, fieldNames: string[]): string | null {
  for (const fieldName of fieldNames) {
    const value = getFieldValue(fields, fieldName);
    const str = extractLookupText(value);
    if (str) {
      return str;
    }
  }
  return null;
}

function firstId(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim()) {
        return entry.trim();
      }
    }
    return null;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function extractUserName(fields: SessionFields): string | null {
  const direct = pickFirstString(fields, [
    'name (from user)',
    'user name',
    'userName',
    'username',
    'ユーザー名',
    'ユーザー名 (from user)',
    'display name',
    'displayName',
  ]);
  if (direct) {
    return direct;
  }

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string') {
      continue;
    }
    const normalizedKey = normalizeFieldKey(key);
    if (normalizedKey.includes('user') && normalizedKey.includes('name')) {
      const candidate = asString(value);
      if (candidate) {
        return candidate;
      }
    }
    if (normalizedKey.includes('user') && normalizedKey.includes('display')) {
      const candidate = asString(value);
      if (candidate) {
        return candidate;
      }
    }
  }
  return null;
}

function toSessionRow(record: RawSessionRecord): AttendanceSession | null {
  const fields = record.fields ?? {};
  const date = asString(getFieldValue(fields, 'date'));
  const start = pickFirstString(fields, ['start', 'start (JST)']);
  const end = pickFirstString(fields, ['end', 'end (JST)']);
  const durationMin = asNumber(getFieldValue(fields, 'durationMin'));
  const siteName = pickFirstString(fields, ['siteName', 'site name', 'site Name']);
  const workDescription = pickFirstString(fields, [
    'workDescription',
    'work description',
    'workDescription (from work)',
    'description (from work)',
  ]);

  const userField = getFieldValue(fields, 'user');
  const rawUserId = asNumber(userField);
  const userRecordId = firstId(userField);
  const userName = extractUserName(fields);

  const machineIdValue = pickFirstString(fields, [
    'machineId',
    'machine id',
    'machineid',
  ]);
  const machineIdNumber =
    asNumber(getFieldValue(fields, 'machineId'));
  const machineId = machineIdValue ?? (machineIdNumber != null ? String(machineIdNumber) : null);
  const machineName = pickFirstString(fields, [
    'machineName',
    'machine name',
    'machinename',
  ]);

  const status = pickFirstString(fields, ['status']);

  const startMs = start ? Date.parse(start) : Number.NaN;
  const endMs = end ? Date.parse(end) : Number.NaN;
  const normalizedStartMs = Number.isFinite(startMs) ? startMs : null;
  const normalizedEndMs = Number.isFinite(endMs) ? endMs : null;
  const computedDuration =
    normalizedStartMs != null && normalizedEndMs != null && normalizedEndMs > normalizedStartMs
      ? Math.round((normalizedEndMs - normalizedStartMs) / 60000)
      : null;

  return {
    id: record.id,
    date,
    start: start ?? null,
    end: end ?? null,
    startMs: normalizedStartMs,
    endMs: normalizedEndMs,
    durationMin: durationMin ?? computedDuration,
    siteName,
    workDescription,
    userId: rawUserId,
    userRecordId,
    userName,
    machineId,
    machineName,
    status,
  } satisfies AttendanceSession;
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.trim().toLocaleLowerCase('ja');
}

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildFilterFormula(query: AttendanceSessionQuery): string {
  const clauses: string[] = [];
  clauses.push(`{date} >= "${escapeFormulaValue(query.startDate)}"`);
  clauses.push(`{date} <= "${escapeFormulaValue(query.endDate)}"`);

  if (query.userId != null) {
    clauses.push(`{user} = ${Math.round(query.userId)}`);
  }
  if (query.siteName) {
    clauses.push(`{siteName} = "${escapeFormulaValue(query.siteName)}"`);
  }
  if (query.machineId) {
    clauses.push(`{machineId} = "${escapeFormulaValue(String(query.machineId))}"`);
  }

  if (clauses.length === 1) {
    return clauses[0];
  }
  return `AND(${clauses.join(',')})`;
}

async function fetchUserHydrationMap(recordIds: string[]): Promise<Map<string, { name: string | null; userId: number | null }>> {
  const map = new Map<string, { name: string | null; userId: number | null }>();
  if (recordIds.length === 0) {
    return map;
  }

  const uniqueIds = Array.from(new Set(recordIds));
  const batches: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += 15) {
    batches.push(uniqueIds.slice(index, index + 15));
  }

  for (const batch of batches) {
    const formula = batch
      .map((id) => `RECORD_ID()='${escapeFormulaValue(id)}'`)
      .reduce((acc, clause) => (acc ? `${acc},${clause}` : clause), '');
    const filterByFormula = batch.length === 1 ? formula : `OR(${formula})`;
    const records = await withRetry(() =>
      usersTable
        .select({
          filterByFormula,
          fields: ['name', 'username', 'userId'],
        })
        .all(),
    );

    for (const record of records) {
      const fields = record.fields as Partial<UserFields> | undefined;
      const name = asString(fields?.name) ?? asString(fields?.username) ?? null;
      const userId = asNumber(fields?.userId);
      map.set(record.id, { name, userId });
    }
  }

  return map;
}

async function hydrateUserRows(rows: AttendanceSession[]): Promise<void> {
  const needsHydration = rows.filter((row) => {
    if (!row.userRecordId) {
      return false;
    }
    const missingName = !row.userName || row.userName.trim().length === 0;
    const missingUserId = row.userId == null || !Number.isFinite(row.userId);
    return missingName || missingUserId;
  });

  if (needsHydration.length === 0) {
    return;
  }

  const recordIds = needsHydration
    .map((row) => row.userRecordId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const hydrationMap = await fetchUserHydrationMap(recordIds);

  for (const row of needsHydration) {
    if (!row.userRecordId) {
      continue;
    }
    const hydration = hydrationMap.get(row.userRecordId);
    if (!hydration) {
      continue;
    }
    if ((!row.userName || row.userName.trim().length === 0) && hydration.name) {
      row.userName = hydration.name;
    }
    if ((row.userId == null || !Number.isFinite(row.userId)) && hydration.userId != null) {
      row.userId = hydration.userId;
    }
  }
}

function matchesQuery(row: AttendanceSession, query: AttendanceSessionQuery): boolean {
  if (query.userId != null && row.userId !== query.userId) {
    return false;
  }
  if (query.siteName) {
    const expected = normalizeText(query.siteName);
    const actual = normalizeText(row.siteName);
    if (expected && actual && expected !== actual) {
      return false;
    }
  }
  if (query.machineId) {
    const expected = normalizeText(String(query.machineId));
    const actual = normalizeText(row.machineId);
    if (expected && actual && expected !== actual) {
      return false;
    }
  }
  return true;
}

/**
 * Sessionsテーブルから勤怠集計に必要なセッション一覧を取得する。
 */
export async function fetchAttendanceSessions(query: AttendanceSessionQuery): Promise<AttendanceSession[]> {
  const filterByFormula = buildFilterFormula(query);
  let records: Awaited<ReturnType<typeof listRecords<SessionFields>>>;
  try {
    records = await listRecords<SessionFields>({
      table: SESSIONS_TABLE,
      filterByFormula,
      fields: [
        'date',
        'start',
        'end',
        'durationMin',
        'siteName',
        'user',
        'name (from user)',
        'machineId',
        'machine',
        'machineName',
        'workDescription',
        'status',
      ],
      sort: [
        { field: 'date', direction: 'asc' },
        { field: 'start', direction: 'asc' },
      ],
    });
  } catch (error) {
    if (error instanceof AirtableError) {
      let message = error.message;
      try {
        const parsed = JSON.parse(error.message) as { error?: { message?: string } };
        if (parsed?.error?.message) {
          message = parsed.error.message;
        }
      } catch {
        // keep original message
      }
      console.error('[attendance] AirtableError', {
        status: error.status,
        message,
        filterByFormula,
      });
    }
    throw error;
  }

  const rows = records
    .map((record) => toSessionRow(record as RawSessionRecord))
    .filter((row): row is AttendanceSession => row !== null && row.date !== null);

  await hydrateUserRows(rows);

  const filtered = rows.filter((row) => matchesQuery(row, query));
  return filtered.sort((a, b) => {
    const dateA = a.date ?? '';
    const dateB = b.date ?? '';
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const startA = a.startMs ?? Number.POSITIVE_INFINITY;
    const startB = b.startMs ?? Number.POSITIVE_INFINITY;
    return startA - startB;
  });
}

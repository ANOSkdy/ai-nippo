import Airtable, { FieldSet } from 'airtable';
import { NextRequest, NextResponse } from 'next/server';
import { TZ_OFFSET, toUtcFromMaybeLocal } from './utils';

export const runtime = 'nodejs';
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY ?? '',
}).base(process.env.AIRTABLE_BASE_ID ?? '');

const TABLE_LOGS = process.env.AIRTABLE_TABLE_LOGS || 'Logs';
const TABLE_SESSION = process.env.AIRTABLE_TABLE_SESSIONS || 'Session';

export async function POST(req: NextRequest) {
  try {
    if (req.method !== 'POST') {
      return NextResponse.json(
        { ok: false, error: 'Method Not Allowed' },
        { status: 405 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const result = await handleOutToSession(body);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

interface NormalizedLog {
  id?: string;
  user?: unknown;
  username?: unknown;
  siteName?: unknown;
  workDescription?: unknown;
  type: string;
  ts: Date | null;
}

export async function handleOutToSession(payload: unknown) {
  type Payload = { outLogId: string } | { out: Record<string, unknown> };
  const p = payload as Payload | undefined;

  const outLogId = p && 'outLogId' in p ? p.outLogId : undefined;
  let outRec: Airtable.Record<FieldSet> | null = null;
  if (outLogId) {
    outRec = await withRetry(() => base(TABLE_LOGS).find(outLogId));
  }
  const out = outRec
    ? normalizeLog(outRec)
    : p && 'out' in p
      ? normalizeFields(p.out)
      : null;

  if (!out || out.type !== 'OUT' || !out.ts) {
    return { skipped: true, reason: 'invalid or non-OUT payload' };
  }

  const outLog = out as NormalizedLog & { ts: Date };
  const inRec = await findLatestInBefore(outLog);
  if (!inRec) return { skipped: true, reason: 'no matching IN' };
  const inn = normalizeLog(inRec);
  if (!inn.ts) return { skipped: true, reason: 'invalid IN timestamp' };

  const hours = Math.max(0, (out.ts.getTime() - inn.ts.getTime()) / 3600000);
  const hoursRounded = Math.round(hours * 100) / 100;

  const zonedIn = new Date(inn.ts.getTime() + TZ_OFFSET);
  const year = zonedIn.getUTCFullYear();
  const month = zonedIn.getUTCMonth() + 1;
  const day = zonedIn.getUTCDate();

  const dup = await findExistingSession({
    userId: String(inn.user ?? ''),
    sitename: stringOrEmpty(inn.siteName),
    workdescription: stringOrEmpty(inn.workDescription),
    clockInAt: inn.ts.toISOString(),
    clockOutAt: out.ts.toISOString(),
  });
  if (dup) {
    return { skipped: true, reason: 'session exists', sessionId: dup.id };
  }

  const fields = {
    year,
    month,
    day,
    userId: String(inn.user ?? ''),
    username: stringOrEmpty(inn.username),
    sitename: stringOrEmpty(inn.siteName),
    workdescription: stringOrEmpty(inn.workDescription),
    clockInAt: inn.ts.toISOString(),
    clockOutAt: out.ts.toISOString(),
    hours: hoursRounded,
  };

  const created = await withRetry(() =>
    base(TABLE_SESSION).create([{ fields }], { typecast: true }),
  );
  return { createdId: created?.[0]?.id, fields };
}

function escapeQuotes(v = '') {
  return String(v ?? '').replace(/'/g, "\\'");
}

function stringOrEmpty(v: unknown) {
  return v == null ? '' : String(v);
}

function normalizeLog(rec: Airtable.Record<FieldSet>): NormalizedLog {
  const f = rec.fields as Record<string, unknown>;
  return {
    id: rec.id,
    user: f.user ?? f.User ?? (f['user'] as unknown),
    username: f.username ?? f.userName ?? (f['username'] as unknown),
    siteName: f.siteName ?? (f['siteName'] as unknown) ?? (f.sitename as unknown),
    workDescription:
      f.workDescription ?? (f['workDescription'] as unknown) ?? f.workdescription,
    type: String(f.type || '').toUpperCase(),
    ts: toUtcFromMaybeLocal(f.timestamp),
  };
}

function normalizeFields(f: Record<string, unknown> | undefined): NormalizedLog | null {
  if (!f) return null;
  return {
    id: f.id as string | undefined,
    user: f.user ?? (f as Record<string, unknown>)['User'],
    username: f.username ?? (f as Record<string, unknown>)['userName'],
    siteName: f.siteName ?? (f as Record<string, unknown>)['sitename'],
    workDescription:
      f.workDescription ?? (f as Record<string, unknown>)['workdescription'],
    type: String(f.type || '').toUpperCase(),
    ts: toUtcFromMaybeLocal(f.timestamp),
  };
}

function formatJst(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
    date.getUTCSeconds(),
  )}`;
}

async function findLatestInBefore(out: NormalizedLog & { ts: Date }) {
  // Airtable 側では文字列 timestamp 比較をやめ、IN 候補を広めに取得して
  // Node 側で厳密に ts < out.ts の最新を選ぶ。
  const userStr = escapeQuotes(String(out.user ?? ''));
  const siteStr = escapeQuotes(String(out.siteName ?? ''));
  const workStr = escapeQuotes(String(out.workDescription ?? ''));

  // user が Number フィールドでも Text フィールドでもヒットさせる
  const userClause = `OR({user} = VALUE('${userStr}'), {user} = '${userStr}')`;
  const filter = `
AND(
  ${userClause},
  {siteName} = '${siteStr}',
  {workDescription} = '${workStr}',
  {type} = 'IN'
)`.trim();

  // 直近の IN を取りやすいように timestamp で降順ソート（文字列でも概ね近い順）
  const page = await withRetry(() =>
    base(TABLE_LOGS)
      .select({
        filterByFormula: filter,
        sort: [{ field: 'timestamp', direction: 'desc' }],
        maxRecords: 50, // 十分に小さく・十分に多い範囲を取得
      })
      .firstPage(),
  );

  // Node 側で厳密に比較
  let best: Airtable.Record<FieldSet> | null = null;
  let bestTs = -Infinity;
  for (const rec of page) {
    const n = normalizeLog(rec);
    if (!n.ts) continue;
    const t = n.ts.getTime();
    if (t < out.ts.getTime() && t > bestTs) {
      best = rec;
      bestTs = t;
    }
  }
  return best;
}

async function findExistingSession(args: {
  userId: string;
  sitename: string;
  workdescription: string;
  clockInAt: string;
  clockOutAt: string;
}) {
  const { userId, sitename, workdescription, clockInAt, clockOutAt } = args;
  const filter = `
AND(
  {userId} = '${escapeQuotes(userId)}',
  {sitename} = '${escapeQuotes(sitename)}',
  {workdescription} = '${escapeQuotes(workdescription)}',
  {clockInAt} = '${escapeQuotes(clockInAt)}',
  {clockOutAt} = '${escapeQuotes(clockOutAt)}'
)`;

  const page = await withRetry(() =>
    base(TABLE_SESSION)
      .select({ filterByFormula: filter, maxRecords: 1 })
      .firstPage(),
  );
  return page[0] || null;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt += 1;
      if (attempt > retries) throw e;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 100));
    }
  }
}

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
  // 1) 広め検索（型揺れ吸収）
  const search = await findInCandidates(outLog);
  // Node 側で厳密比較（ts < out.ts）
  const viable = search.candidates
    .map((r) => ({ rec: r, n: normalizeLog(r) }))
    .filter((x) => x.n.ts && x.n.ts.getTime() < outLog.ts.getTime());
  // 同日(JST) fallback（site/work が微ズレのとき検出）
  const sameDay = viable.filter((x) => isSameLocalDay(x.n.ts!, outLog.ts));

  const pick = ((list) => {
    let best: (typeof list)[number] | null = null;
    let bestTs = -Infinity;
    for (const it of list) {
      const t = it.n.ts!.getTime();
      if (t > bestTs) {
        best = it;
        bestTs = t;
      }
    }
    return best?.rec ?? null;
  })(sameDay.length ? sameDay : viable);

  if (!pick) {
    return {
      skipped: true,
      reason: 'no matching IN',
      debug: {
        user: outLog.user,
        siteName: outLog.siteName,
        workDescription: outLog.workDescription,
        outTs: outLog.ts.toISOString(),
        candidatesFound: search.candidates.length,
        viableBeforeOut: viable.length,
        sameDayJST: sameDay.length,
        sample: search.candidates.slice(0, 5).map((r) => r.id),
      },
    };
  }
  const inn = normalizeLog(pick);
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
  return {
    createdId: created?.[0]?.id,
    fields,
    debug: {
      pickedInId: pick.id,
      pickedInTs: inn.ts?.toISOString(),
    },
  };
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

async function findInCandidates(out: NormalizedLog & { ts: Date }) {
  // user 数値/文字列の両マッチ、site/work はトリム比較
  const userStr = escapeQuotes(String(out.user ?? ''));
  const siteStr = escapeQuotes(String((out.siteName ?? '').toString().trim()));
  const workStr = escapeQuotes(String((out.workDescription ?? '').toString().trim()));
  const userClause = `OR({user} = VALUE('${userStr}'), {user} = '${userStr}')`;
  const filter = `
AND(
  ${userClause},
  OR(
    TRIM({siteName}) = '${siteStr}',
    TRIM({siteName}) = TRIM('${siteStr}')
  ),
  OR(
    TRIM({workDescription}) = '${workStr}',
    TRIM({workDescription}) = TRIM('${workStr}')
  ),
  {type} = 'IN'
)`.trim();

  const page = await withRetry(() =>
    base(TABLE_LOGS)
      .select({
        filterByFormula: filter,
        sort: [{ field: 'timestamp', direction: 'desc' }],
        maxRecords: 100,
      })
      .firstPage(),
  );
  return { candidates: page ?? [] };
}

function isSameLocalDay(a: Date, b: Date) {
  const aj = new Date(a.getTime() + TZ_OFFSET);
  const bj = new Date(b.getTime() + TZ_OFFSET);
  return (
    aj.getUTCFullYear() === bj.getUTCFullYear() &&
    aj.getUTCMonth() === bj.getUTCMonth() &&
    aj.getUTCDate() === bj.getUTCDate()
  );
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

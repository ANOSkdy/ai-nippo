import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { isAdminUIEnabled } from '@/lib/featureFlags';
import { searchQuerySchema } from '@/lib/validation/admin';
import { table, withRetry } from '@/lib/airtable';
import type { SearchResponse } from '@/types/admin';

const LOGS_TABLE = 'Logs';

function buildFilterFormula(q: z.infer<typeof searchQuerySchema>) {
  const clauses: string[] = [];
  if (q.userId) clauses.push(`FIND('${q.userId}', ARRAYJOIN({user}))`);
  if (q.siteName) clauses.push(`FIND('${q.siteName}', {siteName})`);
  if (q.type) clauses.push(`{type}='${q.type}'`);
  if (q.dateFrom) clauses.push(`IS_AFTER({date}, '${q.dateFrom}')`);
  if (q.dateTo) clauses.push(`IS_BEFORE({date}, '${q.dateTo}')`);
  if (clauses.length === 0) {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const seven = d.toISOString().slice(0, 10);
    return `IS_AFTER({date}, '${seven}')`;
  }
  return `AND(${clauses.join(',')})`;
}

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!isAdminUIEnabled())
    return NextResponse.json({ error: 'Disabled' }, { status: 404 });

  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const q = parsed.data;

  try {
    const res: SearchResponse = await withRetry(async () => {
      const sel = table(LOGS_TABLE).select({
        filterByFormula: buildFilterFormula(q),
        pageSize: q.pageSize,
        sort: [
          { field: 'date', direction: 'desc' },
          { field: 'timestamp', direction: 'desc' },
        ],
      });
      const items: SearchResponse['items'] = [];
      await new Promise<void>((resolve, reject) => {
        sel.eachPage(
          (records) => {
            for (const r of records) {
              items.push({
                id: r.id,
                date: r.get('date') as string | undefined,
                timestamp: r.get('timestamp') as string | undefined,
                user: r.get('user') as string[] | undefined,
                machine: r.get('machine') as string[] | undefined,
                siteName: r.get('siteName') as string | undefined,
                work: r.get('work') as number | undefined,
                workDescription: r.get('workDescription') as string | undefined,
                type: r.get('type') as 'IN' | 'OUT' | undefined,
              });
            }
            resolve();
          },
          (err) => (err ? reject(err) : resolve()),
        );
      });
      return { items };
    });
    return NextResponse.json(res, { status: 200 });
  } catch (e: unknown) {
    console.error('[admin/search]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Upstream failure' }, { status: 502 });
  }
}


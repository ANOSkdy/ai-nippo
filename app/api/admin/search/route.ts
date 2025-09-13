import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminUIEnabled } from '@/lib/featureFlags';
import { parseSearchQuery } from '@/lib/validation/admin';
import { logsTable, withRetry } from '@/lib/airtable';
import type { SearchResponse } from '@/types/admin';

export const runtime = 'nodejs';

import type { SearchQuery } from '@/lib/validation/admin';

function buildFilterFormula(q: SearchQuery): string | undefined {
  const clauses: string[] = [];
  if (q.userId) clauses.push(`FIND('${q.userId}', ARRAYJOIN({user}))`);
  if (q.siteName) clauses.push(`FIND('${q.siteName}', {siteName})`);
  if (q.type) clauses.push(`{type}='${q.type}'`);
  if (q.dateFrom) clauses.push(`IS_AFTER({date}, '${q.dateFrom}')`);
  if (q.dateTo) clauses.push(`IS_BEFORE({date}, '${q.dateTo}')`);
  return clauses.length ? `AND(${clauses.join(',')})` : undefined;
}

export async function GET(req: Request) {
  if (!isAdminUIEnabled()) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

  const url = new URL(req.url);
  const parsed = parseSearchQuery(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const q = parsed.data;

  const filterByFormula = buildFilterFormula(q);
  const pageSize = q.pageSize ?? 25;

  try {
    const res: SearchResponse = await withRetry(async () => {
        const sel = logsTable.select({ filterByFormula, pageSize });
        const items: SearchResponse['items'] = [];
      await new Promise<void>((resolve, reject) => {
        sel.eachPage(
          function page(records) {
            for (const r of records) {
              items.push({
                id: r.id,
                date: r.get('date') as string | undefined,
                timestamp: r.get('timestamp') as string | undefined,
                user: (r.get('user') as string[] | undefined) ?? undefined,
                machine: (r.get('machine') as string[] | undefined) ?? undefined,
                siteName: r.get('siteName') as string | undefined,
                work: r.get('work') as number | undefined,
                workDescription: r.get('workDescription') as string | undefined,
                type: r.get('type') as 'IN' | 'OUT' | undefined,
              });
            }
            resolve();
          },
          function done(err) {
            if (err) reject(err);
          }
        );
      });
      return { items };
    });

    return NextResponse.json(res, { status: 200 });
  } catch (e) {
    console.error('[admin/search]', e);
    return NextResponse.json({ error: 'Upstream failure' }, { status: 502 });
  }
}

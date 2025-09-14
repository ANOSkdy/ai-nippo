import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminUIEnabled } from '@/lib/featureFlags';
import { parseReflectBody } from '@/lib/validation/admin';
import { table, withRetry } from '@/lib/airtable';
import { LogFields } from '@/types';

const LOGS_TABLE = 'Logs';

export const runtime = 'nodejs';

const ALLOWED_FIELDS = new Set(['workDescription', 'type'] as const);

export async function POST(req: Request) {
    if (!isAdminUIEnabled()) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const role = (session.user as { role?: string } | undefined)?.role;
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseReflectBody(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updates = parsed.data.updates.map(
      (u: { id: string; fields: { workDescription?: string; type?: 'IN' | 'OUT' } }) => {
        const fields: { workDescription?: string; type?: 'IN' | 'OUT' } = {};
        for (const [k, v] of Object.entries(u.fields) as [
          'workDescription' | 'type',
          string | 'IN' | 'OUT'
        ][]) {
          if (ALLOWED_FIELDS.has(k)) {
            if (k === 'workDescription') fields.workDescription = v as string;
            if (k === 'type') fields.type = v as 'IN' | 'OUT';
          }
        }
        return { id: u.id, fields };
      }
    );

    const chunks: Array<
      Array<{ id: string; fields: { workDescription?: string; type?: 'IN' | 'OUT' } }>
    > = [];
  const size = 10;
  for (let i = 0; i < updates.length; i += size) {
    chunks.push(updates.slice(i, i + size));
  }

  try {
    for (const chunk of chunks) {
      await withRetry(() =>
        table(LOGS_TABLE).update(
          chunk as Array<{ id: string; fields: Partial<LogFields> }>,
          { typecast: true }
        )
      );
    }
    const actor = session.user as { email?: string; name?: string };
    console.info('[admin/reflect]', {
      by: actor.email || actor.name,
      count: updates.length,
      fields: Array.from(ALLOWED_FIELDS),
    });
    return NextResponse.json({ updated: updates.length }, { status: 200 });
  } catch (e) {
    console.error('[admin/reflect]', e);
    return NextResponse.json({ error: 'Upstream failure' }, { status: 502 });
  }
}

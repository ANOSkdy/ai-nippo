import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminUIEnabled } from '@/lib/featureFlags';
import { reflectBodySchema } from '@/lib/validation/admin';
import { table, withRetry } from '@/lib/airtable';
import type { FieldSet, UpdateOptions, Records } from 'airtable';

const LOGS_TABLE = 'Logs';
type AllowedField = 'workDescription' | 'type';
const ALLOWED = new Set<AllowedField>(['workDescription', 'type']);

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!isAdminUIEnabled())
    return NextResponse.json({ error: 'Disabled' }, { status: 404 });

  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = reflectBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Array<{ id: string; fields: Partial<FieldSet> }> =
    parsed.data.updates.map((u) => {
      const fields: Partial<FieldSet> = {};
      for (const [k, v] of Object.entries(u.fields)) {
        const key = k as AllowedField;
        if (ALLOWED.has(key)) {
          fields[key] = v as FieldSet[AllowedField];
        }
      }
      return { id: u.id, fields };
    });

  const chunks: typeof updates[] = [];
  for (let i = 0; i < updates.length; i += 10)
    chunks.push(updates.slice(i, i + 10));

  try {
    const opts: UpdateOptions = { typecast: true };
    for (const c of chunks) {
      await withRetry<Records<FieldSet>>(
        () =>
          new Promise((resolve, reject) => {
            table(LOGS_TABLE).update(
              c,
              opts,
              (err, records) => {
                if (err) return reject(err);
                resolve(records as Records<FieldSet>);
              },
            );
          }),
      );
    }
    console.info('[admin/reflect]', {
      by:
        (session.user as { email?: string; name?: string }).email ||
        (session.user as { email?: string; name?: string }).name,
      count: updates.length,
      fields: Array.from(ALLOWED),
    });
    return NextResponse.json({ updated: updates.length }, { status: 200 });
  } catch (e: unknown) {
    console.error('[admin/reflect]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Upstream failure' }, { status: 502 });
  }
}


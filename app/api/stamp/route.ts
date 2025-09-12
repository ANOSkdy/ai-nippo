import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { machinesTable } from '@/lib/airtable';
import { createSession, updateSessionGeo } from '@/lib/session-store';
import { validateStartRequest } from './validator';

export const runtime = 'nodejs';

function ok(sessionId: string, status: 'geo_pending' | 'accepted' | 'rejected') {
  return NextResponse.json({ ok: true, sessionId, status });
}

function badRequest(hint: string) {
  return NextResponse.json({ ok: false, hint }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'UNAUTHORIZED' }, { status: 401 });
  }

  const parsed = validateStartRequest(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.hint);
  }

  const { machineId, workDescription, type, lat, lon, lng, accuracy, positionTimestamp } =
    parsed.data;
  const longitude = lon ?? lng;

  try {
    const machineRecords = await machinesTable
      .select({ filterByFormula: `{machineid} = '${machineId}'`, maxRecords: 1 })
      .firstPage();

    if (machineRecords.length === 0 || !machineRecords[0].fields.active) {
      return badRequest('Invalid or inactive machine ID');
    }

    const sessionEntry = createSession({
      userId: session.user.id,
      machineId,
      machineRecordId: machineRecords[0].id,
      workDescription,
      type,
      startedAt: Date.now(),
    });

    if (lat !== undefined && longitude !== undefined) {
      await updateSessionGeo(sessionEntry.sessionId, {
        lat,
        lon: longitude,
        accuracy,
        positionTimestamp,
      });
    }

    return ok(sessionEntry.sessionId, sessionEntry.status);
  } catch (error) {
    console.error('start failed', error);
    return ok('unknown', 'geo_pending');
  }
}


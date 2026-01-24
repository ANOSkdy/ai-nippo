import { NextResponse } from 'next/server';
import {
  InvalidMonthError,
  SiteNotFoundError,
  getMonthlyAttendance,
} from '@/lib/report/work/attendance/getMonthlyAttendance';
import { AirtableError } from '@/src/lib/airtable/client';

function parseAirtableErrorDetails(error: AirtableError): unknown {
  try {
    return JSON.parse(error.message);
  } catch {
    return error.message;
  }
}

function parseNumberParam(value: string | null, label: string): number | null {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a number`);
  }
  return parsed;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get('month');
  const siteId = searchParams.get('siteId') || undefined;
  const siteName = searchParams.get('siteName') || undefined;

  if (!monthParam) {
    return NextResponse.json({ error: 'month is required' }, { status: 400 });
  }

  let userId: number | null = null;
  let machineId: number | null = null;
  try {
    const userParam = searchParams.get('user') ?? searchParams.get('userId');
    userId = parseNumberParam(userParam, 'user');
    machineId = parseNumberParam(searchParams.get('machineId'), 'machineId');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid params';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const response = await getMonthlyAttendance({
      month: monthParam,
      siteId,
      siteName,
      userId,
      machineId,
    });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof InvalidMonthError) {
      return NextResponse.json({ error: 'month must be YYYY-MM format' }, { status: 400 });
    }
    if (error instanceof SiteNotFoundError) {
      return NextResponse.json(
        { message: 'siteId not found', details: { siteId: error.siteId } },
        { status: 404 },
      );
    }
    if (error instanceof AirtableError && error.status === 422) {
      const details = parseAirtableErrorDetails(error);
      console.error('[/api/report/work/attendance] airtable error', {
        status: error.status,
        details,
      });
      return NextResponse.json(
        { message: 'Airtable request failed', details },
        { status: 422 },
      );
    }
    console.error('[/api/report/work/attendance] error', error);
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json({ message: 'internal error', details: message }, { status: 500 });
  }
}

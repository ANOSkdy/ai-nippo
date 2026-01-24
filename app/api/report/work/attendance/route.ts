import { NextResponse } from 'next/server';
import {
  aggregateMonthlyAttendance,
  type AttendanceUser,
} from '@/lib/report/work/attendance/aggregateMonthlyAttendance';
import { getMonthDateRange } from '@/lib/report/work/attendance/dateUtils';
import { normalizeSession } from '@/lib/report/work/attendance/normalize';
import { fetchAttendanceSessions } from '@/lib/report/work/attendance/sessions';
import { resolveSiteName } from '@/lib/report/work/attendance/siteUtils';
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

  const range = getMonthDateRange(monthParam);
  if (!range) {
    return NextResponse.json({ error: 'month must be YYYY-MM format' }, { status: 400 });
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
    const resolvedSiteName = await resolveSiteName(siteId, siteName);
    if (siteId && !siteName && !resolvedSiteName) {
      return NextResponse.json(
        { message: 'siteId not found', details: { siteId } },
        { status: 404 },
      );
    }

    const sessions = (await fetchAttendanceSessions({
      startDate: range.startDate,
      endDate: range.endDate,
      userId,
      siteName: resolvedSiteName ?? undefined,
      machineId: machineId != null ? String(machineId) : null,
    })).map(normalizeSession);

    const usersMap = new Map<string, AttendanceUser>();
    for (const session of sessions) {
      const key = session.userId != null
        ? `userId:${session.userId}`
        : session.userRecordId
        ? `record:${session.userRecordId}`
        : session.userName
        ? `name:${session.userName}`
        : 'unknown';
      if (!usersMap.has(key)) {
        usersMap.set(key, {
          userId: session.userId ?? null,
          name: session.userName ?? null,
          userRecordId: session.userRecordId ?? null,
        });
      }
    }

    const response = aggregateMonthlyAttendance(
      sessions,
      Array.from(usersMap.values()),
      monthParam,
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
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

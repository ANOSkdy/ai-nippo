import { NextResponse } from 'next/server';
import {
  aggregateMonthlyAttendance,
  type AttendanceUser,
} from '@/lib/report/work/attendance/aggregateMonthlyAttendance';
import { getMonthDateRange } from '@/lib/report/work/attendance/dateUtils';
import { fetchAttendanceSessions } from '@/lib/report/work/attendance/sessions';
import { AirtableError, listRecords } from '@/src/lib/airtable/client';
import type { SiteFields } from '@/types';

const SITES_TABLE = 'Sites';

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function resolveSiteName(siteId?: string, siteName?: string): Promise<string | null> {
  if (siteName && siteName.trim().length > 0) {
    return siteName.trim();
  }
  if (!siteId) {
    return null;
  }
  const records = await listRecords<SiteFields>({
    table: SITES_TABLE,
    filterByFormula: `{siteId} = "${escapeFormulaValue(siteId)}"`,
    maxRecords: 1,
    fields: ['name', 'siteId'],
  });
  const name = records[0]?.fields?.name;
  if (typeof name === 'string' && name.trim().length > 0) {
    return name.trim();
  }
  return null;
}

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
    userId = parseNumberParam(searchParams.get('userId'), 'userId');
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

    const sessions = await fetchAttendanceSessions({
      startDate: range.startDate,
      endDate: range.endDate,
      userId,
      siteId,
      siteName: resolvedSiteName ?? undefined,
      machineId: machineId != null ? String(machineId) : null,
    });

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

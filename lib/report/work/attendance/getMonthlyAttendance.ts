import {
  aggregateMonthlyAttendance,
  type AttendanceUser,
  type MonthlyAttendanceResponse,
} from './aggregateMonthlyAttendance';
import { getMonthDateRange } from './dateUtils';
import { normalizeSession } from './normalize';
import { fetchAttendanceSessions } from './sessions';
import { resolveSiteName } from './siteUtils';

export class InvalidMonthError extends Error {
  constructor(message = 'month must be YYYY-MM format') {
    super(message);
    this.name = 'InvalidMonthError';
  }
}

export class SiteNotFoundError extends Error {
  siteId: string;

  constructor(siteId: string) {
    super('siteId not found');
    this.name = 'SiteNotFoundError';
    this.siteId = siteId;
  }
}

export type MonthlyAttendanceParams = {
  month: string;
  siteId?: string;
  siteName?: string;
  userId?: number | null;
  machineId?: number | null;
};

function buildUserKey(user: {
  userId?: number | null;
  userRecordId?: string | null;
  userName?: string | null;
}): string {
  if (user.userId != null) {
    return `userId:${user.userId}`;
  }
  if (user.userRecordId) {
    return `record:${user.userRecordId}`;
  }
  if (user.userName) {
    return `name:${user.userName}`;
  }
  return 'unknown';
}

export async function getMonthlyAttendance(
  params: MonthlyAttendanceParams,
): Promise<MonthlyAttendanceResponse> {
  const range = getMonthDateRange(params.month);
  if (!range) {
    throw new InvalidMonthError();
  }

  const resolvedSiteName = await resolveSiteName(params.siteId, params.siteName);
  if (params.siteId && !params.siteName && !resolvedSiteName) {
    throw new SiteNotFoundError(params.siteId);
  }

  const sessions = (await fetchAttendanceSessions({
    startDate: range.startDate,
    endDate: range.endDate,
    userId: params.userId ?? null,
    siteName: resolvedSiteName ?? undefined,
    machineId: params.machineId != null ? String(params.machineId) : null,
  })).map(normalizeSession);

  const usersMap = new Map<string, AttendanceUser>();
  for (const session of sessions) {
    const key = buildUserKey(session);
    if (!usersMap.has(key)) {
      usersMap.set(key, {
        userId: session.userId ?? null,
        name: session.userName ?? null,
        userRecordId: session.userRecordId ?? null,
      });
    }
  }

  return aggregateMonthlyAttendance(
    sessions,
    Array.from(usersMap.values()),
    params.month,
  );
}

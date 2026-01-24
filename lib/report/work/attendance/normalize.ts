import type { AttendanceSession } from './sessions';

export type NormalizedSessionStatus = 'closed' | 'open' | 'unknown' | 'other';

const CLOSED_STATUSES = new Set(['close', 'closed']);

export function normalizeSessionStatus(input: unknown): NormalizedSessionStatus {
  if (input == null) {
    return 'unknown';
  }
  if (typeof input !== 'string') {
    return 'other';
  }

  const normalized = input.trim().toLowerCase();
  if (normalized.length === 0) {
    return 'unknown';
  }
  if (CLOSED_STATUSES.has(normalized)) {
    return 'closed';
  }
  if (normalized === 'open') {
    return 'open';
  }
  return 'other';
}

export type NormalizedAttendanceSession = AttendanceSession & {
  status: NormalizedSessionStatus;
  statusNormalized: NormalizedSessionStatus;
  statusRaw: string | null;
};

export function normalizeSession(session: AttendanceSession): NormalizedAttendanceSession {
  const statusRaw = typeof session.status === 'string' ? session.status : null;
  const statusNormalized = normalizeSessionStatus(session.status);

  return {
    ...session,
    statusRaw,
    status: statusNormalized,
    statusNormalized,
  } satisfies NormalizedAttendanceSession;
}

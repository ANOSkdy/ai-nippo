import 'server-only';

import { auth } from '@/lib/auth';
import { usersTable } from '@/lib/airtable';
import { resolveUserIdentity } from '@/lib/services/userIdentity';

type Role = 'admin' | 'user' | string;

type SessionLike = {
  user?: Record<string, unknown> | null;
} | null;

function normalizeRoleString(value: string): Role {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'user';
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'user') return 'user';
  if (lower === 'admin') return 'admin';
  return trimmed as Role;
}

function normRole(value: unknown): Role | null {
  if (!value) return null;
  if (typeof value === 'string') {
    return normalizeRoleString(value);
  }
  if (typeof value === 'object' && value !== null && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string') {
      return normalizeRoleString(name);
    }
  }
  return null;
}

function coerceToString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}

function uniqueStrings(values: Array<unknown>): string[] {
  const result = new Set<string>();
  for (const value of values) {
    const coerced = coerceToString(value);
    if (coerced) {
      result.add(coerced);
    }
  }
  return Array.from(result);
}

function looksLikeRecordId(value: string): boolean {
  return value.startsWith('rec');
}

function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

export async function getCurrentUserRole(): Promise<Role> {
  const session = (await auth()) as SessionLike;
  const sessionUser = (session?.user as Record<string, unknown> | undefined) ?? undefined;
  const sessionRole = normRole(sessionUser?.role);
  if (sessionRole) {
    return sessionRole;
  }

  const identity = sessionUser ? resolveUserIdentity({ fields: sessionUser }) : undefined;

  const recordIdCandidates = uniqueStrings([
    sessionUser?.id,
    identity?.userRecId,
  ]);

  for (const recordId of recordIdCandidates) {
    if (!looksLikeRecordId(recordId)) continue;
    try {
      const record = await usersTable.find(recordId);
      const roleFromRecord = normRole(record.get('role'));
      if (roleFromRecord) {
        return roleFromRecord;
      }
    } catch {
      // ignore and fall through to the formula-based lookup
    }
  }

  const candidateUserIds = uniqueStrings([
    sessionUser?.userId,
    identity?.employeeCode,
  ]);
  const candidateUsernames = uniqueStrings([
    sessionUser?.username,
    identity?.username,
  ]);
  const candidateEmails = uniqueStrings([
    sessionUser?.email,
    sessionUser?.login,
  ]);

  const formulaParts: string[] = [];
  for (const userId of candidateUserIds) {
    formulaParts.push(`({userId}='${escapeFormulaValue(userId)}')`);
  }
  for (const username of candidateUsernames) {
    formulaParts.push(`({username}='${escapeFormulaValue(username)}')`);
  }
  for (const email of candidateEmails) {
    formulaParts.push(`({email}='${escapeFormulaValue(email)}')`);
  }

  if (formulaParts.length === 0) {
    return 'user';
  }

  const formula =
    formulaParts.length === 1 ? formulaParts[0] : `OR(${formulaParts.join(',')})`;

  try {
    const page = await usersTable
      .select({
        filterByFormula: formula,
        fields: ['role'],
        maxRecords: 1,
      })
      .firstPage();

    const record = page?.[0];
    if (record) {
      const role = normRole(record.get('role'));
      if (role) {
        return role;
      }
    }
  } catch {
    // fall through to default role
  }

  return 'user';
}

export type { Role };

export function isRoleUser(role: Role | null | undefined): boolean {
  const normalized = normRole(role ?? null);
  return (normalized ?? 'user') === 'user';
}

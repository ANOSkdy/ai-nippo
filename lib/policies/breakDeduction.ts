import type { UserFields } from '@/types';
import { logger } from '@/lib/logger';

export type BreakPolicyIdentity = {
  userRecordId?: string | null;
  userId?: string | number | null;
  userName?: string | null;
};

export type BreakPolicySource = 'recordId' | 'userId' | 'userName' | 'default';

export type BreakPolicyResult = {
  excludeBreakDeduction: boolean;
  source: BreakPolicySource;
};

type UserPolicyRecord = {
  id: string;
  name: string | null;
  userId: number | null;
  excludeBreakDeduction: boolean;
};

type ResolverDeps = {
  findByRecordId: (recordId: string) => Promise<UserPolicyRecord | null>;
  findByUserId: (userId: number) => Promise<UserPolicyRecord | null>;
  findByUserName: (userName: string) => Promise<UserPolicyRecord[]>;
  isPolicyEnabled: () => boolean;
};

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return false;
}

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('ja');
}

function makeCacheKeys(identity: BreakPolicyIdentity): string[] {
  const keys: string[] = [];
  const recordId = asString(identity.userRecordId);
  if (recordId) keys.push(`record:${recordId}`);
  const userId = asNumber(identity.userId);
  if (userId != null) keys.push(`userId:${userId}`);
  const userName = asString(identity.userName);
  if (userName) keys.push(`userName:${normalizeName(userName)}`);
  return keys;
}

const DEFAULT_POLICY: BreakPolicyResult = { excludeBreakDeduction: false, source: 'default' };

function toPolicy(record: UserPolicyRecord | null, source: Exclude<BreakPolicySource, 'default'>): BreakPolicyResult {
  if (!record) {
    return DEFAULT_POLICY;
  }
  return {
    excludeBreakDeduction: Boolean(record.excludeBreakDeduction),
    source,
  };
}

async function buildDeps(): Promise<ResolverDeps> {
  const { usersTable, withRetry } = await import('@/lib/airtable');

  const toPolicyRecord = (record: { id: string; fields: Partial<UserFields> | undefined }): UserPolicyRecord => {
    const fields = record.fields ?? {};
    return {
      id: record.id,
      name: asString(fields.name) ?? asString(fields.username),
      userId: asNumber(fields.userId),
      excludeBreakDeduction: asBoolean((fields as Record<string, unknown>).excludeBreakDeduction),
    };
  };

  return {
    findByRecordId: async (recordId) => {
      const records = await withRetry(() =>
        usersTable
          .select({
            filterByFormula: `RECORD_ID()='${escapeFormulaValue(recordId)}'`,
            fields: ['name', 'username', 'userId', 'excludeBreakDeduction'],
            maxRecords: 1,
          })
          .all(),
      );
      const first = records[0];
      return first ? toPolicyRecord({ id: first.id, fields: first.fields as Partial<UserFields> }) : null;
    },
    findByUserId: async (userId) => {
      const records = await withRetry(() =>
        usersTable
          .select({
            filterByFormula: `{userId} = ${Math.round(userId)}`,
            fields: ['name', 'username', 'userId', 'excludeBreakDeduction'],
            maxRecords: 1,
          })
          .all(),
      );
      const first = records[0];
      return first ? toPolicyRecord({ id: first.id, fields: first.fields as Partial<UserFields> }) : null;
    },
    findByUserName: async (userName) => {
      const formula = `LOWER({name}) = "${escapeFormulaValue(userName.toLocaleLowerCase('ja'))}"`;
      const records = await withRetry(() =>
        usersTable
          .select({
            filterByFormula: formula,
            fields: ['name', 'username', 'userId', 'excludeBreakDeduction'],
          })
          .all(),
      );
      return records.map((record) => toPolicyRecord({ id: record.id, fields: record.fields as Partial<UserFields> }));
    },
    isPolicyEnabled: () => process.env.ENABLE_BREAK_POLICY !== 'false',
  };
}

export function createBreakPolicyResolver(injected?: Partial<ResolverDeps>) {
  let depsPromise: Promise<ResolverDeps> | null = null;

  const getDeps = async (): Promise<ResolverDeps> => {
    if (
      injected?.findByRecordId &&
      injected?.findByUserId &&
      injected?.findByUserName &&
      injected?.isPolicyEnabled
    ) {
      return {
        findByRecordId: injected.findByRecordId,
        findByUserId: injected.findByUserId,
        findByUserName: injected.findByUserName,
        isPolicyEnabled: injected.isPolicyEnabled,
      };
    }
    if (!depsPromise) {
      depsPromise = buildDeps();
    }
    return depsPromise;
  };

  return async function resolveBreakPolicy(
    identity: BreakPolicyIdentity,
    cache?: Map<string, BreakPolicyResult>,
  ): Promise<BreakPolicyResult> {
    const deps = await getDeps();
    if (!deps.isPolicyEnabled()) {
      return DEFAULT_POLICY;
    }

    const cacheKeys = makeCacheKeys(identity);
    if (cache && cacheKeys.length > 0) {
      for (const key of cacheKeys) {
        const found = cache.get(key);
        if (found) {
          return found;
        }
      }
    }

    const recordId = asString(identity.userRecordId);
    if (recordId) {
      const policy = toPolicy(await deps.findByRecordId(recordId), 'recordId');
      if (cache) {
        for (const key of cacheKeys) cache.set(key, policy);
      }
      return policy;
    }

    const userId = asNumber(identity.userId);
    if (userId != null) {
      const policy = toPolicy(await deps.findByUserId(userId), 'userId');
      if (cache) {
        for (const key of cacheKeys) cache.set(key, policy);
      }
      return policy;
    }

    const userName = asString(identity.userName);
    if (userName) {
      const matches = await deps.findByUserName(userName);
      let policy = DEFAULT_POLICY;
      if (matches.length === 1) {
        policy = toPolicy(matches[0], 'userName');
      } else if (matches.length > 1) {
        logger.warn('[break-policy] duplicate users matched by userName. fallback to default.', {
          userName,
          matchedCount: matches.length,
        });
      }
      if (cache) {
        for (const key of cacheKeys) cache.set(key, policy);
      }
      return policy;
    }

    return DEFAULT_POLICY;
  };
}

const defaultResolver = createBreakPolicyResolver();

export async function resolveBreakPolicy(identity: BreakPolicyIdentity, cache?: Map<string, BreakPolicyResult>) {
  return defaultResolver(identity, cache);
}

export function isBreakPolicyEnabled() {
  return process.env.ENABLE_BREAK_POLICY !== 'false';
}

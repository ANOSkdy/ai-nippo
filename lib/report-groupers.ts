export type ReportLog = {
  id: string;
  userId: string;
  userName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  date?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  machine?: { machineId?: string | null; machineName?: string | null } | null;
  workType?: string | null;
  durationMinutes?: number | null;
};

export type UserDateGroup = {
  key: string;
  date: string;
  userId: string;
  userName?: string | null;
  totalMinutes: number;
  count: number;
  items: ReportLog[];
};

function toDateYMD(iso?: string | null): string {
  if (!iso) return '';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return '';
  }
  try {
    return new Date(timestamp).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function diffMinutes(startIso?: string | null, endIso?: string | null): number {
  if (!startIso || !endIso) return 0;
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function resolveMinutes(log: ReportLog): number {
  if (log.durationMinutes != null && Number.isFinite(log.durationMinutes)) {
    return Math.max(0, Math.round(log.durationMinutes));
  }
  return diffMinutes(log.startAt, log.endAt);
}

function sortItems(items: ReportLog[]): ReportLog[] {
  return [...items].sort((a, b) => {
    const aStart = a.startAt ?? '';
    const bStart = b.startAt ?? '';
    if (aStart && bStart) {
      const result = aStart.localeCompare(bStart);
      if (result !== 0) {
        return result;
      }
    } else if (aStart) {
      return -1;
    } else if (bStart) {
      return 1;
    }
    const aEnd = a.endAt ?? '';
    const bEnd = b.endAt ?? '';
    if (aEnd && bEnd) {
      return aEnd.localeCompare(bEnd);
    }
    if (aEnd) return -1;
    if (bEnd) return 1;
    return a.id.localeCompare(b.id);
  });
}

export function groupByUserDate(logs: ReportLog[]): UserDateGroup[] {
  const map = new Map<string, UserDateGroup>();

  for (const log of logs ?? []) {
    if (!log.userId) {
      continue;
    }
    const date = log.date || toDateYMD(log.startAt) || toDateYMD(log.endAt);
    if (!date) {
      continue;
    }
    const key = `${date}|${log.userId}`;
    const group = map.get(key) ?? {
      key,
      date,
      userId: log.userId,
      userName: log.userName,
      totalMinutes: 0,
      count: 0,
      items: [],
    };
    group.items.push(log);
    group.count += 1;
    group.totalMinutes += resolveMinutes(log);
    if (!group.userName && log.userName) {
      group.userName = log.userName;
    }
    map.set(key, group);
  }

  const groups = Array.from(map.values());
  groups.forEach((group) => {
    group.items = sortItems(group.items);
  });

  groups.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    const nameA = a.userName ?? a.userId;
    const nameB = b.userName ?? b.userId;
    return nameA.localeCompare(nameB, 'ja');
  });

  return groups;
}

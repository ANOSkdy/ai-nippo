import Airtable, { FieldSet } from 'airtable';

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  throw new Error('Airtable credentials are not configured');
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

const PROJECTS_TABLE = process.env.AIRTABLE_TABLE_PROJECTS || 'Projects';
const SITES_TABLE = process.env.AIRTABLE_TABLE_SITES || 'Sites';

type ProjectStatus = '準備中' | '進行中' | '保留' | '完了';

interface ProjectFields extends FieldSet {
  projectId?: string;
  name?: string;
  site?: readonly string[];
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  progressPercent?: number;
  spreadsheetUrl?: string;
}

interface SiteFields extends FieldSet {
  name?: string;
}

export type ProjectListItem = {
  projectId: string;
  name: string;
  siteName: string | null;
  status: ProjectStatus | '';
  startDate: string | null;
  endDate: string | null;
  progressPercent: number | null;
  spreadsheetUrl: string | null;
};

export type ProjectListResponse = {
  items: ProjectListItem[];
  total: number;
};

type SortKey = 'progressPercent' | 'startDate' | 'endDate';

type SortOrder = 'asc' | 'desc';

type ListOptions = {
  search?: string;
  status?: ProjectStatus;
  sortBy?: SortKey;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
};

const withRetry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
};

let projectsCache: Promise<ProjectListItem[]> | null = null;

const fetchSiteNames = async (siteIds: readonly string[] | undefined): Promise<Map<string, string>> => {
  const names = new Map<string, string>();
  if (!siteIds || siteIds.length === 0) {
    return names;
  }
  const uniqueIds = Array.from(new Set(siteIds));
  const chunkSize = 15;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    const records = await withRetry(() =>
      base<SiteFields>(SITES_TABLE)
        .select({ filterByFormula: formula, maxRecords: chunk.length })
        .all(),
    );
    records.forEach((record) => {
      if (typeof record.fields.name === 'string') {
        names.set(record.id, record.fields.name);
      }
    });
  }
  return names;
};

const loadProjects = async (): Promise<ProjectListItem[]> => {
  const records = await withRetry(() =>
    base<ProjectFields>(PROJECTS_TABLE)
      .select({
        pageSize: 100,
      })
      .all(),
  );

  const siteIds = records.flatMap((record) => record.fields.site ?? []);
  const siteNames = await fetchSiteNames(siteIds);

  return records.map((record) => {
    const { fields } = record;
    const linkedSiteId = fields.site?.[0];
    const progress =
      typeof fields.progressPercent === 'number'
        ? Math.round(fields.progressPercent * 100) / 100
        : typeof fields.progressPercent === 'string'
          ? Number.parseFloat(fields.progressPercent)
          : null;
    return {
      projectId: fields.projectId ?? record.id,
      name: fields.name ?? '未設定',
      siteName: linkedSiteId ? siteNames.get(linkedSiteId) ?? null : null,
      status: fields.status ?? '',
      startDate: fields.startDate ?? null,
      endDate: fields.endDate ?? null,
      progressPercent: Number.isFinite(progress) ? progress : null,
      spreadsheetUrl: fields.spreadsheetUrl ?? null,
    } satisfies ProjectListItem;
  });
};

const ensureProjects = () => {
  if (!projectsCache) {
    projectsCache = loadProjects().catch((error) => {
      projectsCache = null;
      throw error;
    });
  }
  return projectsCache;
};

const compareValues = (a: ProjectListItem, b: ProjectListItem, sortBy: SortKey, order: SortOrder): number => {
  const direction = order === 'desc' ? -1 : 1;
  if (sortBy === 'progressPercent') {
    const valueA = a.progressPercent ?? 0;
    const valueB = b.progressPercent ?? 0;
    if (valueA === valueB) {
      return a.name.localeCompare(b.name) * direction;
    }
    return (valueA - valueB) * direction;
  }
  const rawA = sortBy === 'startDate' ? a.startDate : a.endDate;
  const rawB = sortBy === 'startDate' ? b.startDate : b.endDate;
  const timeA = rawA ? Date.parse(rawA) : 0;
  const timeB = rawB ? Date.parse(rawB) : 0;
  if (timeA === timeB) {
    return a.name.localeCompare(b.name) * direction;
  }
  return (timeA - timeB) * direction;
};

export const listProjects = async ({
  search,
  status,
  sortBy = 'endDate',
  order = 'desc',
  page = 1,
  pageSize = 20,
}: ListOptions = {}): Promise<ProjectListResponse> => {
  const projects = await ensureProjects();
  const normalizedSearch = search?.toLowerCase().trim();

  const filtered = projects.filter((project) => {
    if (status && project.status !== status) {
      return false;
    }
    if (normalizedSearch) {
      const target = `${project.name} ${project.siteName ?? ''}`.toLowerCase();
      if (!target.includes(normalizedSearch)) {
        return false;
      }
    }
    return true;
  });

  const sorted = filtered.slice().sort((a, b) => compareValues(a, b, sortBy, order));

  const safePage = Math.max(page, 1);
  const safePageSize = Math.max(pageSize, 1);
  const offset = (safePage - 1) * safePageSize;
  const items = sorted.slice(offset, offset + safePageSize);

  return { items, total: filtered.length };
};

export const findSpreadsheetUrlForSites = async (siteNames: readonly string[]): Promise<string | null> => {
  if (!siteNames.length) {
    return null;
  }
  const projects = await ensureProjects();
  const candidates = projects.filter(
    (project) => project.siteName && siteNames.includes(project.siteName),
  );
  if (candidates.length === 0) {
    return null;
  }
  const sorted = candidates.sort((a, b) => {
    const timeA = a.endDate ? Date.parse(a.endDate) : 0;
    const timeB = b.endDate ? Date.parse(b.endDate) : 0;
    if (timeA === timeB) {
      return (b.startDate ? Date.parse(b.startDate) : 0) - (a.startDate ? Date.parse(a.startDate) : 0);
    }
    return timeB - timeA;
  });
  const found = sorted.find((project) => project.spreadsheetUrl);
  return found?.spreadsheetUrl ?? null;
};

export const resetProjectsCache = () => {
  projectsCache = null;
};

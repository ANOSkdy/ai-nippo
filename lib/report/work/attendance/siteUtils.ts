import { listRecords } from '@/src/lib/airtable/client';
import type { SiteFields } from '@/types';

const SITES_TABLE = 'Sites';

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function resolveSiteName(siteId?: string, siteName?: string): Promise<string | null> {
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

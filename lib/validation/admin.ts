export type SearchQuery = {
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  siteName?: string;
  type?: 'IN' | 'OUT';
  pageToken?: string;
  pageSize: number;
};

export function parseSearchQuery(
  params: Record<string, string | string[] | undefined>
): { success: true; data: SearchQuery } | { success: false; error: string } {
  const data: SearchQuery = { pageSize: 25 };
  if (typeof params.userId === 'string') data.userId = params.userId;
  if (typeof params.siteName === 'string') data.siteName = params.siteName;
  if (typeof params.type === 'string') {
    if (params.type === 'IN' || params.type === 'OUT') data.type = params.type;
    else return { success: false, error: 'Invalid type' };
  }
  if (typeof params.dateFrom === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.dateFrom)) data.dateFrom = params.dateFrom;
    else return { success: false, error: 'Invalid dateFrom' };
  }
  if (typeof params.dateTo === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.dateTo)) data.dateTo = params.dateTo;
    else return { success: false, error: 'Invalid dateTo' };
  }
  if (typeof params.pageToken === 'string') data.pageToken = params.pageToken;
  if (typeof params.pageSize === 'string') {
    const n = Number(params.pageSize);
    if (Number.isInteger(n) && n >= 1 && n <= 100) data.pageSize = n;
    else return { success: false, error: 'Invalid pageSize' };
  }
  return { success: true, data };
}

export type ReflectUpdate = {
  id: string;
  fields: { workDescription?: string; type?: 'IN' | 'OUT' };
};
export type ReflectBody = {
  updates: ReflectUpdate[];
};

export function parseReflectBody(
  body: unknown
): { success: true; data: ReflectBody } | { success: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Invalid body' };
  }
  const b = body as Record<string, unknown>;
  const updatesRaw = b.updates;
  if (!Array.isArray(updatesRaw) || updatesRaw.length === 0 || updatesRaw.length > 50) {
    return { success: false, error: 'Invalid updates' };
  }
  const updates: ReflectUpdate[] = [];
  for (const u of updatesRaw as Array<Record<string, unknown>>) {
    const id = u.id;
    const fieldsSrc = u.fields as Record<string, unknown> | undefined;
    if (typeof id !== 'string' || !fieldsSrc) {
      return { success: false, error: 'Invalid update item' };
    }
    const fields: ReflectUpdate['fields'] = {};
    if (typeof fieldsSrc.workDescription === 'string') {
      fields.workDescription = fieldsSrc.workDescription;
    }
    if (typeof fieldsSrc.type === 'string') {
      if (fieldsSrc.type === 'IN' || fieldsSrc.type === 'OUT') {
        fields.type = fieldsSrc.type;
      } else return { success: false, error: 'Invalid type' };
    }
    if (Object.keys(fields).length === 0) {
      return { success: false, error: 'No fields to update' };
    }
    updates.push({ id, fields });
  }
  return { success: true, data: { updates } };
}

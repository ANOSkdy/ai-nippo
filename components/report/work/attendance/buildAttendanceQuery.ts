export type AttendanceFilters = {
  month: string;
  siteId?: string;
  siteName?: string;
  machineId?: string;
};

export function buildAttendanceQuery(filters: AttendanceFilters): string {
  const params = new URLSearchParams();
  params.set('month', filters.month);
  if (filters.siteId) params.set('siteId', filters.siteId);
  if (!filters.siteId && filters.siteName) params.set('siteName', filters.siteName);
  if (filters.machineId) params.set('machineId', filters.machineId);
  return params.toString();
}

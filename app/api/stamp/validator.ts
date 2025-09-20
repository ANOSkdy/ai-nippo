export type StampRequest = {
  machineId: string;
  workDescription: string;
  lat: number;
  lon: number;
  accuracy?: number;
  positionTimestamp?: number;
  clientDecision?: 'auto' | 'blocked';
  siteId?: string;
  type: 'IN' | 'OUT';
};

const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

export function validateStampRequest(
  data: unknown,
): { success: true; data: StampRequest } | { success: false; hint: string } {
  const payload = data as Partial<StampRequest>;
  const errors: string[] = [];

  if (typeof payload.machineId !== 'string' || payload.machineId.trim().length === 0) {
    errors.push('machineId is required');
  }
  if (typeof payload.workDescription !== 'string' || payload.workDescription.trim().length === 0) {
    errors.push('workDescription is required');
  }
  if (!finiteNumber(payload.lat)) {
    errors.push('lat must be a finite number');
  }
  if (!finiteNumber(payload.lon)) {
    errors.push('lon must be a finite number');
  }
  if (
    payload.accuracy !== undefined &&
    (!finiteNumber(payload.accuracy) || (payload.accuracy as number) < 0)
  ) {
    errors.push('accuracy must be a positive number when provided');
  }
  if (
    payload.positionTimestamp !== undefined &&
    !finiteNumber(payload.positionTimestamp)
  ) {
    errors.push('positionTimestamp must be a finite number when provided');
  }
  if (
    payload.clientDecision !== undefined &&
    payload.clientDecision !== 'auto' &&
    payload.clientDecision !== 'blocked'
  ) {
    errors.push('clientDecision must be auto or blocked when provided');
  }
  if (payload.siteId !== undefined && typeof payload.siteId !== 'string') {
    errors.push('siteId must be a string when provided');
  }
  if (payload.type !== 'IN' && payload.type !== 'OUT') {
    errors.push('type must be IN or OUT');
  }

  if (errors.length > 0) {
    return { success: false, hint: errors.join(', ') };
  }

  return { success: true, data: payload as StampRequest };
}

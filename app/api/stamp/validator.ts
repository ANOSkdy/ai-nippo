export type StartRequest = {
  machineId: string;
  workDescription: string;
  type: 'IN' | 'OUT';
  lat?: number;
  lon?: number;
  lng?: number;
  accuracy?: number;
  positionTimestamp?: number;
};

export type GeoUpdateRequest = {
  sessionId: string;
  lat: number;
  lon?: number;
  lng?: number;
  accuracy?: number;
  positionTimestamp?: number;
};

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

export function validateStartRequest(
  data: unknown,
): { success: true; data: StartRequest } | { success: false; hint: string } {
  const body = data as Partial<StartRequest>;
  if (
    typeof body.machineId !== 'string' ||
    typeof body.workDescription !== 'string' ||
    (body.type !== 'IN' && body.type !== 'OUT') ||
    (body.lat !== undefined && !isNumber(body.lat)) ||
    (body.lon !== undefined && !isNumber(body.lon)) ||
    (body.lng !== undefined && !isNumber(body.lng)) ||
    (body.accuracy !== undefined && !isNumber(body.accuracy)) ||
    (body.positionTimestamp !== undefined && !isNumber(body.positionTimestamp))
  ) {
    return { success: false, hint: 'machineId, workDescription, type are required' };
  }
  return { success: true, data: body as StartRequest };
}

export function validateGeoUpdateRequest(
  data: unknown,
): { success: true; data: GeoUpdateRequest } | { success: false; hint: string } {
  const body = data as Partial<GeoUpdateRequest>;
  if (
    typeof body.sessionId !== 'string' ||
    !isNumber(body.lat) ||
    (body.lon === undefined && body.lng === undefined) ||
    (body.lon !== undefined && !isNumber(body.lon)) ||
    (body.lng !== undefined && !isNumber(body.lng)) ||
    (body.accuracy !== undefined && !isNumber(body.accuracy)) ||
    (body.positionTimestamp !== undefined && !isNumber(body.positionTimestamp))
  ) {
    return { success: false, hint: 'sessionId, lat, lon|lng are required' };
  }
  return { success: true, data: body as GeoUpdateRequest };
}


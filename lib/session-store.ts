import crypto from 'node:crypto';
import { logsTable, sitesTable } from '@/lib/airtable';
import { findNearestSite } from '@/lib/geo';
import type { LogFields } from '@/types';

export type GeoSession = {
  sessionId: string;
  status: 'geo_pending' | 'accepted' | 'rejected';
  userId: string;
  machineId: string;
  machineRecordId: string;
  workDescription: string;
  type: 'IN' | 'OUT';
  startedAt: number;
  lat?: number;
  lon?: number;
  accuracy?: number;
  positionTimestamp?: number;
  decisionThreshold?: number;
  distanceToSite?: number;
  syncedAt?: string;
  airtableRecordId?: string;
};

const sessions = new Map<string, GeoSession>();

export function createSession(
  params: Omit<
    GeoSession,
    | 'sessionId'
    | 'status'
    | 'lat'
    | 'lon'
    | 'accuracy'
    | 'positionTimestamp'
    | 'decisionThreshold'
    | 'distanceToSite'
    | 'syncedAt'
    | 'airtableRecordId'
  >,
): GeoSession {
  const sessionId = crypto.randomUUID();
  const session: GeoSession = {
    ...params,
    sessionId,
    status: 'geo_pending',
  };
  sessions.set(sessionId, session);
  return session;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function updateSessionGeo(
  sessionId: string,
  geo: { lat: number; lon: number; accuracy?: number; positionTimestamp?: number },
): Promise<GeoSession | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.lat = geo.lat;
  session.lon = geo.lon;
  session.accuracy = geo.accuracy;
  session.positionTimestamp = geo.positionTimestamp;

  try {
    const activeSites = await sitesTable.select({ filterByFormula: '{active} = 1' }).all();
    const nearestSite = findNearestSite(geo.lat, geo.lon, activeSites);
    const distanceToSite = nearestSite
      ? haversineDistance(geo.lat, geo.lon, nearestSite.fields.lat, nearestSite.fields.lon)
      : Number.POSITIVE_INFINITY;
    const threshold = Math.max(150, (geo.accuracy ?? 150) * 2);
    const fresh =
      typeof geo.positionTimestamp === 'number'
        ? Date.now() - geo.positionTimestamp <= 30_000
        : false;
    const accurate = typeof geo.accuracy === 'number' ? geo.accuracy <= 100 : false;
    const within = distanceToSite <= threshold;
    const accepted = within && fresh && accurate;

    session.distanceToSite = distanceToSite;
    session.decisionThreshold = threshold;

    if (accepted && session.status !== 'accepted') {
      const now = new Date();
      const timestamp = now.toISOString();
      const dateJST = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(now)
        .replace(/\//g, '-');

      const fields: Omit<LogFields, 'user' | 'machine'> & {
        user: readonly string[];
        machine: readonly string[];
      } = {
        timestamp,
        date: dateJST,
        user: [session.userId],
        machine: [session.machineRecordId],
        lat: geo.lat,
        lon: geo.lon,
        accuracy: geo.accuracy,
        positionTimestamp: geo.positionTimestamp,
        distanceToSite,
        decisionThreshold: threshold,
        siteName: nearestSite?.fields.name ?? '特定不能',
        workDescription: session.workDescription,
        type: session.type,
        serverDecision: 'accepted',
        status: 'accepted',
        sessionId: session.sessionId,
      };

      const created = await logsTable.create([{ fields }]);
      session.status = 'accepted';
      session.syncedAt = timestamp;
      session.airtableRecordId = created[0].id;
    }
  } catch (error) {
    console.error('geo update failed', error);
  }

  return session;
}

export function getSession(sessionId: string): GeoSession | undefined {
  return sessions.get(sessionId);
}


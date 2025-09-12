import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateSessionGeo, getSession } from '@/lib/session-store';
import { validateGeoUpdateRequest } from '../validator';

export const runtime = 'nodejs';

function ok(sessionId: string, status: 'geo_pending' | 'accepted' | 'rejected') {
  return NextResponse.json({ ok: true, sessionId, status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return ok('unknown', 'geo_pending');
  }

  const parsed = validateGeoUpdateRequest(await req.json());
  if (!parsed.success) {
    return ok('unknown', 'geo_pending');
  }

  const { sessionId, lat, lon, lng, accuracy, positionTimestamp } = parsed.data;
  const longitude = lon ?? lng!;

  try {
    const existing = getSession(sessionId);
    if (!existing) {
      return ok(sessionId, 'geo_pending');
    }

    await updateSessionGeo(sessionId, {
      lat,
      lon: longitude,
      accuracy,
      positionTimestamp,
    });

    const updated = getSession(sessionId);
    return ok(sessionId, updated?.status ?? 'geo_pending');
  } catch (error) {
    console.error('geo-update failed', error);
    return ok(sessionId, 'geo_pending');
  }
}


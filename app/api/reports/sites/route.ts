export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildSiteReport } from '@/app/(protected)/reports/sites/_lib/buildSiteReport';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const siteId = searchParams.get('siteId') ?? '';
  const machineIdsFilter = searchParams
    .getAll('machineIds')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !siteId) {
    return NextResponse.json({ error: 'year, month, siteId are required' }, { status: 400 });
  }

  try {
    const report = await buildSiteReport({
      year,
      month,
      siteId,
      machineIds: machineIdsFilter,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('[reports][sites] failed to build report', error);
    return NextResponse.json({ error: 'failed to build report' }, { status: 500 });
  }
}

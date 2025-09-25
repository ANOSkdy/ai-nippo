import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findSpreadsheetUrlForSites } from '@/lib/airtable/projects';
import { getDaySessions } from '@/lib/airtable/sessions';

export const runtime = 'nodejs';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const extractSiteNames = (sessions: { sitename: string }[]): string[] => {
  const set = new Set<string>();
  sessions.forEach((session) => {
    if (session.sitename) {
      set.add(session.sitename);
    }
  });
  return Array.from(set);
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !DATE_PATTERN.test(date)) {
      return NextResponse.json({ error: 'MISSING_DATE', code: 'MISSING_DATE' }, { status: 400 });
    }

    const detail = await getDaySessions(date);
    const spreadsheetUrl = await findSpreadsheetUrlForSites(extractSiteNames(detail.sessions));

    return NextResponse.json({ ...detail, spreadsheetUrl: spreadsheetUrl ?? null });
  } catch (error) {
    console.error('[dashboard.day-detail]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

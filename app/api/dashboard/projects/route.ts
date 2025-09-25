import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listProjects, type ProjectListResponse } from '@/lib/airtable/projects';

export const runtime = 'nodejs';

type SortParam = 'progress' | 'startDate' | 'endDate';

type OrderParam = 'asc' | 'desc';

const sortMap: Record<SortParam, 'progressPercent' | 'startDate' | 'endDate'> = {
  progress: 'progressPercent',
  startDate: 'startDate',
  endDate: 'endDate',
};

const isStatus = (value: string | null): value is '準備中' | '進行中' | '保留' | '完了' => {
  return value === '準備中' || value === '進行中' || value === '保留' || value === '完了';
};

const parsePositiveInt = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const statusParam = searchParams.get('status');
    const status = isStatus(statusParam) ? statusParam : undefined;
    const sortParam = (searchParams.get('sort') as SortParam | null) ?? null;
    const orderParam = (searchParams.get('order') as OrderParam | null) ?? 'desc';
    const pageParam = parsePositiveInt(searchParams.get('page'));
    const pageSizeParam = parsePositiveInt(searchParams.get('pageSize'));

    if (searchParams.get('page') && !pageParam) {
      return NextResponse.json({ error: 'INVALID_PAGE', code: 'INVALID_PAGE' }, { status: 400 });
    }
    if (searchParams.get('pageSize') && !pageSizeParam) {
      return NextResponse.json({ error: 'INVALID_PAGE_SIZE', code: 'INVALID_PAGE_SIZE' }, { status: 400 });
    }

    const sortBy = sortParam ? sortMap[sortParam] : 'endDate';
    const order: OrderParam = orderParam === 'asc' ? 'asc' : 'desc';

    const data = (await listProjects({
      search,
      status,
      sortBy,
      order,
      page: pageParam ?? undefined,
      pageSize: pageSizeParam ?? undefined,
    })) satisfies ProjectListResponse;

    return NextResponse.json(data);
  } catch (error) {
    console.error('[dashboard.projects]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

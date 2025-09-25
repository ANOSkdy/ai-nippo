import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import ProjectsTable from './_components/ProjectsTable';
import CalendarMonth from './_components/CalendarMonth';

const TAB_KEYS = ['projects', 'calendar'] as const;

type DashboardTab = (typeof TAB_KEYS)[number];

type DashboardPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

function resolveTab(value: string | null | undefined): DashboardTab {
  if (value === 'calendar') {
    return 'calendar';
  }
  return 'projects';
}

function resolveNumberParam(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const tab = resolveTab(
    typeof searchParams.tab === 'string' ? searchParams.tab : Array.isArray(searchParams.tab) ? searchParams.tab[0] : null,
  );

  const resolvedYear = resolveNumberParam(
    typeof searchParams.year === 'string' ? searchParams.year : Array.isArray(searchParams.year) ? searchParams.year[0] : null,
  );
  const resolvedMonth = resolveNumberParam(
    typeof searchParams.month === 'string' ? searchParams.month : Array.isArray(searchParams.month) ? searchParams.month[0] : null,
  );

  const today = new Date();
  const initialYear = resolvedYear ?? today.getFullYear();
  const initialMonth = resolvedMonth ?? today.getMonth() + 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-white p-4 shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">ダッシュボード</h2>
            <p className="text-sm text-gray-500">案件の進捗と稼働状況を一元管理します。</p>
          </div>
          <nav className="flex rounded-full bg-gray-100 p-1" aria-label="ダッシュボード切り替えタブ">
            {TAB_KEYS.map((key) => {
              const isActive = tab === key;
              return (
                <a
                  key={key}
                  href={`?tab=${key}${resolvedYear ? `&year=${resolvedYear}` : ''}${resolvedMonth ? `&month=${resolvedMonth}` : ''}`}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary text-white shadow'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {key === 'projects' ? '案件進捗' : '稼働状況'}
                </a>
              );
            })}
          </nav>
        </div>
      </div>

      {tab === 'projects' ? (
        <ProjectsTable />
      ) : (
        <CalendarMonth initialYear={initialYear} initialMonth={initialMonth} />
      )}
    </div>
  );
}

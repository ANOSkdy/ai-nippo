'use client';

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

type ProjectStatus = '準備中' | '進行中' | '保留' | '完了';

type ProjectListItem = {
  projectId: string;
  name: string;
  siteName: string | null;
  status: ProjectStatus | '';
  startDate: string | null;
  endDate: string | null;
  progressPercent: number | null;
  spreadsheetUrl: string | null;
};

type ProjectsResponse = {
  items: ProjectListItem[];
  total: number;
};

function formatDate(value: string | null): string {
  if (!value) return '未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function ProgressBar({ value }: { value: number }): ReactElement {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-gray-200" aria-hidden>
      <div className="h-2 rounded-full bg-primary" style={{ width: `${clamped}%` }} />
    </div>
  );
}

type ErrorBannerProps = {
  message: string;
  onRetry: () => void;
};

function ErrorBanner({ message, onRetry }: ErrorBannerProps): ReactElement {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-red-700"
        >
          再試行
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton(): ReactElement {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}

export default function ProjectsTable(): ReactElement {
  const [data, setData] = useState<ProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/projects', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`failed with status ${response.status}`);
      }
      const json = (await response.json()) as ProjectsResponse;
      setData(json);
    } catch (err) {
      console.error('Failed to fetch projects', err);
      setError('案件情報の取得に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const projects = useMemo(() => data?.items ?? [], [data]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-md">
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">案件進捗</h3>
          <p className="text-sm text-gray-500">登録済みプロジェクトの状況を確認します。</p>
        </div>
        <p className="text-sm text-gray-400" aria-live="polite">
          合計 {data?.total ?? 0} 件
        </p>
      </header>
      {loading && <LoadingSkeleton />}
      {!loading && error && <ErrorBanner message={error} onRetry={loadProjects} />}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" role="table">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th scope="col" className="px-4 py-3">
                  案件名
                </th>
                <th scope="col" className="px-4 py-3">
                  現場
                </th>
                <th scope="col" className="px-4 py-3">
                  期間
                </th>
                <th scope="col" className="px-4 py-3">
                  進捗
                </th>
                <th scope="col" className="px-4 py-3">
                  状態
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  リンク
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {projects.map((project) => {
                const progress = project.progressPercent ?? 0;
                return (
                  <tr key={project.projectId} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{project.name}</div>
                      <div className="text-xs text-gray-400">ID: {project.projectId}</div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{project.siteName ?? '未割当'}</td>
                    <td className="px-4 py-4 text-gray-700">
                      <div>{formatDate(project.startDate)}</div>
                      <div className="text-xs text-gray-400">〜 {formatDate(project.endDate)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <ProgressBar value={progress} />
                        <span className="w-12 text-right tabular-nums text-gray-700">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{project.status || '不明'}</td>
                    <td className="px-4 py-4 text-right">
                      {project.spreadsheetUrl ? (
                        <a
                          href={project.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow transition hover:bg-primary/90"
                          aria-label={`${project.name}のスプレッドシートを開く`}
                        >
                          開く
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">未登録</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    表示できる案件がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

type DaySessionDetail = {
  username: string;
  sitename: string;
  workdescription: string;
  clockInAt: string;
  clockOutAt: string;
  hours: number;
  projectName?: string;
};

type DayDetailResponse = {
  date: string;
  sessions: DaySessionDetail[];
  spreadsheetUrl: string | null;
};

type DayDrawerProps = {
  date: string | null;
  open: boolean;
  onClose: () => void;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date);
}

function EmptyState(): ReactElement {
  return (
    <p className="text-sm text-gray-500">対象日のセッションは登録されていません。</p>
  );
}

function LoadingState(): ReactElement {
  return <div className="h-24 animate-pulse rounded-xl bg-gray-100" />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): ReactElement {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-red-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-red-700"
      >
        再試行
      </button>
    </div>
  );
}

export default function DayDrawer({ date, open, onClose }: DayDrawerProps): ReactElement | null {
  const [detail, setDetail] = useState<DayDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!date) {
        return;
      }
      try {
        const response = await fetch(`/api/dashboard/day-detail?date=${encodeURIComponent(date)}`, {
          cache: 'no-store',
          signal,
        });
        if (!response.ok) {
          throw new Error(`failed with status ${response.status}`);
        }
        const json = (await response.json()) as DayDetailResponse;
        setDetail(json);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch day detail', err);
        setError('日別明細の取得に失敗しました。');
      }
    },
    [date],
  );

  useEffect(() => {
    if (!open || !date) {
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchDetail(controller.signal).finally(() => {
      setLoading(false);
    });
    return () => {
      controller.abort();
    };
  }, [date, fetchDetail, open]);

  const handleRetry = useCallback(() => {
    if (!date) {
      return;
    }
    setLoading(true);
    setError(null);
    void fetchDetail().finally(() => {
      setLoading(false);
    });
  }, [date, fetchDetail]);

  const heading = useMemo(() => (detail?.date ? formatDate(detail.date) : date ? formatDate(date) : ''), [date, detail]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-4 pt-12" role="dialog" aria-modal>
      <div className="w-full max-w-2xl rounded-t-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">日別明細</p>
            <h4 className="text-lg font-semibold text-gray-900">{heading}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
            aria-label="詳細を閉じる"
          >
            閉じる
          </button>
        </div>
        {loading && <LoadingState />}
        {!loading && error && <ErrorState message={error} onRetry={handleRetry} />}
        {!loading && !error && detail && detail.sessions.length === 0 && <EmptyState />}
        {!loading && !error && detail && detail.sessions.length > 0 && (
          <ul className="space-y-4">
            {detail.sessions.map((session, index) => (
              <li key={`${session.username}-${session.clockInAt}-${index}`} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {session.username}
                    </span>
                    <span className="text-sm text-gray-600">{session.sitename}</span>
                    {session.projectName && (
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{session.projectName}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{session.workdescription}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>
                      IN {formatTime(session.clockInAt)} / OUT {formatTime(session.clockOutAt)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {session.hours.toFixed(2)} h
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && detail?.spreadsheetUrl && (
          <div className="mt-6 text-right">
            <a
              href={detail.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary/90"
            >
              スプレッドシートを開く
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useCallback, useId, useMemo, useState } from 'react';

type Severity = 'info' | 'warning' | 'error';

type ErrorBannerProps = {
  title?: string;
  description?: string | ReactNode;
  onRetry?: () => void;
  details?: string;
  severity?: Severity;
  className?: string;
  dismissible?: boolean;
};

const severityStyles: Record<Severity, string> = {
  info: 'bg-blue-50 text-blue-900 border-blue-200',
  warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
  error: 'bg-red-50 text-red-900 border-red-200',
};

export default function ErrorBanner({
  title,
  description,
  onRetry,
  details,
  severity = 'error',
  className,
  dismissible = true,
}: ErrorBannerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const headingId = useId();
  const descriptionId = useId();
  const detailsId = useId();

  const resolvedTitle = title ??
    (severity === 'info'
      ? 'お知らせ'
      : severity === 'warning'
        ? '注意が必要です'
        : 'エラーが発生しました');

  const resolvedDescription = useMemo(() => {
    if (typeof description === 'string' && description.trim().length === 0) {
      return undefined;
    }
    return description;
  }, [description]);

  const handleDismiss = useCallback(() => {
    if (!dismissible) return;
    setIsOpen(false);
  }, [dismissible]);

  if (!isOpen) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-labelledby={headingId}
      aria-describedby={resolvedDescription ? descriptionId : undefined}
      className={[
        'relative w-full rounded-md border px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-offset-2',
        severityStyles[severity],
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <p id={headingId} className="text-base font-semibold">
            {resolvedTitle}
          </p>
          {resolvedDescription ? (
            <div id={descriptionId} className="mt-1 text-sm leading-relaxed">
              {resolvedDescription}
            </div>
          ) : null}
          {details ? (
            <div className="mt-2 text-xs">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium underline focus:outline-none focus:ring-2 focus:ring-offset-2"
                onClick={() => setShowDetails((prev) => !prev)}
                aria-expanded={showDetails}
                aria-controls={detailsId}
              >
                {showDetails ? '詳細を隠す' : '詳細を表示'}
              </button>
              {showDetails ? (
                <pre
                  id={detailsId}
                  className="mt-2 overflow-auto rounded bg-black/10 p-2 text-[11px] leading-tight"
                >
                  {details}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-white/80 px-3 py-1 text-sm font-medium text-gray-900 shadow focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              再試行
            </button>
          ) : null}
          {dismissible ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-md bg-transparent px-2 py-1 text-sm font-medium underline focus:outline-none focus:ring-2 focus:ring-offset-2"
              aria-label="通知を閉じる"
            >
              閉じる
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

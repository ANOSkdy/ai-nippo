'use client';

import { useEffect } from 'react';
import ErrorBanner from '@/src/components/ui/ErrorBanner';
import { logger } from '@/src/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error({
      code: 'APP-500-GLOBAL',
      message: 'Unhandled global error',
      route: 'global',
      context: { digest: error.digest },
      error,
    });
  }, [error]);

  return (
    <html lang="ja">
      <body className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <ErrorBanner
          title="予期しないエラーが発生しました"
          description="ページの再読み込みをお試しください。改善しない場合は管理者へご連絡ください。"
          details={error.message}
          severity="error"
          onRetry={reset}
        />
      </body>
    </html>
  );
}

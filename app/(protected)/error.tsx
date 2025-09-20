'use client';

import { useEffect } from 'react';
import ErrorBanner from '@/src/components/ui/ErrorBanner';
import { logger } from '@/src/lib/logger';

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error({
      code: 'APP-500-PROTECTED',
      message: 'Protected segment error',
      route: '(protected)',
      context: { digest: error.digest },
      error,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <ErrorBanner
        title="データの読み込みに失敗しました"
        description="通信状況を確認し、再読み込みしてください。"
        details={error.message}
        severity="error"
        onRetry={reset}
      />
    </div>
  );
}

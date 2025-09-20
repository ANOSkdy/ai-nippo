'use client';

import { useEffect } from 'react';
import ErrorBanner from '@/src/components/ui/ErrorBanner';
import { logger } from '@/src/lib/logger';

export default function GlobalSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error({
      code: 'APP-500-SEGMENT',
      message: 'Segment boundary error',
      route: '(root)',
      context: { digest: error.digest },
      error,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <ErrorBanner
        title="画面の表示に失敗しました"
        description="ページの読み込み中にエラーが発生しました。再読み込みで解消する場合があります。"
        details={error.message}
        severity="error"
        onRetry={reset}
      />
    </div>
  );
}

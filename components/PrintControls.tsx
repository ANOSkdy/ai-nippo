'use client';

import { useCallback } from 'react';

type PrintControlsProps = {
  className?: string;
  title?: string;
  printPath?: string;
  getSearchParams?: () => string | URLSearchParams;
};

export default function PrintControls({
  className = '',
  title = '現場別集計',
  printPath,
  getSearchParams,
}: PrintControlsProps) {
  const handlePrint = useCallback(() => {
    if (printPath) {
      const resolved = getSearchParams?.();
      const searchValue =
        typeof resolved === 'string'
          ? resolved
          : resolved instanceof URLSearchParams
            ? resolved.toString()
            : window.location.search;
      const normalizedSearch = searchValue
        ? searchValue.startsWith('?')
          ? searchValue
          : `?${searchValue}`
        : '';
      const url = `${printPath}${normalizedSearch}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const previousTitle = document.title;
    document.title = title;
    window.print();
    document.title = previousTitle;
  }, [getSearchParams, printPath, title]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handlePrint}
        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
      >
        印刷（A4縦）
      </button>
    </div>
  );
}

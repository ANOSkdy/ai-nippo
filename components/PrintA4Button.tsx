'use client';
import React from 'react';

/**
 * A4縦での印刷を想定した汎用ボタン。
 * - 依存なし（どのページにも差し込み可）
 * - onClickで window.print() を呼ぶのみ
 */
type PrintA4ButtonProps = {
  label?: string;
  className?: string;
  printPath?: string;
  getSearchParams?: () => string | URLSearchParams;
};

export default function PrintA4Button({
  label = 'PDF印刷',
  className = '',
  printPath,
  getSearchParams,
}: PrintA4ButtonProps) {
  const handleClick = () => {
    if (printPath) {
      const resolved = getSearchParams?.();
      const searchValue =
        typeof resolved === 'string'
          ? resolved
          : resolved instanceof URLSearchParams
            ? resolved.toString()
            : typeof window !== 'undefined'
              ? window.location.search
              : '';
      const normalizedSearch = searchValue
        ? searchValue.startsWith('?')
          ? searchValue
          : `?${searchValue}`
        : '';
      const url = `${printPath}${normalizedSearch}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    window.print();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="A4縦でPDF印刷"
      className={className || 'rounded-md border px-3 py-1 text-sm hover:bg-gray-50 active:opacity-90'}
    >
      {label}
    </button>
  );
}

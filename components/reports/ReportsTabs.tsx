'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const REPORT_TABS = [
  { href: '/reports', label: '個別集計' },
  { href: '/reports/sites', label: '現場別集計' },
] as const;

const RECORD_ADJUST_URL = 'https://forms.gle/hKbhCwxUFDFpHGNUA';

export default function ReportsTabs() {
  const pathname = usePathname();
  const isReportsPage = pathname === '/reports';

  return (
    <div className="space-y-3">
      <nav className="flex gap-3 border-b border-gray-200 pb-2" aria-label="レポート切替タブ">
        {REPORT_TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                isActive
                  ? 'border-b-2 border-indigo-500 pb-1 text-sm font-semibold text-indigo-600'
                  : 'pb-1 text-sm text-gray-500 transition hover:text-gray-900'
              }
              prefetch
            >
              {tab.label}
            </Link>
          );
        })}

      </nav>

      {isReportsPage ? (
        <div className="rounded-md border border-dashed border-gray-200 p-4 text-sm text-gray-700">
          <p className="text-gray-600">
            レコードの修正依頼は以下のリンクからフォームにて送信してください。
          </p>
          <a
            href={RECORD_ADJUST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center justify-center rounded-md border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
            aria-label="レコード調整フォームを新しいタブで開く"
          >
            フォームを開く
          </a>
          <p className="mt-2 text-xs text-gray-500">※ 新しいタブが開きます。必要事項を入力のうえ送信してください。</p>
        </div>
      ) : null}
    </div>
  );
}

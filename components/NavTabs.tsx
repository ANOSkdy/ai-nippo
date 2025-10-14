"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/calendar/month', label: 'カレンダー' },
  { href: '/reports/work', label: '稼働集計' },
  { href: '/nfc?machineId=1001', label: '打刻ページ' },
] as const;

export default function NavTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname?.startsWith(href.split('?')[0]);

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-4">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-2 py-1 text-sm font-medium transition-colors border-b-2 ${
              isActive(tab.href)
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

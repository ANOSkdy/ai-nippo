'use client';

import Link from 'next/link';

export default function NfcLinkButton() {
  const targetUrl = 'https://ai-nippo.vercel.app/nfc?machineid=1003';

  return (
    <Link
      href={targetUrl}
      aria-label="打刻ページ"
      className="tap-target inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-primaryText shadow-sm transition hover:bg-brand-primary/90"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 8a7 7 0 0 1 14 0v8a7 7 0 0 1-14 0Z" />
        <path d="M12 6v12" />
      </svg>
      打刻ページへ
    </Link>
  );
}

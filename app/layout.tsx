import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // グローバルCSSのインポート

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI日報「スマレポ」',
  description: 'NFCで簡単打刻',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
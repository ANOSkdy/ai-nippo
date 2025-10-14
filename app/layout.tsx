import type { Metadata } from 'next';
import './globals.css';
import NextAuthSessionProvider from '@/components/SessionProvider';
import NavTabs from '@/components/NavTabs';

export const metadata: Metadata = {
  title: 'AI日報「スマレポ」',
  description: 'NFCを使ったAI日報システム',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-base min-h-screen text-gray-900">
        <NextAuthSessionProvider>
          <div className="flex min-h-screen flex-col">
            <header className="w-full bg-white shadow-md">
              <div className="mx-auto max-w-6xl px-4 py-3">
                <h1 className="text-xl font-bold text-gray-800">スマレポ</h1>
              </div>
            </header>
            <NavTabs />
            <main className="flex-1 w-full">
              {children}
            </main>
          </div>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}

import type { ReactNode } from 'react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-12 pt-6">
        {children}
      </div>
    </div>
  );
}

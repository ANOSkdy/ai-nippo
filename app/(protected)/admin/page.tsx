'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export const runtime = 'nodejs';

export default function AdminDebug() {
  const { data: session, status } = useSession();
  const [health, setHealth] = useState<'unknown' | 'ok' | 'ng'>('unknown');
  const [msg, setMsg] = useState('');

  const enabled = process.env.NEXT_PUBLIC_FEATURE_ADMIN_UI === '1';
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'guest';
  const isAdmin = role === 'admin';

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/health', { cache: 'no-store' });
        setHealth(r.ok ? 'ok' : 'ng');
        if (!r.ok) setMsg(`health NG: ${r.status}`);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setHealth('ng');
        setMsg(`health error: ${message}`);
      }
    })();
  }, []);

  return (
    <div className="p-5 space-y-4">
      <h1 className="text-2xl font-semibold">管理UI（診断モード）</h1>
      <div className="rounded-lg border p-3 space-y-1 bg-yellow-50">
        <div className="text-sm">
          <b>FEATURE_ADMIN_UI:</b> {String(process.env.NEXT_PUBLIC_FEATURE_ADMIN_UI)}
        </div>
        <div className="text-sm">
          <b>session status:</b> {status} / <b>role:</b> {String(role)}
        </div>
        <div className="text-sm">
          <b>health:</b> {health} {msg && <span>- {msg}</span>}
        </div>
        {!enabled && (
          <div className="text-red-600 text-sm">
            /admin は無効化中（NEXT_PUBLIC_FEATURE_ADMIN_UI=1 が必要）
          </div>
        )}
        {enabled && !isAdmin && (
          <div className="text-red-600 text-sm">
            権限不足（admin ロールが必要）
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white"
          onClick={async () => {
            try {
              const r = await fetch('/api/admin/search?pageSize=1', { cache: 'no-store' });
              alert(`/api/admin/search => ${r.status}`);
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              alert(`fetch error: ${message}`);
            }
          }}
        >
          /api/admin/search を叩いてみる
        </button>
        <button
          className="px-4 py-2 rounded bg-gray-700 text-white"
          onClick={async () => {
            try {
              const r = await fetch('/api/admin/reflect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: [] }),
              });
              alert(`/api/admin/reflect => ${r.status}`);
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              alert(`fetch error: ${message}`);
            }
          }}
        >
          /api/admin/reflect を叩いてみる（空）
        </button>
      </div>
      <p className="text-sm text-gray-500">
        ※ ここは診断用ページです。health=ok & admin ロール & 機能フラグが立っていれば、
        実装済みの検索UIに差し替えれば表示/200返却が確認できます。
      </p>
    </div>
  );
}

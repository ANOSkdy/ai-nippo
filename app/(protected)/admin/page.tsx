'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { isAdminUIEnabled } from '@/lib/featureFlags';

export const runtime = 'nodejs';

const enabled = isAdminUIEnabled();

type SearchParams = {
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  siteName?: string;
  type?: 'IN' | 'OUT' | '';
  pageSize?: number;
};

type Row = {
  id: string;
  date?: string;
  timestamp?: string;
  user?: string[];
  machine?: string[];
  siteName?: string;
  work?: number;
  workDescription?: string;
  type?: 'IN' | 'OUT';
};

export default function AdminPage() {
  const { data: session } = useSession();
  const [q, setQ] = useState<SearchParams>({ pageSize: 25 });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<{ workDescription?: string; type?: 'IN' | 'OUT' }>({});

  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === 'admin';

  const search = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
    });
    const r = await fetch(`/api/admin/search?${params.toString()}`);
    setLoading(false);
    if (!r.ok) {
      setRows([]);
      setError('検索に失敗しました');
      return;
    }
    const data = await r.json();
    setRows(data.items ?? []);
    setSelected({});
  };

  const reflect = async () => {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (ids.length === 0) return alert('行を選択してください');
    if (!edit.workDescription && !edit.type)
      return alert('更新内容を入力してください');
    if (!confirm(`${ids.length} 件を更新します。よろしいですか？`)) return;
    const r = await fetch('/api/admin/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: ids.map((id) => ({ id, fields: { ...edit } })),
      }),
    });
    if (!r.ok) return alert('更新に失敗しました');
    await search();
  };

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled) return null;
  if (!isAdmin)
    return <div className="p-6" role="alert">権限がありません。</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">管理UI（検索 & 反映）</h1>
      <p className="text-sm text-gray-500">
        初期表示は直近7日分の最新ログを表示します。必要に応じて検索条件を絞り込んでください。
      </p>
      <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <label className="sr-only" htmlFor="userId">userId</label>
        <input
          id="userId"
          className="border p-2 rounded"
          placeholder="userId"
          value={q.userId ?? ''}
          onChange={(e) => setQ((s) => ({ ...s, userId: e.target.value }))}
        />
        <label className="sr-only" htmlFor="dateFrom">dateFrom</label>
        <input
          id="dateFrom"
          className="border p-2 rounded"
          placeholder="dateFrom (YYYY-MM-DD)"
          value={q.dateFrom ?? ''}
          onChange={(e) => setQ((s) => ({ ...s, dateFrom: e.target.value }))}
        />
        <label className="sr-only" htmlFor="dateTo">dateTo</label>
        <input
          id="dateTo"
          className="border p-2 rounded"
          placeholder="dateTo (YYYY-MM-DD)"
          value={q.dateTo ?? ''}
          onChange={(e) => setQ((s) => ({ ...s, dateTo: e.target.value }))}
        />
        <label className="sr-only" htmlFor="siteName">siteName</label>
        <input
          id="siteName"
          className="border p-2 rounded"
          placeholder="siteName"
          value={q.siteName ?? ''}
          onChange={(e) => setQ((s) => ({ ...s, siteName: e.target.value }))}
        />
        <label className="sr-only" htmlFor="type">type</label>
        <select
          id="type"
          className="border p-2 rounded"
          value={q.type ?? ''}
          onChange={(e) =>
            setQ((s) => ({ ...s, type: e.target.value as 'IN' | 'OUT' | '' }))
          }
        >
          <option value="">type (任意)</option>
          <option value="IN">IN</option>
          <option value="OUT">OUT</option>
        </select>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={search}
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          検索
        </button>
        <button
          onClick={() => {
            setQ({ pageSize: 25 });
            void search();
          }}
          className="px-3 py-2 rounded border"
        >
          条件リセット
        </button>
        <span className="text-sm text-gray-500">{loading ? '検索中…' : ''}</span>
      </div>
      {error && (
        <div className="text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      <section className="overflow-x-auto">
        <table className="min-w-full text-sm border" role="table">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border">
                <input
                  type="checkbox"
                  aria-label="select all"
                  onChange={(e) => {
                    const all: Record<string, boolean> = {};
                    rows.forEach((r) => {
                      all[r.id] = e.target.checked;
                    });
                    setSelected(all);
                  }}
                />
              </th>
              <th className="p-2 border">id</th>
              <th className="p-2 border">date</th>
              <th className="p-2 border">user</th>
              <th className="p-2 border">siteName</th>
              <th className="p-2 border">type</th>
              <th className="p-2 border">workDescription</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border text-center">
                  <input
                    type="checkbox"
                    aria-label={`select ${r.id}`}
                    checked={!!selected[r.id]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [r.id]: e.target.checked }))
                    }
                  />
                </td>
                <td className="p-2 border">{r.id}</td>
                <td className="p-2 border">{r.date}</td>
                <td className="p-2 border">{(r.user ?? []).join(', ')}</td>
                <td className="p-2 border">{r.siteName}</td>
                <td className="p-2 border">{r.type}</td>
                <td className="p-2 border">{r.workDescription}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && !error && (
              <tr>
                <td className="p-6 text-gray-500" colSpan={7}>
                  該当データが見つかりませんでした。日付範囲やtypeを外して再検索してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="sr-only" htmlFor="editWorkDescription">
          workDescription
        </label>
        <input
          id="editWorkDescription"
          className="border p-2 rounded"
          placeholder="workDescription を一括更新"
          value={edit.workDescription ?? ''}
          onChange={(e) =>
            setEdit((s) => ({ ...s, workDescription: e.target.value || undefined }))
          }
        />
        <label className="sr-only" htmlFor="editType">type</label>
        <select
          id="editType"
          className="border p-2 rounded"
          value={edit.type ?? ''}
          onChange={(e) =>
            setEdit((s) => ({ ...s, type: (e.target.value || undefined) as 'IN' | 'OUT' | undefined }))
          }
        >
          <option value="">type を一括更新（任意）</option>
          <option value="IN">IN</option>
          <option value="OUT">OUT</option>
        </select>
        <button
          onClick={reflect}
          className="px-4 py-2 rounded bg-green-600 text-white"
        >
          選択行を反映
        </button>
      </section>
    </div>
  );
}

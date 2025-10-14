"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

type CalendarDaySummary = {
  date: string;
  sites: string[];
  punches: number;
  sessions: number;
  hours: number;
};

type MonthSummary = {
  year: number;
  month: number;
  days: CalendarDaySummary[];
};

const formatCurrency = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function WorkReportPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ year: String(year), month: String(month) });
        const response = await fetch(`/api/calendar/month?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('集計データの取得に失敗しました');
        }
        const json = (await response.json()) as MonthSummary;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        console.error('[reports/work] failed to fetch', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const summary = useMemo(() => {
    if (!data) {
      return { hours: 0, punches: 0, sessions: 0 };
    }
    return data.days.reduce(
      (acc, day) => ({
        hours: acc.hours + (Number.isFinite(day.hours) ? day.hours : 0),
        punches: acc.punches + (Number.isFinite(day.punches) ? day.punches : 0),
        sessions: acc.sessions + (Number.isFinite(day.sessions) ? day.sessions : 0),
      }),
      { hours: 0, punches: 0, sessions: 0 },
    );
  }, [data]);

  async function handlePdfDownload() {
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const node = tableRef.current;
      if (!node) {
        throw new Error('PDF化する要素が見つかりません');
      }
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;
      const imgHeight = (canvas.height * availableWidth) / canvas.width;

      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, availableWidth, imgHeight, undefined, 'FAST');
      } else {
        let currentY = 0;
        const sliceHeight = Math.floor((availableHeight * canvas.width) / availableWidth);
        while (currentY < canvas.height) {
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.min(sliceHeight, canvas.height - currentY);
          const ctx = sliceCanvas.getContext('2d');
          if (!ctx) {
            break;
          }
          ctx.drawImage(
            canvas,
            0,
            currentY,
            canvas.width,
            sliceCanvas.height,
            0,
            0,
            sliceCanvas.width,
            sliceCanvas.height,
          );
          const partData = sliceCanvas.toDataURL('image/png');
          if (currentY > 0) {
            pdf.addPage();
          }
          const renderedHeight = (sliceCanvas.height * availableWidth) / sliceCanvas.width;
          pdf.addImage(partData, 'PNG', margin, margin, availableWidth, renderedHeight, undefined, 'FAST');
          currentY += sliceHeight;
        }
      }

      pdf.save(`work_${year}-${String(month).padStart(2, '0')}.pdf`);
    } catch (err) {
      console.error('[reports/work] failed to export pdf', err);
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      alert(`PDF出力に失敗しました\n${message}`);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">月次稼働集計</h1>
          <p className="text-sm text-gray-500">Airtable のログをもとに現場別の稼働状況を確認できます。</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="year" className="text-sm font-medium text-gray-700">
              年
            </label>
            <input
              id="year"
              type="number"
              min={2020}
              max={2100}
              value={year}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (!Number.isNaN(value)) {
                  setYear(value);
                }
              }}
              className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="month" className="text-sm font-medium text-gray-700">
              月
            </label>
            <input
              id="month"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (!Number.isNaN(value)) {
                  const normalized = Math.min(12, Math.max(1, value));
                  setMonth(normalized);
                }
              }}
              className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <button
            type="button"
            onClick={handlePdfDownload}
            className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            PDFダウンロード
          </button>
        </div>
      </header>

      {isLoading && <p className="text-sm text-gray-500">読み込み中です...</p>}
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl bg-white p-4 shadow" ref={tableRef}>
        {data ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                {data.year}年 {data.month}月の稼働サマリ
              </h2>
              <dl className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                  <dt className="font-medium text-gray-500">総稼働時間</dt>
                  <dd className="text-base font-semibold text-gray-900">{formatCurrency.format(summary.hours)} h</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">総打刻数</dt>
                  <dd className="text-base font-semibold text-gray-900">{summary.punches}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">セッション数</dt>
                  <dd className="text-base font-semibold text-gray-900">{summary.sessions}</dd>
                </div>
              </dl>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">日付</th>
                    <th className="px-3 py-2">現場</th>
                    <th className="px-3 py-2">打刻数</th>
                    <th className="px-3 py-2">セッション</th>
                    <th className="px-3 py-2">稼働時間(h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                  {data.days.map((day) => (
                    <tr key={day.date}>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">{day.date}</td>
                      <td className="px-3 py-2">
                        {day.sites.length > 0 ? (
                          <ul className="list-inside list-disc space-y-1 text-xs text-gray-600">
                            {day.sites.map((site) => (
                              <li key={site}>{site}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-gray-400">(現場登録なし)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{day.punches}</td>
                      <td className="px-3 py-2 text-right">{day.sessions}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency.format(day.hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">データがまだありません。</p>
        )}
      </section>
    </div>
  );
}

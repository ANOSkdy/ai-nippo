'use client';

import React from 'react';
import { getJstParts } from '@/lib/jstDate';
import { pivotByUserAndMachine, type PivotResult, type SessionLike } from '../_lib/gridUtils';

type Props = {
  sessions: SessionLike[];
};

const fmt = (v: number | undefined) =>
  v !== undefined ? `${v.toFixed(1)}h` : '';

export default function MachinePivotGrid({ sessions }: Props) {
  const pivot: PivotResult = pivotByUserAndMachine(sessions, {
    youbiOf: (date) => getJstParts(date).weekdayJp,
  });

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left">日付</th>
            <th className="px-3 py-2 text-left">曜日</th>
            {pivot.columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left">
                {c.header}
              </th>
            ))}
            <th className="px-3 py-2 text-left">行合計</th>
          </tr>
        </thead>
        <tbody>
          {pivot.rows.map((r) => (
            <tr key={r.date} className="border-t">
              <td className="sticky left-0 z-10 bg-white px-3 py-2">{r.date}</td>
              <td className="px-3 py-2">{r.youbi}</td>
              {pivot.columns.map((c) => (
                <td key={c.key} className="px-3 py-2">
                  {fmt(r.cells[c.key])}
                </td>
              ))}
              <td className="px-3 py-2 font-medium">{fmt(r.rowTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-gray-50">
            <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-medium">総計</td>
            <td className="px-3 py-2 font-semibold">総計: {fmt(pivot.grandTotal)}</td>
            {pivot.columns.map((c) => (
              <td key={c.key} className="px-3 py-2" />
            ))}
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

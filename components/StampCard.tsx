'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { WorkTypeFields } from '@/types';
import { Record } from 'airtable';
import LogoutButton from './LogoutButton'; // LogoutButtonをインポート

type StampCardProps = {
  initialStampType: 'IN' | 'OUT';
  initialWorkDescription: string;
  userName: string;
  machineName: string; 
};

// 完了・エラー・待機時の汎用表示コンポーネント
const CardState = ({ title, message }: { title?: string; message: string }) => (
  <div className="flex min-h-[calc(100svh-56px)] w-full items-center justify-center p-4">
    <div className="card">
      {title && <h2 className="text-xl font-bold">{title}</h2>}
      <p className="mt-4 text-gray-700">{message}</p>
    </div>
  </div>
);

export default function StampCard({
  initialStampType,
  initialWorkDescription,
  userName,
  machineName,
}: StampCardProps) {
  const [stampType, setStampType] = useState<'IN' | 'OUT' | 'COMPLETED'>(initialStampType);
  const [workTypes, setWorkTypes] = useState<Record<WorkTypeFields>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastWorkDescription, setLastWorkDescription] = useState(initialWorkDescription);
  const [selectedWork, setSelectedWork] = useState('');

  const searchParams = useSearchParams();
  const machineId = searchParams.get('machineid');

  useEffect(() => {
    if (stampType === 'IN') {
      fetch('/api/masters/work-types')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch work types');
          return res.json();
        })
        .then((data) => setWorkTypes(data))
        .catch(() => setError('作業内容マスタの取得に失敗しました。'));
    }
  }, [stampType]);

  const handleStamp = async (type: 'IN' | 'OUT', workDescription: string) => {
    setIsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const response = await fetch('/api/stamp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ machineId, workDescription, lat: latitude, lon: longitude, accuracy, type }),
          });
          if (!response.ok) {
            const res = await response.json();
            throw new Error(res.message || `サーバーエラー: ${response.statusText}`);
          }
          if (type === 'IN') {
            setStampType('OUT');
            setLastWorkDescription(workDescription);
          } else {
            setStampType('COMPLETED');
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : '通信に失敗しました。';
          setError(message);
        } finally {
          setIsLoading(false);
        }
      },
      (geoError) => {
        setError(`位置情報の取得に失敗しました: ${geoError.message}`);
        setIsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCheckIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedWork) handleStamp('IN', selectedWork);
  };
  
  const handleCheckOut = () => {
    if (!lastWorkDescription) {
      alert('前回の作業内容が見つかりません。');
      return;
    }
    handleStamp('OUT', lastWorkDescription);
  };

  if (isLoading) return <CardState title="処理中..." message="サーバーと通信しています。" />;
  if (error) return <CardState title="エラーが発生しました" message={error} />;
  if (!machineId) return <CardState title="無効なアクセス" message="NFCタグから機械IDを読み取れませんでした。" />;
  if (stampType === 'COMPLETED')
    return (
      <div className="flex min-h-[calc(100svh-56px)] w-full items-center justify-center p-4">
        <p className="whitespace-nowrap break-keep text-center text-black leading-normal max-w-[90vw] mx-auto text-base sm:text-lg">
          本日の業務お疲れ様でした。
        </p>
      </div>
    );

  return (
    <div className="flex min-h-[calc(100svh-56px)] w-full flex-col items-center gap-6 p-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="card w-[90vw] max-w-[560px] mx-auto">
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold text-gray-800">{userName} さん</p>
          <p className="text-gray-600">
            <span className="font-semibold">機械:</span> {machineName}
          </p>
        </div>
      </div>
      {stampType === 'IN' ? (
        <>
          <form id="check-in-form" onSubmit={handleCheckIn} className="w-full">
            <div className="card w-[90vw] max-w-[560px] mx-auto text-left">
              <label htmlFor="workDescription" className="mb-2 block text-sm font-medium text-black">
                本日の作業内容を選択
              </label>
              <div className="relative w-full">
                <select
                  id="workDescription"
                  name="workDescription"
                  required
                  value={selectedWork}
                  onChange={(e) => setSelectedWork(e.target.value)}
                  className="w-full bg-white text-black rounded-xl px-4 py-3 pr-10 text-base leading-tight ring-1 ring-zinc-300 focus:ring-2 focus:ring-primary outline-none appearance-none"
                >
                  <option value="" disabled className="whitespace-nowrap">
                    選択してください
                  </option>
                  {workTypes.map((wt) => (
                    <option key={wt.id} value={wt.fields.name} className="whitespace-nowrap">
                      {wt.fields.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">▾</span>
              </div>
            </div>
          </form>
          <div className="w-[90vw] max-w-[560px] mx-auto px-4">
            <button
              onClick={() => (document.getElementById('check-in-form') as HTMLFormElement)?.requestSubmit()}
              disabled={!selectedWork || isLoading}
              className="work-btn w-full min-h-12 text-lg disabled:bg-gray-400"
            >
              出 勤
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="card w-[90vw] max-w-[560px] mx-auto text-center">
            <p className="text-black">
              <span className="font-semibold">現在の作業:</span>{' '}
              <span className="whitespace-nowrap">{lastWorkDescription || 'N/A'}</span>
            </p>
          </div>
          <div className="w-[90vw] max-w-[560px] mx-auto px-4">
            <button
              onClick={handleCheckOut}
              disabled={isLoading}
              type="button"
              className="work-btn w-full min-h-12 text-lg disabled:bg-gray-400"
            >
              退 勤
            </button>
          </div>
        </>
      )}
      <div className="w-[90vw] max-w-[560px] mx-auto">
        <LogoutButton />
      </div>
    </div>
  );
}

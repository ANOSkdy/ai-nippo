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
const CardState = ({ title, message }: { title: string; message: string }) => (
    <div className="flex min-h-[calc(100vh-61px)] w-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
            <h2 className="text-xl font-bold">{title}</h2>
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
  if (stampType === 'COMPLETED') return <CardState title="記録しました" message="本日の業務お疲れ様でした。" />;

  // メインのUI部分
  const mainContent = (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-md">
        <div className="space-y-2">
          <div>
            <span className="text-xs text-gray-500">ユーザー</span>
            <div className="font-medium text-gray-900">{userName}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">機械</span>
            <div className="font-medium text-gray-900">{machineName}</div>
          </div>
          {stampType === 'OUT' && (
            <div>
              <span className="text-xs text-gray-500">現在の作業</span>
              <div className="font-medium text-gray-900">{lastWorkDescription || 'N/A'}</div>
            </div>
          )}
        </div>
      </div>
      {stampType === 'IN' && (
        <form id="check-in-form" onSubmit={handleCheckIn} className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-md">
            <label
              htmlFor="workDescription"
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              本日の作業内容を選択
            </label>
            <select
              id="workDescription"
              name="workDescription"
              required
              value={selectedWork}
              onChange={(e) => setSelectedWork(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="" disabled>
                選択してください
              </option>
              {workTypes.map((wt) => (
                <option key={wt.id} value={wt.fields.name}>
                  {wt.fields.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div className="relative flex min-h-[calc(100vh-61px)] w-full flex-col p-4 pb-32">
        <div className="w-full max-w-md mx-auto">
            {mainContent}
            <div className="mt-6">
                <LogoutButton />
            </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/80 p-4 backdrop-blur-sm">
            {stampType === 'IN' ? (
                <button
                    onClick={() => (document.getElementById('check-in-form') as HTMLFormElement)?.requestSubmit()}
                    disabled={!selectedWork || isLoading}
                    className="w-full rounded-xl bg-primary px-4 py-4 text-lg font-semibold text-white shadow-md hover:bg-primary/90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:bg-primary/50"
                >
                    出 勤
                </button>
            ) : (
                <button
                    onClick={handleCheckOut}
                    disabled={isLoading}
                    type="button"
                    className="w-full rounded-xl bg-primary px-4 py-4 text-lg font-semibold text-white shadow-md hover:bg-primary/90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:bg-primary/50"
                >
                    退 勤
                </button>
            )}
        </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SiteFields, WorkTypeFields } from '@/types';
import { Record } from 'airtable';
import LogoutButton from './LogoutButton'; // LogoutButtonをインポート
import { findNearestSite, distanceMeters } from '@/lib/geo';

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
  const [sites, setSites] = useState<Record<SiteFields>[]>([]);
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

  useEffect(() => {
    fetch('/api/masters/sites')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch sites');
        return res.json();
      })
      .then((data) => setSites(data))
      .catch(() => setError('拠点マスタの取得に失敗しました。'));
  }, []);

  type Pos = { lat: number; lng: number; accuracy: number; ts: number };
  const GEO_TIMEOUT_MS = 15000;

  const getFreshPosition = () =>
    new Promise<Pos>((resolve, reject) => {
      const opts: PositionOptions = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: GEO_TIMEOUT_MS,
      };
      let best: Pos | null = null;
      const started = Date.now();
      const id = navigator.geolocation.watchPosition(
        (p) => {
          const cur: Pos = {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy ?? 9999,
            ts: p.timestamp,
          };
          if (
            !best ||
            cur.accuracy < best.accuracy ||
            (cur.accuracy === best.accuracy && cur.ts > best.ts)
          )
            best = cur;
          const good = cur.accuracy <= 50;
          const expired = Date.now() - started > GEO_TIMEOUT_MS;
          if (good || expired) {
            navigator.geolocation.clearWatch(id);
            resolve(best ?? cur);
          }
        },
        (err) => {
          navigator.geolocation.clearWatch(id);
          reject(err);
        },
        opts,
      );
      setTimeout(() => {
        try {
          navigator.geolocation.clearWatch(id);
        } catch {}
        if (best) resolve(best);
        else reject(new Error('Geolocation timeout'));
      }, GEO_TIMEOUT_MS + 1000);
    });

  const handleStamp = async (type: 'IN' | 'OUT', workDescription: string) => {
    setIsLoading(true);
    setError('');
    const tryAutoStampOnce = async (label: 'first' | 'retry') => {
      const pos = await getFreshPosition();
      const nearestSite = findNearestSite(pos.lat, pos.lng, sites);
      const distanceToSite = nearestSite
        ? distanceMeters(
            pos.lat,
            pos.lng,
            nearestSite.fields.lat,
            nearestSite.fields.lon,
          )
        : Number.POSITIVE_INFINITY;
      const decisionThreshold = Math.max(150, (pos.accuracy || 0) * 2);
      if (nearestSite && distanceToSite <= decisionThreshold) {
        const response = await fetch('/api/stamp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machineId,
            workDescription,
            lat: pos.lat,
            lon: pos.lng,
            accuracy: pos.accuracy,
            type,
            positionTimestamp: pos.ts,
            distanceToSite,
            decisionThreshold,
            clientDecision: 'auto',
            siteId: nearestSite.fields.siteId,
          }),
        });
        if (!response.ok) {
          let msg = `サーバーエラー: ${response.statusText}`;
          try {
            const res = await response.json();
            msg = res.reason || res.error || res.message || msg;
          } catch {}
          throw new Error(msg);
        }
        setError('');
        if (type === 'IN') {
          setStampType('OUT');
          setLastWorkDescription(workDescription);
        } else {
          setStampType('COMPLETED');
        }
        return true;
      }
      if (label === 'first') {
        setError('最新の位置情報を取得しています…');
      }
      return false;
    };

    try {
      const ok = await tryAutoStampOnce('first');
      if (ok) {
        setIsLoading(false);
        return;
      }
      const ok2 = await tryAutoStampOnce('retry');
      if (ok2) {
        setIsLoading(false);
        return;
      }
      const confirmOverride = window.confirm(
        '現在地が登録拠点から離れています。申告送信しますか？（後レビュー対象）',
      );
      if (!confirmOverride) {
        setIsLoading(false);
        return;
      }
      const reason =
        window.prompt(
          '申告理由を入力してください（例: 現地近辺/屋内でGPS誤差）',
        ) ?? '';
      let pos: Pos | null = null;
      try {
        pos = await getFreshPosition();
      } catch {}
      const lat = pos?.lat ?? 0;
      const lon = pos?.lng ?? 0;
      const accuracy = pos?.accuracy ?? 9999;
      const ts = pos?.ts ?? Date.now();
      const nearestSite = findNearestSite(lat, lon, sites);
      const distanceToSite = nearestSite
        ? distanceMeters(
            lat,
            lon,
            nearestSite.fields.lat,
            nearestSite.fields.lon,
          )
        : Number.POSITIVE_INFINITY;
      const decisionThreshold = Math.max(150, (accuracy || 0) * 2);
      const response = await fetch('/api/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId,
          workDescription,
          lat,
          lon,
          accuracy,
          type,
          positionTimestamp: ts,
          distanceToSite,
          decisionThreshold,
          clientDecision: 'override',
          siteId: nearestSite?.fields.siteId,
          overrideReason: reason,
        }),
      });
      if (!response.ok) {
        let msg = `サーバーエラー: ${response.statusText}`;
        try {
          const res = await response.json();
          msg = res.reason || res.error || res.message || msg;
        } catch {}
        throw new Error(msg);
      }
      setError('');
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

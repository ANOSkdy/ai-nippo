import { auth } from '@/lib/auth';
import StampCard from '@/components/StampCard';
import { getTodayLogs, getMachineById } from '@/lib/airtable';
import { redirect } from 'next/navigation';
import ErrorBanner from '@/src/components/ui/ErrorBanner';
import { AppError } from '@/src/lib/errors';

export const dynamic = 'force-dynamic';

type NFCPageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function NFCPage({ searchParams }: NFCPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const machineId = searchParams.machineid;
  if (typeof machineId !== 'string') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <ErrorBanner
          title="無効な機械IDです"
          description="NFCタグから正しいIDが取得できませんでした。タグの再読み取りを行ってください。"
          severity="warning"
          dismissible={false}
        />
      </main>
    );
  }

  try {
    const machine = await getMachineById(machineId);
    if (!machine) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
          <ErrorBanner
            title="登録されていない機械IDです"
            description="現場担当者へ機械登録状況を確認してください。"
            severity="warning"
            dismissible={false}
          />
        </main>
      );
    }

    const logs = await getTodayLogs(session.user.id);
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

    const initialStampType = lastLog?.fields.type === 'IN' ? 'OUT' : 'IN';
    const initialWorkDescription = lastLog?.fields.workDescription ?? '';

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <StampCard
          initialStampType={initialStampType}
          initialWorkDescription={initialWorkDescription}
          userName={session.user.name ?? 'ゲスト'}
          machineName={machine.fields?.name ?? machineId}
        />
      </main>
    );
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : new AppError({
          code: 'APP-500-INTERNAL',
          message: '初期データの取得に失敗しました',
          hint: '時間をおいてから再試行してください',
          status: 500,
          severity: 'error',
          cause: error,
        });

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <ErrorBanner
          title={appError.message}
          description={appError.hint}
          details={error instanceof Error ? error.stack ?? error.message : undefined}
          severity={appError.severity}
          dismissible={false}
        />
      </main>
    );
  }
}

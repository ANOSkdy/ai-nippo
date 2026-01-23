'use client';

import ReportsTabs from '@/components/reports/ReportsTabs';
import AttendanceMonthlyTab from '@/components/report/work/attendance/AttendanceMonthlyTab';

export default function AttendanceReportPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <ReportsTabs />
      <AttendanceMonthlyTab />
    </main>
  );
}

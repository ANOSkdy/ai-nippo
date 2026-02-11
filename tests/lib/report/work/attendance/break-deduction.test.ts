import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDailyAttendance } from '@/lib/report/work/attendance/computeDailyAttendance';

const baseSession = {
  id: 's1',
  date: '2026-02-11',
  start: '2026-02-11T09:00:00+09:00',
  end: '2026-02-11T18:00:00+09:00',
  startMs: Date.parse('2026-02-11T09:00:00+09:00'),
  endMs: Date.parse('2026-02-11T18:00:00+09:00'),
  durationMin: 540,
  siteName: 'A現場',
  workDescription: '作業',
  userId: 1,
  userRecordId: 'rec1',
  userName: '対象ユーザー',
  machineId: null,
  machineName: null,
  status: 'closed',
} as const;

test('computeDailyAttendance skips standard break deduction only when requested', () => {
  const normal = computeDailyAttendance([baseSession], { skipStandardBreakDeduction: false });
  const exempt = computeDailyAttendance([baseSession], { skipStandardBreakDeduction: true });

  assert.equal(normal.breakPolicyApplied, true);
  assert.equal(exempt.breakPolicyApplied, false);

  assert.equal(normal.deductBreakMinutes > 0, true);
  assert.equal(exempt.deductBreakMinutes, 0);
  assert.equal(exempt.roundedMinutes >= normal.roundedMinutes, true);
});

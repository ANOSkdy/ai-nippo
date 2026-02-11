import assert from 'node:assert/strict';
import test from 'node:test';
import { groupReportRowsByDate } from '@/lib/report-groupers';

test('groupReportRowsByDate does not apply 1.5h break when breakPolicyApplied is false', () => {
  const startMs = Date.parse('2026-02-12T09:00:00+09:00');
  const endMs = Date.parse('2026-02-12T18:00:00+09:00');

  const groups = groupReportRowsByDate([
    {
      recordId: 'r1',
      year: 2026,
      month: 2,
      day: 12,
      siteName: 'A現場',
      clientName: '顧客A',
      minutes: 540,
      durationMinutes: 540,
      startTimestampMs: startMs,
      endTimestampMs: endMs,
      breakPolicyApplied: false,
    },
  ]);

  assert.equal(groups.length, 1);
  const [group] = groups;
  assert.equal(group.totalWorkingMinutes, 450);
  assert.equal(group.totalOvertimeMinutes, 90);

  assert.equal(group.items[0]?.workingMinutes, 450);
  assert.equal(group.items[0]?.overtimeMinutes, 90);
});

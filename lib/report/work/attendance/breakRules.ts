import { getTimeCalcConfig } from '@/src/lib/timecalc';

export type BreakRule = (grossMinutes: number) => number;

const DEFAULT_RULES = [
  { minMinutes: 12 * 60, breakMinutes: 120 },
  { minMinutes: 10 * 60, breakMinutes: 90 },
  { minMinutes: 6 * 60, breakMinutes: 60 },
];

/**
 * 勤怠集計の標準休憩を算出する。
 * 既存の TIME_CALC 設定が有効な場合は固定休憩を優先する。
 */
export function getStandardBreakMinutes(grossMinutes: number): number {
  const config = getTimeCalcConfig();
  if (config.enabled && config.breakMinutes > 0) {
    return Math.max(0, Math.round(config.breakMinutes));
  }
  return defaultStandardBreakMinutes(grossMinutes);
}

/**
 * 既存ルールがない場合の暫定標準休憩ルール。
 */
export function defaultStandardBreakMinutes(grossMinutes: number): number {
  const safeGross = Math.max(0, Math.round(grossMinutes));
  for (const rule of DEFAULT_RULES) {
    if (safeGross >= rule.minMinutes) {
      return rule.breakMinutes;
    }
  }
  return 0;
}

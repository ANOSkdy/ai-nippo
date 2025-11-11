export type MachineRef = { machineId: string; machineName?: string | null };

/**
 * machineId に含まれる末尾の数値を優先比較（無ければ文字列比較）。
 * 例: MC-2 < MC-10,  A-9 < A-10,  "AX" は数値無し → 文字列比較
 */
export function compareMachineId(a: MachineRef, b: MachineRef) {
  const takeNumber = (value: string) => {
    const matches = value?.match(/\d+/g);
    if (!matches) return Number.NaN;
    return Number(matches[matches.length - 1]);
  };
  const an = takeNumber(a.machineId);
  const bn = takeNumber(b.machineId);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) {
    return an - bn;
  }
  return a.machineId.localeCompare(b.machineId, 'ja');
}

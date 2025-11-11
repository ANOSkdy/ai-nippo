import React from 'react';

type MachineTagProps = {
  id?: string | null;
  name?: string | null;
  className?: string;
};

function joinClassNames(...classes: (string | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * 機械の表示用タグ。
 * 例: "MC-012 | 油圧プレス #2" (name が無い場合は ID のみ)
 */
const MachineTag: React.FC<MachineTagProps> = ({ id, name, className }) => {
  const normalizedId = typeof id === 'string' ? id.trim() : '';
  const normalizedName = typeof name === 'string' ? name.trim() : '';

  if (!normalizedId) {
    return <span className={joinClassNames('text-sm text-brand-muted', className)}>—</span>;
  }

  const label = normalizedName ? `${normalizedId} | ${normalizedName}` : normalizedId;

  return (
    <span className={joinClassNames('max-w-[280px] truncate text-sm text-brand-text', className)} title={label}>
      {label}
    </span>
  );
};

export default MachineTag;

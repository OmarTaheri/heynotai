import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

export function Row({ label, value, hint }: Props) {
  return (
    <div className="row">
      <span className="row-label">{label} <Icon name="info" size={12} /></span>
      <span className="row-value">
        {value}
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
    </div>
  );
}

import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function MetricCard({ title, action, children }: Props) {
  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

import { Icon } from '@/components/Icon';
import { describeScanError } from './scan-error';

export function ScanFailedCard({
  error,
  onRetry,
  onDismiss,
}: {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { title, body } = describeScanError(error);
  return (
    <section className="card action-card action-paused">
      <div className="action-head">
        <div className="action-icon">
          <Icon name="info" size={18} />
        </div>
        <div className="action-copy">
          <div className="action-title">{title}</div>
          <div className="action-host mono">scan failed</div>
        </div>
      </div>
      <p className="action-desc">{body}</p>
      <div className="action-btns">
        <button className="btn-primary" onClick={onRetry}>
          <Icon name="refresh" size={14} />
          Try again
        </button>
        <button className="btn-outline" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

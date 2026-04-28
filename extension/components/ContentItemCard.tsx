import type { ContentItem } from '@/lib/types';
import { Icon } from './Icon';

export function ContentItemCard({ item }: { item: ContentItem }) {
  const verdictClass = `verdict-${item.verdict}`;
  const colorVar =
    item.verdict === 'ai' ? 'var(--ai)' :
    item.verdict === 'human' ? 'var(--human)' : 'var(--mixed)';

  return (
    <div className="content-item">
      <div className={`ci-icon ${verdictClass}`}>
        <Icon name={item.kind} size={14} />
      </div>
      <div className="ci-body">
        <div className="ci-head">
          <span className="ci-author">{item.author}</span>
          <span className="ci-when">{item.when}</span>
        </div>
        <p className="ci-snip">{item.snip}</p>
        <div className="ci-foot">
          <span className="left">
            <span className={`ci-badge ${verdictClass}`}>
              <span className="dot" style={{ background: colorVar }} />
              <span className="score">{item.score}%</span>
            </span>
            <span className="model">{item.model}</span>
          </span>
          <Icon name="chevron-right" size={13} />
        </div>
      </div>
    </div>
  );
}

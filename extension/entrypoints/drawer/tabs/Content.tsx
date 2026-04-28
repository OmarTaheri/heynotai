import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/Chip';
import { ContentItemCard } from '@/components/ContentItemCard';
import { CONTENT_ITEMS } from '@/lib/sample-data';
import type { Verdict } from '@/lib/types';

type Filter = 'all' | Verdict;

export function Content() {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = {
    all: CONTENT_ITEMS.length,
    ai: CONTENT_ITEMS.filter(i => i.verdict === 'ai').length,
    mixed: CONTENT_ITEMS.filter(i => i.verdict === 'mixed').length,
    human: CONTENT_ITEMS.filter(i => i.verdict === 'human').length,
  };

  const filtered = filter === 'all'
    ? CONTENT_ITEMS
    : CONTENT_ITEMS.filter(i => i.verdict === filter);

  const filters: Filter[] = ['all', 'ai', 'mixed', 'human'];

  return (
    <div className="panel">
      <div className="chips">
        {filters.map(k => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {k === 'all' ? 'All' : k[0]!.toUpperCase() + k.slice(1)} · {counts[k]}
          </Chip>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(item => <ContentItemCard key={item.id} item={item} />)}
      </div>
      <button className="load-more" type="button">
        <Icon name="refresh" size={12} /> Load earlier items
      </button>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/Chip';
import { LibraryRow } from '@/components/LibraryRow';
import { useAuth } from '@/lib/auth-state';
import { listScans, FRONTEND_URL, ScanApiError } from '@/lib/scans-api';
import { scanToRow, type LibraryRowItem } from '@/lib/library';
import { CONTENT_ITEMS } from '@/lib/sample-data';
import type { ContentItem, Verdict } from '@/lib/types';

type Filter = 'all' | Verdict;

const PER_PAGE = 12;

/** Map the legacy mock CONTENT_ITEMS into the new row shape so guests
 *  see the same layout as signed-in users. */
function mockToRow(item: ContentItem): LibraryRowItem {
  const type =
    item.kind === 'text' ? 'txt'
    : item.kind === 'image' ? 'img'
    : item.kind === 'audio' ? 'aud'
    : 'vid';
  const meta =
    type === 'txt' ? { wordCount: item.snip }
    : type === 'img' ? { size: item.snip }
    : { length: item.snip };
  return {
    id: `mock-${item.id}`,
    type,
    name: item.author,
    origin: 'ext',
    meta,
    confidence: item.score,
    verdict: item.verdict,
    model: item.model,
    when: item.when,
  };
}

function openLibrary() {
  const url = `${FRONTEND_URL}/app/library`;
  if (chrome?.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener,noreferrer');
}

function openEditor(id: string) {
  if (id.startsWith('mock-')) return openLibrary();
  const url = `${FRONTEND_URL}/editor/${encodeURIComponent(id)}`;
  if (chrome?.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function Content() {
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<LibraryRowItem[] | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mock rows for the signed-out preview state.
  const mockRows = useMemo(() => CONTENT_ITEMS.map(mockToRow), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Guest preview — keep mock data so the tab isn't empty.
      setRows(mockRows);
      setTotalItems(mockRows.length);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const result = await listScans({ perPage: PER_PAGE });
        if (cancelled) return;
        setRows(result.items.map(scanToRow));
        setTotalItems(result.totalItems);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ScanApiError && err.status === 401) {
          setRows(mockRows);
          setTotalItems(mockRows.length);
        } else {
          setRows([]);
          setTotalItems(0);
          setError("Couldn't load your recent content.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, mockRows]);

  const visibleAll = rows ?? [];

  const counts = useMemo(() => ({
    all: visibleAll.length,
    ai: visibleAll.filter(i => i.verdict === 'ai').length,
    mixed: visibleAll.filter(i => i.verdict === 'mixed').length,
    human: visibleAll.filter(i => i.verdict === 'human').length,
  }), [visibleAll]);

  const filtered = filter === 'all'
    ? visibleAll
    : visibleAll.filter(i => i.verdict === filter);

  const filters: Filter[] = ['all', 'ai', 'mixed', 'human'];

  const showLoading = rows === null && user;
  const moreAvailable = user && totalItems > visibleAll.length;

  return (
    <div className="panel">
      <div className="chips">
        {filters.map(k => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {k === 'all' ? 'All' : k[0]!.toUpperCase() + k.slice(1)} · {counts[k]}
          </Chip>
        ))}
      </div>

      {showLoading ? (
        <div className="lib-empty-state">Loading your recent content…</div>
      ) : error ? (
        <div className="lib-empty-state">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="lib-empty-state">
          {user ? 'No scans match this filter yet.' : 'Sign in to see your scans.'}
        </div>
      ) : (
        <div className="lib-list">
          {filtered.map(row => (
            <LibraryRow
              key={row.id}
              item={row}
              onClick={() => openEditor(row.id)}
            />
          ))}
        </div>
      )}

      <button className="lib-open-btn" type="button" onClick={openLibrary}>
        <Icon name="external-link" size={12} />
        {user
          ? moreAvailable
            ? `See all ${totalItems.toLocaleString()} in your library`
            : 'Open full library on heynotai'
          : 'Open the heynotai web app'}
      </button>
    </div>
  );
}

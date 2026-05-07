import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/Chip';
import { LibraryRow } from '@/components/LibraryRow';
import { useApp } from '@/lib/state';
import { useAuth } from '@/lib/auth-state';
import { FRONTEND_URL } from '@/lib/scans-api';
import { useScansLive } from '@/lib/use-scans-live';
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
  if (id.startsWith('mock-') || id.startsWith('pending:')) return openLibrary();
  const url = `${FRONTEND_URL}/editor/${encodeURIComponent(id)}`;
  if (chrome?.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function Content() {
  const { user, loading: authLoading } = useAuth();
  const { scanning, currentPage } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const live = useScansLive(PER_PAGE);

  // Mock rows for the signed-out preview state.
  const mockRows = useMemo(() => CONTENT_ITEMS.map(mockToRow), []);

  // Optimistic in-flight row. Inserted at the top while the host page
  // is mid-scan and the PB realtime `create` event hasn't reached us
  // yet. Once the real record arrives via realtime, the dedupe by
  // canonical YouTube URL hides this synthetic row so we don't show
  // the same video twice. Stays visible until the real row is `done`
  // — same UX a user would expect from any "currently scanning" pill.
  const optimisticRow: LibraryRowItem | null = useMemo(() => {
    if (!user || !scanning || !currentPage) return null;
    if (currentPage.platform !== 'youtube' || currentPage.surface !== 'videos') return null;
    const yt = currentPage.youtube;
    if (!yt) return null;
    return {
      id: `pending:${yt.videoId}`,
      type: 'yt-vid',
      name: yt.title || 'YouTube video',
      origin: 'ext',
      meta: { socialFormat: 'video', socialId: yt.videoId },
      link: currentPage.url,
      confidence: 0,
      verdict: 'unknown',
      model: '—',
      when: 'just now',
      status: 'scanning',
    };
  }, [user, scanning, currentPage]);

  const liveRows = useMemo(
    () => live.scans.map(scanToRow),
    [live.scans],
  );

  // Compose final rows. When auth fails or guest, fall back to mock
  // preview. Otherwise: optimistic row (if any) at the top, deduped
  // against any real row that already represents the same video.
  const rows: LibraryRowItem[] = useMemo(() => {
    if (!user) return mockRows;
    if (live.error === 'auth') return mockRows;
    if (live.error === 'fetch') return [];
    if (!optimisticRow) return liveRows;
    const optimisticUrl = optimisticRow.link;
    const dup = liveRows.some((r) => {
      // De-dupe by canonical sourceUrl when the live row is a yt-vid
      // sharing the same URL. The live row will have status='queued'
      // / 'scanning' until the backend transitions it, so the user
      // sees a single working pill, not two.
      if (r.type !== 'yt-vid') return false;
      if (!optimisticUrl) return false;
      return rowSourceUrl(r) === optimisticUrl;
    });
    return dup ? liveRows : [optimisticRow, ...liveRows];
  }, [user, live.error, liveRows, mockRows, optimisticRow]);

  const counts = useMemo(() => ({
    all: rows.length,
    ai: rows.filter(i => i.verdict === 'ai').length,
    mixed: rows.filter(i => i.verdict === 'mixed').length,
    human: rows.filter(i => i.verdict === 'human').length,
  }), [rows]);

  const filtered = filter === 'all'
    ? rows
    : rows.filter(i => i.verdict === filter);

  const filters: Filter[] = ['all', 'ai', 'mixed', 'human'];

  const showLoading = !authLoading && user && live.loading && rows.length === 0;
  const errorMessage =
    live.error === 'fetch' ? "Couldn't load your recent content." : null;
  const totalItems = user ? live.totalItems : mockRows.length;
  const moreAvailable = user && totalItems > rows.length;

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
      ) : errorMessage ? (
        <div className="lib-empty-state">{errorMessage}</div>
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

/** Recover the original sourceUrl from a row so we can dedupe the
 *  optimistic in-flight row against the real PB record. `link` is
 *  populated for social subtypes — see scanToRow / library.ts. */
function rowSourceUrl(row: LibraryRowItem): string | undefined {
  return row.link;
}

import { Fragment } from 'react';
import { TypeChip } from './TypeChip';
import { OriginBadge } from './OriginBadge';
import type { LibraryRowItem } from '@/lib/library';
import { isSocialType, metaSegments } from '@/lib/library';

/** Compact row that mirrors the frontend library / activity row layout
 *  (TypeChip · title + origin + meta · confidence bar · model · when).
 *  Adapted to the popup's narrow column — the right column stacks
 *  confidence + model + when so everything stays scannable.
 *
 *  Designed to live inside a `.lib-list` card wrapper which owns the
 *  outer border + corners, with rows separated by a 1px line. */
export function LibraryRow({
  item,
  onClick,
}: {
  item: LibraryRowItem;
  onClick?: () => void;
}) {
  const segments = metaSegments(item.type, item.meta);
  const showSocialLink =
    isSocialType(item.type) &&
    item.link &&
    item.meta.socialFormat &&
    item.meta.socialId;

  return (
    <button
      type="button"
      className="lib-row"
      onClick={onClick}
      title={item.name}
    >
      <TypeChip type={item.type} />
      <div className="lib-row-main">
        <div className="lib-row-title">{item.name}</div>
        <div className="lib-row-meta">
          <OriginBadge origin={item.origin} />
          {showSocialLink ? (
            <span className="lib-row-meta-text">
              <span className="lr-fmt">{item.meta.socialFormat}</span>
              <span aria-hidden> · </span>
              <span>{item.meta.socialId}</span>
            </span>
          ) : segments.length > 0 ? (
            <span className="lib-row-meta-text">
              {segments.map((s, i) => (
                <Fragment key={i}>
                  {i > 0 && <span aria-hidden> · </span>}
                  {s}
                </Fragment>
              ))}
            </span>
          ) : null}
        </div>
      </div>
      <div className="lib-row-side">
        <span className="lib-row-conf">
          <span className="lib-conf-bar" aria-hidden>
            <span style={{ width: `${item.confidence}%` }} />
          </span>
          <span className="lib-conf-num">{item.confidence}%</span>
        </span>
        <span className="lib-row-model" title={item.model}>{item.model}</span>
        <span className="lib-row-when">{item.when}</span>
      </div>
    </button>
  );
}

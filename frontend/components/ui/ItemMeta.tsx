"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import {
  isSocialType,
  metaSegments,
  type ItemMetaCollection,
  type ItemMetaLink,
  type ItemMetaParts,
} from "@/lib/item-meta";
import type { ScanType } from "./TypeChip";

export function ItemMeta({
  type,
  parts,
  link,
}: {
  type: ScanType;
  parts: ItemMetaParts;
  link?: ItemMetaLink;
}) {
  const segments = metaSegments(type, parts);
  if (segments.length === 0) return null;

  // The collection title sits at the end of the segment list (when set);
  // render the leading segments as plain text and the collection as a
  // separate Link so clicking it navigates to the collection without
  // triggering the row's onClick (which would open the editor).
  const hasCollection = !!parts.collection?.title;
  const baseSegments = hasCollection ? segments.slice(0, -1) : segments;

  if (isSocialType(type) && link?.url && parts.socialFormat && parts.socialId) {
    return (
      <span>
        <SocialLink
          url={link.url}
          format={parts.socialFormat}
          id={parts.socialId}
        />
        {parts.collection?.title && (
          <>
            <span aria-hidden> · </span>
            <CollectionSegment collection={parts.collection} />
          </>
        )}
      </span>
    );
  }

  return (
    <span>
      {baseSegments.map((segment, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden> · </span>}
          {segment}
        </Fragment>
      ))}
      {parts.collection?.title && (
        <>
          {baseSegments.length > 0 && <span aria-hidden> · </span>}
          <CollectionSegment collection={parts.collection} />
        </>
      )}
    </span>
  );
}

function CollectionSegment({ collection }: { collection: ItemMetaCollection }) {
  if (!collection.href) {
    return <span>{collection.title}</span>;
  }
  return (
    <Link
      href={collection.href}
      className="lib-row-collection"
      onClick={(e) => e.stopPropagation()}
    >
      {collection.title}
    </Link>
  );
}

function SocialLink({
  url,
  format,
  id,
}: {
  url: string;
  format: string;
  id: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  };

  return (
    <button
      type="button"
      className={`lib-row-link${copied ? " is-copied" : ""}`}
      onClick={handleCopy}
      aria-label={`Copy ${url}`}
      title="Copy link"
    >
      <span className="fmt">{format}</span>
      <span aria-hidden>·</span>
      <span>{id}</span>
      <Icon name={copied ? "check" : "link"} size={11} />
    </button>
  );
}

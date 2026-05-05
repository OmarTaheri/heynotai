"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import type { CollectionMember } from "@/lib/collections-data";
import { InviteCollaboratorModal } from "./InviteCollaboratorModal";
import { ManageMembersModal } from "./ManageMembersModal";

/**
 * Side-panel listing every member of the collection + an invite CTA.
 * The CTA is only meaningful when the host detail page knows which
 * collection we're on, so it's wired up only when `collectionId` is
 * provided. Otherwise the button stays as a passive ornament for the
 * legacy mock pages.
 */
export function MembersPanel({
  members,
  collectionId,
  collectionTitle,
  excludeUserIds,
  manageOpen: manageOpenProp,
  onManageOpenChange,
  onInvited,
  inviteLabel = "Invite collaborator",
}: {
  members: CollectionMember[];
  collectionId?: string;
  collectionTitle?: string;
  excludeUserIds?: ReadonlySet<string>;
  /** Lifted state — when provided, the parent owns whether the Manage
   *  modal is open. Lets sibling surfaces (e.g. the share popup) open
   *  Manage too. When omitted, the panel keeps its own local state. */
  manageOpen?: boolean;
  onManageOpenChange?: (open: boolean) => void;
  onInvited?: () => void;
  inviteLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [internalManageOpen, setInternalManageOpen] = useState(false);
  const manageOpen = manageOpenProp ?? internalManageOpen;
  const setManageOpen = (v: boolean) => {
    if (onManageOpenChange) onManageOpenChange(v);
    else setInternalManageOpen(v);
  };
  // Both "Manage" and "Invite collaborator" are owner-only — non-owner
  // viewers don't see other members' rows (PB listRule filters them
  // out) and can't write to `collection_members` (PB createRule + the
  // `/me/collections/invite` API both reject them). Hide the buttons
  // entirely so the side panel reads as read-only for them.
  const ownerMember =
    members.find((m) => m.role === "Owner") ?? members[0] ?? null;
  const isOwner = Boolean(ownerMember && ownerMember.you);
  const canInvite = Boolean(collectionId && collectionTitle && isOwner);
  const canManage = canInvite;

  return (
    <section className="coll-panel">
      <header className="coll-panel-head">
        <span>Members</span>
        {canManage && (
          <button
            type="button"
            className="coll-panel-link"
            onClick={() => setManageOpen(true)}
          >
            Manage
          </button>
        )}
      </header>

      <ul className="coll-member-list">
        {members.map((m) => (
          <li
            key={m.membershipId ?? `${m.initials}-${m.emailHandle}`}
            className="coll-member"
          >
            <Avatar initials={m.initials} size="md" src={m.avatarSrc} />
            <div className="coll-member-info">
              <div className="coll-member-name">{m.name}</div>
              <div className="coll-member-role">
                {m.role} · {m.emailHandle}
              </div>
            </div>
            {m.you && <span className="coll-member-you">You</span>}
          </li>
        ))}
      </ul>

      {canInvite && (
        <button
          type="button"
          className="coll-invite-btn"
          onClick={() => setOpen(true)}
        >
          <Icon name="plus" size={12} />
          {inviteLabel}
        </button>
      )}

      {open && collectionId && collectionTitle && (
        <InviteCollaboratorModal
          collectionId={collectionId}
          collectionTitle={collectionTitle}
          excludeUserIds={excludeUserIds}
          onClose={() => setOpen(false)}
          onInvited={onInvited}
        />
      )}

      {manageOpen && collectionId && collectionTitle && ownerMember && (
        <ManageMembersModal
          collectionId={collectionId}
          collectionTitle={collectionTitle}
          ownerMember={ownerMember}
          onClose={() => setManageOpen(false)}
          onChanged={onInvited}
        />
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { listPendingRequests } from "@/lib/collection-members";
import { RequestsModal } from "./RequestsModal";
import { collectionsRefreshBus } from "./collections-refresh-bus";

/**
 * Header button that surfaces pending collection invites. Polls the
 * count once on mount + whenever the collections list refreshes
 * (accept/reject ripples back through the same bus). Clicking opens
 * the Requests modal where the user approves or rejects each invite.
 */
export function RequestsTrigger() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (loading || !user) {
      setCount(null);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const rows = await listPendingRequests(user.id);
        if (!cancelled) setCount(rows.length);
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    refresh();
    const unsub = collectionsRefreshBus.subscribe(refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, loading]);

  const hasPending = count !== null && count > 0;

  return (
    <>
      <span className="coll-requests-trigger">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Icon name="users" size={14} />
          Requests
        </Button>
        {hasPending && (
          <span
            className="coll-requests-dot"
            aria-label={`${count} pending request${count === 1 ? "" : "s"}`}
            title={`${count} pending`}
          >
            {count}
          </span>
        )}
      </span>
      {open && (
        <RequestsModal
          onClose={() => setOpen(false)}
          onChanged={() => collectionsRefreshBus.publish()}
        />
      )}
    </>
  );
}

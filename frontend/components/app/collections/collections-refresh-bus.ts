/**
 * Module-scoped pub/sub used to keep the collections grid + the
 * "Requests" badge in sync. The page-header trigger and the
 * collections list both subscribe; accepting an invite or removing a
 * member calls `publish()` so they all re-fetch.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export const collectionsRefreshBus = {
  publish() {
    for (const fn of listeners) fn();
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

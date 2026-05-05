/**
 * Tiny module-scoped pub/sub so the page-header "New collection"
 * button and the dashed grid tile (rendered in different parts of the
 * tree) can both pop the same modal without making the parent server
 * component a client component.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export const newCollectionBus = {
  open() {
    for (const fn of listeners) fn();
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

"use client";

import { useEffect, useState } from "react";
import { newCollectionBus } from "./new-collection-bus";
import { NewCollectionModal } from "./NewCollectionModal";

/**
 * Mount once on the collections page. Subscribes to `newCollectionBus`
 * and renders the modal when any trigger fires `bus.open()`.
 */
export function NewCollectionModalHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return newCollectionBus.subscribe(() => setOpen(true));
  }, []);

  if (!open) return null;
  return <NewCollectionModal onClose={() => setOpen(false)} />;
}

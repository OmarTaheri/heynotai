"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isPlatformAdmin, useAuth } from "@/lib/auth";

/** Presentation-layer guard for `/app/admin/*`. Admin API routes enforce
 * the same authorization server-side; hiding pages is not the boundary. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = isPlatformAdmin(user);

  useEffect(() => {
    if (!loading && user && !allowed) router.replace("/app");
  }, [allowed, loading, router, user]);

  if (loading || !allowed) return null;
  return children;
}


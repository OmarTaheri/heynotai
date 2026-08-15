import type { Metadata } from "next";
import { ProvidersClient } from "@/components/app/admin/ProvidersClient";

export const metadata: Metadata = { title: "Providers" };

export default function AdminProvidersPage() {
  return <ProvidersClient />;
}


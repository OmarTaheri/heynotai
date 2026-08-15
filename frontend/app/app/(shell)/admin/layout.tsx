import type { Metadata } from "next";
import { AdminGuard } from "@/components/app/admin/AdminGuard";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s — Admin",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}


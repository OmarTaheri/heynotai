import type { Metadata } from "next";
import { UsersClient } from "@/components/app/admin/UsersClient";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return <UsersClient />;
}


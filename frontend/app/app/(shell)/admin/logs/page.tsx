import type { Metadata } from "next";
import { LogsClient } from "@/components/app/admin/LogsClient";

export const metadata: Metadata = { title: "Logs" };

export default function AdminLogsPage() {
  return <LogsClient />;
}


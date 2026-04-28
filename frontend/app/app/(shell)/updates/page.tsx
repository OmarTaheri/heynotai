import type { Metadata } from "next";
import { UpdatesClient } from "@/components/app/updates/UpdatesClient";

export const metadata: Metadata = { title: "Updates" };

export default function UpdatesPage() {
  return <UpdatesClient />;
}

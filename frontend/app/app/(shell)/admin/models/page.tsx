import type { Metadata } from "next";
import { ModelsClient } from "@/components/app/admin/ModelsClient";

export const metadata: Metadata = { title: "Models" };

export default function AdminModelsPage() {
  return <ModelsClient />;
}


import type { Metadata } from "next";
import { ModelsClient } from "@/components/app/models/ModelsClient";

export const metadata: Metadata = { title: "Models" };

export default function ModelsPage() {
  return <ModelsClient />;
}

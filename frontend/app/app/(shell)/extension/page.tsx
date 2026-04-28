import type { Metadata } from "next";
import { ExtensionClient } from "@/components/app/extension/ExtensionClient";

export const metadata: Metadata = { title: "Extension" };

export default function ExtensionPage() {
  return <ExtensionClient />;
}

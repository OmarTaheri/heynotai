import type { Metadata } from "next";
import "./editor.css";

export const metadata: Metadata = {
  title: "Editor — heynotai",
  description: "Scan, edit, and verify text for AI-generated content.",
};

/**
 * Standalone editor surface. Sits OUTSIDE `app/(shell)` so the
 * dashboard sidebar + AuthGuard never mount — the route is open to
 * logged-out visitors per product spec, à la Grammarly's editor.
 */
export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

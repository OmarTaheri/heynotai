import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Not found" };

/**
 * 404 inside /app/*. Stays inside the dashboard shell so the user keeps
 * the sidebar + nav while we offer a route back home.
 */
export default function NotFound() {
  return (
    <div className="empty-page">
      <span className="empty-page-icon" aria-hidden>
        <Icon name="search" size={24} />
      </span>
      <div className="empty-page-title">We couldn&apos;t find that page.</div>
      <p className="empty-page-body">
        The URL doesn&apos;t match anything in the workspace. Check the
        sidebar for the destination you&apos;re after, or jump back home.
      </p>
      <Link href="/app" className="action-pill mt-4">
        Back to home
      </Link>
    </div>
  );
}

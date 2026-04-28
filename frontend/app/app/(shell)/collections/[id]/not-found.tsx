import Link from "next/link";
import { EmptyPage } from "@/components/app/EmptyPage";

export default function CollectionNotFound() {
  return (
    <div>
      <EmptyPage
        title="Collection not found"
        subtitle="That collection doesn't exist or has been removed."
        icon="folder"
        body="It may have been deleted, or the link may be stale. Head back to the index to pick another."
      />
      <p style={{ textAlign: "center", marginTop: 14 }}>
        <Link href="/app/collections" className="action-pill">
          Back to collections
        </Link>
      </p>
    </div>
  );
}

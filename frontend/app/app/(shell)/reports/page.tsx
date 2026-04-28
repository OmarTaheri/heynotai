import type { Metadata } from "next";
import { ReportsClient } from "@/components/app/reports/ReportsClient";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <ComingSoon feature="Reports" subtitle="Sharable scan reports are landing soon.">
      <ReportsClient />
    </ComingSoon>
  );
}

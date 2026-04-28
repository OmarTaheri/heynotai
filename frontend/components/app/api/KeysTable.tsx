import { Card } from "@/components/ui/Card";
import { KeyRow } from "./KeyRow";
import { NewKeyRow } from "./NewKeyRow";
import type { ApiKey } from "@/lib/api-data";

/**
 * API-keys list. Card hosts the bordered surface; the row grid is
 * declared in `api.css` (`.api-key-row`) so the column widths line
 * up with the header below.
 */
export function KeysTable({ keys }: { keys: ApiKey[] }) {
  return (
    <Card className="api-keys">
      <div className="api-key-head">
        <span>Name</span>
        <span>Key</span>
        <span>Scope</span>
        <span>Usage · 30d</span>
        <span style={{ textAlign: "right" }}>Last used</span>
        <span aria-hidden />
      </div>
      {keys.map((key) => (
        <KeyRow key={key.id} apiKey={key} />
      ))}
      <NewKeyRow />
    </Card>
  );
}

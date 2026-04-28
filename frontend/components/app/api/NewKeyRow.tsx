import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";

/**
 * Inline create-a-new-key row at the bottom of the table.
 * Currently render-only; submit handler lands when the API is wired.
 */
export function NewKeyRow() {
  return (
    <div className="api-key-new">
      <input
        type="text"
        className="api-key-new-input"
        placeholder="Name this key — e.g. CI/CD pipeline"
      />
      <button type="button" className="api-key-new-scope">
        <Icon name="shield" size={11} />
        <span>Full access</span>
        <Icon name="chevron-down" size={11} />
      </button>
      <Button variant="primary">
        <Icon name="plus" size={13} />
        <span>Create key</span>
      </Button>
    </div>
  );
}

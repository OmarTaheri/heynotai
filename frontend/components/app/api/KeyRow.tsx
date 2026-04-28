import { Icon } from "@/components/Icon";
import { Pill, type PillTone } from "@/components/ui/Pill";
import type { ApiKey, KeyScope } from "@/lib/api-data";

const SCOPE_TONE: Record<KeyScope, PillTone> = {
  full: "warn",
  write: "info",
  read: "human",
};

const SCOPE_LABEL: Record<KeyScope, string> = {
  full: "FULL",
  write: "WRITE",
  read: "READ",
};

/**
 * Single row inside `KeysTable`. Static — reveal/copy/menu are render-only
 * affordances; wiring them up is out of scope until the backend ships.
 */
export function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const barClass = apiKey.usageTone
    ? `api-key-bar-fill is-${apiKey.usageTone}`
    : "api-key-bar-fill";

  return (
    <div className="api-key-row">
      <div className="api-key-info">
        <div className="api-key-name">
          <span>{apiKey.name}</span>
          {apiKey.nameSuffix && (
            <span className="api-key-name-suffix">· {apiKey.nameSuffix}</span>
          )}
        </div>
        <div className="api-key-meta">{apiKey.meta}</div>
      </div>

      <div className="api-key-secret">
        <span className="api-key-secret-text">{apiKey.masked}</span>
        <button type="button" className="api-key-secret-btn" aria-label="Reveal">
          <Icon name="eye" size={11} />
        </button>
        <button type="button" className="api-key-secret-btn" aria-label="Copy">
          <Icon name="paperclip" size={11} />
        </button>
      </div>

      <Pill tone={SCOPE_TONE[apiKey.scope]} compact>
        {SCOPE_LABEL[apiKey.scope]}
      </Pill>

      <div className="api-key-usage">
        <div>
          <strong>{apiKey.callsThisMonth.toLocaleString()}</strong> calls
        </div>
        <div className="api-key-bar" aria-hidden>
          <div className={barClass} style={{ width: `${apiKey.usagePercent}%` }} />
        </div>
      </div>

      <div className="api-key-time">
        <strong>{apiKey.lastUsedHeadline}</strong>
        <span>{apiKey.lastUsedSub}</span>
      </div>

      <button type="button" className="api-key-action" aria-label="More">
        <Icon name="more" size={14} />
      </button>
    </div>
  );
}

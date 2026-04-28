"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { CollectionRule } from "@/lib/collections-data";

/**
 * Side-panel listing every auto-rule on the collection with a per-row
 * toggle. Local state only for now — wiring to real persistence will
 * land when the collections data layer goes from mock to live.
 */
export function RulesPanel({ rules }: { rules: CollectionRule[] }) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rules.map((r) => [r.id, r.active])),
  );

  return (
    <section className="coll-panel">
      <header className="coll-panel-head">
        <span>Auto-rules</span>
        <button type="button" className="coll-panel-link">
          Edit
        </button>
      </header>

      <ul className="coll-rule-list">
        {rules.map((r) => {
          const on = state[r.id];
          return (
            <li key={r.id} className="coll-rule">
              <span className="coll-rule-icon">
                <Icon name={r.icon} size={12} />
              </span>
              <span className="coll-rule-text">{r.text}</span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={r.text}
                className={`coll-rule-toggle${on ? " is-on" : ""}`}
                onClick={() => setState((s) => ({ ...s, [r.id]: !on }))}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

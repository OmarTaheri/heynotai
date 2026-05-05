"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { CollectionRule } from "@/lib/collections-data";

/**
 * Auto-rules side panel. Visually blurred + locked behind a "coming
 * soon" overlay until the rules engine ships. The list and toggles
 * stay rendered for visual density but are inert (`pointer-events:
 * none`) and aria-hidden behind the overlay.
 */
export function RulesPanel({ rules }: { rules: CollectionRule[] }) {
  const [state] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rules.map((r) => [r.id, r.active])),
  );

  return (
    <section className="coll-panel coll-panel-locked">
      <header className="coll-panel-head">
        <span>Auto-rules</span>
        <span className="coll-panel-tag">Soon</span>
      </header>

      <div className="coll-panel-content" aria-hidden>
        <ul className="coll-rule-list">
          {rules.map((r) => {
            const on = state[r.id];
            return (
              <li key={r.id} className="coll-rule">
                <span className="coll-rule-icon">
                  <Icon name={r.icon} size={12} />
                </span>
                <span className="coll-rule-text">{r.text}</span>
                <span
                  role="switch"
                  aria-checked={on}
                  className={`coll-rule-toggle${on ? " is-on" : ""}`}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="coll-panel-overlay" role="status">
        <Icon name="sparkle" size={16} />
        <strong>Almost ready</strong>
        <span>We&apos;re working on auto-rules — coming soon.</span>
      </div>
    </section>
  );
}

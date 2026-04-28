"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { CodeSample, CodeSpan } from "@/lib/api-data";

/**
 * Code panel with language tabs + copy button. Snippets ship pre-tokenized
 * from `lib/api-data.ts` (an array of `{kind, text}` spans), so there's no
 * client-side highlighter — the bundle stays small and the colors come from
 * `api.css`.
 */
export function CodeBlock({ samples }: { samples: CodeSample[] }) {
  const [activeId, setActiveId] = useState(samples[0].id);
  const active = samples.find((s) => s.id === activeId) ?? samples[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.plain);
    } catch {
      /* clipboard blocked — silently ignore, no toast UI yet */
    }
  };

  return (
    <div className="api-code">
      <div className="api-code-tabs">
        {samples.map((s) => (
          <button
            key={s.id}
            type="button"
            className={
              s.id === activeId
                ? "api-code-tab is-active"
                : "api-code-tab"
            }
            onClick={() => setActiveId(s.id)}
          >
            {s.label}
          </button>
        ))}
        <div className="api-code-actions">
          <button type="button" className="api-code-btn" onClick={copy}>
            <Icon name="paperclip" size={11} />
            <span>Copy</span>
          </button>
        </div>
      </div>
      <pre className="api-code-body">
        <code>{active.spans.map(renderSpan)}</code>
      </pre>
    </div>
  );
}

function renderSpan(span: CodeSpan, i: number) {
  if (typeof span === "string") return <span key={i}>{span}</span>;
  return (
    <span key={i} className={`api-code-${span.kind}`}>
      {span.text}
    </span>
  );
}

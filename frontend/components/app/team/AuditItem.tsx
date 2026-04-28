import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { AuditEntry } from "@/lib/team-data";

/**
 * Renders the lightweight rich-text in `entry.text`:
 *   **bold**  → <strong>
 *   *italic*  → <em> (used for collection / role names)
 * Intentionally tiny — full markdown is overkill for one-line activity
 * captions, and parsing real markdown would pull a dependency.
 */
function parseRichText(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const t = match[0];
    if (t.startsWith("**")) {
      tokens.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    } else {
      tokens.push(<em key={key++}>{t.slice(1, -1)}</em>);
    }
    lastIndex = match.index + t.length;
  }
  if (lastIndex < text.length) tokens.push(text.slice(lastIndex));
  return tokens;
}

export function AuditItem({ entry }: { entry: AuditEntry }) {
  return (
    <li className="team-audit-item">
      <Avatar initials={entry.actorInitials} size="sm" />
      <div className="team-audit-content">
        <div className="team-audit-text">{parseRichText(entry.text)}</div>
        <div className="team-audit-meta">{entry.meta}</div>
      </div>
    </li>
  );
}

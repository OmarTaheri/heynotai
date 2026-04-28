import { Icon, type IconName } from "@/components/Icon";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * Default body for sidebar routes that don't have real content yet.
 * Renders the page chrome (title + subtitle) and a quiet placeholder
 * card so the navigation still feels alive — every nav click lands on
 * a real-looking page instead of a 404.
 *
 * As each surface graduates to a real implementation, the route's
 * page.tsx swaps EmptyPage out for its own body and keeps the same
 * title + subtitle.
 */
export function EmptyPage({
  title,
  subtitle,
  icon,
  body,
  tag = "Coming soon",
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  body?: string;
  tag?: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="empty-page">
        <span className="empty-page-icon" aria-hidden>
          <Icon name={icon} size={24} />
        </span>
        <div className="empty-page-title">{title}</div>
        {body && <p className="empty-page-body">{body}</p>}
        <span className="empty-page-tag">{tag}</span>
      </div>
    </>
  );
}

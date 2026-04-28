import { Icon, type IconName } from "@/components/Icon";
import styles from "./IconTile.module.css";

const ICON_SIZE: Record<"sm" | "md" | "lg", number> = {
  sm: 14,
  md: 18,
  lg: 22,
};

/**
 * Soft square that hosts a single icon. Used on drop zones, empty
 * states, settings rows, etc. — anywhere we want to "label" a card
 * with a tone-neutral mark.
 */
export function IconTile({
  icon,
  size = "md",
}: {
  icon: IconName;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`${styles.tile} ${styles[size]}`} aria-hidden>
      <Icon name={icon} size={ICON_SIZE[size]} />
    </span>
  );
}

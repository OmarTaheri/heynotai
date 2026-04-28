import { Icon, type IconName } from "@/components/Icon";
import styles from "./TypeChip.module.css";

export type ScanType =
  | "txt"
  | "img"
  | "aud"
  | "vid"
  | "web"
  | "soc"
  | "fb-vid"
  | "fb-reel"
  | "fb-post"
  | "ig-reel"
  | "ig-post-img"
  | "ig-post-vid"
  | "yt-vid"
  | "yt-reel";

const ICON: Record<ScanType, IconName> = {
  txt: "text",
  img: "image",
  aud: "audio",
  vid: "video",
  web: "globe",
  soc: "users",
  "fb-vid": "facebook",
  "fb-reel": "facebook",
  "fb-post": "facebook",
  "ig-reel": "instagram",
  "ig-post-img": "instagram",
  "ig-post-vid": "instagram",
  "yt-vid": "youtube",
  "yt-reel": "youtube",
};

/**
 * Square chip identifying what kind of content a row / card represents.
 * For platform variants (fb-*, ig-*, yt-*) the chip is the platform's
 * brand color filled solid with the brand glyph in white — so the
 * platform reads instantly without relying on color alone. The format
 * (video / reel / image / post) is shown in the row's source text, not
 * on the chip. Base media types (txt/img/aud/vid/web/soc) keep the
 * original tinted palette.
 */
export function TypeChip({
  type,
  size = "md",
}: {
  type: ScanType;
  size?: "md" | "lg";
}) {
  const variantClass = styles[type as keyof typeof styles] ?? "";
  const classes = [styles.chip, styles[size], variantClass].join(" ");
  const iconSize = size === "lg" ? 20 : 16;
  return (
    <span className={classes} aria-hidden>
      <Icon name={ICON[type]} size={iconSize} />
    </span>
  );
}

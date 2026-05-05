import type { SVGProps } from "react";

export type IconName =
  | "info"
  | "chevron-right"
  | "chevron-left"
  | "chevron-down"
  | "arrow-left"
  | "arrow-right"
  | "check"
  | "refresh"
  | "filter"
  | "plus"
  | "text"
  | "image"
  | "audio"
  | "video"
  | "globe"
  | "sparkle"
  | "bell"
  | "shield"
  | "lock"
  | "sun"
  | "moon"
  | "pause"
  | "activity"
  | "layers"
  | "user"
  | "bolt"
  | "home"
  | "upload"
  | "trash"
  | "heart"
  | "link"
  | "play"
  | "search"
  | "list"
  | "folder"
  | "eye"
  | "file-text"
  | "users"
  | "code"
  | "mic"
  | "x"
  | "more"
  | "send"
  | "key"
  | "share"
  | "paperclip"
  | "settings"
  | "puzzle"
  | "cube"
  | "zap"
  | "alert-triangle"
  | "sidebar"
  | "log-out"
  | "reel"
  | "pin"
  | "facebook"
  | "instagram"
  | "youtube";

const PATHS: Record<IconName, React.ReactElement> = {
  info: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" />
    </g>
  ),
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "arrow-left": (
    <g>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </g>
  ),
  "arrow-right": (
    <g>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </g>
  ),
  check: <path d="M4 12l5 5 11-11" />,
  refresh: (
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
  ),
  filter: <path d="M4 4h16l-6 8v7l-4-2v-5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  text: <path d="M4 6h16M4 12h10M4 18h16" />,
  image: (
    <g>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </g>
  ),
  audio: (
    <g>
      <path d="M9 18V6l11-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </g>
  ),
  video: (
    <g>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </g>
  ),
  globe: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </g>
  ),
  sparkle: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  ),
  bell: (
    <g>
      <path d="M18 16V11a6 6 0 1 0-12 0v5l-2 2h16z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </g>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  lock: (
    <g>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </g>
  ),
  sun: (
    <g>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </g>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  pause: (
    <g>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </g>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  layers: (
    <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />
  ),
  user: (
    <g>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
    </g>
  ),
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  home: (
    <g>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </g>
  ),
  upload: (
    <g>
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </g>
  ),
  trash: (
    <g>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V4h6v3" />
    </g>
  ),
  heart: (
    <path d="M12 20s-7-4.5-9.5-9a5 5 0 0 1 9.5-3 5 5 0 0 1 9.5 3C19 15.5 12 20 12 20z" />
  ),
  link: (
    <g>
      <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </g>
  ),
  play: <path d="M6 4l14 8-14 8z" />,
  search: (
    <g>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </g>
  ),
  list: <path d="M3 6h18M3 12h18M3 18h18" />,
  folder: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  ),
  eye: (
    <g>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
  "file-text": (
    <g>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 14h8M8 17h6" />
    </g>
  ),
  users: (
    <g>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </g>
  ),
  code: <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
  mic: (
    <g>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M9 21h6" />
    </g>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  more: (
    <g>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </g>
  ),
  send: <path d="m22 2-7 20-4-9-9-4 20-7z" />,
  key: (
    <g>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
    </g>
  ),
  share: (
    <g>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </g>
  ),
  paperclip: (
    <path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7L9.5 17.4a2 2 0 1 1-2.9-2.9l8.5-8.5" />
  ),
  settings: (
    <g>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </g>
  ),
  /* Browser-extension puzzle piece. */
  puzzle: (
    <path d="M14 4a2 2 0 1 1 4 0v3h3a1 1 0 0 1 1 1v4h-3a2 2 0 1 0 0 4h3v4a1 1 0 0 1-1 1h-4v-3a2 2 0 1 0-4 0v3H8a1 1 0 0 1-1-1v-4H4a2 2 0 1 1 0-4h3V8a1 1 0 0 1 1-1h3V4z" />
  ),
  /* Stylised cube — used for the Models catalog. */
  cube: (
    <g>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3z" />
      <path d="M3 7.5v9L12 21" />
      <path d="M12 21V12" />
      <path d="M21 7.5v9L12 21" />
    </g>
  ),
  /* Lightning bolt — Updates / changelog signal. */
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  "alert-triangle": (
    <g>
      <path d="M10.3 3.7 2 19a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 19L13.7 3.7a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17v.01" />
    </g>
  ),
  /* Panel / sidebar toggle — rectangle with the left rail highlighted. */
  sidebar: (
    <g>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </g>
  ),
  /* Door with exit arrow — signs the user out. */
  "log-out": (
    <g>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </g>
  ),
  /* Vertical phone-shaped frame with a play triangle — short-form
     vertical video (Reels, Shorts, TikToks). */
  reel: (
    <g>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="m11 9 4 3-4 3z" />
    </g>
  ),
  /* Pushpin — pin/unpin a collection so it floats to the top of the grid. */
  pin: (
    <g>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </g>
  ),
  /* Brand marks — Facebook "f", Instagram camera, YouTube play rectangle.
     Drawn as filled silhouettes (fill="currentColor", stroke="none")
     so they stay recognizable at chip sizes where stroked outlines
     would lose the brand reading. fillRule="evenodd" lets the inner
     sub-paths punch holes (camera body, lens ring, play triangle). */
  facebook: (
    <path
      fill="currentColor"
      stroke="none"
      d="M13.5 9V7.5A.5.5 0 0 1 14 7h2.5V4H14a3.5 3.5 0 0 0-3.5 3.5V9H8v3h2.5v9h3v-9H16l.5-3z"
    />
  ),
  instagram: (
    <g fill="currentColor" stroke="none" fillRule="evenodd">
      <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
      <circle cx="17.5" cy="6.5" r="1" />
    </g>
  ),
  youtube: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M21.6 7.2a2.5 2.5 0 0 0-1.75-1.77C18.31 5 12 5 12 5s-6.31 0-7.85.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.75 1.77C5.69 19 12 19 12 19s6.31 0 7.85-.43A2.5 2.5 0 0 0 21.6 16.8 26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15.5v-7l6 3.5z"
    />
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

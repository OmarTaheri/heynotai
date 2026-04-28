import type { ReactElement, SVGProps } from 'react';

export type IconName =
  | 'info' | 'chevron-right' | 'chevron-left' | 'arrow-left' | 'check' | 'refresh' | 'filter' | 'plus'
  | 'text' | 'image' | 'audio' | 'video'
  | 'globe' | 'sparkle' | 'bell' | 'shield' | 'lock' | 'log-out'
  | 'sun' | 'moon' | 'pause' | 'activity' | 'layers' | 'user' | 'bolt' | 'home'
  | 'facebook' | 'youtube' | 'instagram' | 'settings' | 'trash';

const PATHS: Record<IconName, ReactElement> = {
  info:            <g><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></g>,
  'chevron-right': <path d="M9 6l6 6-6 6"/>,
  'chevron-left':  <path d="M15 6l-6 6 6 6"/>,
  'arrow-left':    <g><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></g>,
  check:           <path d="M4 12l5 5 11-11"/>,
  refresh:         <g><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></g>,
  filter:          <path d="M4 4h16l-6 8v7l-4-2v-5z"/>,
  plus:            <path d="M12 5v14M5 12h14"/>,
  text:            <path d="M4 6h16M4 12h10M4 18h16"/>,
  image:           <g><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></g>,
  audio:           <g><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></g>,
  video:           <g><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></g>,
  globe:           <g><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></g>,
  sparkle:         <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>,
  bell:            <g><path d="M18 16V11a6 6 0 1 0-12 0v5l-2 2h16z"/><path d="M10 20a2 2 0 0 0 4 0"/></g>,
  shield:          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>,
  lock:            <g><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></g>,
  'log-out':       <g><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></g>,
  sun:             <g><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g>,
  moon:            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>,
  pause:           <g><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></g>,
  activity:        <path d="M3 12h4l3-8 4 16 3-8h4"/>,
  layers:          <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5"/>,
  user:            <g><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></g>,
  bolt:            <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
  home:            <g><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></g>,
  facebook:        <path d="M22 12a10 10 0 1 0-11.56 9.88V14.9H8v-2.9h2.44V9.9c0-2.4 1.43-3.72 3.62-3.72 1.05 0 2.15.18 2.15.18v2.37h-1.21c-1.2 0-1.56.74-1.56 1.5v1.8h2.66l-.43 2.9H13.44v6.98A10 10 0 0 0 22 12z" fill="currentColor" stroke="none"/>,
  youtube:         <g><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/></g>,
  instagram:       <g><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></g>,
  settings:        <g><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>,
  trash:           <g><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4h6v3"/></g>,
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
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
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

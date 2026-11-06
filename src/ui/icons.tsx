import { ReactNode } from "react";

export type IconName =
  | "gauge" | "box" | "image" | "database" | "sliders" | "play" | "stop" | "restart"
  | "cluster" | "check" | "alert" | "network" | "logs" | "trash" | "search" | "download" | "close" | "info" | "copy" | "folder" | "sidebar" | "plus" | "chevron" | "tick" | "terminal" | "more" | "finder" | "hammer"
  | "chevron-right" | "external-link" | "link" | "rotate-ccw" | "send" | "pause" | "stop-circle" | "trash-2"
  | "chevron-left" | "loader" | "send-icon" | "pause-icon" | "play-icon"
  | "pause" | "loader2" | "chevron-left-icon";

const PATHS: Record<IconName, ReactNode> = {
  gauge: <><path d="M12 14l4-4" /><path d="M3.3 17a9 9 0 1 1 17.4 0" /></>,
  box: <><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  play: <path d="M7 5l12 7-12 7V5z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  restart: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>,
  alert: <><path d="M12 3.5l9.5 16.5h-19L12 3.5z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  cluster: <><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9L12 3z" /><circle cx="12" cy="12" r="2.5" /></>,
  network: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5v4M12 11.5L6.5 17M12 11.5l5.5 5.5" /></>,
  logs: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="M7 10l5 5 5-5" />,
  terminal: <><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M7 10l3 2.5L7 15M12.5 15H17" /></>,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  more: <><circle cx="6" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18" cy="12" r="1.3" fill="currentColor" /></>,
  hammer: <><path d="M14 6l4 4M4 20l9-9M12 4l2 2 3-1 3 3-1 3 2 2-2 2-8-8 1-3z" /></>,
  finder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /><path d="M12 13h5M14.5 10.5L17 13l-2.5 2.5" /></>,
  "chevron-left": <path d="M15 18l-6-6 6-6" />,
  "loader": <circle cx="12" cy="12" r="10" strokeWidth="3" strokeLinecap="round" strokeDasharray="56" pathLength="1" />,
  "send-icon": <path d="M22 2L11 13 M22 2l-7 20-4-9-9-8 20 4" />,
  "pause-icon": <g><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></g>,
  "play-icon": <path d="M8 5l11 7-11 7V5z" />,
  "pause": <g><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></g>,
  "loader2": <circle cx="12" cy="12" r="10" strokeWidth="3" strokeLinecap="round" strokeDasharray="56" pathLength="1" />,
  "chevron-left-icon": <path d="M15 18l-6-6 6-6" />,
  "link": <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
  "chevron-right": <path d="M9 18l6-6-6-6" />,
  "external-link": <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3" />,
  "rotate-ccw": <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5" />,
  "send": <path d="M22 2L11 13 M22 2l-7 20-4-9-9-8 20 4" />,
  "stop-circle": <g><circle cx="12" cy="12" r="10" /><rect x="9" y="9" width="6" height="6" /></g>,
  "trash-2": <path d="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
};

export function Icon({ name, size = 16, className = "", style, ...props }: { name: IconName; size?: number; className?: string; style?: React.CSSProperties } & React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style} {...props}>
      {PATHS[name]}
    </svg>
  );
}

// New createIcon approach for more complex icons
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function createIcon(path: string) {
  return function Icon({ size = 16, className, ...props }: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        <path d={path} />
      </svg>
    );
  };
}

// Additional icons using createIcon
export const FolderGit2 = createIcon(
  'M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z M12 12h6 M15 9h3 M15 15h3'
);

export const FolderOpen = createIcon(
  'M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5.707a2 2 0 0 0-.59-1.41L12.29 2.29A2 2 0 0 0 11 2H6z M8 14H6 M18 14H6'
);

export const Search = createIcon(
  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
);

export const Plus = createIcon(
  'M12 5v14M5 12h14'
);

export const ChevronRight = createIcon(
  'M9 18l6-6-6-6'
);

export const Play = createIcon(
  'M5 3l14 9-14 9z'
);

export const Stop = createIcon(
  'M5 3h14v18H5z'
);

export const RotateCcw = createIcon(
  'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5'
);

export const Terminal = createIcon(
  'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01'
);

export const ExternalLink = createIcon(
  'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3'
);

export const Download = createIcon(
  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M5 20h14'
);

export const Trash2 = createIcon(
  'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
);

export const RefreshCw = createIcon(
  'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M21 12a9 9 0 1 1-9 9c2.52 0 4.93-1 6.74-2.74L21 8'
);

export const X = createIcon(
  'M18 6L6 18 M6 6l12 12'
);

export const CheckCircle2 = createIcon(
  'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3'
);

export const AlertTriangle = createIcon(
  'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01'
);

export const Activity = createIcon(
  'M22 12h-4l-3 9L9 3l-3 9H2'
);

export const Settings = createIcon(
  'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'
);

export const Server = createIcon(
  'M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6z M6 6h12 M6 10h12 M6 14h12 M6 18h12'
);

export const Database = createIcon(
  'M4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6 M4 6l8 4 8-4 M8 10l8 4 8-4 M4 10l8 4 8-4 M4 14l8 4 8-4'
);

export const Network = createIcon(
  'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z M12 6v6l4 2'
);

export const Link2 = createIcon(
  'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
);

export const AlertCircle = createIcon(
  'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z M12 8v4 M12 16h.01'
);

export const Pause = createIcon(
  'M6 4h4v16H6V4zm8 0h4v16h-4V4z'
);

export const Loader2 = createIcon(
  'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z'
);

export const ChevronLeft = createIcon(
  'M15 18l-6-6 6-6'
);

export const SendIcon = createIcon(
  'M22 2L11 13 M22 2l-7 20-4-9-9-8 20 4'
);

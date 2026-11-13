import {
  Search, Plus, Ellipsis, ChevronDown, ChevronRight, X, Copy, Check, CircleAlert, TriangleAlert, Info,
  Download, Play, Square, RotateCw, Trash2, ExternalLink, Folder, Box, Image, Database, Network, Hexagon,
  Activity, SlidersHorizontal, PanelLeft, Terminal, ScrollText, RefreshCw, Command, ChevronLeft,
  SquareTerminal, CircleHelp, ChevronsUpDown, ChevronUp, type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

export type IconName =
  | "search" | "plus" | "more" | "chev-down" | "chev-right" | "close" | "copy" | "check" | "error" | "alert" | "info"
  | "download" | "play" | "stop" | "restart" | "trash" | "external" | "folder" | "box" | "image" | "database" | "network"
  | "cluster" | "doctor" | "settings" | "sidebar" | "terminal" | "logs" | "refresh" | "command"
  | "back" | "activity" | "help" | "updown" | "chev-up";

const ICONS: Record<IconName, LucideIcon> = {
  search: Search,
  plus: Plus,
  more: Ellipsis,
  "chev-down": ChevronDown,
  "chev-right": ChevronRight,
  close: X,
  copy: Copy,
  check: Check,
  error: CircleAlert,
  alert: TriangleAlert,
  info: Info,
  download: Download,
  play: Play,
  stop: Square,
  restart: RotateCw,
  trash: Trash2,
  external: ExternalLink,
  folder: Folder,
  box: Box,
  image: Image,
  database: Database,
  network: Network,
  cluster: Hexagon,
  doctor: Activity,
  settings: SlidersHorizontal,
  sidebar: PanelLeft,
  terminal: Terminal,
  logs: ScrollText,
  refresh: RefreshCw,
  command: Command,
  back: ChevronLeft,
  activity: SquareTerminal,
  help: CircleHelp,
  updown: ChevronsUpDown,
  "chev-up": ChevronUp,
};

export function Icon({ name, size, className, ...rest }: { name: IconName; size?: "sm" | "md"; className?: string } & React.SVGProps<SVGSVGElement>): React.JSX.Element {
  const Component = ICONS[name];
  return <Component className={clsx("icon", size === "sm" && "sm", className)} aria-hidden="true" {...rest} />;
}

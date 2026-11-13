export type ShortcutId =
  | "palette" | "go-projects" | "go-containers" | "go-images" | "go-volumes" | "go-networks" | "go-kubernetes"
  | "go-doctor" | "go-settings" | "engine" | "fold" | "run" | "pull" | "search" | "search-slash"
  | "back" | "forward" | "refresh" | "help";

export type ShortcutDef = {
  id: ShortcutId;
  key: string;          // as KeyboardEvent.key
  meta?: boolean;       // Cmd
  shift?: boolean;
  label: string;        // the words in Help and in the palette
  group: "Go to" | "Do" | "Page";
  pending?: boolean;    // true until the screen exists; a pending shortcut is not registered and not shown
};

export const SHORTCUTS: ShortcutDef[] = [
  { id: "palette", key: "k", meta: true, label: "Command palette", group: "Do" },
  { id: "go-projects", key: "1", meta: true, label: "Projects", group: "Go to", pending: true }, // WO-7.5 removes `pending`
  { id: "go-containers", key: "2", meta: true, label: "Containers", group: "Go to" },
  { id: "go-images", key: "3", meta: true, label: "Images", group: "Go to" },
  { id: "go-volumes", key: "4", meta: true, label: "Volumes", group: "Go to" },
  { id: "go-networks", key: "5", meta: true, label: "Networks", group: "Go to" },
  { id: "go-kubernetes", key: "6", meta: true, label: "Kubernetes", group: "Go to" },
  { id: "go-doctor", key: "d", meta: true, label: "Doctor", group: "Go to" },
  { id: "go-settings", key: ",", meta: true, label: "Settings", group: "Go to" },
  { id: "engine", key: "e", meta: true, label: "Engine switcher", group: "Do" },
  { id: "fold", key: "b", meta: true, label: "Fold sidebar", group: "Do" },
  { id: "run", key: "n", meta: true, label: "Run an image", group: "Do" },
  { id: "pull", key: "p", meta: true, label: "Pull an image", group: "Do" },
  { id: "search", key: "f", meta: true, label: "Search this page", group: "Page" },
  { id: "search-slash", key: "/", label: "Search this page", group: "Page" },
  { id: "back", key: "[", meta: true, label: "Back", group: "Page" },
  { id: "forward", key: "]", meta: true, label: "Forward", group: "Page" },
  { id: "refresh", key: "r", meta: true, label: "Refresh this page", group: "Page" },
  { id: "help", key: "?", label: "Help and shortcuts", group: "Do" },
];

// List keys are handled by the list itself (WO-3.1b). They are shown in Help only.
export const LIST_KEYS: { keys: string; label: string }[] = [
  { keys: "↑ ↓", label: "Move in a list" },
  { keys: "↵", label: "Open the row" },
  { keys: "Space", label: "Select the row" },
  { keys: "← →", label: "Fold or unfold a group" },
  { keys: "Esc", label: "Close the top layer, else clear the selection, else clear the search" },
];

export const activeShortcuts = () => SHORTCUTS.filter((s) => !s.pending);

// "⌘K", "⌘,", "/" ; used by Help and the palette.
export function showKeys(s: Pick<ShortcutDef, "key" | "meta" | "shift">): string {
  const key = s.key.length === 1 ? s.key.toUpperCase() : s.key;
  return `${s.meta ? "⌘" : ""}${s.shift ? "⇧" : ""}${key}`;
}

// A key typed in a text field is never a shortcut (only Cmd combinations are).
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

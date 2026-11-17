import { useCallback, useMemo } from "react";
import { Sheet, GroupCaption, Button } from "./ui/op";
import { ShortcutId, SHORTCUTS, activeShortcuts, showKeys, LIST_KEYS } from "./lib/shortcuts";
import { REPO_URL } from "./lib/links";
import { openUrl } from "./api";

type HelpModalProps = { open: boolean; onClose: () => void };

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const groups = useMemoGroups();
  const onDocs = useCallback(() => void openUrl(`${REPO_URL}#readme`), []);
  const onFeedback = useCallback(() => void openUrl(`${REPO_URL}/discussions`), []);

  if (!open) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Help and shortcuts" footer={
      <>
        <Button variant="ghost" onClick={onDocs}>Docs</Button>
        <Button variant="ghost" onClick={onFeedback}>Give feedback</Button>
      </>
    }>
      {groups.map((g) => (
        <div key={g.group} className="flex flex-col gap-4">
          <GroupCaption>{g.group}</GroupCaption>
          {g.items.map((s) => (
            <div key={s.id} className="row">
              <span className="name">{s.label}</span>
              <span className="grow" />
              <span className="inline-flex min-w-5 items-center justify-center rounded-xs border border-edge bg-tile px-1.5 font-mono text-micro text-fg-muted">{showKeys(s)}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="flex flex-col gap-4">
        <GroupCaption>List</GroupCaption>
        {LIST_KEYS.map((l) => (
          <div key={l.keys} className="row">
            <span className="name">{l.label}</span>
            <span className="grow" />
            <span className="inline-flex min-w-5 items-center justify-center rounded-xs border border-edge bg-tile px-1.5 font-mono text-micro text-fg-muted">{l.keys}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function useMemoGroups() {
  const byGroup: Record<string, ShortcutId[]> = { "Go to": [], "Do": [], "Page": [] };
  for (const s of activeShortcuts()) byGroup[s.group].push(s.id);
  return [
    { group: "Go to", items: byGroup["Go to"].map((id) => SHORTCUTS.find((s) => s.id === id)!) },
    { group: "Do", items: byGroup["Do"].map((id) => SHORTCUTS.find((s) => s.id === id)!) },
    { group: "Page", items: byGroup["Page"].map((id) => SHORTCUTS.find((s) => s.id === id)!) },
  ].filter((g) => g.items.length);
}

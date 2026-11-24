import { useState, useEffect, useMemo, useCallback } from "react";
import { Palette, type PaletteEntry, type PaletteSection } from "./ui/op/Palette";
import { rank, flat, pushRecent, type PaletteItem } from "./lib/paletteModel";
import { REPO_URL } from "./lib/links";
import { openUrl } from "./api";

type CommandPaletteProps = { open: boolean; onClose: () => void; items: PaletteItem[] };

export default function CommandPalette({ open, onClose, items }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [recentRaw] = useState(() => { try { return JSON.parse(localStorage.getItem("container-ui:recent-actions") ?? "[]"); } catch { return []; } });
  const recent = Array.isArray(recentRaw) ? recentRaw.filter((x: unknown) => typeof x === "string") as string[] : [];

  const sections = useMemo(() => rank(query, items, recent), [query, items, recent]);

  const handleRun = useCallback((id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const next = pushRecent(recent, id);
    try { localStorage.setItem("container-ui:recent-actions", JSON.stringify(next)); } catch { /* not remembered */ }
    onClose();
    item.run();
  }, [items, recent, onClose]);

  const paletteSections: PaletteSection[] = useMemo(() => sections.map((s) => ({
    group: s.group,
    items: s.items.map((i): PaletteEntry => ({
      id: i.id,
      label: i.label,
      hint: i.hint,
      dot: i.dot,
      kbd: i.kbd,
      enter: i.group === "Containers" ? "↵ Open" : undefined,
    })),
  })), [sections]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <Palette
      open={open}
      onClose={onClose}
      query={query}
      onQuery={setQuery}
      sections={paletteSections}
      onRun={handleRun}
    />
  );
}

import { useState, FormEvent, useId, useEffect } from "react";
import { Dialog } from "@/ui/components/Dialog";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Label } from "@/ui/Label";
import { Plus, FolderOpen, Loader2 } from "@/ui/icons";
import { invoke } from "@tauri-apps/api/core";
import { CreateProjectInput } from "@/shared/types/project";
import { FocusTrap } from "@/ui/components/FocusTrap";

interface CreateProjectDialogProps {
  onSubmit: (input: CreateProjectInput) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ onSubmit, onOpenChange }: CreateProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  const pathInputId = useId();
  const nameInputId = useId();

  const handleSelectPath = async () => {
    setSelecting(true);
    setError("");
    try {
      const selected = await invoke<string>("dialog_open", {
        options: { title: "Select Project Directory", directory: true, multiple: false },
      });
      if (selected) {
        setPath(selected);
        const folderName = selected.split("/").pop() || selected.split("\\").pop() || "";
        setName(folderName);
      }
    } catch (e) {
      if ((e as Error).message !== "cancelled") {
        setError("Failed to select folder");
      }
    } finally {
      setSelecting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!path) {
      setError("Please select a project directory");
      return;
    }
    setError("");
    try {
      await onSubmit({ path, name: name || undefined });
      setIsOpen(false);
      onOpenChange(false);
      setPath("");
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    }
  };

  return (
    <FocusTrap enabled={isOpen} onEscape={() => { setIsOpen(false); onOpenChange(false); }}>
      <Dialog
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); onOpenChange(false); }}
        title="Add Project"
        description="Select a directory to create a new project from"
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-2">
            {error && (
              <div className="text-sm text-[var(--color-brand-danger)] p-3 bg-[var(--color-brand-danger)]/10 rounded-lg" role="alert">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor={pathInputId}>Project Path</Label>
              <div className="flex gap-2">
                <Input
                  id={pathInputId}
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/path/to/project"
                  disabled={selecting}
                  className="flex-1"
                  error={error && !path ? "Please select a directory" : undefined}
                  required
                  aria-describedby={error && !path ? `${pathInputId}-error` : undefined}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectPath}
                  disabled={selecting}
                  aria-label="Browse for folder"
                  aria-busy={selecting}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                >
                  {selecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FolderOpen className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={nameInputId}>Name (optional)</Label>
              <Input
                id={nameInputId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-detected from folder name"
                disabled={selecting}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => { setIsOpen(false); onOpenChange(false); }} disabled={selecting} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded">
              Cancel
            </Button>
            <Button type="submit" disabled={!path || selecting} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded">
              {selecting ? "Selecting..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Dialog>
    </FocusTrap>
  );
}
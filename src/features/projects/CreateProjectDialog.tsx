import { useState, FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/ui/Dialog";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Label } from "@/ui/Label";
import { Plus, FolderOpen } from "@/ui/icons";
import { invoke } from "@tauri-apps/api/core";
import { CreateProjectInput } from "@/shared/types/project";

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
      setPath("");
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {error && (
              <div className="text-sm text-[var(--color-brand-danger)] p-3 bg-[var(--color-brand-danger)]/10 rounded-lg" role="alert">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="path">Project Path</Label>
              <div className="flex gap-2">
                <Input
                  id="path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/path/to/project"
                  disabled={selecting}
                  className="flex-1"
                  error={error && !path ? "Please select a directory" : undefined}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectPath}
                  disabled={selecting}
                  aria-label="Browse for folder"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-detected from folder name"
                disabled={selecting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={selecting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!path || selecting}>
              {selecting ? "Selecting..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
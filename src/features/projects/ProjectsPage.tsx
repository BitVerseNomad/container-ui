import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { projectsApi } from "@/lib/projectsApi";
import { detectProjectConfig, DevContainerSpec, ComposeSpec } from "@/lib/projectDetection";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ProjectTerminal } from "./ProjectTerminal";
import { ProjectLogs } from "./ProjectLogs";
import { ProjectPorts } from "./ProjectPorts";
import { ProjectDetail } from "./ProjectDetail";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Badge } from "@/ui/Badge";
import { Spinner } from "@/ui/Spinner";
import { Plus, RefreshCw, FolderOpen, Search, ChevronLeft, Stop, RotateCcw, Play, Terminal, ExternalLink, Download, Trash2, ChevronRight } from "@/ui/icons";
import { cn } from "@/lib/cn";
import type { Project } from "@/shared/types/project";
import type { Environment } from "@/shared/types/environment";

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailView, setDetailView] = useState(false);

  const { data: projects, isLoading, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: (input: { path: string; name?: string }) => projectsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setCreateOpen(false);
    },
    onError: (error) => {
      console.error("Create project failed:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const handleCreate = async (input: { path: string; name?: string }) => {
    await createMutation.mutateAsync(input);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this project? This will also remove its environment.")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSelect = (project: Project) => {
    setSelectedProject(project);
    setDetailView(true);
  };

  if (detailView && selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setDetailView(false)}
        onRefresh={refetch}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-[var(--color-fg-tertiary)]">Manage your containerized development environments</p>
        </div>
        <div className="flex items-center gap-2">
          <CreateProjectDialog onSubmit={handleCreate} onOpenChange={setCreateOpen} />
          <Button variant="outline" onClick={() => refetch()} disabled={createMutation.isPending}>
            <RefreshCw className={cn("h-4 w-4 mr-1", createMutation.isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading && !projects && (
          <div className="flex items-center justify-center h-64">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-[var(--color-brand-danger)]">
            Failed to load projects: {error instanceof Error ? error.message : "Unknown error"}
            <Button variant="outline" size="sm" className="ml-2" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          </div>
        )}

        {projects && projects.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <div className="mx-auto mb-4 p-3 bg-[var(--color-bg-tertiary)] rounded-full w-16 h-16 flex items-center justify-center">
              <FolderOpen className="h-8 w-8 text-[var(--color-fg-tertiary)]" />
            </div>
            <h2 className="text-lg font-medium text-[var(--color-fg-secondary)] mb-2">No projects yet</h2>
            <p className="text-[var(--color-fg-tertiary)] mb-6">Create your first project to get started with containerized development environments.</p>
            <CreateProjectDialog onSubmit={handleCreate} onOpenChange={setCreateOpen} />
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
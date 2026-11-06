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
import { ProjectCardSkeleton } from "@/ui/Skeleton";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { useToast } from "@/ui/components/Toast";
import { Plus, RefreshCw, FolderOpen, Search, ChevronLeft, Stop, RotateCcw, Play, Terminal, ExternalLink, Download, Trash2, ChevronRight, AlertTriangle, Home } from "@/ui/icons";
import { cn } from "@/lib/cn";
import type { Project } from "@/shared/types/project";
import type { Environment } from "@/shared/types/environment";

function ProjectsPageContent() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
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
      success("Project created", "Your new project has been added successfully.");
    },
    onError: (error) => {
      console.error("Create project failed:", error);
      toastError("Failed to create project", error instanceof Error ? error.message : "Unknown error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      success("Project deleted", "The project has been removed.");
    },
    onError: (error) => {
      toastError("Failed to delete project", error instanceof Error ? error.message : "Unknown error");
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
      <ErrorBoundary
        fallback={<ProjectDetailErrorFallback error={new Error("Failed to load project detail")} resetErrorBoundary={() => setDetailView(false)} />}
        resetKeys={[selectedProject.id]}
      >
        <ProjectDetail
          project={selectedProject}
          onBack={() => setDetailView(false)}
          onRefresh={refetch}
        />
      </ErrorBoundary>
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
          <Button variant="outline" onClick={() => refetch()} disabled={createMutation.isPending} aria-label="Refresh projects list">
            <RefreshCw className={cn("h-4 w-4 mr-1", createMutation.isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading && !projects && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Loading projects">
            {Array.from({ length: 8 }, (_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-[var(--color-brand-danger)]" role="alert">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list" aria-label="Projects">
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

function ProjectDetailErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 pb-6 px-6 text-center">
          <div className="mx-auto mb-4 p-3 bg-[var(--color-brand-danger)]/10 rounded-full w-16 h-16 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-[var(--color-brand-danger)]" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Failed to load project</h2>
          <p className="text-[var(--color-fg-secondary)] text-sm mb-6">
            {error.message || "An unexpected error occurred while loading the project details."}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={resetErrorBoundary}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
            <Button onClick={resetErrorBoundary}>
              <Home className="h-4 w-4 mr-1" />
              Back to Projects
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProjectsPage() {
  return <ProjectsPageContent />;
}
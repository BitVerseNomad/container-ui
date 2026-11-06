import { memo } from "react";
import { Project } from "@/shared/types/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { FolderGit2, Search, ChevronRight, GitBranch } from "@/ui/icons";
import { cn } from "@/lib/cn";

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
  onSelect: (project: Project) => void;
}

const ProjectCardComponent = memo(function ProjectCard({ project, onDelete, onSelect }: ProjectCardProps) {
  const hasEnv = !!project.devEnvironment;
  const envState = project.devEnvironment?.state;
  const isRunning = envState === "running";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(project);
    }
  };

  return (
    <article className="group">
      <Card
        variant="default"
        className={cn(
          "group transition-all duration-200 hover:shadow-[var(--color-shadow-lg)] cursor-pointer p-0",
          "focus-within:ring-2 focus-within:ring-[var(--color-brand-primary)] focus-within:ring-offset-2"
        )}
        onClick={() => onSelect(project)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Open project ${project.name}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 p-2 bg-[var(--color-brand-primary-light)] rounded-lg text-[var(--color-brand-primary)]" aria-hidden="true">
                <FolderGit2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{project.name}</CardTitle>
                <p className="text-xs text-[var(--color-fg-tertiary)] truncate max-w-[250px]">{project.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {project.gitInfo?.currentBranch && (
                <Badge variant="outline" size="sm" className="gap-1" aria-label={`Git branch: ${project.gitInfo.currentBranch}`}>
                  <GitBranch className="h-2.5 w-2.5" aria-hidden="true" />
                  <span className="text-xs truncate max-w-[100px]">{project.gitInfo.currentBranch}</span>
                </Badge>
              )}
              {hasEnv && (
                <Badge
                  variant={isRunning ? "success" : envState === "error" ? "danger" : "default"}
                  size="sm"
                  dot
                  aria-label={`Environment: ${envState}`}
                >
                  {envState}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-[var(--color-fg-tertiary)] min-w-0">
              {project.gitInfo?.remoteUrl && (
                <span className="truncate max-w-[180px] flex items-center gap-1" title={project.gitInfo.remoteUrl}>
                  <span className="hidden sm:inline truncate">{project.gitInfo.remoteUrl}</span>
                </span>
              )}
              {project.gitInfo?.hasUncommittedChanges && (
                <Badge variant="warning" size="sm" className="gap-1" aria-label="Uncommitted changes">
                  <span className="text-xs">Uncommitted</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(project);
                }}
                aria-label={`Open ${project.name}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </article>
  );
});

ProjectCardComponent.displayName = "ProjectCard";

export const ProjectCard = ProjectCardComponent;
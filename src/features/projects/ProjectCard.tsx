import { Project } from "@/shared/types/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { FolderGit2, Play, Stop, Terminal, Search, ChevronRight } from "@/ui/icons";
import { cn } from "@/lib/cn";

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
  onSelect: (project: Project) => void;
}

export function ProjectCard({ project, onDelete, onSelect }: ProjectCardProps) {
  const hasEnv = !!project.devEnvironment;
  const envState = project.devEnvironment?.state;
  const isRunning = envState === "running";

  return (
    <Card
      variant="default"
      className={cn("group transition-all duration-200 hover:shadow-[var(--color-shadow-lg)] cursor-pointer", "p-0")}
      onClick={() => onSelect(project)}
    >
      <CardHeader>
        <div className="flex items-start justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-brand-primary-light)] rounded-lg text-[var(--color-brand-primary)]">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <p className="text-xs text-[var(--color-fg-tertiary)] truncate max-w-[250px]">{project.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {project.gitInfo?.currentBranch && (
              <Badge variant="outline" size="sm" className="gap-1">
                <Search className="h-2.5 w-2.5" />
                <span className="text-xs">{project.gitInfo.currentBranch}</span>
              </Badge>
            )}
            {hasEnv && (
              <Badge
                variant={isRunning ? "success" : envState === "error" ? "danger" : "default"}
                size="sm"
                dot
              >
                {envState}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-[var(--color-fg-tertiary)]">
            {project.gitInfo?.remoteUrl && (
              <span className="truncate max-w-[180px] flex items-center gap-1">
                <span className="hidden sm:inline">{project.gitInfo.remoteUrl}</span>
              </span>
            )}
            {project.gitInfo?.hasUncommittedChanges && (
              <Badge variant="warning" size="sm" className="gap-1">
                <span className="text-xs">Uncommitted</span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onSelect(project); }} aria-label="Open project">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
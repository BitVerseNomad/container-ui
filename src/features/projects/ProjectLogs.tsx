import { useEffect, useState, useCallback, useMemo, useRef, useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Button } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { Input } from "@/ui/Input";
import { X, Trash2, Pause, Play, Search, Settings, Download, ChevronRight, FileText } from "@/ui/icons";
import { cn } from "@/lib/cn";
import { projectsApi } from "@/lib/projectsApi";
import { FocusTrap } from "@/ui/components/FocusTrap";
import { LogsSkeleton } from "@/ui/Skeleton";
import type { LogLine } from "@/shared/types/environment";

interface ProjectLogsProps {
  environmentId: string;
  onClose: () => void;
}

const STORAGE_KEY = "project-logs-";
const MAX_STORED_LOGS = 5000;
const VIRTUALIZATION_THRESHOLD = 1000;

type LogStream = "all" | "stdout" | "stderr" | "system";

export function ProjectLogs({ environmentId, onClose }: ProjectLogsProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [filterStream, setFilterStream] = useState<LogStream>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [virtualized, setVirtualized] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [itemHeight, setItemHeight] = useState(22);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const logsTitleId = useId();
  const logsStatusId = useId();
  const searchInputId = useId();
  const firstItemRef = useRef<HTMLDivElement>(null);

  // Measure actual line height for virtualization
  useEffect(() => {
    if (firstItemRef.current) {
      const h = firstItemRef.current.getBoundingClientRect().height;
      setItemHeight(Math.max(22, Math.ceil(h)));
    }
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterStream !== "all" && log.stream !== filterStream) return false;
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        return log.content.toLowerCase().includes(query);
      }
      return true;
    });
  }, [logs, filterStream, debouncedSearch]);

  // Load persisted logs from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`${STORAGE_KEY}${environmentId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setLogs(parsed.slice(-MAX_STORED_LOGS));
        }
      }
    } catch (e) {
      console.warn("Failed to load persisted logs:", e);
    }
    setIsInitialized(true);
  }, [environmentId]);

  // Persist logs to sessionStorage
  useEffect(() => {
    if (logs.length > 0) {
      try {
        sessionStorage.setItem(
          `${STORAGE_KEY}${environmentId}`,
          JSON.stringify(logs.slice(-MAX_STORED_LOGS))
        );
      } catch (e) {
        console.warn("Failed to persist logs:", e);
      }
    }
  }, [logs, environmentId]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Determine if we should virtualize
  useEffect(() => {
    setVirtualized(filteredLogs.length > VIRTUALIZATION_THRESHOLD);
  }, [filteredLogs.length]);

  const subscribeLogs = useMutation({
    mutationFn: async (id: string) => {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen<LogLine>(
        `project-env-logs-${id}`,
        (e) => {
          if (!paused) {
            setLogs((prev) => {
              const next = [...prev, e.payload];
              if (next.length > MAX_STORED_LOGS) {
                return next.slice(-MAX_STORED_LOGS);
              }
              return next;
            });
          }
        }
      );
      return unlisten;
    },
    onSuccess: (unlisten) => {
      unlistenRef.current = unlisten;
    },
    onError: (error) => {
      console.error("Failed to subscribe to logs:", error);
    },
  });

  useEffect(() => {
    subscribeLogs.mutate(environmentId);
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [environmentId, subscribeLogs]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    sessionStorage.removeItem(`${STORAGE_KEY}${environmentId}`);
  }, [environmentId]);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const exportLogs = useCallback(() => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp}] [${log.stream}] ${log.content}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${environmentId}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs, environmentId]);

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStreamColor = (stream: string) => {
    switch (stream) {
      case "stderr": return "text-red-400";
      case "system": return "text-yellow-400";
      default: return "text-green-300";
    }
  };

  const getStreamBadge = (stream: string) => {
    switch (stream) {
      case "stderr": return "text-red-400 bg-red-500/10";
      case "system": return "text-yellow-400 bg-yellow-500/10";
      default: return "text-green-400 bg-green-500/10";
    }
  };

  // Virtualized rendering
  const visibleItems = useMemo(() => {
    if (!virtualized || !listRef.current) return filteredLogs;

    const container = listRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 10);
    const endIndex = Math.min(
      filteredLogs.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + 10
    );

    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, virtualized, itemHeight]);

  const totalHeight = virtualized ? filteredLogs.length * itemHeight : undefined;
  const offsetY = virtualized && listRef.current
    ? Math.max(0, Math.floor(listRef.current.scrollTop / itemHeight) - 10) * itemHeight
    : 0;

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!isInitialized) {
    return <LogsSkeleton />;
  }

  return (
    <FocusTrap enabled={true} onEscape={onClose}>
      <Card
        className="fixed inset-0 z-50 flex flex-col m-4 max-h-[90vh] max-w-[90vw] sm:max-h-[80vh] sm:max-w-[80vw]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={logsTitleId}
        aria-describedby={logsStatusId}
      >
        <CardHeader className="flex flex-row items-center justify-between p-3">
          <CardTitle id={logsTitleId} className="flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Logs
            <Badge variant={paused ? "default" : "success"} size="sm" aria-live="polite" id={logsStatusId}>
              {paused ? "Paused" : "Live"}
            </Badge>
            {debouncedSearch && (
              <Badge variant="outline" size="sm" className="ml-1" aria-label={`${filteredLogs.length} search matches`}>
                {filteredLogs.length} matches
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePause}
              aria-label={paused ? "Resume log streaming" : "Pause log streaming"}
              aria-pressed={paused}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
            >
              {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearLogs}
              aria-label="Clear all logs"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={exportLogs}
              aria-label="Export logs to file"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close logs"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>

        <div className="border-b p-3 bg-[var(--color-bg-primary)] flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-fg-tertiary)]" aria-hidden="true" />
            <Input
              id={searchInputId}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="pl-10 bg-[var(--color-bg-tertiary)]"
              aria-label="Search logs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                showFilters && "bg-[var(--color-brand-primary)] text-[var(--color-brand-primary-foreground)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
              )}
              aria-expanded={showFilters}
              aria-controls="log-stream-filters"
            >
              <Settings className="h-4 w-4 mr-1" aria-hidden="true" />
              Streams
              <ChevronRight className={cn("h-3 w-3 ml-1", showFilters && "rotate-90")} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div id="log-stream-filters" className="border-b p-3 bg-[var(--color-bg-primary)] flex flex-wrap items-center gap-2" role="group" aria-label="Log stream filters">
            <span className="text-sm text-[var(--color-fg-secondary)]">Show:</span>
            {(["all", "stdout", "stderr", "system"] as LogStream[]).map((stream) => (
              <Button
                key={stream}
                variant={filterStream === stream ? "primary" : "outline"}
                size="sm"
                onClick={() => setFilterStream(stream)}
                className={cn(
                  filterStream === stream && stream !== "all" && getStreamBadge(stream),
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                )}
                aria-pressed={filterStream === stream}
              >
                {stream === "all" ? "All" : stream.charAt(0).toUpperCase() + stream.slice(1)}
              </Button>
            ))}
          </div>
        )}

        <CardContent className="flex-1 p-0 overflow-hidden">
          <div
            ref={listRef}
            className="h-full overflow-y-auto font-mono text-sm p-4 bg-black"
            style={{ height: "100%" }}
            role="log"
            aria-live={paused ? "off" : "polite"}
            aria-atomic="false"
            aria-label="Log output"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              const atBottom = scrollHeight - scrollTop - clientHeight < 50;
              if (atBottom && !paused) {
                // Keep at bottom - React will handle scroll naturally
              }
            }}
          >
            {filteredLogs.length === 0 ? (
              <div
                className="flex items-center justify-center h-full text-[var(--color-fg-tertiary)]"
                role="status"
                aria-live="polite"
              >
                <div className="text-center space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-[var(--color-fg-tertiary)]/50" aria-hidden="true" />
                  <p className="text-sm">{paused ? "Log streaming paused. Click play to resume." : "No logs yet. Logs will appear here when the environment produces output."}</p>
                  {paused && (
                    <Button variant="outline" size="sm" onClick={togglePause}>
                      <Play className="h-4 w-4 mr-1" aria-hidden="true" />
                      Resume Streaming
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {virtualized ? (
                  <div style={{ height: totalHeight, position: "relative" }}>
                    <div style={{ transform: `translateY(${offsetY}px)` }}>
                      {visibleItems.map((log, index) => (
                        <div
                          key={index}
                          ref={index === 0 ? firstItemRef : undefined}
                          className={cn(
                            "whitespace-pre-wrap break-all py-0.5",
                            getStreamColor(log.stream)
                          )}
                          title={log.timestamp}
                        >
                          <span className="text-[var(--color-fg-tertiary)] mr-2">{formatRelativeTime(log.timestamp)}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs mr-2", getStreamBadge(log.stream))}>
                            {log.stream}
                          </span>
                          {log.content}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className={cn(
                        "whitespace-pre-wrap break-all py-0.5",
                        getStreamColor(log.stream)
                      )}
                      title={log.timestamp}
                    >
                      <span className="text-[var(--color-fg-tertiary)] mr-2">{formatRelativeTime(log.timestamp)}</span>
                      <span className={cn("px-1.5 py-0.5 rounded text-xs mr-2", getStreamBadge(log.stream))}>
                        {log.stream}
                      </span>
                      {log.content}
                    </div>
                  ))
                )}
                <div ref={scrollAnchorRef} />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </FocusTrap>
  );
}
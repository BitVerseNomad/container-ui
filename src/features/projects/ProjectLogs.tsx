import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Button } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { Input } from "@/ui/Input";
import { X, Trash2, Pause, Play, Search, Settings, Download, ChevronRight } from "@/ui/icons";
import { cn } from "@/lib/cn";
import { projectsApi } from "@/lib/projectsApi";
import type { LogLine } from "@/shared/types/environment";

interface ProjectLogsProps {
  environmentId: string;
  onClose: () => void;
}

const STORAGE_KEY = "project-logs-";
const MAX_STORED_LOGS = 5000;
const VIRTUALIZATION_THRESHOLD = 1000;
const ITEM_HEIGHT = 22;

type LogStream = "all" | "stdout" | "stderr" | "system";

export function ProjectLogs({ environmentId, onClose }: ProjectLogsProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [filterStream, setFilterStream] = useState<LogStream>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [virtualized, setVirtualized] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

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
    onError: (error) => {
      console.error("Failed to subscribe to logs:", error);
    },
  });

  useEffect(() => {
    subscribeLogs.mutate(environmentId);
    return () => {
      // cleanup handled by hook
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
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 10);
    const endIndex = Math.min(
      filteredLogs.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + 10
    );
    
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, virtualized]);

  const totalHeight = virtualized ? filteredLogs.length * ITEM_HEIGHT : undefined;
  const offsetY = virtualized && listRef.current 
    ? Math.max(0, Math.floor(listRef.current.scrollTop / ITEM_HEIGHT) - 10) * ITEM_HEIGHT 
    : 0;

  return (
    <Card className="fixed inset-0 z-50 flex flex-col m-4 max-h-[90vh] max-w-[90vw]">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <CardTitle className="flex items-center gap-2">
          Logs
          <Badge variant={paused ? "default" : "success"} size="sm">
            {paused ? "Paused" : "Live"}
          </Badge>
          {debouncedSearch && (
            <Badge variant="outline" size="sm" className="ml-1">
              {filteredLogs.length} matches
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={togglePause} title={paused ? "Resume" : "Pause"}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={clearLogs} title="Clear logs">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={exportLogs} title="Export logs">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <div className="border-b p-3 bg-[var(--color-bg-primary)] flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-fg-tertiary)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="pl-10 bg-[var(--color-bg-tertiary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-[var(--color-brand-primary)] text-[var(--color-brand-primary-foreground)]")}
          >
            <Settings className="h-4 w-4 mr-1" /> Streams
            <ChevronRight className={cn("h-3 w-3 ml-1", showFilters && "rotate-90")} />
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="border-b p-3 bg-[var(--color-bg-primary)] flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-fg-secondary)]">Show:</span>
          {(["all", "stdout", "stderr", "system"] as LogStream[]).map((stream) => (
            <Button
              key={stream}
              variant={filterStream === stream ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilterStream(stream)}
              className={cn(
                filterStream === stream && stream !== "all" && getStreamBadge(stream)
              )}
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
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
            const atBottom = scrollHeight - scrollTop - clientHeight < 50;
            if (atBottom && !paused) {
              // Keep at bottom - React will handle scroll naturally
            }
          }}
        >
          {virtualized ? (
            <div style={{ height: totalHeight, position: "relative" }}>
              <div style={{ transform: `translateY(${offsetY}px)` }}>
                {visibleItems.map((log, index) => (
                  <div
                    key={index}
                    className={cn(
                      "whitespace-pre-wrap break-all py-0.5",
                      getStreamColor(log.stream)
                    )}
                    style={{ height: ITEM_HEIGHT, lineHeight: `${ITEM_HEIGHT}px` }}
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
        </div>
      </CardContent>
    </Card>
  );
}
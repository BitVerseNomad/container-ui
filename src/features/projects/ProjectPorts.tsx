import { useState, useCallback, useMemo, useId, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Button } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { Input } from "@/ui/Input";
import { ExternalLink, X, Loader2, CheckCircle2, AlertTriangle, Copy } from "@/ui/icons";
import { Icon } from "@/ui/icons";
import { cn } from "@/lib/cn";
import { projectsApi } from "@/lib/projectsApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/ui/components/Toast";
import { PortsSkeleton } from "@/ui/Skeleton";
import type { PortMapping } from "@/shared/types/environment";

interface ProjectPortsProps {
  environmentId: string;
}

const VIRTUALIZATION_THRESHOLD = 50;
const REFETCH_INTERVAL_ACTIVE = 5000;
const REFETCH_INTERVAL_IDLE = 10000;

export function ProjectPorts({ environmentId }: ProjectPortsProps) {
  const queryClient = useQueryClient();
  const { success, error: toastError, warning } = useToast();
  const [newPort, setNewPort] = useState("");
  const [copiedPort, setCopiedPort] = useState<number | null>(null);
  const [collisionErrors, setCollisionErrors] = useState<Record<string, string>>({});
  const [forwardingPorts, setForwardingPorts] = useState<Set<number>>(new Set());
  const [idle, setIdle] = useState(false);
  const inputId = useId();
  const portsTitleId = useId();

  // Use different refetch intervals based on idle state
  const refetchInterval = idle ? REFETCH_INTERVAL_IDLE : REFETCH_INTERVAL_ACTIVE;

  const { data: ports = [], isLoading, isFetching } = useQuery({
    queryKey: ["project-ports", environmentId],
    queryFn: () => projectsApi.listEnvironmentPorts(environmentId),
    refetchInterval,
    enabled: !!environmentId,
  });

  // Track user activity to determine idle state
  useEffect(() => {
    const handleActivity = () => {
      setIdle(false);
      const timeout = setTimeout(() => setIdle(true), 30000); // 30s idle
      return () => clearTimeout(timeout);
    };
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, []);

  const forwardMutation = useMutation({
    mutationFn: (port: number) => projectsApi.forwardPort(environmentId, port),
    onMutate: async (port) => {
      setForwardingPorts((prev) => new Set(prev).add(port));
      return { port };
    },
    onSuccess: (_, __, context) => {
      const port = context?.port;
      if (port) {
        const portMapping = ports.find((p) => p.containerPort === port);
        const protocol = portMapping?.protocol || "tcp";
        const collisionKey = `${port}:${protocol}`;
        setCollisionErrors((prev) => {
          const next = { ...prev };
          delete next[collisionKey];
          return next;
        });
        setForwardingPorts((prev) => {
          const next = new Set(prev);
          next.delete(port);
          return next;
        });
        success("Port forwarded", `Container port ${port} is now accessible on localhost.`);
      }
      queryClient.invalidateQueries({ queryKey: ["project-ports", environmentId] });
    },
    onError: (error, port) => {
      const errorMsg = error instanceof Error ? error.message : "Failed to forward port";
      if (errorMsg.includes("address in use") || errorMsg.includes("EADDRINUSE")) {
        const portMapping = ports.find((p) => p.containerPort === port);
        const protocol = portMapping?.protocol || "tcp";
        setCollisionErrors((prev) => ({ ...prev, [`${port}:${protocol}`]: "Port already in use on host" }));
        warning("Port collision", `Port ${port} is already in use on your host. Try a different port.`);
      } else {
        toastError("Forward failed", errorMsg);
      }
      setForwardingPorts((prev) => {
        const next = new Set(prev);
        next.delete(port);
        return next;
      });
    },
  });

  const unforwardMutation = useMutation({
    mutationFn: (port: number) => projectsApi.unforwardPort(environmentId, port),
    onSuccess: (_, port) => {
      queryClient.invalidateQueries({ queryKey: ["project-ports", environmentId] });
      success("Port forwarding removed", `Container port ${port} is no longer forwarded.`);
      // Clear any collision error for this port
      setCollisionErrors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${port}:`)) {
            delete next[key];
          }
        });
        return next;
      });
    },
    onError: (error, port) => {
      toastError("Failed to remove port", error instanceof Error ? error.message : "Unknown error");
    },
  });

  const handleForward = useCallback(async () => {
    const port = parseInt(newPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      toastError("Invalid port", "Please enter a valid port number (1-65535).");
      return;
    }
    try {
      await forwardMutation.mutateAsync(port);
      setNewPort("");
    } catch (e) {
      // Error handled by onError
    }
  }, [newPort, forwardMutation, toastError]);

  const handleUnforward = useCallback(async (port: number) => {
    try {
      await unforwardMutation.mutateAsync(port);
    } catch (e) {
      // Error handled by mutation
    }
  }, [unforwardMutation]);

  const handleRetry = useCallback(async (port: number, protocol: string) => {
    try {
      await forwardMutation.mutateAsync(port);
      // Clear error on successful retry
      setCollisionErrors((prev) => {
        const next = { ...prev };
        delete next[`${port}:${protocol}`];
        return next;
      });
    } catch (e) {
      // Error handled by onError
    }
  }, [forwardMutation]);

  const copyToClipboard = useCallback(async (text: string, port: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPort(port);
      setTimeout(() => setCopiedPort(null), 2000);
      success("Copied", `${text} copied to clipboard.`);
    } catch (e) {
      toastError("Copy failed", "Failed to copy to clipboard.");
    }
  }, [success, toastError]);

  const formatProtocol = (protocol: string) => {
    return protocol.toUpperCase();
  };

  const getProtocolColor = (protocol: string) => {
    return protocol.toLowerCase() === "udp" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400";
  };

  // For virtualization, we just show all ports since threshold is 50
  const displayPorts = ports;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle id={portsTitleId} className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Port Forwarding
        </CardTitle>
        <div className="flex items-center gap-2" role="group" aria-label="Add port forwarding">
          <label htmlFor={inputId} className="sr-only">
            Container port to forward
          </label>
          <Input
            id={inputId}
            value={newPort}
            onChange={(e) => setNewPort(e.target.value)}
            placeholder="Container port"
            type="number"
            min={1}
            max={65535}
            className="w-32"
            disabled={forwardMutation.isPending}
            onKeyDown={(e) => e.key === "Enter" && handleForward()}
            aria-describedby="port-help"
          />
          <Button
            onClick={handleForward}
            disabled={forwardMutation.isPending || !newPort}
            aria-label={!newPort ? "Enter a port number first" : forwardMutation.isPending ? "Forwarding port..." : `Forward container port ${newPort}`}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
          >
            {forwardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Forward"}
          </Button>
        </div>
        <p id="port-help" className="text-xs text-[var(--color-fg-tertiary)] order-3 w-full sm:order-0 sm:w-auto">
          Enter a container port (1-65535) to forward to localhost
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading port forwards">
            <PortsSkeleton />
          </div>
        ) : ports.length === 0 ? (
          <div className="space-y-4 p-4" role="status">
            <div className="text-center space-y-3">
              <ExternalLink className="h-12 w-12 mx-auto text-[var(--color-fg-tertiary)]/50" aria-hidden="true" />
              <p className="text-[var(--color-fg-tertiary)] text-sm">No ports forwarded</p>
              <p className="text-xs text-[var(--color-fg-tertiary)]">Forward a container port to access it on localhost</p>
            </div>
            {/* Inline forward form when no ports */}
            <div className="flex items-center gap-2 p-3 bg-[var(--color-bg-tertiary)]/50 rounded-lg border" role="group" aria-label="Quick port forward">
              <label htmlFor={`${inputId}-quick`} className="sr-only">
                Container port to forward
              </label>
              <Input
                id={`${inputId}-quick`}
                value={newPort}
                onChange={(e) => setNewPort(e.target.value)}
                placeholder="Container port"
                type="number"
                min={1}
                max={65535}
                className="w-32"
                disabled={forwardMutation.isPending}
                onKeyDown={(e) => e.key === "Enter" && handleForward()}
              />
              <Button
                onClick={handleForward}
                disabled={forwardMutation.isPending || !newPort}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
              >
                {forwardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Forward"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-auto" role="list" aria-label="Forwarded ports">
            {displayPorts.map((port) => {
              const protocol = port.protocol || "tcp";
              const collisionKey = `${port.containerPort}:${protocol}`;
              const hasCollision = collisionErrors[collisionKey];
              const hostPort = port.hostPort;
              const url = hostPort ? `http://localhost:${hostPort}` : null;
              const isForwarding = forwardingPorts.has(port.containerPort);

              return (
                <div
                  key={collisionKey}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg gap-3",
                    hasCollision && "border border-red-500/50"
                  )}
                  role="listitem"
                >
                  <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg">{port.containerPort}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", getProtocolColor(protocol))}
                        title={`Protocol: ${formatProtocol(protocol)}`}
                        aria-label={`Protocol: ${formatProtocol(protocol)}`}
                      >
                        {formatProtocol(protocol)}
                      </Badge>
                    </div>
                    {hasCollision && (
                      <div className="flex items-center gap-2 text-sm text-red-400" role="alert">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        <span>{collisionErrors[collisionKey]}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRetry(port.containerPort, protocol)}
                          disabled={forwardMutation.isPending || isForwarding}
                          aria-label={`Retry forwarding port ${port.containerPort}`}
                          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                        >
                          <Loader2 className={cn("h-3 w-3", (forwardMutation.isPending || isForwarding) && "animate-spin")} aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                    {hostPort && !hasCollision && (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-fg-tertiary)]">
                        <span className="font-mono">→ localhost:{hostPort}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(`localhost:${hostPort}`, hostPort)}
                          title={copiedPort === hostPort ? "Copied!" : "Copy address"}
                          aria-label={copiedPort === hostPort ? `Copied localhost:${hostPort}` : `Copy localhost:${hostPort} to clipboard`}
                          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                        >
                          {copiedPort === hostPort ? (
                            <CheckCircle2 className="h-3 w-3 text-green-400" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(url!, "_blank")}
                          title="Open in browser"
                          aria-label={`Open localhost:${hostPort} in browser`}
                          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                    {hostPort && !hasCollision && (
                      <Badge
                        variant={port.isForwarded ? "success" : "default"}
                        size="sm"
                        aria-label={`Port status: ${port.isForwarded ? "Forwarded" : "Pending"}`}
                      >
                        {port.isForwarded ? "Forwarded" : "Pending"}
                      </Badge>
                    )}
                    {!hostPort && !hasCollision && (
                      <Badge variant="default" size="sm" aria-label="Port not forwarded">
                        Not forwarded
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUnforward(port.containerPort)}
                    disabled={unforwardMutation.isPending}
                    className="text-[var(--color-brand-danger)] hover:text-[var(--color-brand-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                    aria-label={`Remove port forwarding for container port ${port.containerPort}`}
                    title="Remove port forwarding"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
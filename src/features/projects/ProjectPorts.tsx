import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Button } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { Input } from "@/ui/Input";
import { ExternalLink, X, Link2, Loader2, CheckCircle2, AlertTriangle, AlertCircle } from "@/ui/icons";
import { Icon } from "@/ui/icons";
import { cn } from "@/lib/cn";
import { projectsApi } from "@/lib/projectsApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PortMapping } from "@/shared/types/environment";

interface ProjectPortsProps {
  environmentId: string;
}

const VIRTUALIZATION_THRESHOLD = 20;

export function ProjectPorts({ environmentId }: ProjectPortsProps) {
  const queryClient = useQueryClient();
  const [newPort, setNewPort] = useState("");
  const [copiedPort, setCopiedPort] = useState<number | null>(null);
  const [collisionErrors, setCollisionErrors] = useState<Record<string, string>>({});
  const [forwardingPorts, setForwardingPorts] = useState<Set<number>>(new Set());

  const { data: ports = [], isLoading } = useQuery({
    queryKey: ["project-ports", environmentId],
    queryFn: () => projectsApi.listEnvironmentPorts(environmentId),
    refetchInterval: 5000,
    enabled: !!environmentId,
  });

  const forwardMutation = useMutation({
    mutationFn: (port: number) => projectsApi.forwardPort(environmentId, port),
    onMutate: async (port) => {
      // Track this port as being forwarded
      setForwardingPorts((prev) => new Set(prev).add(port));
      return { port };
    },
    onSuccess: (_, __, context) => {
      const port = context?.port;
      if (port) {
        setCollisionErrors((prev) => {
          const next = { ...prev };
          // Clear error for this port+protocol combo
          Object.keys(next).forEach((key) => {
            if (key.startsWith(`${port}:`)) {
              delete next[key];
            }
          });
          return next;
        });
        setForwardingPorts((prev) => {
          const next = new Set(prev);
          next.delete(port);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["project-ports", environmentId] });
    },
    onError: (error, port) => {
      const errorMsg = error instanceof Error ? error.message : "Failed to forward port";
      if (errorMsg.includes("address in use") || errorMsg.includes("EADDRINUSE")) {
        // Key by port:protocol to handle multiple protocols on same port
        // For now we use just port since protocol comes from the port mapping
        const portMapping = ports.find(p => p.containerPort === port);
        const protocol = portMapping?.protocol || "tcp";
        setCollisionErrors((prev) => ({ ...prev, [`${port}:${protocol}`]: "Port already in use on host" }));
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-ports", environmentId] });
    },
  });

  const handleForward = useCallback(async () => {
    const port = parseInt(newPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) return;
    try {
      await forwardMutation.mutateAsync(port);
      setNewPort("");
    } catch (e) {
      // Error handled by onError
    }
  }, [newPort, forwardMutation]);

  const handleUnforward = useCallback(async (port: number) => {
    try {
      await unforwardMutation.mutateAsync(port);
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
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  }, []);

  const formatProtocol = (protocol: string) => {
    return protocol.toUpperCase();
  };

  const getProtocolColor = (protocol: string) => {
    return protocol.toLowerCase() === "udp" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400";
  };

  // For virtualization, we just show all ports since threshold is 20
  // But we keep the structure for future expansion
  const displayPorts = ports;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Port Forwarding</CardTitle>
        <div className="flex items-center gap-2">
          <Input
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
          <Button onClick={handleForward} disabled={forwardMutation.isPending || !newPort}>
            {forwardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Forward"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : ports.length === 0 ? (
          <p className="text-[var(--color-fg-tertiary)] text-sm">No ports forwarded</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                    "flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg",
                    hasCollision && "border border-red-500/50"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg">{port.containerPort}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", getProtocolColor(protocol))}
                        title={`Protocol: ${formatProtocol(protocol)}`}
                      >
                        {formatProtocol(protocol)}
                      </Badge>
                    </div>
                    {hasCollision && (
                      <div className="flex items-center gap-2 text-sm text-red-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{collisionErrors[collisionKey]}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRetry(port.containerPort, protocol)}
                          disabled={forwardMutation.isPending || isForwarding}
                        >
                          <Loader2 className={cn("h-3 w-3", (forwardMutation.isPending || isForwarding) && "animate-spin")} />
                        </Button>
                      </div>
                    )}
                    {hostPort && !hasCollision && (
                      <div className="flex items-center gap-2 text-sm text-[var(--color-fg-tertiary)]">
                        <span className="font-mono">→ localhost:{hostPort}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(`localhost:${hostPort}`, hostPort)}
                          title={copiedPort === hostPort ? "Copied!" : "Copy address"}
                        >
                          {copiedPort === hostPort ? (
                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                          ) : (
                            <Icon name="copy" className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(url!, "_blank")}
                          title="Open in browser"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {hostPort && !hasCollision && (
                      <Badge variant={port.isForwarded ? "success" : "default"} size="sm">
                        {port.isForwarded ? "Forwarded" : "Pending"}
                      </Badge>
                    )}
                    {!hostPort && !hasCollision && (
                      <Badge variant="default" size="sm">Not forwarded</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUnforward(port.containerPort)}
                    disabled={unforwardMutation.isPending}
                    className="text-[var(--color-brand-danger)] hover:text-[var(--color-brand-danger)]"
                    title="Remove port forwarding"
                  >
                    <X className="h-4 w-4" />
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
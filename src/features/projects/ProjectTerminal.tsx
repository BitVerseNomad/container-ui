import { useState, useEffect, useRef, useCallback } from "react";
import { X, SendIcon, AlertTriangle, Activity, Loader2 } from "@/ui/icons";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Card, CardContent } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";
import { cn } from "@/lib/cn";
import { useProjectTerminal } from "@/hooks/useProjectTerminal";

interface ProjectTerminalProps {
  environmentId: string;
  onClose: () => void;
}

export function ProjectTerminal({ environmentId, onClose }: ProjectTerminalProps) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);

  const {
    containerRef,
    terminalRef,
    fitAddonRef,
    executeCommand,
    isConnected,
    reconnect,
    scrollback,
    clearScrollback,
  } = useProjectTerminal({
    environmentId,
    onDisconnect: () => setShowReconnectBanner(true),
    onReconnect: () => setShowReconnectBanner(false),
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && command.trim()) {
      executeCommand(command);
      setHistory((prev) => [...prev, command]);
      setHistoryIndex(-1);
      setCommand("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistoryIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex < history.length) {
          setCommand(history[history.length - 1 - nextIndex]);
        }
        return Math.min(nextIndex, history.length - 1);
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistoryIndex((prev) => {
        if (prev <= 0) {
          setCommand("");
          return -1;
        }
        const nextIndex = prev - 1;
        if (nextIndex >= 0) {
          setCommand(history[history.length - 1 - nextIndex]);
        } else {
          setCommand("");
        }
        return nextIndex;
      });
    } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
      // Ctrl+C - send interrupt
      e.preventDefault();
      if (terminalRef.current) {
        terminalRef.current.write("\x03");
        terminalRef.current.write("\r\n$ ");
      }
    } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      // Ctrl+L - clear screen
      e.preventDefault();
      if (terminalRef.current) {
        terminalRef.current.clear();
      }
    } else if (e.key === "d" && (e.ctrlKey || e.metaKey) && !command) {
      // Ctrl+D - exit signal
      e.preventDefault();
      if (terminalRef.current) {
        terminalRef.current.write("\x04");
      }
    }
  }, [command, history, executeCommand, terminalRef]);

  const handleSendCommand = useCallback(() => {
    if (command.trim()) {
      executeCommand(command);
      setHistory((prev) => [...prev, command]);
      setHistoryIndex(-1);
      setCommand("");
    }
  }, [command, executeCommand]);

  const handleReconnect = useCallback(async () => {
    await reconnect();
  }, [reconnect]);

  return (
    <Card className="fixed inset-0 z-50 flex flex-col m-4 max-h-[90vh] max-w-[90vw]">
      <div className="flex items-center justify-between border-b p-3 bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-2">
          <span className="font-medium">Terminal</span>
          <span className="text-xs text-[var(--color-fg-tertiary)]">{environmentId.slice(0, 12)}</span>
          <span className={cn(
            "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
            isConnected
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          )}>
            {isConnected ? (
              <>
                <Activity className="h-3 w-3" />
                Connected
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                Disconnected
              </>
            )}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!isConnected && showReconnectBanner && (
        <div className="flex items-center justify-between p-3 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-400 text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connection lost. Reconnecting...</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReconnect}>
            Retry Now
          </Button>
        </div>
      )}

      <CardContent className="flex-1 p-0 min-h-[400px] relative">
        <div ref={containerRef} className="h-full w-full" />
      </CardContent>

      <div className="border-t p-3 bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-fg-tertiary)] font-mono text-sm">$</span>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent"
            disabled={!isConnected}
            autoFocus
          />
          <Button onClick={handleSendCommand} disabled={!isConnected || !command.trim()}>
            <SendIcon className="h-4 w-4" />
          </Button>
          {!isConnected && (
            <Button variant="outline" size="sm" onClick={handleReconnect}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reconnect
            </Button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-fg-tertiary)]">
          <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded">Ctrl+C</kbd> Interrupt
          <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded">Ctrl+L</kbd> Clear
          <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded">Ctrl+D</kbd> EOF
          <span className="ml-auto">Scrollback: {scrollback.length} lines</span>
        </div>
      </div>
    </Card>
  );
}
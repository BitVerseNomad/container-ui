import { useState, useEffect, useRef, useCallback, useId } from "react";
import { X, SendIcon, AlertTriangle, Activity, Loader2, Terminal as TerminalIcon } from "@/ui/icons";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Card, CardContent } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";
import { cn } from "@/lib/cn";
import { useProjectTerminal } from "@/hooks/useProjectTerminal";
import { FocusTrap } from "@/ui/components/FocusTrap";
import { TerminalSkeleton } from "@/ui/Skeleton";

interface ProjectTerminalProps {
  environmentId: string;
  onClose: () => void;
  onReconnectToast?: (msg: string) => void;
}

export function ProjectTerminal({ environmentId, onClose, onReconnectToast }: ProjectTerminalProps) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const terminalTitleId = useId();
  const terminalStatusId = useId();

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
    onDisconnect: () => {
      setShowReconnectBanner(true);
      onReconnectToast?.("Connection lost. Attempting to reconnect...");
    },
    onReconnect: () => {
      setShowReconnectBanner(false);
      onReconnectToast?.("Terminal reconnected successfully.");
    },
  });

  // Track initialization for skeleton
  useEffect(() => {
    if (isConnected && !isInitialized) {
      setIsInitialized(true);
    } else if (!isConnected && isInitialized) {
      setIsInitialized(false);
    }
  }, [isConnected, isInitialized]);

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
    return <TerminalSkeleton />;
  }

  return (
    <FocusTrap enabled={true} onEscape={onClose}>
      <Card
        className="fixed inset-0 z-50 flex flex-col m-4 max-h-[90vh] max-w-[90vw] sm:max-h-[80vh] sm:max-w-[80vw]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={terminalTitleId}
        aria-describedby={terminalStatusId}
      >
        <div className="flex items-center justify-between border-b p-3 bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4" aria-hidden="true" />
            <span id={terminalTitleId} className="font-medium">Terminal</span>
            <span className="text-xs text-[var(--color-fg-tertiary)] font-mono">{environmentId.slice(0, 12)}</span>
            <span
              id={terminalStatusId}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                isConnected
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              )}
              aria-live="polite"
              aria-atomic="true"
            >
              {isConnected ? (
                <>
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  Connected
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Disconnected
                </>
              )}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close terminal"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {!isConnected && showReconnectBanner && (
          <div
            className="flex items-center justify-between p-3 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-400 text-sm"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Connection lost. Reconnecting...</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReconnect}
              aria-label="Retry connection now"
            >
              Retry Now
            </Button>
          </div>
        )}

        <CardContent className="flex-1 p-0 min-h-[400px] relative" tabIndex={0}>
          <div
            ref={containerRef}
            className="h-full w-full"
            role="application"
            aria-label="Terminal emulator"
          />
        </CardContent>

        <div className="border-t p-3 bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-fg-tertiary)] font-mono text-sm" aria-hidden="true">$</span>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command..."
              className="flex-1 bg-transparent"
              disabled={!isConnected}
              autoFocus
              aria-label="Terminal command input"
              aria-describedby="terminal-hints"
            />
            <Button
              onClick={handleSendCommand}
              disabled={!isConnected || !command.trim()}
              aria-label="Send command"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
            >
              <SendIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
            {!isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReconnect}
                aria-label="Reconnect to terminal"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Reconnect
              </Button>
            )}
          </div>
          <div id="terminal-hints" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-fg-tertiary)]" aria-label="Keyboard shortcuts">
            <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded">Ctrl+C</kbd> Interrupt
            <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded">Ctrl+L</kbd> Clear
            <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded">Ctrl+D</kbd> EOF
            <span className="ml-auto">Scrollback: {scrollback.length} lines</span>
          </div>
        </div>
      </Card>
    </FocusTrap>
  );
}
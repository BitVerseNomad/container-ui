import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { projectsApi, type ExecResult } from "@/lib/projectsApi";

interface UseProjectTerminalOptions {
  environmentId: string;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

interface UseProjectTerminalReturn {
  terminalRef: React.RefObject<Terminal | null>;
  fitAddonRef: React.RefObject<FitAddon | null>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  executeCommand: (command: string) => Promise<void>;
  isConnected: boolean;
  reconnect: () => Promise<void>;
  scrollback: string[];
  clearScrollback: () => void;
}

const MAX_SCROLLBACK_LINES = 1000;
const RECONNECT_INTERVAL = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useProjectTerminal({
  environmentId,
  onDisconnect,
  onReconnect,
}: UseProjectTerminalOptions): UseProjectTerminalReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [scrollback, setScrollback] = useState<string[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const execMutation = useMutation({
    mutationFn: (input: { environmentId: string; command: string[] }) =>
      projectsApi.execInEnvironment(input),
  });

  const addToScrollback = useCallback((lines: string[]) => {
    setScrollback((prev) => {
      const combined = [...prev, ...lines];
      if (combined.length > MAX_SCROLLBACK_LINES) {
        return combined.slice(-MAX_SCROLLBACK_LINES);
      }
      return combined;
    });
  }, []);

  const clearScrollback = useCallback(() => {
    setScrollback([]);
  }, []);

  const initializeTerminal = useCallback(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      lineHeight: 1.5,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
        black: "#1e1e1e",
        red: "#f44747",
        green: "#6a9955",
        yellow: "#dcdcaa",
        blue: "#569cd6",
        magenta: "#c586c0",
        cyan: "#9cdcfe",
        white: "#d4d4d4",
        brightBlack: "#858585",
        brightRed: "#f44747",
        brightGreen: "#6a9955",
        brightYellow: "#dcdcaa",
        brightBlue: "#569cd6",
        brightMagenta: "#c586c0",
        brightCyan: "#9cdcfe",
        brightWhite: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebglAddon());

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Write welcome message and restore scrollback
    terminal.write("Welcome to Container UI Terminal\r\n");
    terminal.write(`Connected to environment ${environmentId.slice(0, 12)}\r\n\r\n`);
    
    if (scrollback.length > 0) {
      terminal.write(scrollback.join(""));
      terminal.write("\r\n--- Scrollback restored ---\r\n\r\n");
    }

    setIsConnected(true);
    setReconnectAttempts(0);
    if (onReconnect) onReconnect();

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, [environmentId, scrollback, onReconnect]);

  const executeCommand = useCallback(async (command: string) => {
    if (!terminalRef.current) return;
    
    terminalRef.current.write(`\r\n$ ${command}\r\n`);
    
    try {
      const result = await execMutation.mutateAsync({
        environmentId,
        command: ["sh", "-c", command],
      });
      
      if (result.stdout) {
        terminalRef.current.write(result.stdout);
        addToScrollback([result.stdout]);
      }
      if (result.stderr) {
        terminalRef.current.write(result.stderr);
        addToScrollback([result.stderr]);
      }
      terminalRef.current.write(`\r\n[Exit code: ${result.exitCode}]\r\n`);
      addToScrollback([`[Exit code: ${result.exitCode}]`]);
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : "Unknown error"}\r\n`;
      terminalRef.current.write(errorMsg);
      addToScrollback([errorMsg]);
      
      // Check if it's a network error that warrants reconnection
      if (error instanceof Error && (
        error.message.includes("network") ||
        error.message.includes("connection") ||
        error.message.includes("timeout") ||
        error.message.includes("ECONNREFUSED")
      )) {
        handleDisconnect();
      }
    }
  }, [environmentId, execMutation, addToScrollback]);

  const handleDisconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setIsConnected(false);
    if (onDisconnect) onDisconnect();
    
    // Schedule reconnection
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setReconnectAttempts((prev) => prev + 1);
          initializeTerminal();
        }
      }, RECONNECT_INTERVAL);
    }
  }, [reconnectAttempts, initializeTerminal, onDisconnect]);

  const reconnect = useCallback(async () => {
    setReconnectAttempts(0);
    initializeTerminal();
  }, [initializeTerminal]);

  // Initialize terminal on mount
  useEffect(() => {
    isMountedRef.current = true;
    const cleanup = initializeTerminal();
    
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (cleanup) cleanup();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [initializeTerminal]);

  // Re-initialize when environmentId changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    }
    initializeTerminal();
  }, [environmentId, initializeTerminal]);

  return {
    terminalRef,
    fitAddonRef,
    containerRef,
    executeCommand,
    isConnected,
    reconnect,
    scrollback,
    clearScrollback,
  };
}
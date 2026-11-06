import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "@/ui/icons";
import { Button } from "@/ui/Button";
import { Card, CardContent } from "@/ui/Card";
import { cn } from "@/lib/cn";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
  resetOnPropsChange?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.props.resetKeys && this.props.resetKeys.length > 0) {
      const hasResetKeyChanged = this.props.resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index]);
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
    if (this.props.resetOnPropsChange && this.props.children !== prevProps.children) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex h-full items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 pb-6 px-6 text-center">
              <div className="mx-auto mb-4 p-3 bg-[var(--color-brand-danger)]/10 rounded-full w-16 h-16 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-[var(--color-brand-danger)]" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
              <p className="text-[var(--color-fg-secondary)] text-sm mb-6">
                An unexpected error occurred in the project detail view. Please try refreshing or go back to the projects list.
              </p>
              {this.state.error && (
                <details className="text-left mb-4 p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-xs font-mono text-[var(--color-fg-tertiary)]">
                  <summary className="cursor-pointer select-none mb-1">Error details</summary>
                  <pre className="whitespace-pre-wrap break-all">{this.state.error.message}</pre>
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <div className="mt-2 border-t pt-2">Stack trace:</div>
                      <pre className="whitespace-pre-wrap break-all mt-1">{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </details>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={this.reset}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Try Again
                </Button>
                <Button onClick={() => window.history.back()}>
                  <Home className="h-4 w-4 mr-1" />
                  Back to Projects
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ProjectDetailErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
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
            <Button onClick={() => window.history.back()}>
              <Home className="h-4 w-4 mr-1" />
              Back to Projects
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
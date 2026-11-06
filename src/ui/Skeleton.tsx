import { clsx } from "clsx";

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const baseStyles = clsx(
    "bg-[var(--color-bg-tertiary)] rounded",
    animation === "pulse" && "animate-pulse",
    animation === "wave" && "animate-[shimmer_1.5s_infinite]",
    variant === "circular" && "rounded-full",
    variant === "rectangular" && "rounded-lg",
    className
  );

  const style: React.CSSProperties = {
    width: width ? (typeof width === "number" ? `${width}px` : width) : undefined,
    height: height ? (typeof height === "number" ? `${height}px` : height) : variant === "text" ? "1rem" : undefined,
  };

  return <div className={baseStyles} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className, ...props }: { lines?: number; className?: string } & Omit<SkeletonProps, "variant">) {
  return (
    <div className={clsx("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? "60%" : "100%"} {...props} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, ...props }: { className?: string } & Omit<SkeletonProps, "variant">) {
  return (
    <div className={clsx("space-y-4 p-4 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border-light)]", className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} {...props} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" height="1.25rem" {...props} />
          <Skeleton variant="text" width="60%" height="0.875rem" {...props} />
        </div>
        <Skeleton variant="text" width="80px" height="24px" {...props} />
      </div>
      <Skeleton variant="rectangular" height="120px" width="100%" {...props} />
      <div className="flex items-center justify-between pt-2">
        <Skeleton variant="text" width="120px" height="20px" {...props} />
        <div className="flex gap-2">
          <Skeleton variant="text" width="80px" height="20px" {...props} />
          <Skeleton variant="text" width="80px" height="20px" {...props} />
        </div>
      </div>
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="group transition-all duration-200 hover:shadow-[var(--color-shadow-lg)] cursor-pointer p-0">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={40} height={40} className="bg-[var(--color-brand-primary-light)]" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" height="1.25rem" />
            <Skeleton variant="text" width="80%" height="0.875rem" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton variant="text" width="100px" height="20px" />
            <Skeleton variant="text" width="80px" height="20px" />
          </div>
        </div>
      </div>
      <div className="pt-0 px-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <Skeleton variant="text" width="180px" height="14px" />
            <Skeleton variant="text" width="80px" height="20px" />
          </div>
          <Skeleton variant="circular" width={32} height={32} />
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 text-center space-y-1">
          <Skeleton variant="text" width="40%" height="1.5rem" />
          <Skeleton variant="text" width="60%" height="0.875rem" />
        </div>
        <div className="w-10" />
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Dev Environment Card */}
        <SkeletonCard />
        {/* Environment Card */}
        <SkeletonCard />
        {/* Injected Credentials Card */}
        <SkeletonCard />
        {/* Git Card */}
        <SkeletonCard />
      </div>
    </div>
  );
}

export function TerminalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col m-4 max-h-[90vh] max-w-[90vw]">
      <div className="flex items-center justify-between border-b p-3 bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width="80px" height="1.25rem" />
          <Skeleton variant="text" width="100px" height="0.75rem" />
          <Skeleton variant="text" width="100px" height="20px" />
        </div>
        <Skeleton variant="circular" width={40} height={40} />
      </div>
      <div className="flex-1 p-4 bg-black rounded-b-xl">
        <div className="space-y-3 h-full">
          <Skeleton variant="text" width="100%" height="1.5rem" className="text-green-300" />
          <Skeleton variant="text" width="100%" height="1.5rem" className="text-green-300" />
          <Skeleton variant="text" width="100%" height="1.5rem" className="text-green-300" />
          <Skeleton variant="text" width="100%" height="1.5rem" className="text-green-300" />
          <Skeleton variant="text" width="100%" height="1.5rem" className="text-green-300" />
          <Skeleton variant="text" width="100%" height="1.5rem" className="text-green-300" />
          <Skeleton variant="text" width="100%" height="1.5rem" className="text-green-300" />
          <Skeleton variant="text" width="100%" height="1.5rem" className="text-green-300" />
        </div>
      </div>
      <div className="border-t p-3 bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width="20px" height="20px" />
          <Skeleton variant="text" width="100%" height="40px" className="bg-transparent border-[var(--color-border-medium)] rounded" />
          <Skeleton variant="text" width="100px" height="40px" />
          <Skeleton variant="text" width="100px" height="40px" />
        </div>
      </div>
    </div>
  );
}

export function LogsSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col m-4 max-h-[90vh] max-w-[90vw]">
      <div className="flex flex-row items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width="60px" height="1.25rem" />
          <Skeleton variant="text" width="60px" height="20px" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
        </div>
      </div>
      <div className="border-b p-3 bg-[var(--color-bg-primary)] flex flex-wrap items-center gap-2">
        <Skeleton variant="text" width="300px" height="40px" className="bg-[var(--color-bg-tertiary)] rounded" />
        <Skeleton variant="text" width="150px" height="32px" />
      </div>
      <div className="flex-1 p-4 bg-black overflow-y-auto">
        <div className="space-y-2 h-full">
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton variant="text" width="80px" height="14px" className="text-[var(--color-fg-tertiary)]" />
              <Skeleton variant="text" width="70px" height="20px" className="rounded text-xs" />
              <Skeleton variant="text" width="100%" height="14px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PortsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <Skeleton variant="text" width="150px" height="1.25rem" />
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width="100px" height="40px" className="bg-[var(--color-bg-tertiary)] rounded" />
          <Skeleton variant="text" width="100px" height="40px" />
        </div>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton variant="text" width="60px" height="24px" className="font-mono text-lg" />
                <Skeleton variant="text" width="50px" height="20px" className="rounded text-xs" />
              </div>
              <Skeleton variant="text" width="150px" height="14px" className="text-[var(--color-fg-tertiary)]" />
              <Skeleton variant="text" width="80px" height="20px" className="rounded" />
            </div>
            <Skeleton variant="circular" width={40} height={40} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EnvVarsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" width={20} height={20} />
            <Skeleton variant="text" width="200px" height="1.25rem" />
          </div>
          <Skeleton variant="text" width="100px" height="20px" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Skeleton variant="text" width="120px" height="20px" className="rounded text-xs" />
                <div className="min-w-0">
                  <Skeleton variant="text" width="200px" height="14px" className="font-mono text-sm" />
                  <Skeleton variant="text" width="150px" height="12px" className="font-mono text-xs" />
                </div>
              </div>
              <Skeleton variant="circular" width={44} height={24} />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" width={20} height={20} />
            <Skeleton variant="text" width="200px" height="1.25rem" />
          </div>
          <Skeleton variant="text" width="80px" height="20px" />
        </div>
        <Skeleton variant="text" width="100%" height="40px" className="rounded border" />
        <div className="space-y-3 p-4 bg-[var(--color-bg-tertiary)]/50 rounded-lg border">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton variant="text" width="100%" height="40px" className="rounded border" />
            <Skeleton variant="text" width="100%" height="40px" className="rounded border" />
          </div>
          <div className="flex justify-end gap-2">
            <Skeleton variant="text" width="80px" height="32px" />
            <Skeleton variant="text" width="120px" height="32px" />
          </div>
        </div>
      </div>
    </div>
  );
}
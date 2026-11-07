import { useState, useEffect, useCallback, useId, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dialog } from "@/ui/components/Dialog";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Badge } from "@/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Plus, Eye, EyeOff, X, Key, GitBranch, MessageSquare, Shield, Save, Trash2 } from "@/ui/icons";
import { cn } from "@/lib/cn";
import { FocusTrap } from "@/ui/components/FocusTrap";
import { EnvVarsSkeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/components/Toast";
import type { InjectedEnvVar } from "@/shared/types/environment";

interface ProjectEnvVarsProps {
  environmentId: string;
  isOpen: boolean;
  onClose: () => void;
}

const SOURCE_LABELS: Record<InjectedEnvVar["source"], string> = {
  ssh_agent: "SSH Agent",
  git_user: "Git User",
  git_email: "Git Email",
  gh_token: "GitHub Token",
  custom: "Custom",
};

const SOURCE_ICONS: Record<InjectedEnvVar["source"], React.ReactNode> = {
  ssh_agent: <Key className="h-3 w-3" aria-hidden="true" />,
  git_user: <GitBranch className="h-3 w-3" aria-hidden="true" />,
  git_email: <MessageSquare className="h-3 w-3" aria-hidden="true" />,
  gh_token: <Shield className="h-3 w-3" aria-hidden="true" />,
  custom: <Shield className="h-3 w-3" aria-hidden="true" />,
};

const SOURCE_VARIANTS: Record<InjectedEnvVar["source"], "default" | "info" | "success" | "warning" | "outline"> = {
  ssh_agent: "info",
  git_user: "default",
  git_email: "default",
  gh_token: "warning",
  custom: "outline",
};

function Switch({ checked, onChange, disabled, ariaLabel }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2",
        checked
          ? "bg-[var(--color-brand-primary)] border-[var(--color-brand-primary)]"
          : "bg-[var(--color-bg-tertiary)] border-[var(--color-border-medium)]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-150",
          checked ? "translate-x-6" : "translate-x-0"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

function MaskedValue({ value, children }: { value: string; children?: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  const masked = "•".repeat(Math.min(value.length, 8));

  return (
    <span className="flex items-center gap-1 font-mono text-xs">
      <code>{revealed ? value : masked}</code>
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        className="p-0.5 text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
        aria-label={revealed ? "Hide value" : "Show value"}
      >
        {revealed ? <EyeOff className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
      </button>
      {children}
    </span>
  );
}

export function ProjectEnvVars({ environmentId, isOpen, onClose }: ProjectEnvVarsProps) {
  const { success, error: toastError } = useToast();
  const [injectedVars, setInjectedVars] = useState<InjectedEnvVar[]>([]);
  const [customVars, setCustomVars] = useState<InjectedEnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [keyError, setKeyError] = useState("");
  const [valueError, setValueError] = useState("");
  const keyInputId = useId();
  const valueInputId = useId();

  // Virtualization for custom vars list
  const VIRTUALIZATION_THRESHOLD = 20;
  const [virtualized, setVirtualized] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 60;

  useEffect(() => {
    setVirtualized(customVars.length > VIRTUALIZATION_THRESHOLD);
  }, [customVars.length]);

  const visibleCustomVars = useMemo(() => {
    if (!virtualized || !listRef.current) return customVars;

    const container = listRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 5);
    const endIndex = Math.min(
      customVars.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + 5
    );

    return customVars.slice(startIndex, endIndex);
  }, [customVars, virtualized]);

  const totalHeight = virtualized ? customVars.length * ITEM_HEIGHT : undefined;
  const offsetY = virtualized && listRef.current
    ? Math.max(0, Math.floor(listRef.current.scrollTop / ITEM_HEIGHT) - 5) * ITEM_HEIGHT
    : 0;

  // Load environment variables from backend
  useEffect(() => {
    if (isOpen) {
      loadEnvVars();
    }
  }, [isOpen, environmentId]);

  const loadEnvVars = useCallback(async () => {
    try {
      setLoading(true);
      // For now, we'll use the injected defaults and any custom vars from localStorage
      // In the future, this should come from the SQLite database via a Tauri command
      const stored = localStorage.getItem(`env-vars-${environmentId}`);
      const parsed = stored ? JSON.parse(stored) : [];

      // Default injected vars (these are auto-injected by the backend)
      const defaults: InjectedEnvVar[] = [
        { key: "SSH_AUTH_SOCK", source: "ssh_agent", enabled: true },
        { key: "GIT_AUTHOR_NAME", source: "git_user", enabled: true },
        { key: "GIT_COMMITTER_NAME", source: "git_user", enabled: true },
        { key: "GIT_AUTHOR_EMAIL", source: "git_email", enabled: true },
        { key: "GIT_COMMITTER_EMAIL", source: "git_email", enabled: true },
        { key: "GH_TOKEN", source: "gh_token", enabled: true },
        { key: "GITHUB_TOKEN", source: "gh_token", enabled: true },
      ];

      // Merge with stored custom vars
      const merged = [...defaults, ...parsed.filter((v: InjectedEnvVar) => v.source === "custom")];
      setInjectedVars(merged.filter((v) => v.source !== "custom"));
      setCustomVars(parsed.filter((v: InjectedEnvVar) => v.source === "custom"));
    } catch (error) {
      console.error("Failed to load env vars:", error);
      toastError("Failed to load environment variables", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [environmentId, toastError]);

  const saveEnvVars = useCallback(async () => {
    try {
      setSaving(true);
      const allVars = [...injectedVars, ...customVars];
      localStorage.setItem(`env-vars-${environmentId}`, JSON.stringify(allVars));
      // TODO: Persist to SQLite via Tauri command when available
    } catch (error) {
      console.error("Failed to save env vars:", error);
      toastError("Failed to save", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }, [environmentId, injectedVars, customVars, toastError]);

  const toggleVar = useCallback((key: string, source: InjectedEnvVar["source"], currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    if (source === "custom") {
      setCustomVars((prev) => prev.map((v) => (v.key === key ? { ...v, enabled: newEnabled } : v)));
    } else {
      setInjectedVars((prev) => prev.map((v) => (v.key === key ? { ...v, enabled: newEnabled } : v)));
    }
  }, []);

  const validateKey = (key: string): boolean => {
    // Env var keys should be uppercase with underscores
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      setKeyError("Key must be uppercase letters, numbers, and underscores only, starting with a letter or underscore");
      return false;
    }
    setKeyError("");
    return true;
  };

  const validateValue = (value: string): boolean => {
    if (!value.trim()) {
      setValueError("Value is required");
      return false;
    }
    setValueError("");
    return true;
  };

  const handleAddCustomVar = useCallback(() => {
    if (!validateKey(newVarKey) || !validateValue(newVarValue)) return;

    const newVar: InjectedEnvVar = {
      key: newVarKey,
      source: "custom",
      enabled: true,
      value: newVarValue,
    };

    setCustomVars((prev) => [...prev, newVar]);
    setNewVarKey("");
    setNewVarValue("");
    setShowCustomForm(false);
    saveEnvVars();
    success("Variable added", `${newVarKey} has been added as a custom environment variable.`);
  }, [newVarKey, newVarValue, saveEnvVars, success]);

  const handleDeleteCustomVar = useCallback((key: string) => {
    setCustomVars((prev) => prev.filter((v) => v.key !== key));
    saveEnvVars();
    success("Variable deleted", `${key} has been removed.`);
  }, [saveEnvVars, success]);

  const allVars = [...injectedVars, ...customVars];
  const enabledVars = allVars.filter((v) => v.enabled);
  const disabledVars = allVars.filter((v) => !v.enabled);

  if (!isOpen) return null;

  return (
    <FocusTrap enabled={true} onEscape={onClose}>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Environment Variables"
        description="Manage injected and custom environment variables for this environment"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded">
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Injected Credentials Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <Key className="h-5 w-5" aria-hidden="true" />
                  Auto-Injected Credentials
                </span>
                <Badge variant="info" size="sm" aria-label={`${enabledVars.filter((v) => v.source !== "custom").length} auto-injected variables enabled`}>
                  {enabledVars.filter((v) => v.source !== "custom").length} enabled
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8" role="status" aria-label="Loading environment variables">
                  <EnvVarsSkeleton />
                </div>
              ) : injectedVars.length === 0 ? (
                <div className="text-center py-8" role="status">
                  <Key className="h-12 w-12 mx-auto text-[var(--color-fg-tertiary)]/50 mb-3" aria-hidden="true" />
                  <p className="text-sm text-[var(--color-fg-tertiary)]">No auto-injected credentials available</p>
                  <p className="text-xs text-[var(--color-fg-tertiary)] mt-1">SSH agent, Git config, or GitHub token not detected on host</p>
                </div>
              ) : (
                <dl className="space-y-3" aria-label="Auto-injected credentials">
                  {injectedVars.map((v) => (
                    <div
                      key={v.key}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        v.enabled
                          ? "bg-[var(--color-bg-primary)] border-[var(--color-border-medium)]"
                          : "bg-[var(--color-bg-tertiary)]/50 border-[var(--color-border-medium)] opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <dt>
                          <Badge variant={SOURCE_VARIANTS[v.source]} size="sm" className="flex-shrink-0" aria-label={SOURCE_LABELS[v.source]}>
                            {SOURCE_ICONS[v.source]}
                            {SOURCE_LABELS[v.source]}
                          </Badge>
                        </dt>
                        <dd className="min-w-0">
                          <code className="font-mono text-sm text-[var(--color-fg-primary)] truncate block">{v.key}</code>
                          {v.source === "gh_token" && <MaskedValue value="gh_token_value_placeholder" />}
                        </dd>
                      </div>
                      <Switch
                        checked={v.enabled}
                        onChange={(enabled) => toggleVar(v.key, v.source, v.enabled)}
                        ariaLabel={`${v.enabled ? "Disable" : "Enable"} ${v.key}`}
                      />
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Custom Environment Variables Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <Shield className="h-5 w-5" aria-hidden="true" />
                  Custom Environment Variables
                </span>
                <Badge variant="outline" size="sm" aria-label={`${customVars.length} custom variables`}>
                  {customVars.length} custom
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomForm(!showCustomForm)}
                className="w-full sm:w-auto justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                aria-expanded={showCustomForm}
                aria-controls="custom-var-form"
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                {showCustomForm ? "Cancel" : "Add Custom Variable"}
              </Button>

              {showCustomForm && (
                <form id="custom-var-form" onSubmit={(e) => { e.preventDefault(); handleAddCustomVar(); }} className="space-y-3 p-4 bg-[var(--color-bg-tertiary)]/50 rounded-lg border">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      id={keyInputId}
                      label="Key"
                      placeholder="MY_CUSTOM_VAR"
                      value={newVarKey}
                      onChange={(e) => setNewVarKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                      error={keyError}
                      hint="Uppercase letters, numbers, and underscores only"
                      disabled={saving}
                      required
                      aria-describedby={keyError ? `${keyInputId}-error` : undefined}
                    />
                    <Input
                      id={valueInputId}
                      label="Value"
                      placeholder="secret-value"
                      type="password"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      error={valueError}
                      disabled={saving}
                      required
                      aria-describedby={valueError ? `${valueInputId}-error` : undefined}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCustomForm(false)}
                      disabled={saving}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      onClick={handleAddCustomVar}
                      disabled={saving || !newVarKey || !newVarValue}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                    >
                      <Save className="h-4 w-4 mr-1" aria-hidden="true" />
                      Add Variable
                    </Button>
                  </div>
                </form>
              )}

              {customVars.length === 0 && !showCustomForm && (
                <div className="text-center py-8" role="status">
                  <Shield className="h-12 w-12 mx-auto text-[var(--color-fg-tertiary)]/50 mb-3" aria-hidden="true" />
                  <p className="text-sm text-[var(--color-fg-tertiary)]">No custom variables defined</p>
                  <p className="text-xs text-[var(--color-fg-tertiary)] mt-1">Click "Add Custom Variable" to create one</p>
                </div>
              )}

              {customVars.length > 0 && (
                <>
                  {virtualized ? (
                    <div
                      ref={listRef}
                      className="max-h-[300px] overflow-y-auto"
                      role="list"
                      aria-label="Custom environment variables"
                    >
                      <div style={{ height: totalHeight, position: "relative" }}>
                        <div style={{ transform: `translateY(${offsetY}px)` }}>
                          {visibleCustomVars.map((v) => (
                            <div
                              key={v.key}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                v.enabled
                                  ? "bg-[var(--color-bg-primary)] border-[var(--color-border-medium)]"
                                  : "bg-[var(--color-bg-tertiary)]/50 border-[var(--color-border-medium)] opacity-60"
                              )}
                              role="listitem"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <dt>
                                  <Badge variant="outline" size="sm" className="flex-shrink-0" aria-label="Custom variable">
                                    {SOURCE_ICONS.custom}
                                    Custom
                                  </Badge>
                                </dt>
                                <dd className="min-w-0">
                                  <code className="font-mono text-sm text-[var(--color-fg-primary)] truncate block">{v.key}</code>
                                  <MaskedValue value={v.value || ""} />
                                </dd>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={v.enabled}
                                  onChange={(enabled) => toggleVar(v.key, v.source, v.enabled)}
                                  ariaLabel={`${v.enabled ? "Disable" : "Enable"} ${v.key}`}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteCustomVar(v.key)}
                                  disabled={saving}
                                  aria-label={`Delete ${v.key}`}
                                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                                >
                                  <Trash2 className="h-4 w-4 text-[var(--color-brand-danger)]" aria-hidden="true" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <dl className="space-y-3" aria-label="Custom environment variables">
                      {customVars.map((v) => (
                        <div
                          key={v.key}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                            v.enabled
                              ? "bg-[var(--color-bg-primary)] border-[var(--color-border-medium)]"
                              : "bg-[var(--color-bg-tertiary)]/50 border-[var(--color-border-medium)] opacity-60"
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <dt>
                              <Badge variant="outline" size="sm" className="flex-shrink-0" aria-label="Custom variable">
                                {SOURCE_ICONS.custom}
                                Custom
                              </Badge>
                            </dt>
                            <dd className="min-w-0">
                              <code className="font-mono text-sm text-[var(--color-fg-primary)] truncate block">{v.key}</code>
                              <MaskedValue value={v.value || ""} />
                            </dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={v.enabled}
                              onChange={(enabled) => toggleVar(v.key, v.source, v.enabled)}
                              ariaLabel={`${v.enabled ? "Disable" : "Enable"} ${v.key}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCustomVar(v.key)}
                              disabled={saving}
                              aria-label={`Delete ${v.key}`}
                              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                            >
                              <Trash2 className="h-4 w-4 text-[var(--color-brand-danger)]" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card variant="outlined">
            <CardContent className="pt-0">
              <dl className="text-sm text-[var(--color-fg-secondary)] space-y-1">
                <div><strong>Total variables:</strong> {allVars.length}</div>
                <div><strong>Enabled:</strong> {enabledVars.length} (will be injected into container)</div>
                <div><strong>Disabled:</strong> {disabledVars.length}</div>
                <div className="mt-2 text-xs text-[var(--color-fg-tertiary)]">
                  Auto-injected credentials (SSH, Git, GitHub) are configured globally and injected automatically when the environment starts.
                  Custom variables are stored per-environment and persisted to the database.
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </Dialog>
    </FocusTrap>
  );
}
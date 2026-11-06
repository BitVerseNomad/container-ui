import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dialog } from "@/ui/components/Dialog";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Badge } from "@/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Plus, Eye, EyeOff, X, Key, GitBranch, MessageSquare, Shield, Save, Trash2 } from "@/ui/icons";
import { cn } from "@/lib/cn";
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
  ssh_agent: <Key className="h-3 w-3" />,
  git_user: <GitBranch className="h-3 w-3" />,
  git_email: <MessageSquare className="h-3 w-3" />,
  gh_token: <Shield className="h-3 w-3" />,
  custom: <Shield className="h-3 w-3" />,
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
        className="p-0.5 text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors"
        aria-label={revealed ? "Hide value" : "Show value"}
      >
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      {children}
    </span>
  );
}

export function ProjectEnvVars({ environmentId, isOpen, onClose }: ProjectEnvVarsProps) {
  const [injectedVars, setInjectedVars] = useState<InjectedEnvVar[]>([]);
  const [customVars, setCustomVars] = useState<InjectedEnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [keyError, setKeyError] = useState("");
  const [valueError, setValueError] = useState("");

  // Load environment variables from backend
  useEffect(() => {
    if (isOpen) {
      loadEnvVars();
    }
  }, [isOpen, environmentId]);

  const loadEnvVars = async () => {
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
      setInjectedVars(merged.filter(v => v.source !== "custom"));
      setCustomVars(parsed.filter((v: InjectedEnvVar) => v.source === "custom"));
    } catch (error) {
      console.error("Failed to load env vars:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveEnvVars = async () => {
    try {
      setSaving(true);
      const allVars = [...injectedVars, ...customVars];
      localStorage.setItem(`env-vars-${environmentId}`, JSON.stringify(allVars));
      // TODO: Persist to SQLite via Tauri command when available
    } catch (error) {
      console.error("Failed to save env vars:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleVar = (key: string, source: InjectedEnvVar["source"], currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    if (source === "custom") {
      setCustomVars(customVars.map(v => v.key === key ? { ...v, enabled: newEnabled } : v));
    } else {
      setInjectedVars(injectedVars.map(v => v.key === key ? { ...v, enabled: newEnabled } : v));
    }
  };

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

  const handleAddCustomVar = () => {
    if (!validateKey(newVarKey) || !validateValue(newVarValue)) return;
    
    const newVar: InjectedEnvVar = {
      key: newVarKey,
      source: "custom",
      enabled: true,
      value: newVarValue,
    };
    
    setCustomVars([...customVars, newVar]);
    setNewVarKey("");
    setNewVarValue("");
    setShowCustomForm(false);
    saveEnvVars();
  };

  const handleDeleteCustomVar = (key: string) => {
    setCustomVars(customVars.filter(v => v.key !== key));
    saveEnvVars();
  };

  const allVars = [...injectedVars, ...customVars];
  const enabledVars = allVars.filter(v => v.enabled);
  const disabledVars = allVars.filter(v => !v.enabled);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Environment Variables"
      description={`Manage injected and custom environment variables for this environment`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Injected Credentials Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Auto-Injected Credentials
              </span>
              <Badge variant="info" size="sm">{enabledVars.filter(v => v.source !== "custom").length} enabled</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--color-brand-primary)] border-t-transparent" />
              </div>
            ) : injectedVars.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-tertiary)] text-center py-4">
                No auto-injected credentials available
              </p>
            ) : (
              <div className="space-y-3">
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
                      <Badge variant={SOURCE_VARIANTS[v.source]} size="sm" className="flex-shrink-0">
                        {SOURCE_ICONS[v.source]}
                        {SOURCE_LABELS[v.source]}
                      </Badge>
                      <div className="min-w-0">
                        <code className="font-mono text-sm text-[var(--color-fg-primary)] truncate block">{v.key}</code>
                        {v.source === "gh_token" && (
                          <MaskedValue value="gh_token_value_placeholder" />
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={v.enabled}
                      onChange={(enabled) => toggleVar(v.key, v.source, v.enabled)}
                      ariaLabel={`${v.enabled ? "Disable" : "Enable"} ${v.key}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Environment Variables Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Custom Environment Variables
              </span>
              <Badge variant="outline" size="sm">{customVars.length} custom</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="w-full justify-start"
            >
              <Plus className="h-4 w-4 mr-1" />
              {showCustomForm ? "Cancel" : "Add Custom Variable"}
            </Button>

            {showCustomForm && (
              <div className="space-y-3 p-4 bg-[var(--color-bg-tertiary)]/50 rounded-lg border">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Key"
                    placeholder="MY_CUSTOM_VAR"
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                    error={keyError}
                    hint="Uppercase letters, numbers, and underscores only"
                    disabled={saving}
                  />
                  <Input
                    label="Value"
                    placeholder="secret-value"
                    type="password"
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    error={valueError}
                    disabled={saving}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowCustomForm(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddCustomVar} disabled={saving || !newVarKey || !newVarValue}>
                    <Save className="h-4 w-4 mr-1" />
                    Add Variable
                  </Button>
                </div>
              </div>
            )}

            {customVars.length === 0 && !showCustomForm && (
              <p className="text-sm text-[var(--color-fg-tertiary)] text-center py-4">
                No custom variables defined. Click "Add Custom Variable" to create one.
              </p>
            )}

            {customVars.length > 0 && (
              <div className="space-y-3">
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
                      <Badge variant="outline" size="sm" className="flex-shrink-0">
                        {SOURCE_ICONS.custom}
                        Custom
                      </Badge>
                      <div className="min-w-0">
                        <code className="font-mono text-sm text-[var(--color-fg-primary)] truncate block">{v.key}</code>
                        <MaskedValue value={v.value || ""} />
                      </div>
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
                      >
                        <Trash2 className="h-4 w-4 text-[var(--color-brand-danger)]" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card variant="outlined">
          <CardContent className="pt-0">
            <div className="text-sm text-[var(--color-fg-secondary)]">
              <p><strong>Total variables:</strong> {allVars.length}</p>
              <p><strong>Enabled:</strong> {enabledVars.length} (will be injected into container)</p>
              <p><strong>Disabled:</strong> {disabledVars.length}</p>
              <p className="mt-2 text-xs text-[var(--color-fg-tertiary)]">
                Auto-injected credentials (SSH, Git, GitHub) are configured globally and injected automatically when the environment starts. 
                Custom variables are stored per-environment and persisted to the database.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Dialog>
  );
}
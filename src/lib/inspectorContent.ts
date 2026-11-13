import type { Finding } from "./doctor.ts";

// What the Inspector (src/ui/op/Inspector.tsx) is given, plus which buttons go under it.
export type InspectorContent = {
  crumb: string;               // "shop / api" or "kafka"
  title: string;               // one sentence: the problem
  lede: string;                // one paragraph in plain words
  evidence?: { text: string; bad?: boolean }[];   // "What it said"; a finding with none passes none
  findings?: string[];         // "What OpenPier found"; a finding with none passes none
  primary: { kind: "fix" | "logs"; label: string };
  also: ("logs" | "shell")[];  // secondary buttons, in this order, without the primary
  command?: string;            // what the fix will run
  level: "bad" | "warn";
};

// project: the Compose project name or null. fixLabel/fixCommand: from fixAction(); null when the app has no fix.
export function inspectorContent(f: Finding, container: string, project: string | null, fixLabel: string | null, fixCommand: string | null): InspectorContent {
  const hasFix = !!fixLabel;
  return {
    crumb: project ? `${project} / ${container}` : container,
    title: f.short ?? f.title,
    lede: f.detail.split("`").join(""),
    primary: hasFix ? { kind: "fix", label: fixLabel } : { kind: "logs", label: "Open logs" },
    also: hasFix ? ["logs", "shell"] : ["shell"],
    command: hasFix && fixCommand ? fixCommand : undefined,
    level: f.level,
  };
}

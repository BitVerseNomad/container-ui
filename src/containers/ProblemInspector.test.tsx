import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ProblemInspector } from "./ProblemInspector";
import type { InspectorContent } from "../lib/inspectorContent";

const content: InspectorContent = {
  crumb: "shop / api",
  title: "Its health check is failing",
  lede: "The container is running but could not be reached on port 8080.",
  evidence: [{ text: "curl: (7) Failed to connect", bad: true }],
  findings: ["The app listens on another port."],
  primary: { kind: "fix", label: "Set PORT to 8080 and restart" },
  also: ["logs", "shell"],
  command: "docker compose up -d api",
  level: "bad",
};

it("given content with a fix, when rendered, then the primary button has the fix label and the secondary buttons are Open logs and Open a shell", () => {
  render(<ProblemInspector content={content} onClose={() => {}} onFix={() => {}} onLogs={() => {}} onShell={() => {}} />);
  expect(screen.getByRole("button", { name: "Set PORT to 8080 and restart" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open logs" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open a shell" })).toBeInTheDocument();
});

it("given content without evidence, when rendered, then the text What it said is absent", () => {
  const noEvidence: InspectorContent = { ...content, evidence: undefined };
  render(<ProblemInspector content={noEvidence} onClose={() => {}} onFix={() => {}} onLogs={() => {}} onShell={() => {}} />);
  expect(screen.queryByText("What it said")).not.toBeInTheDocument();
});

it("given a command, when rendered, then it shows in a code element with a button named Copy the command", () => {
  render(<ProblemInspector content={content} onClose={() => {}} onFix={() => {}} onLogs={() => {}} onShell={() => {}} />);
  expect(screen.getByText("docker compose up -d api")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy the command" })).toBeInTheDocument();
});

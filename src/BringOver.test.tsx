import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// A Docker Desktop with a real shop_db, and a Colima whose shop_db is a 12 MB fresh one that shop-db-1 runs on.
const answer = (cmd: string, a: Record<string, unknown> = {}): unknown => {
  const args = (a.args as string[] | undefined) ?? [];
  if (cmd === "desktop_state") return { installed: true, running: true, disk_bytes: 0 };
  if (cmd === "desktop_docker") return args[0] === "system" ? JSON.stringify({ Volumes: [{ Name: "shop_db", Size: "412MB" }] }) : "";
  if (cmd === "docker") {
    if (args[0] === "system" && args.includes("-v")) return JSON.stringify({ Volumes: [{ Name: "shop_db", Size: "12MB" }] });
    if (args[0] === "ps") return JSON.stringify({ Names: "shop-db-1", Mounts: "shop_db", State: "running" });
    if (args[0] === "inspect") return JSON.stringify([{ Name: "shop_db", Driver: "local", Options: null }]);
    return "";
  }
  if (cmd === "list_profiles") return [];
  // The backend's replace stopped shop-db-1, and it didn't start again.
  if (cmd === "desktop_replace") return { ok: true, bytes: 412e6, colima: "replaced", backup: a.backup, why: "", not_started: ["shop-db-1"] };
  return null;
};
vi.mock("@tauri-apps/api/core", () => ({ invoke: async (cmd: string, a: Record<string, unknown>) => answer(cmd, a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));

import BringOver from "./BringOver";
import { ConfirmProvider } from "./ui";
import { resetAppStopped, stoppedAt } from "./lib/appStopped";

describe("BringOver", () => {
  it("given a replace whose container stays stopped, when it ends, then home knows the app stopped it", async () => {
    resetAppStopped();
    const user = userEvent.setup();
    render(<ConfirmProvider><BringOver ctx="colima" onClose={() => {}} onDone={() => {}} onProfiles={() => {}} /></ConfirmProvider>);
    await user.click(await screen.findByRole("button", { name: /^Bring 1 volume over/ }));
    await user.click(await screen.findByRole("button", { name: /and bring over$/ }));
    await waitFor(() => expect(stoppedAt("colima", ["shop-db-1"])).toBeDefined());
    expect(stoppedAt("colima-work", ["shop-db-1"])).toBeUndefined();
    resetAppStopped();
  });
});

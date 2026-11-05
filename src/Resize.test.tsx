import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => "") }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
const { afterDismiss } = await import("./Resize");

// Home's rows: a Compose project's row starts with its chevron, hidden from screen readers and out of the tab order.
const home = (rows: string[]) => {
  document.body.innerHTML = `<main><h1>Containers</h1><ul class="apps">${rows.map((n) => `<li class="app"><div class="app-row"><button class="chev" tabindex="-1" aria-hidden="true"></button><button class="app-name">${n}</button></div>${n === "shop" ? '<div class="problem result"><div class="resize-status" id="box"></div></div>' : ""}</li>`).join("")}</ul></main>`;
  return document.getElementById("box")!;
};

describe("afterDismiss", () => {
  it("given the next row is a Compose project, when Dismiss is pressed, then focus goes to its name, not its hidden chevron", () => {
    expect(afterDismiss(home(["shop", "kafka"]))?.textContent).toBe("kafka");
  });
  it("given the resized row is the last row, when Dismiss is pressed, then focus goes to that row's own name", () => {
    const to = afterDismiss(home(["kafka", "shop"]));
    expect(to?.className).toBe("app-name");
    expect(to?.textContent).toBe("shop");
  });
  it("given no row and no Doctor head, when Dismiss is pressed, then the page heading takes focus", () => {
    document.body.innerHTML = '<main><h1>Doctor</h1><div class="resize-status" id="box"></div></main>';
    const to = afterDismiss(document.getElementById("box")!);
    expect(to?.tagName).toBe("H1");
    expect(to?.tabIndex).toBe(-1);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { EntryRow, ChildRow, TableHeadRow } from "./ContainerRows";

const entryProps = {
  id: "aaa",
  name: "web",
  meta: "nginx:latest",
  dot: "ok",
  stateWord: "Running",
  ports: [8080],
  stats: "2% · 512 MB",
  history: [2, 3, 5],
  cpuNow: 2,
  action: { label: "Stop", busy: false, locked: false },
  selected: false,
  onSelect: vi.fn(),
  onOpen: vi.fn(),
  onAction: vi.fn(),
  menu: null,
  menuOpen: false,
  onMenuOpenChange: vi.fn(),
  group: false,
};

it("given an entry with two ports, when rendered, then two links :8080 and :9000 show and each opens its URL on click and onOpen does not run", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(<EntryRow {...entryProps} ports={[8080, 9000]} onOpen={onOpen} menu={null} />);
  expect(screen.getByText(":8080")).toBeInTheDocument();
  expect(screen.getByText(":9000")).toBeInTheDocument();
  const row = screen.getByText("web").closest(".row") as HTMLElement;
  await user.click(row);
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it("given three ports, when rendered, then two http links and one copy link show", () => {
  render(<EntryRow {...entryProps} ports={[8080, 9000, 5432]} menu={null} />);
  expect(screen.getByText(":8080")).toBeInTheDocument();
  expect(screen.getByText(":9000")).toBeInTheDocument();
  expect(screen.getByText(":5432")).toBeInTheDocument();
  expect(screen.getByText("+1")).toBeInTheDocument();
});

it("given a database port, when rendered, then it has the label Copy localhost:3306 and click copies localhost:3306 and does not open a URL", async () => {
  const user = userEvent.setup();
  const clipboard = vi.fn();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: clipboard }, configurable: true });
  render(<EntryRow {...entryProps} ports={[3306]} menu={null} />);
  const link = screen.getByRole("link", { name: "Copy localhost:3306" });
  await user.click(link);
  expect(clipboard).toHaveBeenCalledWith("localhost:3306");
});

it("given a group with 7 blocks, when rendered, then the blocks element shows all 7 services and the state text 5 of 7 running", () => {
  const blocks = [{ name: "a", state: "ok", label: "Running" }, { name: "b", state: "ok", label: "Running" }, { name: "c", state: "ok", label: "Running" }, { name: "d", state: "ok", label: "Running" }, { name: "e", state: "ok", label: "Running" }, { name: "f", state: "ok", label: "Running" }, { name: "g", state: "ok", label: "Running" }];
  render(<EntryRow {...entryProps} group={true} open={true} onToggle={vi.fn()} blocks={blocks} runningText="5 of 7 running" name="shop" meta="~/code/shop" />);
  const row = screen.getByText("shop").closest(".row") as HTMLElement;
  const blocksEl = row.querySelector(".blocks");
  expect(blocksEl).not.toBeNull();
  expect((blocksEl as HTMLElement).getAttribute("aria-label")).toContain("7 running");
  expect(screen.getByText("5 of 7 running")).toBeInTheDocument();
});

it("given a group, when the chevron is pressed, then onToggle runs and aria-expanded flips", async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  render(<EntryRow {...entryProps} group={true} open={false} onToggle={onToggle} blocks={[]} runningText="" name="shop" meta="~/code/shop" />);
  const row = screen.getByText("shop").closest(".row") as HTMLElement;
  await user.click(row.querySelector('[aria-label="Unfold shop"]') as HTMLElement);
  expect(onToggle).toHaveBeenCalledTimes(1);
});

it("given an action button, when pressed, then onAction runs once", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<EntryRow {...entryProps} action={{ label: "Stop", busy: false, locked: false }} onAction={onAction} menu={null} />);
  await user.click(screen.getByRole("button", { name: "Stop web" }));
  expect(onAction).toHaveBeenCalledTimes(1);
});

it("given a menu, when rendered, then the menu items show inside the row", () => {
  const menuItems = [<div key="m">Logs</div>];
  render(<EntryRow {...entryProps} menu={menuItems} onOpen={vi.fn()} />);
  expect(screen.getByText("Logs")).toBeInTheDocument();
});

it("given onSelect and the row is focused, when rendered, then a checkbox shows in place of the dot", () => {
  render(<EntryRow {...entryProps} onSelect={vi.fn()} menu={null} />);
  const row = screen.getByText("web").closest(".row") as HTMLElement;
  fireEvent.focus(row);
  expect(row.querySelector('input[type="checkbox"]')).not.toBeNull();
  expect(row.querySelector(".dot")).toBeNull();
});

it("given a group with onSelect, then the checkbox takes the place of its dot and the chevron stays", () => {
  const onToggle = vi.fn();
  render(<EntryRow {...entryProps} group={true} open={false} onToggle={onToggle} blocks={[]} runningText="" name="shop" meta="~/code/shop" onSelect={vi.fn()} />);
  const row = screen.getByText("shop").closest(".row") as HTMLElement;
  fireEvent.focus(row);
  expect(row.querySelector('input[type="checkbox"]')).not.toBeNull();
  expect(row.querySelector('[aria-expanded="false"]')).not.toBeNull();
});

it("given onSelect is null, then none shows", () => {
  render(<EntryRow {...entryProps} onSelect={null} menu={null} />);
  const row = screen.getByText("web").closest(".row") as HTMLElement;
  expect(row.querySelector('input[type="checkbox"]')).toBeNull();
});

it("given busy true, when rendered, then the action button has aria-busy true and a click does not call onAction", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<EntryRow {...entryProps} action={{ label: "Stop", busy: true, locked: false }} onAction={onAction} menu={null} />);
  const btn = screen.getByRole("button", { name: "Stop web" });
  expect(btn).toHaveAttribute("aria-busy", "true");
  await user.click(btn);
  expect(onAction).not.toHaveBeenCalled();
});

it("given a stopped container, when rendered, then the stats cell is empty and there is no sparkline", () => {
  render(<EntryRow {...entryProps} stateWord="Stopped" stats="" history={[]} menu={null} />);
  expect(screen.getByText("Stopped")).toBeInTheDocument();
  expect(screen.queryByRole("graphics-document")).toBeNull();
});

it("given a running container with 5 history points, when rendered, then one svg.spark with the name CPU 4 percent shows", () => {
  render(<EntryRow {...entryProps} history={[2, 3, 5, 4, 6]} cpuNow={4} menu={null} />);
  const svg = screen.getByRole("img", { name: "CPU 4 percent" });
  expect(svg).toBeInTheDocument();
});

it("given TableHeadRow, when rendered, then the cell texts are Name, Image or folder, Ports, CPU, 10 min, Now, State", () => {
  render(<TableHeadRow />);
  expect(screen.getByText("Name")).toBeInTheDocument();
  expect(screen.getByText("Image or folder")).toBeInTheDocument();
  expect(screen.getByText("Ports")).toBeInTheDocument();
  expect(screen.getByText("CPU, 10 min")).toBeInTheDocument();
  expect(screen.getByText("Now")).toBeInTheDocument();
  expect(screen.getByText("State")).toBeInTheDocument();
});

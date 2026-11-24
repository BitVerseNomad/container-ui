import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Shell from "./Shell";
import { Sheet, Button } from "./ui/op";
import { TooltipProvider } from "./ui/op";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

function Harness(props: { children?: React.ReactNode; shellProps?: Partial<React.ComponentProps<typeof Shell>> }) {
  const { children, shellProps = {} } = props;
  return (
    <TooltipProvider>
      <Shell nav="Containers" onNav={() => {}} onSettings={() => {}} settingsActive={false} onActivity={() => {}} onHelp={() => {}} engine={<span data-testid="engine" />} {...shellProps}>
        {children}
      </Shell>
    </TooltipProvider>
  );
}

describe("Shell", () => {
  it("Given badges Doctor 2, when the shell renders, then the Doctor item has a count with the label '2 need action'", () => {
    render(<Harness shellProps={{ badges: { Doctor: 2 } }} />);
    const doctor = screen.getByRole("link", { name: /Doctor/ });
    expect(doctor.querySelector(".count")).toHaveAttribute("aria-label", "2 need action");
  });

  it("Given badges Doctor 0, when rendered, then there is no count", () => {
    render(<Harness shellProps={{ badges: { Doctor: 0 } }} />);
    const doctor = screen.getByRole("link", { name: /Doctor/ });
    expect(doctor.querySelector(".count")).not.toBeInTheDocument();
  });

  it("Given hidden ['Kubernetes'], when rendered, then there is no Kubernetes item", () => {
    render(<Harness shellProps={{ hidden: ["Kubernetes"] }} />);
    expect(screen.queryByRole("link", { name: /Kubernetes/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Containers/ })).toBeInTheDocument();
  });

  it("Given nav 'Images', when rendered, then only the Images item has aria-current 'page'", () => {
    render(<Harness shellProps={{ nav: "Images" }} />);
    expect(screen.getByRole("link", { name: /Images/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Containers/ })).not.toHaveAttribute("aria-current", "page");
  });

  it("Given the Fold sidebar button is pressed, when pressed, then localStorage 'container-ui:sidebar-folded' is '1' and the button is labelled 'Show the sidebar'", () => {
    render(<Harness />);
    const fold = screen.getByRole("button", { name: /Fold sidebar/ });
    fireEvent.click(fold);
    expect(window.localStorage.getItem("container-ui:sidebar-folded")).toBe("1");
    expect(fold).toHaveAttribute("aria-label", "Show the sidebar");
  });

  it("Given the shell renders, then there is no item named Profiles and none named Projects", () => {
    render(<Harness />);
    expect(screen.queryByRole("link", { name: /Profiles/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Projects/ })).not.toBeInTheDocument();
  });

  it("Given settingsActive true, when rendered, then the Settings button has aria-current 'page'", () => {
    render(<Harness shellProps={{ settingsActive: true }} />);
    expect(screen.getByRole("button", { name: /Settings/ })).toHaveAttribute("aria-current", "page");
  });

  it("Given settingsActive false, when rendered, then the Settings button has no aria-current", () => {
    render(<Harness shellProps={{ settingsActive: false }} />);
    expect(screen.getByRole("button", { name: /Settings/ })).not.toHaveAttribute("aria-current");
  });

  it("Given counts containers 10, when rendered, then the Containers item shows the count 10", () => {
    render(<Harness shellProps={{ counts: { containers: 10 } }} />);
    const containers = screen.getByRole("link", { name: /Containers/ });
    expect(containers.querySelector(".count")).toHaveAttribute("aria-label", "10 need action");
  });

  it("Given the shell renders with an engine slot, then the foot has buttons named Settings, Activity: commands the app ran, Help and shortcuts and Fold sidebar", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: /Settings/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Activity: commands the app ran/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Help and shortcuts/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fold sidebar/ })).toBeInTheDocument();
  });

  it("Given the shell with a child that opens a Sheet, when it is open, then the element with class sheet is inside main.main", () => {
    function Example() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>open</Button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Test">
            <p>hi</p>
          </Sheet>
        </>
      );
    }
    render(
      <TooltipProvider>
        <Shell nav="Containers" onNav={() => {}} onSettings={() => {}} settingsActive={false} onActivity={() => {}} onHelp={() => {}} engine={<span data-testid="engine" />}>
          <Example />
        </Shell>
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /open/ }));
    const sheet = document.querySelector(".sheet");
    const main = document.querySelector(".main");
    expect(sheet).not.toBeNull();
    expect(main?.contains(sheet!)).toBe(true);
  });
});

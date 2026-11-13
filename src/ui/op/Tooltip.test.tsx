import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Tooltip, TooltipProvider } from "./Tooltip";

it("given a button inside, when it gets focus, then a tooltip with the text appears", async () => {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <Tooltip text="Copy the command">
        <button>Copy</button>
      </Tooltip>
    </TooltipProvider>,
  );
  await user.tab();
  const tooltip = await screen.findByRole("tooltip", undefined, { timeout: 2000 });
  expect(tooltip).toHaveTextContent("Copy the command");
});

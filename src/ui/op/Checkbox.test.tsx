import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

it("given unchecked, when its text is clicked, then onChange is called with true", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Checkbox checked={false} onChange={onChange}>Show stopped</Checkbox>);
  await user.click(screen.getByText("Show stopped"));
  expect(onChange).toHaveBeenCalledWith(true);
});

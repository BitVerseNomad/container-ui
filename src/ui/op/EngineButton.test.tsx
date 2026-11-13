import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { EngineButton } from "./EngineButton";

it("given EngineButton with name 'Colima · default' and state 'Running', then it has class engine and shows both texts", () => {
  render(
    <EngineButton dot="ok" name="Colima · default" state="Running · 4 CPU · 8 GB" aria-label="Engine: Colima, default. Running" />,
  );
  const button = screen.getByRole("button", { name: "Engine: Colima, default. Running" });
  expect(button).toHaveClass("engine");
  expect(screen.getByText("Colima · default")).toBeInTheDocument();
  expect(screen.getByText("Running · 4 CPU · 8 GB")).toBeInTheDocument();
});

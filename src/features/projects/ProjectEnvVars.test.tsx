import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProjectEnvVars } from "./ProjectEnvVars";
import { vi } from "vitest";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("ProjectEnvVars", () => {
  const defaultProps = {
    environmentId: "test-env-1",
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(<ProjectEnvVars {...defaultProps} {...props} />);
  };

  describe("Rendering", () => {
    it("renders injected vars with correct source badges", () => {
      renderComponent();
      
      // Check SSH Agent badge
      expect(screen.getAllByText(/SSH Agent/)).toHaveLength(1);
      expect(screen.getByText("SSH_AUTH_SOCK")).toBeInTheDocument();
      
      // Check Git User badge (appears twice for AUTHOR and COMMITTER)
      expect(screen.getAllByText(/Git User/)).toHaveLength(2);
      expect(screen.getByText("GIT_AUTHOR_NAME")).toBeInTheDocument();
      expect(screen.getByText("GIT_COMMITTER_NAME")).toBeInTheDocument();
      
      // Check Git Email badge (appears twice)
      expect(screen.getAllByText(/Git Email/)).toHaveLength(2);
      expect(screen.getByText("GIT_AUTHOR_EMAIL")).toBeInTheDocument();
      expect(screen.getByText("GIT_COMMITTER_EMAIL")).toBeInTheDocument();
      
      // Check GitHub Token badge (appears twice for GH_TOKEN and GITHUB_TOKEN)
      expect(screen.getAllByText(/GitHub Token/)).toHaveLength(2);
      expect(screen.getByText("GH_TOKEN")).toBeInTheDocument();
      expect(screen.getByText("GITHUB_TOKEN")).toBeInTheDocument();
    });

    it("shows correct badge variants for each source", () => {
      renderComponent();
      
      // SSH Agent badge should have info variant (blue) - includes opacity /15
      const sshBadgeText = screen.getByText(/SSH Agent/);
      const sshBadge = sshBadgeText.closest("span[class*='inline-flex']");
      expect(sshBadge).toHaveClass("bg-[var(--color-brand-info)]/15");
      
      // GitHub Token badge should have warning variant (yellow/orange)
      const ghBadgeTexts = screen.getAllByText(/GitHub Token/);
      const ghBadge = ghBadgeTexts[0].closest("span[class*='inline-flex']");
      expect(ghBadge).toHaveClass("bg-[var(--color-brand-warning)]/15");
    });
  });

  describe("Toggle switches", () => {
    it("toggle disables/enables var", async () => {
      renderComponent();
      
      // Find all toggle switches (role="switch")
      const toggles = screen.getAllByRole("switch");
      expect(toggles.length).toBeGreaterThanOrEqual(7); // 7 injected vars
      
      const sshToggle = toggles[0];
      expect(sshToggle).toHaveAttribute("aria-checked", "true");
      
      // Click to disable
      fireEvent.click(sshToggle);
      await waitFor(() => {
        expect(sshToggle).toHaveAttribute("aria-checked", "false");
      });
      
      // Click to enable again
      fireEvent.click(sshToggle);
      await waitFor(() => {
        expect(sshToggle).toHaveAttribute("aria-checked", "true");
      });
    });

    it("persists toggle state to localStorage", async () => {
      renderComponent();
      
      const toggles = screen.getAllByRole("switch");
      const sshToggle = toggles[0];
      
      // Disable SSH_AUTH_SOCK
      fireEvent.click(sshToggle);
      await waitFor(() => {
        expect(sshToggle).toHaveAttribute("aria-checked", "false");
      });
      
      // Re-render component
      const { unmount } = renderComponent();
      unmount();
      renderComponent();
      
      // Check that state is persisted
      const newToggles = screen.getAllByRole("switch");
      expect(newToggles[0]).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Custom variables", () => {
    it("shows add custom variable form when button clicked", () => {
      renderComponent();
      
      expect(screen.queryByLabelText("Key")).not.toBeInTheDocument();
      
      // Use role=button to avoid matching the text in the empty state message
      fireEvent.click(screen.getByRole("button", { name: /Add Custom Variable/ }));
      
      expect(screen.getByLabelText("Key")).toBeInTheDocument();
      expect(screen.getByLabelText("Value")).toBeInTheDocument();
    });

    it("add variable button is disabled when form is empty", () => {
      renderComponent();
      
      fireEvent.click(screen.getByRole("button", { name: /Add Custom Variable/ }));
      
      // Add Variable button should be disabled when form is empty
      expect(screen.getByRole("button", { name: /add variable/i })).toBeDisabled();
      
      // Fill in key
      fireEvent.change(screen.getByLabelText("Key"), { target: { value: "MY_VAR" } });
      expect(screen.getByRole("button", { name: /add variable/i })).toBeDisabled();
      
      // Fill in value
      fireEvent.change(screen.getByLabelText("Value"), { target: { value: "my-value" } });
      expect(screen.getByRole("button", { name: /add variable/i })).not.toBeDisabled();
    });

    it("adds custom variable to list", async () => {
      renderComponent();
      
      fireEvent.click(screen.getByRole("button", { name: /Add Custom Variable/ }));
      fireEvent.change(screen.getByLabelText("Key"), { target: { value: "MY_CUSTOM_VAR" } });
      fireEvent.change(screen.getByLabelText("Value"), { target: { value: "secret-value" } });
      fireEvent.click(screen.getByRole("button", { name: /add variable/i }));
      
      await waitFor(() => {
        expect(screen.getByText("MY_CUSTOM_VAR")).toBeInTheDocument();
        // Check for the custom badge (outline variant)
        const customBadges = screen.getAllByText(/Custom/);
        // Should have "Custom Environment Variables" header + "Custom" badge for the new var
        expect(customBadges.length).toBeGreaterThanOrEqual(2);
      });
      
      // Form should close after adding
      expect(screen.queryByLabelText("Key")).not.toBeInTheDocument();
    });

    it("allows deleting custom variable", async () => {
      // Pre-populate with a custom var
      localStorageMock.setItem("env-vars-test-env-1", JSON.stringify([
        { key: "EXISTING_VAR", source: "custom", enabled: true, value: "existing-value" }
      ]));
      
      renderComponent();
      
      expect(screen.getByText("EXISTING_VAR")).toBeInTheDocument();
      
      // Click delete button
      fireEvent.click(screen.getByRole("button", { name: /delete EXISTING_VAR/i }));
      
      await waitFor(() => {
        expect(screen.queryByText("EXISTING_VAR")).not.toBeInTheDocument();
      });
    });
  });

  describe("Masked values", () => {
    it("masked values show •••• with reveal on click", () => {
      // Pre-populate with a custom var
      localStorageMock.setItem("env-vars-test-env-1", JSON.stringify([
        { key: "SECRET_TOKEN", source: "custom", enabled: true, value: "ghp_abcdefghijklmnop" }
      ]));
      
      renderComponent();
      
      // Find reveal buttons (there are multiple for injected vars + custom)
      const revealButtons = screen.getAllByLabelText(/Show value/);
      expect(revealButtons.length).toBeGreaterThan(0);
      
      // Click to reveal the last one (custom var)
      fireEvent.click(revealButtons[revealButtons.length - 1]);
      
      expect(screen.getByText("ghp_abcdefghijklmnop")).toBeInTheDocument();
      
      // Click to hide again
      const hideButton = screen.getByLabelText(/Hide value/);
      fireEvent.click(hideButton);
      
      // Should show masked again (multiple masked values exist)
      const maskedValues = screen.getAllByText(/••••/);
      expect(maskedValues.length).toBeGreaterThan(0);
    });
  });

  describe("Summary section", () => {
    it("shows correct counts", () => {
      renderComponent();
      
      // Summary text is in the last card - find by the descriptive text
      const summaryCard = screen.getByText(/Auto-injected credentials/).closest("div[class*='rounded-xl']");
      expect(summaryCard).toBeInTheDocument();
      
      // The counts are in the same card - check for text content
      expect(summaryCard).toHaveTextContent(/Total variables: 7/);
      expect(summaryCard).toHaveTextContent(/Enabled: 7/);
      expect(summaryCard).toHaveTextContent(/Disabled: 0/);
    });

    it("updates counts when toggling", async () => {
      renderComponent();
      
      const toggles = screen.getAllByRole("switch");
      fireEvent.click(toggles[0]); // Disable SSH_AUTH_SOCK
      
      await waitFor(() => {
        const summaryCard = screen.getByText(/Auto-injected credentials/).closest("div[class*='rounded-xl']");
        expect(summaryCard).toHaveTextContent(/Enabled: 6/);
        expect(summaryCard).toHaveTextContent(/Disabled: 1/);
      });
    });
  });
});
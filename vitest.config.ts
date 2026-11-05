// Component tests (*.test.tsx) render real screens in jsdom with a fake backend.
// Pure logic tests (*.test.ts) stay on node --test; see "test" in package.json.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", include: ["src/**/*.test.tsx"], setupFiles: ["src/test/setup.ts"] },
});

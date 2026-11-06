// Component tests (*.test.tsx) render real screens in jsdom with a fake backend.
// Pure logic tests (*.test.ts) stay on node --test; see "test" in package.json.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@ui": path.resolve(__dirname, "./src/ui"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
  },
  test: { 
    environment: "jsdom", 
    include: ["src/**/*.test.tsx"], 
    setupFiles: ["src/test/setup.ts"],
    globals: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@ui": path.resolve(__dirname, "./src/ui"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
  },
});

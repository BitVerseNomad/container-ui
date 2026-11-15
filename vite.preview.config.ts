// The browser preview: the real UI with preview/mock.ts standing in for the Rust backend.
// Usage: npm run preview, then open http://localhost:4173/?scenario=running
import { defineConfig, mergeConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import base from "./vite.config";

const mock = path.resolve(__dirname, "./preview/mock.ts");

export default mergeConfig(
  base,
  defineConfig({
    server: { port: 4173, strictPort: true },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@tauri-apps/api/core": mock,
        "@tauri-apps/api/event": mock,
      },
    },
    build: { outDir: "preview/dist", emptyOutDir: true },
  }),
);